# E3CNC Instance Naming Convention

## Problem

Current instance detection reverse-engineers KIAUH conventions:

```python
# ~/printer_data           → name="cnc"
# ~/printer_test1_data     → name="cnc_test1"
# ~/printer_lab_data       → name="lab"
# ~/printer_data_custom    → name="printer_data_custom" (fallthrough)
detect_instances()         → 40 lines of glob + regex
_instance_name_from_printer_data  → 4 regex branches
_read_service_name          → reads .asvc file, applies 3 fallback heuristics
_read_python_service_dir   → regex-parse moonraker.env for Python path
_read_moonraker_port       → regex-parse moonraker.conf for port
_default_web_root          → tries mainsail vs e3cnc-web vs e3cnc-frontend
from_printer_data()        → 45 lines assembling Instance from probes
```

That's ~120 lines of probing code just to answer "what instances exist on this machine?"

## New Convention

### Directory layout

```
~/e3cnc/
  current/              → symlink to active release (shared, from single-clone model)
  releases/
  instances/
    {name}/
      data/
        config/
          moonraker.conf
          printer.cfg
          E3CNC/
            macros/
        logs/
        database/
        comms/
        scripts/
        gcodes/
      frontend/
```

### Instance naming rules

| Rule | Value |
|---|---|
| Characters | `[a-z0-9-]+` — lowercase, hyphens, digits only |
| Name `default` | Reserved for the primary instance (port 7125) |
| Port | `7125 + N` where N is index in sorted instance list, or stored in manifest |
| Web root | `~/e3cnc/instances/{name}/frontend/` |
| Data dir | `~/e3cnc/instances/{name}/data/` |
| Moonraker service | `e3cnc-{name}-moonraker` |
| Klipper service | `e3cnc-{name}-klipper` |
| nginx server_name | `{name}.e3cnc.local` |

### Moonraker/Klipper binary dirs

Still shared from the active release:

```
~/e3cnc/current/vendor/moonraker/   → moonraker_dir for all instances
~/e3cnc/current/vendor/klipper/     → klipper_dir for all instances
```

### Instance definition (replaces current `from_printer_data`)

```python
INSTANCES_DIR = Path.home() / "e3cnc" / "instances"

@classmethod
def from_name(cls, name: str) -> "Instance":
    base = INSTANCES_DIR / name
    data = base / "data"
    config = data / "config"
    port = _read_moonraker_port(config / "moonraker.conf", default=7125)
    idx = sorted(INSTANCES_DIR.iterdir()).index(base) + 1 if INSTANCES_DIR.is_dir() else 0
    port = 7125 + idx
    return cls(
        name=name,
        printer_data_dir=str(data),
        config_dir=str(config),
        moonraker_conf=str(config / "moonraker.conf"),
        moonraker_log=str(data / "logs" / "moonraker.log"),
        scripts_dir=str(data / "scripts"),
        macros_dir=str(config / "E3CNC" / "macros"),
        E3CNC_dir=str(config / "E3CNC"),
        printer_cfg=str(config / "printer.cfg"),
        web_root=str(base / "frontend"),
        moonraker_dir=str(ACTIVE_RELEASE_DIR / "vendor" / "moonraker"),
        klipper_dir=str(ACTIVE_RELEASE_DIR / "vendor" / "klipper"),
        moonraker_service=f"e3cnc-{name}-moonraker",
        klipper_service=f"e3cnc-{name}-klipper",
        moonraker_port=port,
        is_running=(config / "moonraker.conf").exists(),
    )

def detect_instances() -> List[Instance]:
    if not INSTANCES_DIR.is_dir():
        return []
    return [
        Instance.from_name(d.name)
        for d in sorted(INSTANCES_DIR.iterdir())
        if d.is_dir() and not d.name.startswith(".")
    ]
```

Total: ~20 lines instead of ~120.

### What gets deleted

| Function | Lines | Replaced by |
|---|---|---|
| `detect_instances()` | 16 | 7 lines above |
| `select_instance()` | 31 | argparse default, or first-found |
| `_instance_name_from_printer_data()` | 12 | Deleted — name = folder name |
| `_default_service_name()` | 8 | Deleted — `f"e3cnc-{name}-moonraker"` inline |
| `_read_service_name()` | 22 | Deleted — no .asvc probing |
| `_read_python_service_dir()` | 12 | Deleted — dir from active release |
| `_read_moonraker_port()` | 7 | Deleted — deterministic port from index |
| `_default_web_root()` | 12+ | Deleted — `base / "frontend"` |
| `from_printer_data()` | 45 | Replaced by `from_name()` ~30 lines |
| `instance_extra_vars()` | 12 | Simplified — all paths known |

Total removed: ~170 lines of probing code.
Total added: ~35 lines of deterministic path construction.

## Bootstrap changes

Current `cmd_install` runs Ansible with `instance_extra_vars` that feeds KIAUH paths. With the new convention, the Ansible role creates:

```yaml
- name: Create instance directory tree
  file:
    path: "{{ e3cnc_root }}/instances/{{ instance_name }}/{{ item }}"
    state: directory
  loop:
    - data/config
    - data/config/E3CNC/macros
    - data/logs
    - data/database
    - data/comms
    - data/scripts
    - data/gcodes
    - frontend
```

And systemd units:

```
/etc/systemd/system/e3cnc-{name}-moonraker.service
/etc/systemd/system/e3cnc-{name}-klipper.service
/etc/systemd/system/e3cnc-{name}-nginx.service
```

nginx server:

```nginx
server {
    listen 80;
    server_name {name}.e3cnc.local;
    root ~/e3cnc/instances/{name}/frontend;
    ...
}
```

## Migration from KIAUH layout

### Detection

```python
def detect_old_layout() -> bool:
    home = Path.home()
    for pattern in ("printer_data", "printer_data_*", "printer_*_data"):
        if any(home.glob(pattern)):
            return True
    return False
```

### Per-instance migration step

For each detected `printer_{name}_data` or `printer_data_{name}`:

1. Parse old instance (current `from_printer_data()`)
2. Create `~/e3cnc/instances/{new_name}/`
3. `mv config/` → `~/e3cnc/instances/{new_name}/data/config/`
4. `mv logs/` → `~/e3cnc/instances/{new_name}/data/logs/`
5. `mv database/` → `~/e3cnc/instances/{new_name}/data/database/`
6. `mv comms/` → `~/e3cnc/instances/{new_name}/data/comms/`
7. `mv scripts/` → `~/e3cnc/instances/{new_name}/data/scripts/`
8. `mv gcodes/` → `~/e3cnc/instances/{new_name}/data/gcodes/`
9. Update `moonraker.conf` paths (database_path, klippy_uds_address, etc.)
10. Web root: move to `~/e3cnc/instances/{new_name}/frontend/`
    or symlink the old web root into the new layout
11. Install new systemd units (`e3cnc-{new_name}-moonraker`)
12. Install new nginx site (`{new_name}.e3cnc.local`)
13. Stop old systemd unit, start new one
14. Remove old printer_data directory

### Name mapping

| Old path | New name |
|---|---|
| `~/printer_data` | `default` |
| `~/printer_test1_data` | `test1` |
| `~/printer_production_data` | by convention, but KIAUH uses `printer_<name>_data` → name = segment |

## CLI changes

- `--instance` / `-p` flag stays, but accepts just the name (`test1`, `lab`, `prod`)
- `e3cnc-cli install --name test1` creates `~/e3cnc/instances/test1/` during bootstrap
- No more `detect_instances()` interactive prompt for single-instance machines
- `e3cnc-cli instances` just lists `~/e3cnc/instances/` subdirectories
- Default instance (when no `--instance`/`--name`): `default` if it exists, else list and prompt

## Open questions for Isaac

1. Port allocation: deterministic from sorted index (7125+idx), or store in a per-instance `manifest.json`? Deterministic is simpler but means renaming an instance changes its port. I'd store it in a manifest.

2. Service naming: `e3cnc-{name}-moonraker` or `e3cnc-moonraker-{name}`? The proposed order groups by service type for `systemctl list-units 'e3cnc-*'`. The reverse groups by instance. Either works.

3. Migration: one-shot CLI command (`e3cnc-cli migrate-instances`) or done incrementally during the next update? One-shot is cleaner for users who explicitly opt in.

4. The `is_running` probe: currently checks if moonraker.conf exists. With the new layout, instance existence = directory exists. Running state would need a systemctl check. Worth keeping or just skip it?
