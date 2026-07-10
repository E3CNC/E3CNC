# Multi-Instance Setup

Some machines run multiple Klipper/Moonraker instances on one host. The `e3cnc-tui` supports both legacy KIAUH layouts and the new E3CNC instance layout.

## E3CNC Instance Layout (new)

Fresh installs using `./e3cnc-tui install --name <name>` create this layout:

```
~/e3cnc/instances/
├── default/
│   ├── data/
│   │   ├── config/
│   │   │   ├── printer.cfg
│   │   │   ├── moonraker.conf
│   │   │   └── E3CNC/
│   │   │       └── macros/
│   │   ├── logs/
│   │   │   ├── moonraker.log
│   │   │   └── klippy.log
│   │   └── scripts/
│   └── frontend/
├── cnc_2/
│   └── ...
└── lab/
    └── ...
```

Service names follow the pattern `e3cnc-{name}-moonraker` / `e3cnc-{name}-klipper`.

### Install on a specific instance

```bash
cd ~/E3CNC
./e3cnc-tui install --name cnc_2
```

## KIAUH-style layout (legacy, migration only)

| Directory              | Instance name |
| ---------------------- | ------------- |
| `~/printer_data`       | `cnc`         |
| `~/printer_test1_data` | `test1`       |

For KIAUH-style installs, E3CNC reads instance metadata from the printer data dir:

- `config/moonraker.conf` → Moonraker port
- `systemd/moonraker.env` → shared Moonraker source dir
- `systemd/klipper.env` → shared Klipper source dir
- `moonraker.asvc` → Moonraker service suffix/name

### Migrate from KIAUH to E3CNC layout

```bash
./e3cnc-tui migrate-instances
```

This imports KIAUH instances into the `~/e3cnc/instances/` layout. It copies the port from `moonraker.conf` but generates a clean configuration from the bootstrap template — the original KIAUH files are never modified. Mainsail user preferences (dashboard layout, theme, webcam settings) are imported from the KIAUH Moonraker SQLite database.

## Managing instances with the TUI

When you select "Instances" from the interactive TUI menu, you see:

```
● default        ← active
○ cnc_2
○ lab
```

| Key       | Action                                          |
| --------- | ----------------------------------------------- |
| `↑`/`↓`   | Navigate list                                   |
| `Enter`   | Switch active instance                          |
| `n`       | Create new instance (name + port form)          |
| `d`       | Delete instance (with destructive confirmation) |
| `r`       | Refresh list                                    |
| `q`/`esc` | Return to menu                                  |

Instance data is fetched from the Go instance manager. The active instance is persisted to `~/.e3cnc-tui/state.json`.

## Via CLI (no TUI)

```bash
./e3cnc-tui instances                    # list all instances
./e3cnc-tui --instance cnc_2 status      # run a command on a specific instance
```

## Important behavior

Multi-instance does **not** assume separate copies of:

- `~/moonraker`
- `~/klipper`
- `~/e3cnc` (the repo)

Instead, the model is:

- separate `~/e3cnc/instances/{name}/` directories
- shared `~/moonraker`
- shared `~/klipper`
- shared repo (`~/E3CNC`)
- separate systemd services (`e3cnc-{name}-moonraker`, `e3cnc-{name}-klipper`)

## MCU setup per instance

After installing, configure each instance's MCU:

```bash
# For the 'default' instance:
./e3cnc-tui detect-mcu
./e3cnc-tui init-config
nano ~/e3cnc/instances/default/data/config/printer.cfg
./e3cnc-tui flash-mcu
sudo systemctl start e3cnc-default-klipper
```
