## ADDED Requirements

### Requirement: Cartesian CNC printer config
The `printer.cfg` SHALL define a cartesian kinematics CNC machine with three linear axes (X, Y, Z). It SHALL NOT include extruder or heated bed sections.

#### Scenario: Printer kinematics
- **WHEN** Klippy loads the config
- **THEN** `printer.toolhead` SHALL report `kinematics: "cartesian"`

#### Scenario: Axis limits
- **WHEN** Klippy is ready
- **THEN** the toolhead SHALL report `position_max` with values: X=300mm, Y=200mm, Z=150mm

### Requirement: Simulator MCU config
The `[mcu]` section SHALL point to the PTY device created by the entrypoint for the simulator binary. The `[printer]` section SHALL use standard CNC velocity/acceleration limits.

#### Scenario: MCU connection
- **WHEN** Klippy starts
- **THEN** it SHALL connect to the MCU via the configured PTY serial path

### Requirement: Spindle control
The config SHALL provide spindle speed control via S-word and M3/M4/M5 commands.

#### Scenario: Spindle state tracked
- **WHEN** the UI sends `M3 S5000`
- **THEN** the spindle state object SHALL report `spindle_speed: 5000` and `spindle_state: "ON"`

#### Scenario: Spindle stopped
- **WHEN** the UI sends `M5`
- **THEN** the spindle state object SHALL report `spindle_state: "OFF"`

> **Note:** The vendored Klipper lacks the native `[spindle]` module. State is tracked
> via gcode macros into a shared `_CNC_STATE` variables object.

### Requirement: Coolant control
The config SHALL support M7 (mist), M8 (flood), and M9 (off) coolant commands.

#### Scenario: Coolant state tracked
- **WHEN** the UI sends `M8`
- **THEN** the coolant state object SHALL report `coolant: "FLOOD"`

> **Note:** Tracked via the shared `_CNC_STATE` variables object (see spindle).

### Requirement: Work coordinate systems
The config SHALL support G54 through G59 work coordinate system selection.

#### Scenario: WCS switching
- **WHEN** the UI sends `G55`
- **THEN** `printer.gcode_move` SHALL report `gcode_coordinate_system: 55`

### Requirement: E3CNC macros included
The config SHALL include all E3CNC macros from `config/macros/`:
- `wcs_macros.cfg` (WCS selection via named buttons)
- `e3cnc_macros.cfg` (homing override, pre/post homing)
- `cnc_base.cfg` (safe Z, work zero, park)

#### Scenario: Macros loaded
- **WHEN** Klippy is ready
- **THEN** all E3CNC macros SHALL be registered and callable via the G-code API

### Requirement: `[homing_override]` configured
The config SHALL include a `[homing_override]` section that handles CNC-safe homing sequence (Z-first or XY-first as appropriate).

#### Scenario: Homing
- **WHEN** the UI sends `G28`
- **THEN** the homing override SHALL execute the CNC homing sequence

### Requirement: Nozzle diameter and extrusion omitted
The config SHALL NOT include `[extruder]`, `[heater_bed]`, or any filament-related sections. The printer SHALL report `extruder` as absent from the object list.

#### Scenario: No extruder objects
- **WHEN** querying `objects/list`
- **THEN** `extruder` SHALL NOT be in the returned object list