## Context

`lazyswift` es una TUI en Node.js/TypeScript con Ink, orientada a proyectos Swift/Xcode. Ya existe un panel “Schemes” que detecta `.xcworkspace`/`.xcodeproj` y lista schemes usando `xcodebuild -list -json`.

Para poder ejecutar acciones (build/test/run) en un flujo similar a lazygit, necesitamos descubrir los simuladores disponibles y seleccionar uno de forma rápida.

Restricciones / supuestos:

- macOS (herramientas `xcrun` / CoreSimulator).
- Preferimos fuentes **JSON** para evitar parsing frágil.
- El panel debe ser usable con teclado (↑↓, Tab, Enter).

## Goals / Non-Goals

**Goals:**

- Obtener simuladores disponibles usando `xcrun simctl list -j devices available`.
- Presentar el listado agrupado por runtime (ej. iOS 26.1, iOS 18.0).
- Navegación continua (↑↓) a través de todos los simuladores (ignorando headers).
- Selección visible: el ítem seleccionado debe estar resaltado (marker `>` + color/estilo) y el panel debe reflejar el foco.
- Mantener un estado de “simulador seleccionado” para acciones futuras.

**Non-Goals:**

- Listar/gestionar dispositivos físicos conectados (podrá agregarse luego con `xctrace` u otra fuente).
- Boot/Shutdown/Install/Launch (no en este change).
- Filtro/búsqueda incremental o fuzzy-find.
- Persistencia del simulador seleccionado entre ejecuciones.

## Decisions

- **Fuente de datos**: `xcrun simctl list -j devices available`.
  - *Rationale*: JSON estable, ya viene agrupado por runtime; expone `state`, `udid`, `name`, `logPath`, etc.
  - *Alternativas*: `xcrun xctrace list devices` (texto), `simctl list devices` (texto). Se descartan por parsing frágil o por mezclar devices físicos/simuladores sin estructura.

- **Modelo de vista**: construir una estructura “agrupada” para render (headers por runtime) y una lista “aplanada” solo de ítems seleccionables para navegación.
  - *Rationale*: permite navegación continua sin que los headers rompan el índice.

- **Estilo de selección**: `>` + `color="cyan"` y/o `inverse` para el ítem seleccionado, y borde del panel en `cyan` cuando tiene foco.
  - *Rationale*: consistente con el panel “Schemes” y con el look&feel de lazygit.

- **Errores y entornos no interactivos**: si no hay TTY/raw mode, se debe seguir renderizando (sin input) y reportar en logs.
  - *Rationale*: evita crashes en CI/no-TTY y mantiene feedback visible.

## Risks / Trade-offs

- **Riesgo**: el JSON de `simctl` puede variar entre versiones de Xcode.
  - **Mitigación**: tolerar campos extra/ausentes; enfocarse en `name`, `udid`, `state`, `isAvailable`.

- **Riesgo**: runtimes vienen como IDs (ej. `com.apple.CoreSimulator.SimRuntime.iOS-26-1`), poco amigables.
  - **Mitigación**: derivar label humano (parsear `iOS-26-1` → `iOS 26.1`), manteniendo fallback al string original.

- **Trade-off**: sin filtro/búsqueda, la lista puede ser larga.
  - **Mitigación**: grouping por runtime y navegación rápida; dejar filtro como mejora posterior.

