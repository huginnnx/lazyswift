## ADDED Requirements

### Requirement: List available simulators grouped by runtime
The system SHALL list available simulators using `xcrun simctl list -j devices available` and present them grouped by runtime.

#### Scenario: Runtimes are shown as headers
- **WHEN** the user opens `lazyswift`
- **THEN** the Simulators panel SHALL show runtime headers (e.g., iOS 26.1, iOS 18.0)

### Requirement: Simulator items include basic identity and state
Each simulator item SHALL include at least the simulator name and its current state.

#### Scenario: Item shows name and state
- **WHEN** simulators are rendered in the Simulators panel
- **THEN** each item SHALL show `name` and `state` (e.g., Booted/Shutdown)

### Requirement: Continuous navigation across grouped simulators
Simulator navigation SHALL be continuous across all simulator items, skipping runtime headers.

#### Scenario: Arrow navigation skips headers
- **WHEN** the user presses ↑ or ↓ in the Simulators panel
- **THEN** selection SHALL move between simulator items and SHALL NOT land on runtime headers

### Requirement: Selected simulator is visually highlighted
The currently selected simulator SHALL be visually highlighted (e.g., marker `>` and color/`inverse` styling).

#### Scenario: Selection styling is visible
- **WHEN** a simulator is the current selection
- **THEN** it SHALL be rendered with a visible selection indicator distinct from non-selected items

### Requirement: Selecting a simulator updates selected state
The system SHALL allow selecting a simulator item and keep it as the selected simulator for the current session.

#### Scenario: Enter selects simulator
- **WHEN** the user presses Enter on a simulator item
- **THEN** that simulator SHALL become the selected simulator for subsequent actions within the session

