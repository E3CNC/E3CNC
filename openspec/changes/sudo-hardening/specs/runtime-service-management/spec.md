## ADDED Requirements

### Requirement: Runtime restart uses the non-interactive root boundary
The `restart` command SHALL execute service restart commands (`systemctl restart`, `supervisorctl restart`, `nginx reload`) via `RunAsRoot` so they work for a normal `biqu` user and never prompt.

#### Scenario: Restart as non-root biqu user
- **WHEN** a `biqu` user invokes `e3cnc-tui restart` for an instance
- **THEN** the restart commands SHALL run via `RunAsRoot` (non-interactive)
- **AND** on failure SHALL return a clear error instead of silently doing nothing

#### Scenario: Restart as root
- **WHEN** a root user invokes `e3cnc-tui restart`
- **THEN** the restart commands SHALL run directly (no sudo prefix)

### Requirement: Health check distinguishes permission errors
The service health check SHALL report "permission denied / sudo unavailable" distinctly from "service not found".

#### Scenario: Sudo permission failure
- **WHEN** `RunAsRoot("supervisorctl", "status", <svc>)` fails with a permission/sudo error
- **THEN** the health check SHALL report a permission problem (not "service not found")

#### Scenario: Service absent
- **WHEN** `supervisorctl status` returns cleanly but the service is not present/running
- **THEN** the health check SHALL report the service as not found

#### Scenario: Service running
- **WHEN** `supervisorctl status` reports the service as `RUNNING`
- **THEN** the health check SHALL pass with a "running" detail

### Requirement: Health check never prompts
The runtime health check SHALL NOT block on an interactive sudo password prompt.

#### Scenario: Non-interactive check
- **WHEN** a health check runs as a non-root user
- **THEN** it SHALL use `sudo -n` and fail fast rather than prompt
