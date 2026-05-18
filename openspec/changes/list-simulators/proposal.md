## Why

Queremos que `lazyswift` se sienta como lazygit: navegación rápida y “one glance” sobre el estado del entorno. Hoy podemos listar schemes, pero falta el otro insumo clave para build/test/run: saber qué simuladores (devices) están disponibles y cuál está seleccionado.

## What Changes

- Agregar listado de **Simulators** disponibles usando `xcrun simctl list -j devices available`.
- Renderizar simuladores **agrupados por runtime** (ej. iOS 26.1, iOS 18.0) con navegación **continua** (↑↓) entre grupos.
- Resaltar el simulador seleccionado con marcador `>` y color/estilo (ej. `cyan` / `inverse`) para que sea obvio.
- Mantener “Devices físicos” fuera de alcance por ahora (podrá sumarse luego).

## Capabilities

### New Capabilities
- `simulators-list`: Descubrir y presentar simuladores disponibles (agrupados por runtime) y permitir seleccionar uno.

### Modified Capabilities
- (none)

## Impact

- Nuevo módulo de integración con herramientas de Apple (`xcrun simctl`) y parsing de JSON.
- Cambios de UI y estado en `Ink` para soportar panel “Simulators” con selección y highlight.
- Base para acciones futuras (boot/shutdown, build/test apuntando a un simulator seleccionado).

