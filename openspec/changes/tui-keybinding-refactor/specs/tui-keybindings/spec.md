## ADDED Requirements

### Requirement: Global quit key (Ctrl+C)
The system SHALL quit the application when the user presses `Ctrl+C` from any screen or state.

#### Scenario: Quit from main menu
- **WHEN** user presses `Ctrl+C` on the main menu
- **THEN** the application SHALL quit immediately

#### Scenario: Quit from confirm dialog
- **WHEN** user presses `Ctrl+C` on a confirmation dialog
- **THEN** the application SHALL quit immediately (not cancel)

#### Scenario: Quit from update dialog
- **WHEN** user presses `Ctrl+C` during an update
- **THEN** the application SHALL quit immediately

### Requirement: Cancel/back key semantics (q, Esc, B)
The system SHALL use consistent key semantics across all screens: `q` cancels or quits (screen-dependent), `Esc` and `B` cancel or go back (screen-dependent).

#### Scenario: Q quits from main menu
- **WHEN** user is on the main menu and presses `q`
- **THEN** the application SHALL quit

#### Scenario: Q cancels from confirm dialog
- **WHEN** user is on a confirmation dialog and presses `q`
- **THEN** the dialog SHALL cancel (return to previous screen)

#### Scenario: Q cancels from update dialog
- **WHEN** user is on the update confirmation dialog and presses `q`
- **THEN** the update SHALL be cancelled (return to previous screen)

#### Scenario: B cancels from confirm dialog
- **WHEN** user is on a confirmation dialog and presses `b`
- **THEN** the dialog SHALL cancel (return to previous screen)

#### Scenario: B goes back from instance manager
- **WHEN** user is on the instance manager screen and presses `b`
- **THEN** the application SHALL return to the main menu

#### Scenario: Esc cancels from confirm dialog
- **WHEN** user is on a confirmation dialog and presses `Esc`
- **THEN** the dialog SHALL cancel (return to previous screen)

#### Scenario: B does nothing on main menu
- **WHEN** user is on the main menu and presses `b` or `Esc`
- **THEN** the application SHALL not change state (no-op at root)

### Requirement: Enter key for confirm/select
The system SHALL confirm or select the current selection when the user presses `Enter`.

#### Scenario: Select menu item
- **WHEN** user highlights a menu item and presses `Enter`
- **THEN** the application SHALL navigate to the selected command's screen

#### Scenario: Confirm yes/no dialog
- **WHEN** user highlights "Yes" and presses `Enter`
- **THEN** the dialog SHALL confirm (execute the command)

#### Scenario: Cancel yes/no dialog
- **WHEN** user highlights "No" and presses `Enter`
- **THEN** the dialog SHALL cancel (return to previous screen)

### Requirement: Up/down navigation
The system SHALL navigate between items when the user presses `Up` or `Down` (or `k`/`j`).

#### Scenario: Navigate menu items
- **WHEN** user is on the main menu and presses `Up` or `Down`
- **THEN** the cursor SHALL move to the next/previous menu item

#### Scenario: Navigate confirm dialog focus
- **WHEN** user is on a confirmation dialog and presses `Up` or `Down`
- **THEN** the focus SHALL toggle between "Yes" and "No" buttons

### Requirement: Key binding system using BubbleTea API
The system SHALL use BubbleTea's `key.Matches(msg, binding)` API for key handling instead of manual `switch(msg.String())` checks.

#### Scenario: Global keys handled at root level
- **WHEN** a key message is received at the root model level
- **THEN** global keys (`Ctrl+C`, `?`) SHALL be handled at the root level before dispatching to sub-models

#### Scenario: Screen-specific keys handled by sub-models
- **WHEN** a key message is received and not a global key
- **THEN** the key SHALL be dispatched to the current sub-model for screen-specific handling

### Requirement: Quick confirm/cancel keys (y/n)
The system SHALL allow quick confirmation with `y` and quick cancellation with `n` on confirm dialogs.

#### Scenario: Quick confirm
- **WHEN** user is on a confirmation dialog and presses `y`
- **THEN** the dialog SHALL confirm (execute the command)

#### Scenario: Quick cancel
- **WHEN** user is on a confirmation dialog and presses `n`
- **THEN** the dialog SHALL cancel (return to previous screen)
