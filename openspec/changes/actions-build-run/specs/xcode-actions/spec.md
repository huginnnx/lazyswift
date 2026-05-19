## ADDED Requirements

### Requirement: Actions panel lists available actions
The system SHALL present an Actions panel that lists available actions at minimum: Build and Build & Run.

#### Scenario: Actions are visible in the Actions panel
- **WHEN** the user opens `lazyswift`
- **THEN** the Actions panel SHALL show entries for Build and Build & Run

### Requirement: Actions panel supports keyboard navigation
The system SHALL allow users to navigate the Actions panel using the keyboard.

#### Scenario: User navigates actions with arrow keys
- **WHEN** the Actions panel has focus and the user presses ↑ or ↓
- **THEN** the selection cursor SHALL move between action entries

### Requirement: Scheme selection is persisted for actions
The system SHALL persist the selected scheme for the current session so actions can execute against it.

#### Scenario: Selecting a scheme updates the active scheme
- **WHEN** the user presses Enter on a scheme in the Schemes panel
- **THEN** that scheme SHALL become the active scheme used by subsequent actions

### Requirement: Simulator selection is used as destination for actions
The system SHALL use the selected simulator (UDID) as the destination for actions that require a simulator.

#### Scenario: Selecting a simulator updates the active destination
- **WHEN** the user presses Enter on a simulator device in the Simulators panel
- **THEN** that simulator UDID SHALL become the active destination used by subsequent actions

### Requirement: Actions are enabled only when prerequisites are selected
The system SHALL enable or disable each action based on whether its prerequisites are present in the active context (container, scheme, simulator).

#### Scenario: Action is disabled when context is incomplete
- **WHEN** the active scheme is missing OR the active simulator UDID is missing
- **THEN** Build and Build & Run SHALL be shown as disabled and SHALL NOT execute

### Requirement: Build action runs xcodebuild for the active context
The system SHALL execute a Build action by invoking `xcodebuild build` for the active container and scheme, targeting the selected simulator.

#### Scenario: Build runs against the selected scheme and simulator
- **WHEN** the user selects Build in the Actions panel and presses Enter with an active container, scheme, and simulator UDID
- **THEN** the system SHALL run `xcodebuild build` with the selected container and `-scheme <scheme>` and `-destination id=<udid>`

### Requirement: Build & Run boots, installs, and launches on the selected simulator
The system SHALL execute a Build & Run action by ensuring the simulator is booted, building the app, installing it on the selected simulator, and launching it.

#### Scenario: Build & Run installs and launches the built app
- **WHEN** the user selects Build & Run in the Actions panel and presses Enter with an active container, scheme, and simulator UDID
- **THEN** the system SHALL boot the simulator if needed, build the app, install the resulting `.app`, and launch it on the selected simulator

### Requirement: Action execution streams output to Logs
The system SHALL stream action execution output (stdout/stderr) into the Logs panel while the action is running.

#### Scenario: Logs show live output during build
- **WHEN** a build action is running
- **THEN** the Logs panel SHALL display output as it is produced by the underlying commands

### Requirement: Action failures are reported with exit code and output
The system SHALL report action failures with at least the failing command, its exit code (if available), and relevant output.

#### Scenario: Failing command is reported to the user
- **WHEN** an action command fails
- **THEN** the system SHALL add a log entry describing the failure and include the exit code (if available) and the command output

### Requirement: Actions do not run concurrently
The system SHALL prevent starting a new action while another action is already running.

#### Scenario: Second action attempt is rejected while running
- **WHEN** an action is already running and the user attempts to start another action
- **THEN** the system SHALL reject the attempt and add a log entry explaining that an action is in progress

