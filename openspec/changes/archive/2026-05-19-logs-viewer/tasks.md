## 1. Modelo de logs estructurado

- [x] 1.1 Introducir tipo `LogEntry` (ts/source/level/message) y cambiar el estado de logs a `LogEntry[]` (con buffer máximo configurable)
- [x] 1.2 Implementar heurística de parsing desde líneas actuales (prefijos `[xcodebuild]`, `[simctl]`, `[open]`, etc.) → `source`, y detección básica de `level` (error/warn/info)
- [x] 1.3 Actualizar el runner/IO para poder agregar logs como `LogEntry` sin perder compatibilidad (helper `addLog` que acepte string y lo convierta)

## 2. Viewer mode (foco/expand)

- [x] 2.1 Agregar `viewMode = 'main' | 'logs'` y keybinding `L` (toggle) + `Esc` (volver a main)
- [x] 2.2 Implementar layout full-screen para logs viewer (header con hints + área de contenido virtualizada)
- [x] 2.3 Implementar scrollback en viewer (↑↓) con estado de scroll y ventana visible (virtualización)

## 3. Follow mode

- [x] 3.1 Agregar estado `isFollowing` (default true) y actualizarlo al scrollear hacia arriba (deshabilitar)
- [x] 3.2 Implementar “jump to end” (End o `G`) que pinnee al final y reactive `isFollowing`
- [x] 3.3 Asegurar que en follow mode el viewer se mantenga en el tail cuando llegan nuevos logs

## 4. Filter mode

- [x] 4.1 Agregar `isFilterMode` + `filterQuery` y keybinding `/` para entrar a modo input
- [x] 4.2 Implementar captura de texto en filter mode (caracteres, backspace, `Esc` para salir) y render de `Filter: <query>` en el header
- [x] 4.3 Implementar filtrado case-insensitive sobre `message` (y opcional `source:`/`level:` básico si entra fácil)

## 5. Formato y colores

- [x] 5.1 Renderizar cada línea con “tag” de source coloreado y estilo por severity (error=rojo, warn=amarillo, info=dim)
- [x] 5.2 Configurar wrap/truncate: main view compacto usa `truncate-end`; viewer usa `wrap` o `truncate-end` según performance/legibilidad

## 6. Smoke check manual

- [x] 6.1 Ejecutar `lazyswift`, correr acciones para generar logs, abrir viewer con `L`, scrollear y volver con `Esc`
- [x] 6.2 Probar filtro `/` con queries simples y verificar que el viewer muestra solo matches

