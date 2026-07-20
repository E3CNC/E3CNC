## ADDED Requirements

### Requirement: Auto-detect free ports
The installer SHALL detect available ports for Admin UI (default 8081), Moonraker (default 7125), and Klipper (default 7126) services using net.Listen. If a default port is in use, the installer SHALL scan upward to find the next available port.

#### Scenario: Default ports are free
- **WHEN** the installer runs port detection and ports 8081, 7125, 7126 are all free
- **THEN** the installer SHALL use the default ports

#### Scenario: Default port is in use
- **WHEN** port 8081 is already bound by another process
- **THEN** the installer SHALL try port 8082, then 8083, etc., until it finds a free port

#### Scenario: No free ports found
- **WHEN** ports 8081-8180 are all in use
- **THEN** the installer SHALL fail with a clear error message listing the ports it tried

#### Scenario: Port detection with --port-detect flag
- **WHEN** the user runs `e3cnc-tui install --port-detect`
- **THEN** the installer SHALL output the detected ports in JSON format and exit without installing

#### Scenario: Port conflict with existing service
- **WHEN** a Moonraker instance is already running on port 7125
- **THEN** the installer SHALL detect port 7125 as in use and auto-assign 7126 (or next available)

### Requirement: net.Listen accuracy
The installer SHALL use net.Listen to actually bind ports during detection, providing more accurate results than passive checks like ss or netstat.

#### Scenario: Port in TIME_WAIT
- **WHEN** a port is in TIME_WAIT state (recently closed connection)
- **THEN** net.Listen SHALL report the port as available (kernel allows reuse in TIME_WAIT)

#### Scenario: IPv4 and IPv6 binding
- **WHEN** listening on `:port` (all interfaces)
- **THEN** the installer SHALL handle both IPv4 and IPv6 bindings correctly
