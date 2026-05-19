# logs-viewer Specification

## Purpose
TBD - created by archiving change logs-viewer. Update Purpose after archive.
## Requirements
### Requirement: Logs viewer can be opened and closed
The system SHALL provide a dedicated Logs viewer mode that can be opened and closed from the main UI.

#### Scenario: Open logs viewer
- **WHEN** the user presses `L` from the main UI
- **THEN** the system SHALL switch to Logs viewer mode

#### Scenario: Close logs viewer
- **WHEN** the user presses `Esc` while in Logs viewer mode
- **THEN** the system SHALL return to the main UI

### Requirement: Logs viewer supports scrollback navigation
The system SHALL allow the user to navigate through log history in the Logs viewer.

#### Scenario: Scroll up and down through history
- **WHEN** the user presses ↑ or ↓ in Logs viewer mode
- **THEN** the visible log window SHALL move through the log history accordingly

### Requirement: Logs viewer supports follow mode
The system SHALL support a follow mode that keeps the view pinned to the latest logs while new logs are appended.

#### Scenario: Follow mode keeps view pinned to end
- **WHEN** follow mode is enabled and new logs are appended
- **THEN** the visible log window SHALL remain pinned to the most recent logs

#### Scenario: Scrolling up disables follow mode
- **WHEN** follow mode is enabled and the user scrolls upward in Logs viewer mode
- **THEN** follow mode SHALL be disabled

#### Scenario: Jump to end re-enables follow mode
- **WHEN** the user jumps to the end of the log history (e.g., End or `G`)
- **THEN** follow mode SHALL be enabled and the view SHALL be pinned to the latest logs

### Requirement: Logs can be filtered interactively
The system SHALL allow filtering the log stream by a user-provided query.

#### Scenario: Enter filter mode
- **WHEN** the user presses `/` in Logs viewer mode
- **THEN** the system SHALL enter filter input mode and show the current filter query

#### Scenario: Filter reduces visible logs
- **WHEN** a non-empty filter query is active
- **THEN** the Logs viewer SHALL only display log entries matching the query

#### Scenario: Exit filter mode
- **WHEN** the user presses `Esc` in filter input mode
- **THEN** the system SHALL exit filter input mode

### Requirement: Logs have structured fields for formatting
The system SHALL represent logs internally as structured entries with at least timestamp, source, level, and message.

#### Scenario: Log entry has structured fields
- **WHEN** a new log line is appended to the buffer
- **THEN** the system SHALL store it as a structured log entry with timestamp, source, level, and message

### Requirement: Logs are rendered with consistent formatting and colors
The system SHALL render logs with consistent formatting and color styling based on source and severity level.

#### Scenario: Error logs are visually distinct
- **WHEN** a log entry has level `error`
- **THEN** it SHALL be rendered with a visually distinct style (e.g., red color and non-dim)

#### Scenario: Different sources use different colors
- **WHEN** two log entries have different sources (e.g., xcodebuild vs simctl)
- **THEN** they SHALL be rendered with different source styling (e.g., colored tags/prefixes)

### Requirement: Main UI logs panel remains as compact tail view
The system SHALL keep a compact logs panel in the main UI showing the most recent log entries.

#### Scenario: Main view shows tail logs
- **WHEN** the user is in the main UI
- **THEN** the Logs panel SHALL show the most recent log entries (tail)

### Requirement: Log buffer is bounded
The system SHALL bound the log buffer to prevent unbounded growth.

#### Scenario: Old entries are dropped when buffer is full
- **WHEN** the log buffer exceeds its maximum size
- **THEN** the system SHALL drop the oldest log entries to remain within the limit

