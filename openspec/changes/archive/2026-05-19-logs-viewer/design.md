## Context

`lazyswift` es una TUI en Ink. Hoy los logs son un panel fijo al pie que muestra solo el “tail” (últimas líneas) sin foco, sin scrollback, sin filtro y sin formateo. Con acciones como `xcodebuild` y `simctl`, los logs pasan a ser el principal mecanismo de debugging, por lo que necesitamos una experiencia de visualización comparable a lazygit: poder “entrar” a los logs, navegar historial, filtrar y distinguir fuentes/errores visualmente.

Constraints:

- Debe funcionar en terminal (Ink), sin dependencias pesadas.
- El render debe mantenerse performante aun con muchos logs (virtualización simple).
- El input debe soportar modos (main vs viewer) y un sub-modo de captura de texto (filtro).

## Goals / Non-Goals

**Goals:**

- Incorporar un **modo Logs viewer** (full-screen) que se abre/cierra desde la UI.
- Scrollback navegable (↑↓) y toggle **follow** (pegado al final mientras llegan logs).
- Filtro interactivo (tecla `/`) con captura de texto, backspace, escape para salir/limpiar.
- Modelo de logs estructurado (`LogEntry`) con `source`/`level` para aplicar colores/estilos consistentes.
- Mantener el panel Logs en main view como vista compacta (tail), pero con formato.

**Non-Goals:**

- Persistir logs entre ejecuciones.
- Búsqueda avanzada con regex, highlight múltiple, o queries complejas.
- Exportar logs a archivo / compartir.
- Integración con pagers externos tipo `less`.

## Decisions

- **View mode explícito**: `viewMode = 'main' | 'logs'`.
  - *Rationale*: simplifica UX: `L` abre/cierra viewer full-screen; evita pelear con layout variable.
  - *Alternativas*: hacer Logs un panel más en Tab (4 paneles). Útil, pero agrega complejidad de layout y no da “foco real” tan claro.

- **Scroll model basado en “cursor de ventana”**:
  - Estado `logsScrollOffset` (0 = follow/end; >0 = N líneas desde el final) o estado `logsSelectedIndex` absoluto.
  - *Rationale*: fácil de implementar con virtualización como ya se hace para lists (window start/end).

- **Follow toggle**:
  - Estado `isFollowing` (true por default). Si el usuario scrollea hacia arriba, se apaga.
  - `End` / `G` vuelve al final y reactiva follow.

- **Filter mode inline**:
  - Estado `isFilterMode` + `filterQuery`.
  - Mientras `isFilterMode`, el input de teclado se interpreta como texto (y flechas quedan deshabilitadas o limitadas).
  - Renderizar una línea de UI: `Filter: <query>` en el header del viewer (y opcionalmente en main view).
  - *Alternativas*: traer un componente de input (ink-ui / ink-text-input). Se puede sumar luego, pero inicialmente se puede implementar con `useInput` y estado local.

- **LogEntry estructurado**:
  - `LogEntry = { ts: number; source: 'xcodebuild'|'simctl'|'open'|'app'|'unknown'; level: 'info'|'warn'|'error'; message: string }`
  - El runner de comandos puede seguir emitiendo líneas, pero el `addLog` de la app se vuelve `addLogEntry`, y se provee un helper para mapear strings → LogEntry.
  - *Rationale*: permite colores por fuente/nivel y filtros por `source`/`level` sin parsing repetido.

- **Colores y estilos**:
  - `source` como “tag” coloreado (p.ej. xcodebuild=cian, simctl=magenta, open=amarillo).
  - `level`: error=rojo, warn=amarillo, info=dim.
  - `wrap`:
    - main view: `wrap="truncate-end"` para no romper layout
    - viewer: `wrap="wrap"` para legibilidad

- **Buffer limitado**:
  - Mantener un máximo (p.ej. 2000 entradas) para evitar crecer indefinidamente.
  - *Rationale*: estabilidad/performance en sesiones largas.

## Risks / Trade-offs

- **Muchos logs** → *Mitigación*: buffer máximo + render virtualizado (window) + follow por default.
- **Filtro bloquea navegación** → *Mitigación*: indicador claro de modo filtro y keybinding `Esc` para salir.
- **Parsing de source/level imperfecto** → *Mitigación*: fallback `unknown` y heurísticas simples (prefijos `[xcodebuild]`, etc; `error` si contiene “error:” o “failed”).
- **Wrap en viewer cambia el número de líneas visibles** → *Mitigación*: al inicio mantener cada entry como una línea (sin wrap) o wrap solo el mensaje; iterar luego si hace falta.

