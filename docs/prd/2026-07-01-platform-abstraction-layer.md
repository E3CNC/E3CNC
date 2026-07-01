# PRD: Platform Abstraction Layer for E3CNC CLI

> **Status:** Draft  
> **Author:** Hermes  
> **Date:** 2026-07-01  
> **Drivers:** Test coverage ceiling at 79% due to platform-coupled code

---

## 1. Problem Statement

The E3CNC CLI codebase interleaves business logic with direct platform calls across four modules. This creates a hard coverage ceiling on non-Linux systems: **79%**. The remaining ~1,392 uncovered statements are in code that directly invokes:

- `subprocess.run(["sudo", "systemctl", …])`
- `subprocess.run(["sudo", "supervisorctl", …])`
- `glob.glob("/dev/serial/by-id/*")` and `os.path.realpath`
- `subprocess.run(["make", "olddefconfig"])` and `["make", "-j4"]`
- `shutil.copytree`, `shutil.rmtree`, `Path.rename` for deployment operations
- `subprocess.run(["sudo", "apt-get", …])`
- `simple_term_menu.TerminalMenu` (interactive TUI)

These calls are embedded directly in business logic functions, making them impossible to test without either:
1. Running on actual Linux hardware, or
2. Applying deep `unittest.mock` patches that break on nested call chains and are brittle to refactors.

**The goal is to raise the testability ceiling to ~90%+** by introducing injectable platform abstractions, without changing runtime behavior.

---

## 2. Goals & Non-Goals

### Goals

1. **Extract 4-5 platform service interfaces** from the existing codebase into a new `_e3cnc_interfaces.py` module.
2. **Rewrite ~900 lines of untested business logic** to depend on interfaces rather than concrete platform calls.
3. **Achieve ≥90% coverage** across `_e3cnc_deploy.py`, `cli/helpers.py`, `cli/commands.py`, and `cli/menu.py`.
4. **Keep all 428 existing tests passing** — zero regressions.
5. **Preserve existing CLI surface** — no changes to user-facing commands, flags, or output.

### Non-Goals

1. No CLI API changes — flag names, subcommand names, help text, output format stay identical.
2. No database schema changes.
3. No new external dependencies.
4. No Docker/VM integration tests (those are separate infra).
5. No GUI or web interface changes.

---

## 3. Proposed Architecture

### 3.1 Interface Definitions (`_e3cnc_interfaces.py`)

A new module containing 5 abstract base classes (or Protocols):

```
_e3cnc_interfaces.py
├── ISystemService        # systemctl, supervisorctl lifecycle
├── IFilesystemOperator   # shutil.copytree, rmtree, mkdir, rename
├── ISerialDetector       # /dev/serial/by-id/* scanning + parsing
├── IFirmwareBuilder      # make olddefconfig + make -j4
└── IMenu                 # simple-term-menu or fallback numbered menu
```

Each interface defines 2-5 methods with clear contracts. Default implementations (`LinuxSystemService`, `RealFilesystemOperator`, etc.) live alongside the interfaces.

### 3.2 Wiring (`cli/bootstrap.py`)

A new bootstrap module that wires real implementations at startup:

```python
# cli/bootstrap.py
from _e3cnc_interfaces import (
    LinuxSystemService, RealFilesystemOperator,
    LinuxSerialDetector, KlipperFirmwareBuilder, TerminalMenuAdapter,
)

system: ISystemService = LinuxSystemService()
filesystem: IFilesystemOperator = RealFilesystemOperator()
serial: ISerialDetector = LinuxSerialDetector()
builder: IFirmwareBuilder = KlipperFirmwareBuilder()
menu: IMenu = TerminalMenuAdapter()
```

Tests import `cli.bootstrap` and replace services before invoking commands.

### 3.3 Code Transformation Pattern

Every refactored function follows this pattern:

**Before (current):**
```python
def restart_services(inst: Instance) -> bool:
    result = subprocess.run(["sudo", "systemctl", "restart", inst.moonraker_service], ...)
    ...
```

**After:**
```python
def restart_services(inst: Instance, svc: ISystemService | None = None) -> bool:
    svc = svc or bootstrap.system
    result = svc.restart(inst.moonraker_service)
    ...
```

Functions that previously accepted `(inst)` now accept `(inst, svc=None)`. The optional parameter with `bootstrap` fallback keeps existing callers unchanged while allowing tests to inject mocks.

---

## 4. Detailed Design

### 4.1 ISystemService

```python
class ISystemService(ABC):
    @abstractmethod
    def is_installed(self) -> bool: ...
    @abstractmethod
    def service_status(self, name: str) -> ServiceStatus: ...
    @abstractmethod
    def restart(self, name: str) -> bool: ...
    @abstractmethod
    def stop(self, name: str) -> bool: ...
    @abstractmethod
    def install_package(self, pkg: str) -> bool: ...
    @abstractmethod
    def run_script(self, cmd: list[str], timeout: int = 60) -> SubprocessResult: ...

@dataclass
class ServiceStatus:
    running: bool
    output: str

@dataclass
class SubprocessResult:
    returncode: int
    stdout: str
    stderr: str
```

**Coverage unlocked:**
- `_e3cnc_supervisor.py` — `install_supervisor`, `register_instance`, `_run_supervisorctl`
- `_e3cnc_deploy.py` — `update_systemd_paths`, `restart_services`, `_check_service`
- `cli/commands.py` — `cmd_restart`

### 4.2 IFilesystemOperator

```python
class IFilesystemOperator(ABC):
    @abstractmethod
    def copy_tree(self, src: Path, dst: Path) -> None: ...
    @abstractmethod
    def remove_tree(self, path: Path) -> None: ...
    @abstractmethod
    def ensure_dir(self, path: Path) -> None: ...
    @abstractmethod
    def atomic_symlink(self, target: Path, link: Path) -> bool: ...
    @abstractmethod
    def write_file(self, path: Path, content: str) -> None: ...
    @abstractmethod
    def read_file(self, path: Path) -> str: ...
```

**Coverage unlocked:**
- `_e3cnc_deploy.py` — `sync_runtime_files`, `migrate_layout`, `migrate_instances`
- `_e3cnc_deploy.py` — `activate_release`, `deactivate_release`
- `_e3cnc_deploy.py` — `run_backup`, `run_diagnose`, `prune_releases`

### 4.3 ISerialDetector

```python
@dataclass
class SerialDevice:
    path: str; real: str; vendor: str; model: str; serial: str; is_klipper: bool

class ISerialDetector(ABC):
    @abstractmethod
    def scan(self) -> list[SerialDevice]: ...
```

**Coverage unlocked:**
- `cli/helpers.py` — `scan_serial_devices` (entire 80-line function)

### 4.4 IFirmwareBuilder

```python
class IFirmwareBuilder(ABC):
    @abstractmethod
    def build(self, preset_id: str, klipper_dir: str,
              progress_callback: Callable[[str], None] | None = None) -> bool: ...
```

**Coverage unlocked:**
- `cli/helpers.py` — `build_klipper_firmware` (entire 80-line function)

### 4.5 IMenu

```python
class IMenu(ABC):
    @abstractmethod
    def choose(self, entries: list[tuple[str, str]], title: str,
               status_bar: str | None = None) -> str | None: ...
    @abstractmethod
    def choose_instance(self, instances: list[Instance]) -> Instance | None: ...
```

**Coverage unlocked:**
- `cli/menu.py` — `_tui_menu`, TUI path of `_switch_instance`

---

## 5. Phases & Milestones

### Phase 1: Foundation (Days 1-2)

| Task | Deliverable | Est. impact |
|------|------------|-------------|
| Create `_e3cnc_interfaces.py` with all 5 interfaces + dataclasses | Reviewable module | — |
| Create `cli/bootstrap.py` with real implementations | Wire file | — |
| Create `tests/conftest.py` with factory fixtures for all mocks | Shared test infra | — |
| Run full suite — 0 regressions | Green CI | — |

### Phase 2: ISystemService (Days 3-4)

| Task | Deliverable | Est. impact |
|------|------------|-------------|
| Refactor `_e3cnc_supervisor.py` to accept `ISystemService` | ~115 lines refactored | 99% → 100% |
| Refactor `_e3cnc_deploy.py::_check_service` | ~30 lines refactored | +2% on deploy |
| Refactor `_e3cnc_deploy.py::update_systemd_paths`, `restart_services` | ~60 lines refactored | +3% on deploy |
| Refactor `cli/commands.py::cmd_restart` | ~15 lines refactored | +1% on commands |
| Write `MockSystemService` + tests | ~50 lines test | verifiable |

### Phase 3: IFilesystemOperator (Days 5-6)

| Task | Deliverable | Est. impact |
|------|------------|-------------|
| Refactor `sync_runtime_files` to accept `IFilesystemOperator` | ~40 lines refactored | +3% on deploy |
| Refactor `activate_release` / `deactivate_release` | ~30 lines refactored | +2% on deploy |
| Refactor `migrate_layout` | ~50 lines refactored | +4% on deploy |
| Refactor `migrate_instances` | ~130 lines refactored | +6% on deploy |
| Refactor `run_backup` | ~30 lines refactored | +2% on deploy |
| Refactor `prune_releases` | ~30 lines refactored | +2% on deploy |
| Write `MockFilesystemOperator` + tests | ~80 lines test | verifiable |

### Phase 4: ISerialDetector + IFirmwareBuilder (Day 7)

| Task | Deliverable | Est. impact |
|------|------------|-------------|
| Refactor `scan_serial_devices` | ~80 lines refactored | +10% on helpers |
| Refactor `build_klipper_firmware` | ~80 lines refactored | +10% on helpers |
| Refactor `cmd_flash_mcu` user choice | ~20 lines refactored | +2% on commands |
| Write mocks + tests | ~80 lines test | verifiable |

### Phase 5: IMenu (Day 8)

| Task | Deliverable | Est. impact |
|------|------------|-------------|
| Refactor `_tui_menu` to use `IMenu` | ~75 lines refactored | +15% on menu |
| Refactor `_switch_instance` TUI path | ~20 lines refactored | +5% on menu |
| Refactor `select_instance` in `_e3cnc_shared.py` | ~30 lines refactored | +1% on shared |
| Write `MockMenu` + tests | ~60 lines test | verifiable |

### Phase 6: Polish & Verify (Day 9)

| Task | Deliverable |
|------|------------|
| Run full test suite — 0 regressions | Green CI |
| Coverage report — verify ≥90% across target modules | Report |
| Update `ARCHITECTURE.md` with new layering | Documentation |
| Remove dead mock patches from old tests | Cleanup |

---

## 6. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| `_e3cnc_deploy.py` coverage | 51% | ≥85% |
| `cli/helpers.py` coverage | 64% | ≥90% |
| `cli/commands.py` coverage | 62% | ≥85% |
| `cli/menu.py` coverage | 74% | ≥90% |
| **Overall project coverage** | **79%** | **≥90%** |
| Test suite pass rate | 100% (428/428) | 100% |
| New test files added | 0 | ≥5 |

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Interface scope creep (YAGNI violations) | Medium | High | Strict review: max 5 methods per interface, defer speculative methods |
| Existing callers miss the optional parameter | Low | Medium | Type-check with mypy; all cmd_* functions get a new `svc=None` default |
| Test mock complexity exceeds original patch complexity | Medium | Medium | Each MockService is a single class under 40 lines; hardcode return values |
| Phase interdependency (deploy → interfaces changes needed first) | Low | Low | Phases are independent; each interface stands alone |
| `migrate_instances` rewrites are large | Medium | Medium | Split into 3 sub-tasks: (a) dir creation, (b) file copy, (c) config update |

---

## 8. Appendix: Module Reference

### Current Coverage Detail

| Module | Stmts | Missed | % | Primary blockers |
|--------|-------|--------|---|-----------------|
| `_e3cnc_deploy.py` | 888 | 436 | 51% | subprocess, shutil, systemd, serial, make |
| `_e3cnc_shared.py` | 832 | 167 | 80% | select_instance TUI, run_ansible |
| `cli/commands.py` | 530 | 201 | 62% | cmd_flash_mcu, cmd_backup, sudo |
| `cli/helpers.py` | 333 | 121 | 64% | scan_serial_devices, build_firmware |
| `cli/menu.py` | 198 | 51 | 74% | _tui_menu TerminalMenu |
| **Total** | **6,629** | **1,392** | **79%** | |

### Estimated Lines of New Code

| Artifact | Lines |
|----------|-------|
| `_e3cnc_interfaces.py` (5 interfaces + dataclasses) | ~150 |
| `cli/bootstrap.py` (default wiring) | ~30 |
| `tests/conftest.py` (shared fixtures) | ~60 |
| Mock implementations (5 x ~40 lines) | ~200 |
| Test code (new tests for refactored functions) | ~400 |
| **Total** | **~840** |

### Estimated Lines of Source Changed

| Refactoring | Lines changed |
|-------------|--------------|
| `_e3cnc_supervisor.py` (add `svc:` param) | ~15 |
| `_e3cnc_deploy.py` (add `fs:` / `svc:` params to 8 functions) | ~50 |
| `cli/helpers.py` (extract serial + firmware) | ~20 |
| `cli/commands.py` (add `svc:` to 3 cmd_* functions) | ~10 |
| `cli/menu.py` (extract IMenu) | ~25 |
| **Total** | **~120** |
