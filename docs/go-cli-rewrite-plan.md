# Plan: Full Go CLI + Drop Ansible

## Motivation

The hybrid Go/Python CLI works but carries friction: subprocess overhead
(50-200ms per command), fragile path resolution, two codebases to maintain,
and Ansible as a heavyweight dependency for what's essentially shell commands.

Eliminating Python and Ansible means:
- Single static binary — zero runtime dependencies
- Every command runs in-process — instant startup
- One codebase, one build system, one language
- No more Go↔Python bridge issues (path resolution, ANSI handling,
  version sync, dispatch loops)

## Current Codebase

```
Python CLI (3,585 lines):
  cli/commands.py      1,049  — command handlers
  cli/helpers.py         818  — download, extract, verify, ansible wrapper
  cli/menu.py            323  — interactive menu (bootstrap fallback)
  cli/parser.py          169  — argparse setup
  cli/__init__.py         47  — package init + main()
  cli/__main__.py          9  — python3 -m cli support

Python shared modules (3,333 lines):
  _e3cnc_shared.py      1,577  — Instance model, paths, styles, check_status
  _e3cnc_deploy.py      1,756  — releases, health checks, backup/restore,
                                 deploy, detect_mcu, flash_mcu
  _e3cnc_supervisor.py    252  — supervisorctl wrapper

Ansible (663 lines YAML):
  bootstrap-stack/main   488  — apt, venvs, systemd, configs (run once)
  install.yml             97  — pre-flight, roles, verification
  uninstall.yml           78  — remove files/services
  + 4 role files          ~50 each — extractor, moonraker-config,
                                     macros, frontend

Go TUI existing (already built):
  cli/go/                ~2,500  — TUI, runner, resolver, config,
                                   commands (partial), install wizard
```

## Phase Plan

### Phase 1 — Instance Model + Paths (0.5 day)
**Port `_e3cnc_shared.py` → `cli/go/internal/instance/`**

The Instance struct is the foundation — everything references it.

Deliverable:
- `Instance` struct with Name, Ports, Paths, Services
- `detect_instances()` — scan `~/e3cnc/instances/`
- `get_active_instance()` — read `~/.e3cnc-tui/state.json`
- Machine profile parsing
- Local IP detection

Input: `_e3cnc_shared.py` (Instance class, ~200 lines of the 1,577 total)
Output: `cli/go/internal/instance/instance.go`

### Phase 2 — Releases + Health Checks (1 day)
**Port `_e3cnc_deploy.py` → `cli/go/internal/deploy/`**

Self-contained file ops + HTTP — no Ansible, no system deps.

Deliverable:
- Release scanning (`~/e3cnc/releases/`)
- Release activation (atomic symlink swap)
- Health checks (HTTP GET to Moonraker)
- Download artifact from GitHub
- Checksum verification
- tar.zst extraction
- Backup/restore (file tar + zstd)
- `detect_mcu()` — scan `/dev/serial/by-id/`

Input: `_e3cnc_deploy.py` (1,756 lines — ~600 are release management,
~400 are health checks, ~300 backup/restore, ~200 detect/flash MCU,
~256 are ansible wrappers that get replaced)
Output: `cli/go/internal/deploy/releases.go`,
`cli/go/internal/deploy/health.go`,
`cli/go/internal/deploy/backup.go`

### Phase 3 — Go-native Command Handlers (1 day)
**Port `cli/commands.py` → `cli/go/internal/commands/`**

Already started in `dispatch.go`. Wire up remaining commands.

Deliverable:
- Wire handlers for all 24 commands
- JSON output mode for every command
- Formatted terminal output (matching current Python output)
- Help text + usage from commands manifest

Commands to implement:
| Command | Go impl exists | Complexity | Notes |
|---|---|---|---|
| status | ✅ partial | Low | Health checks over HTTP |
| check | ✅ partial | Low | Stat binaries |
| instances | ✅ partial | Low | Read dirs |
| releases | ✅ partial | Low | Read dirs |
| clilog | ✅ | Trivial | Read file |
| install | ❌ | High | Uses Ansible → Go |
| update | ❌ | Medium | Download + extract + restart |
| deploy | ❌ | Medium | Same as update |
| uninstall | ❌ | High | Removes services + files |
| backup | ❌ | Medium | tar + zstd |
| restore | ❌ | Medium | tar + zstd |
| rollback | ❌ | Low | Symlink swap |
| prune | ❌ | Low | Remove dirs |
| detect-mcu | ❌ | Low | Read /dev |
| flash-mcu | ❌ | High | Build klipper + flash |
| init-config | ❌ | Medium | Generate config from template |
| diagnose | ❌ | Medium | Collect system info |
| logs | ❌ | Low | Tail/read files |
| migrate | ❌ | Medium | File moves |
| admin-page | ❌ | Low | Generate HTML |
| restart | ❌ | Low | systemd restart |

Output: Extended `cli/go/internal/commands/dispatch.go`
(~800 lines total when complete)

### Phase 4 — Replace Ansible (2 days)
**Port `ansible/roles/bootstrap-stack/` → Go**

Ansible's 488-line bootstrap playbook is 90% basic system admin wrapped
in YAML. Every operation maps to Go stdlib + `os/exec`.

Ansible task → Go replacement:

```
ansible.builtin.apt            → exec.Command("apt-get", ...)
ansible.builtin.git            → exec.Command("git", "clone", ...)
ansible.builtin.copy           → os.WriteFile / os.Rename
ansible.builtin.file (mkdir)   → os.MkdirAll
ansible.builtin.file (rm)      → os.RemoveAll
ansible.builtin.command        → exec.Command
ansible.builtin.systemd        → exec.Command("systemctl", ...)
ansible.builtin.pip            → exec.Command("pip3", ...)
ansible.builtin.stat           → os.Stat
ansible.builtin.set_fact       → Go variable
ansible.builtin.debug          → fmt.Println
ansible.builtin.fail           → fmt.Fprintf + os.Exit
ansible.builtin.uri            → http.Get
ansible.builtin.shell          → exec.Command("bash", "-c", ...)
ansible.builtin.lineinfile     → regexp + os.ReadFile/WriteFile
```

Key principle: **no framework**. Each task is a simple Go function.
The install command calls them in sequence with error handling.
Idempotency is explicit (`os.Stat` → skip if exists).

Deliverable:
- `cli/go/internal/bootstrap/bootstrap.go` — replaces entire
  `bootstrap-stack` playbook (~400 lines Go)
- `cli/go/internal/bootstrap/uninstall.go` — replaces `uninstall.yml`
  (~80 lines Go)
- No more `ansible-playbook` dependency on the CNC

### Phase 5 — Wire Entry Point + Drop Python (1 day)

Deliverable:
- `main.go` becomes the sole entry point
- Go binary handles all 24 commands in-process
- Python `cli/` directory is archived but preserved for reference
- `_e3cnc_shared.py`, `_e3cnc_deploy.py`, `_e3cnc_supervisor.py` retired
- Release artifact no longer includes `cli/` or Python modules
- Binary drops from ~4 MB to... actually stays ~4 MB (CGO_ENABLED=0 static)

### Phase 6 — Test + Docs (0.5 day)

- Verify all 24 commands produce identical output to current Python CLI
- Update `docs/TUI.md`, wiki pages
- Remove ansible from CI workflow (no more `ansible-galaxy install`)

## Total Effort: ~6 days

| Phase | Days | Dependency |
|---|---|---|
| 1 — Instance model | 0.5 | None |
| 2 — Releases + health | 1 | Phase 1 |
| 3 — Command handlers | 1 | Phase 1 |
| 4 — Replace Ansible | 2 | Phase 1 |
| 5 — Wire entry point | 1 | Phases 1-4 |
| 6 — Test + docs | 0.5 | Phases 1-5 |
| **Total** | **6 days** | |

## What Splitting Looks Like

The work is naturally incremental — each phase ships independently
and is a net improvement even if later phases don't happen.

| Phase | What it unlocks | Fully reversible? |
|---|---|---|
| 1 | Native Instance type, used by Go commands | Yes — Python still works |
| 2 | Releases/health in Go, faster CLI experience | Yes — Python fallback |
| 3 | All commands run in-process, no subprocess | Yes — Python fallback |
| 4 | Zero Ansible dependency on CNC | No — can't revert easily |
| 5 | Remove Python from release entirely | No — Python dir archived |

## Open Questions

1. **`flash-mcu`** — currently calls Klipper's `make flash` via
   `make_command_flash.py`. Should Go call this directly or wrap it?
   (My vote: Go calls `make flash FLASH_DEVICE=...` directly)
2. **`init-config`** — generates printer.cfg from templates. The
   template files are YAML/conf text. Go can do this with `text/template`.
3. **`diagnose`** — collects system info (dmesg, logs, etc.). Go can
   run `exec.Command` for each check.
4. **Klipper/Moonraker venvs** — currently managed by Ansible's pip.
   Go can call `python3 -m venv` and `pip install -r requirements.txt`
   directly via exec.
