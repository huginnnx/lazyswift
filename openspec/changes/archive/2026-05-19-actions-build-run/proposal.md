## Why

Hoy `lazyswift` permite elegir contenedor (workspace/proyecto), listar schemes y elegir un simulador, pero el panel **Actions** no ejecuta nada. Para que la TUI se sienta como lazygit, necesitamos poder disparar acciones comunes (al menos **Build** y **Build & Run**) usando el **scheme** y **simulador** seleccionados, con feedback inmediato en logs.

## What Changes

- Agregar un panel **Actions** navegable (↑↓) con ejecución por Enter.
- Persistir la selección de **scheme** (igual que hoy ya se persiste `selectedSimulatorUdid`).
- Implementar ejecución de acciones:
  - **Build**: correr `xcodebuild build` apuntando al contenedor + scheme + destino (simulador UDID).
  - **Build & Run**: boot del simulador si hace falta, build, instalación de la app y launch en el simulador.
- Mostrar estado de cada acción (habilitada/deshabilitada) según el “contexto activo” (container/scheme/simulator).
- Stream de salida (stdout/stderr) a **Logs** y reporte claro de errores (exit code, comando, etc.).

## Capabilities

### New Capabilities
- `xcode-actions`: Permite seleccionar y ejecutar acciones de Xcode (Build, Build & Run) usando el contenedor/scheme/simulador seleccionados, con estado (enabled/disabled) y logs en tiempo real.

### Modified Capabilities

<!-- none -->

## Impact

- UI/state en `src/cli.tsx`: nuevo foco/navegación para el panel Actions, y estado persistente para scheme + acción seleccionada + ejecución en curso.
- Nuevos módulos de integración con herramientas de Apple:
  - `xcodebuild` para build
  - `xcrun simctl` para boot/install/launch (y potencialmente utilidades futuras)
- Manejo de procesos con streaming (execa) y cuidados de UX (cancelación, errores, logs acotados).
