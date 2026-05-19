## Why

Hoy `lazyswift` muestra logs solo como “tail” en un panel fijo: no se puede hacer foco, expandir para inspeccionar, scrollear historial ni filtrar. A medida que agregamos acciones (xcodebuild/simctl), los logs son la principal herramienta de diagnóstico; necesitamos una experiencia tipo “viewer” que permita entender qué pasó rápido.

## What Changes

- Agregar un **Logs viewer** con modo de foco (full-screen) para inspección.
- Incorporar **scrollback** (historial navegable) y modo **follow** (quedarse pegado al final mientras corre una acción).
- Agregar **filtro interactivo** (ej. tecla `/`) para buscar por texto y/o por fuente (xcodebuild/simctl/app).
- Normalizar logs a un modelo estructurado (timestamp/source/level/message) y renderizar con **formato y colores**.
- Mantener el panel Logs actual como vista compacta (tail) dentro del layout principal.

## Capabilities

### New Capabilities
- `logs-viewer`: Visualización de logs con foco/expand, scrollback+follow, filtro, y formato/colores por fuente y severidad.

### Modified Capabilities

<!-- none -->

## Impact

- UI/state en `src/cli.tsx`: nuevo view mode (main vs logs), estado de scroll/follow y modo filtro.
- Refactor del buffer de logs: pasar de `string[]` a `LogEntry[]` con parsing de prefijos y colores.
- Ajustes en el runner de comandos para emitir logs estructurados (sin romper el output actual).
