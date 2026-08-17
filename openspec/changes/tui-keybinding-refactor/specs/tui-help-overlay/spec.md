## ADDED Requirements

### Requirement: Help overlay toggled by ? key
The system SHALL display a help overlay when the user presses `?`, showing all key bindings for the current screen.

#### Scenario: Toggle help overlay from main menu
- **WHEN** user is on the main menu and presses `?`
- **THEN** a help overlay SHALL appear showing all available key bindings

#### Scenario: Toggle help overlay from confirm dialog
- **WHEN** user is on a confirmation dialog and presses `?`
- **THEN** a help overlay SHALL appear showing all available key bindings for that dialog

#### Scenario: Dismiss help overlay
- **WHEN** help overlay is visible and user presses `?` again
- **THEN** the help overlay SHALL be dismissed

#### Scenario: Help overlay does not block interaction
- **WHEN** help overlay is visible
- **THEN** the user SHALL still be able to interact with the underlying screen (keys still work)

### Requirement: Footer shows screen-specific action hints
The system SHALL show screen-specific action hints in the footer instead of full key lists.

#### Scenario: Main menu footer
- **WHEN** user is on the main menu
- **THEN** the footer SHALL show "↑/↓ navigate · enter select · q quit · ? help"

#### Scenario: Confirm dialog footer
- **WHEN** user is on a confirmation dialog
- **THEN** the footer SHALL show "←/→ toggle · enter confirm · y/n quick · esc/q/b cancel"

#### Scenario: Update dialog footer
- **WHEN** user is on the update confirmation dialog
- **THEN** the footer SHALL show "↑/↓ select · enter confirm · q/esc/b cancel"

#### Scenario: Instance manager footer
- **WHEN** user is on the instance manager screen
- **THEN** the footer SHALL show "↑/↓ navigate · enter select · b esc back · q quit"

#### Scenario: Output view footer
- **WHEN** user is on the output view screen
- **THEN** the footer SHALL show "b/esc back · q quit"

### Requirement: Help overlay content matches actual bindings
The help overlay SHALL show key bindings that match the actual implemented behavior.

#### Scenario: Help overlay shows correct quit key
- **WHEN** help overlay is displayed
- **THEN** it SHALL show "Ctrl+C: quit" as the quit key (not "q: quit" which is screen-dependent)

#### Scenario: Help overlay shows screen-specific cancel keys
- **WHEN** help overlay is displayed on a confirm dialog
- **THEN** it SHALL show "q/esc/b: cancel" as the cancel keys

### Requirement: Help overlay is implemented using BubbleTea help module
The system SHALL use BubbleTea's `bubbles/help` module for the help overlay implementation.

#### Scenario: Help overlay uses bubbles/help
- **WHEN** the help overlay is implemented
- **THEN** it SHALL use `github.com/charmbracelet/bubbles/help` module (already a dependency of BubbleTea)
