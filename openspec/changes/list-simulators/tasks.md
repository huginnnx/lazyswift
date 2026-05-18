## 1. Xcode / Simulator integration

- [x] 1.1 Add `src/xcode/list-simulators.ts` to run `xcrun simctl list -j devices available` and parse `{devices}` JSON
- [x] 1.2 Define simulator types (runtime id/label, device: name/udid/state/isAvailable/logPath) in `src/xcode/types.ts`
- [x] 1.3 Implement runtime label formatting (e.g. `com.apple.CoreSimulator.SimRuntime.iOS-26-1` → `iOS 26.1`) with sensible fallback

## 2. Simulators panel view-model + selection

- [x] 2.1 Build a grouped structure: `[{runtimeLabel, runtimeId, devices: [...]}, ...]` sorted by runtime label/id
- [x] 2.2 Build an “index map” of selectable simulator rows (skip runtime headers) to support continuous ↑↓ navigation
- [x] 2.3 Add state to track `selectedSimulatorUdid` and current `simulatorIndex` (clamped to available selectable items)

## 3. Ink UI rendering + keyboard controls

- [x] 3.1 Render Simulators panel grouped by runtime headers, with items showing `name` + `state`
- [x] 3.2 Highlight the currently selected simulator row with marker `>` and styling (cyan and/or `inverse`), focus-aware
- [x] 3.3 Wire keyboard handling when focus is `simulators`: ↑↓ updates selection continuously; Enter sets `selectedSimulatorUdid` and logs selection
- [x] 3.4 Keep raw-mode guard (`useStdin().isRawModeSupported`) so non-TTY runs don’t crash

## 4. Verification

- [x] 4.1 Run `pnpm typecheck` and `pnpm lint`
- [x] 4.2 Run `pnpm dev` and confirm simulators list appears and selection behaves as expected

