## 1. Actions panel UX + estado activo

- [x] 1.1 Agregar estado `selectedScheme` (string | null) y setearlo al presionar Enter en Schemes panel
- [x] 1.2 Mostrar visualmente el scheme activo (sin perder cursor de navegación) y loguear cambios de scheme
- [x] 1.3 Crear estado de Actions panel: lista de acciones + `actionIndex` + `isActionRunning`
- [x] 1.4 Implementar navegación en Actions panel (↑↓) y ejecución (Enter) respetando foco actual (`focus === 'actions'`)
- [x] 1.5 Renderizar acciones con estado enabled/disabled según contexto activo (scheme + simulator UDID) y mostrar hint/log al intentar ejecutar una acción deshabilitada

## 2. Infra de ejecución y streaming de logs

- [x] 2.1 Crear tipo `ActiveContext` (container + scheme + simulatorUdid) y función para derivarlo desde el estado de la UI
- [x] 2.2 Implementar un runner común para comandos (execa) que streamee stdout/stderr a `addLog` e incluya prefix por comando (ej. `[xcodebuild]`, `[simctl]`)
- [x] 2.3 Asegurar ejecución serial: si `isActionRunning` es true, rechazar nuevas ejecuciones y loguear motivo

## 3. Implementar acción Build

- [x] 3.1 Implementar construcción de args de `xcodebuild` según tipo de contenedor (workspace/project)
- [x] 3.2 Implementar `Build` con `xcodebuild build -scheme <scheme> -destination id=<udid>` y logs de inicio/fin + exit code

## 4. Implementar acción Build & Run

- [x] 4.1 Implementar boot del simulador con `xcrun simctl bootstatus <udid> -b` (y manejo de errores)
- [x] 4.2 Elegir `derivedDataPath` controlado para la acción y asegurarse de que Build & Run construye usando ese path
- [x] 4.3 Implementar búsqueda del `.app` resultante dentro de DerivedData (heurística: app más reciente) y loguear el path elegido
- [x] 4.4 Extraer `CFBundleIdentifier` desde `Info.plist` del `.app` usando `plutil` (o alternativa equivalente) y loguear bundleId detectado
- [x] 4.5 Implementar `xcrun simctl install <udid> <appPath>` y `xcrun simctl launch <udid> <bundleId>` con streaming de logs

## 5. Smoke check manual

- [ ] 5.1 Probar en un repo con `.xcworkspace` y con `.xcodeproj` que Build corre contra el scheme y simulador seleccionados
- [ ] 5.2 Probar Build & Run y validar que bootea/instala/lanza, y que los errores se reportan con comando + output

