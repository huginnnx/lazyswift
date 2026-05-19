## Context

`lazyswift` es una TUI (Ink) para proyectos Swift/Xcode. Hoy:

- Detecta contenedores `.xcworkspace`/`.xcodeproj` y lista schemes via `xcodebuild -list -json`.
- Lista simuladores disponibles via `xcrun simctl list -j devices available` y permite elegir un device (persistido como UDID en memoria).
- Tiene un panel **Actions** placeholder, sin navegación ni ejecución.

Queremos incorporar ejecución de acciones (primero **Build** y **Build & Run**) usando el **scheme** y **simulador** seleccionados, con logs en tiempo real y UX estilo lazygit.

Constraints:

- macOS (dependencia en `xcodebuild` y `xcrun`).
- Preferimos fuentes JSON cuando existan, pero no todas las salidas relevantes de `xcodebuild`/DerivedData son JSON.
- La UI debe mantenerse fluida: acciones largas deben stream-ear logs, y no bloquear el input principal más de lo necesario.

## Goals / Non-Goals

**Goals:**

- Panel **Actions** con lista de acciones, navegación (↑↓), y ejecución con Enter.
- Definir un “contexto activo” consistente: contenedor + scheme + simulador (UDID).
- Implementar **Build** usando `xcodebuild build` con `-destination id=<udid>`.
- Implementar **Build & Run**: boot (si es necesario) + build + localizar `.app` + install + launch en el simulador.
- Streaming de stdout/stderr a Logs, con errores accionables (comando, exit code, output).
- Estado de ejecución visible (ej. “running…”) y prevenir ejecuciones concurrentes.

**Non-Goals:**

- Tests, coverage, y reporting avanzado (se agrega después).
- Gestión completa del simulador (shutdown/erase/clone/etc).
- Persistencia del contexto activo entre ejecuciones de `lazyswift`.
- Soporte para devices físicos.
- Fuzzy search / filtering (schemes, simulators, actions).

## Decisions

- **Modelo de acciones como “registry”** (lista declarativa).
  - *Qué*: definir `ActionId` (`build`, `build_and_run`, …) + `label` + `isEnabled(context)` + `run(context, io)` (runner).
  - *Por qué*: permite sumar `test`, `boot`, `logs` sin reescribir la UI; habilita/inhabilita en base al contexto.
  - *Alternativas*: if/else monolítico dentro del handler de teclado. Se descarta por acoplamiento y crecimiento.

- **Contexto activo explícito**.
  - *Qué*: derivar un objeto `ActiveContext` con:
    - contenedor (`XcodeContainer`)
    - `scheme: string`
    - `simulatorUdid: string`
  - *Por qué*: acciones comparten requisitos; facilita “enabled/disabled” y mensajes de error consistentes.

- **Destino por UDID en `xcodebuild`**.
  - *Qué*: usar `-destination "id=<udid>"`.
  - *Por qué*: evita mapear platform/version (iOS/tvOS/visionOS) y reduce ambigüedades.
  - *Alternativas*: `platform=iOS Simulator,name=...,OS=...` (requiere correlacionar runtime/device).

- **DerivedData controlado para encontrar el `.app` en Build & Run**.
  - *Qué*: usar `-derivedDataPath <path bajo el repo o temp>` y luego buscar `.app` en `Build/Products/*-iphonesimulator/*.app` (o el sufijo correspondiente) y elegir el más reciente.
  - *Por qué*: el output de build no da directamente el path final de la app; controlar DerivedData hace el lookup determinístico.
  - *Alternativas*: parsear `xcodebuild -showBuildSettings` para obtener `TARGET_BUILD_DIR`/`FULL_PRODUCT_NAME`. Útil, pero requiere parsing de texto y varía entre versiones.

- **Boot/install/launch via `xcrun simctl`**.
  - *Qué*: para **Build & Run**:
    - `xcrun simctl bootstatus <udid> -b` (o boot + bootstatus)
    - `xcrun simctl install <udid> <appPath>`
    - `xcrun simctl launch <udid> <bundleId>`
  - *Por qué*: comandos estándar; salida relativamente estable.

- **Bundle ID desde el `.app`**.
  - *Qué*: extraer `CFBundleIdentifier` desde `Info.plist` dentro del `.app` (p.ej. via `plutil -extract CFBundleIdentifier raw -o - Info.plist`).
  - *Por qué*: el bundleId es requerido para `simctl launch` y no es seguro inferirlo del scheme.
  - *Alternativas*: pedir bundleId manual (mala UX) o intentar deducirlo del project settings (complejo).

- **Ejecución serial + streaming**.
  - *Qué*: bloquear la ejecución de nuevas acciones mientras una está corriendo; stream de stdout/stderr a Logs.
  - *Por qué*: simplifica estado y evita carreras (dos builds sobre el mismo DerivedData, etc).
  - *Alternativas*: cola de acciones o concurrencia. Se deja para el futuro.

## Risks / Trade-offs

- **Encontrar la `.app` correcta** (multi-target / schemes que construyen más de una app) → *Mitigación*: elegir la app más reciente dentro de DerivedData y loguear qué app/bundleId se detectó; si hay ambigüedad, mostrar lista para elegir en una mejora.

- **Variaciones entre versiones de Xcode** → *Mitigación*: tolerar fallos con mensajes claros y fallback (ej. si no se puede extraer bundleId, sugerir dónde buscar).

- **Acciones largas generan muchos logs** → *Mitigación*: truncado de logs ya existe (últimas 200 líneas); mantenerlo y marcar inicio/fin de acción.

- **Simulador no bootable / runtime faltante** → *Mitigación*: fallar rápido con el stderr de `simctl` y sugerir “abrí Simulator.app / instalá runtime”.

- **Raw mode/TTY no disponible** → *Mitigación*: mantener output informativo y evitar crash; hoy ya se loguea que el input está deshabilitado.

