# E3CNC Single-Deploy Plan

**Version:** 3.0  
**Date:** 2026-06-26  
**Author:** AI Agent  
**Status:** Draft for review  
**Recommendation:** Rename the repo from `E3CNC_UI` to `E3CNC`, flatten the redundant `E3CNC/` internal directory, keep Klipper mostly upstream, and ship **one CI-built stack artifact** applied by **one deploy command**.

---

## 1. Goal

Move E3CNC from a copy-and-patch deployment model to a **single-stack deployment model**:

1. `E3CNC` (the repo, formerly `E3CNC_UI`) is the single source of truth
2. E3CNC Moonraker component files live in the repo at `moonraker/`
3. Klipper stays mostly upstream with a small E3CNC patch/extras layer
4. CI builds **one release artifact** containing the full E3CNC runtime
5. The target machine uses **one deploy/apply command** to update everything together
6. E3CNC supports both **parallel mode** and **replace mode**, with **parallel mode as the default**
7. Existing installations have a defined migration path to the new layout and repo name

---

## 2. Problem with the current model

Today one repo mutates many runtime trees independently:

- `~/mainsail`
- `~/moonraker/...`
- `~/klipper/...`
- `~/printer_data/config/...`
- `~/printer_data/scripts/...`

That creates:

- partial updates
- frontend/backend drift
- repeated patching of foreign trees
- hard rollback
- weak update semantics

The key problem is not the repo layout by itself. The key problem is that **runtime activation is split across many independent copy steps**.

---

## 3. Recommended long-term architecture

## 3.1 Install modes

E3CNC should support two install modes:

### Parallel mode (**default**)

E3CNC installs beside regular Moonraker/Mainsail without mutating the stock stack for that host or instance.

In this mode E3CNC gets its own:

- Moonraker service name
- Moonraker port
- frontend web root / URL path
- config/data directory for the E3CNC-controlled instance
- update-manager entries
- logs and backup scope

**Port allocation in parallel mode:** The default Moonraker port is `7125` (stock). E3CNC parallel mode should allocate ports by adding an offset derived from the instance index. For a host with stock Moonraker on port `7125`, E3CNC's default instance gets `7135`, the next gets `7145`, etc. The CLI must detect port conflicts before activation and refuse to proceed if the port is already in use.

**Reverse proxy:** Parallel mode may require a reverse-proxy snippet (nginx/caddy) to route `<host>/e3cnc/` to the E3CNC Moonraker port. The installer should optionally generate and install this snippet, with the user's consent.

Parallel mode is the default because it is the safest way to support hosts that run:

- stock 3D-printing machines
- CNC machines managed by E3CNC
- multiple instances with different roles on the same host

### Replace mode

E3CNC takes over the selected instance and is allowed to replace the regular Mainsail/Moonraker-facing stack for that instance.

Replace mode may:

- deploy into the standard web root for that instance
- disable or comment conflicting update-manager entries for that same instance
- assume E3CNC is now the primary UI/control-plane for that instance

**Stock stack backup:** Before mutating any stock path, replace mode must snapshot the original state to `~/e3cnc/stock-backup-<date>/`. The snapshot must include:
- `~/mainsail` or the web root directory (full copy)
- The Moonraker service unit file or override
- The original `moonraker.conf`

This snapshot is the escape hatch: `e3cnc-cli uninstall --restore-stock` can reverse a replace-mode install.

Replace mode should be explicit, not implicit.

## 3.2 Product shape

```text
Frontend        -> E3CNC UI (compiled SPA in artifact)
Control plane   -> E3CNC Moonraker components (moonraker/ in repo)
Machine plane   -> Klipper upstream + small E3CNC patch layer
Deployment      -> one stack artifact, one apply step
```

## 3.3 Repo source layout

Recommended source layout after the rename (all source artifacts that feed into a stack release):

```text
E3CNC/                        # the repo (formerly E3CNC_UI)
  src/                          # frontend source
  public/                       # frontend static assets
  moonraker/                    # E3CNC Moonraker component source
    cnc_agent/                  #   cnc_agent.py (Moonraker component)
    cnc_metadata/               #   cnc_metadata.py (Moonraker component)
    mcp/                        #   mcp_server.py + __init__.py (MCP server, not a Moonraker component)
    pyproject.toml              #   shared Python project metadata + deps
    requirements.txt            #   pinned pip dependencies for deployment
  extras/                       # Klipper extras / patch-layer files (was E3CNC/extras/)
    work_coordinate_systems.py
  macros/                       # CNC macros (was E3CNC/macros/)
    cnc_base.cfg
    e3cnc_macros.cfg
    wcs_macros.cfg
  post_processors/              # CAM post-processors + handwheel (was E3CNC/post_processors/)
    klipper/macros/             #   G-code macro files for Klipper
    handwheel/                  #   handwheel firmware + Linux companion app
  scripts/                      # helper scripts deployed with the stack (was E3CNC/scripts/)
    cnc_metadata_extractor.py   #   gcode metadata extractor
    reset_mainsail_db.sh
  build-scripts/                # CI / deploy helper scripts (was scripts/ at repo root)
    post_update.sh
    download_frontend.sh
  examples/                     # example configs (was E3CNC/examples/)
    machine-profile.example.yaml
    update-manager.conf
  theme.json                    # E3CNC branding theme (was E3CNC/theme.json)
  ansible/                      # legacy deploy roles (to be retired)
  tests/                        # tests for all layers
  prd/                          # design documents
```

### Key distinction: shipped vs deployed

Not everything in the repo is a runtime artifact:

| Category | Content | In stack artifact? | Runtime path |
|---|---|---|---|
| Frontend built assets | `src/` + `public/` → compiled SPA | Yes | `~/e3cnc/releases/vX.Y.Z/frontend/` |
| Moonraker components | `moonraker/cnc_agent/`, `moonraker/cnc_metadata/` | Yes | Installed into target Moonraker's `components/` dir |
| MCP server | `moonraker/mcp/` + pip deps | Yes | Installed as systemd unit or sidecar |
| Metadata extractor | `scripts/cnc_metadata_extractor.py` | Yes | `~/e3cnc/releases/vX.Y.Z/scripts/` (symlinked to `~/printer_data/scripts/`) |
| Klipper extras | `extras/` | Yes | Installed into Klipper's `klippy/extras/` |
| Macros | `macros/` | Yes | `~/e3cnc/releases/vX.Y.Z/config/macros/` |
| Post-processor macros | `post_processors/klipper/macros/` | Yes | Same as macros above (merged) |
| Handwheel firmware | `post_processors/handwheel/firmware/` | No | User-managed; shipped in repo only |
| Handwheel Linux app | `post_processors/handwheel/linux/` | No | User-managed; shipped in repo only |
| CAM post-processors | `post_processors/*.cps` | No | User-managed; shipped in repo only |
| Example configs | `examples/` | No | Documentation only |
| theme.json | `theme.json` | Yes | Bundled with frontend or deployed alongside |

## 3.4 Deployment model

The runtime should be updated from **one bundle**, not from a series of unrelated copy operations.

### Source truth
- source lives in the `E3CNC` repo

### Release truth
- CI produces one stack artifact per release

### Runtime truth
- target machine activates one release at a time

---

## 4. Single stack artifact model

## 4.1 Artifact shape

CI should produce one artifact such as:

```text
e3cnc-stack-v0.9.0.tar.zst
```

with an accompanying checksum file:

```text
e3cnc-stack-v0.9.0.tar.zst.sha256
```

Contents should include:

```text
e3cnc-stack-v0.9.0.tar.zst
  manifest.json                 # release metadata (see 4.2)
  frontend/                    # vite-built SPA assets (index.html, js, css, fonts)
  moonraker/
    cnc_agent/                 # Moonraker component: cnc_agent.py
    cnc_metadata/              # Moonraker component: cnc_metadata.py
    mcp/                       # MCP server: mcp_server.py, __init__.py
    requirements.txt           # pinned pip dependencies
    wheels/                    # vendored pip wheels
  klipper/
    extras/
      work_coordinate_systems.py
  config/
    macros/                    # merged macros + post-processor macros
    cnc_base.cfg
    machine-profile.example.yaml
  scripts/
    cnc_metadata_extractor.py
    reset_mainsail_db.sh       # if versioned with the stack
  theme.json                   # E3CNC branding
  migrations/                  # numbered config/state migration scripts
    0001_initial_schema.py
    0002_add_machine_profile.py
```

## 4.2 Release metadata

Each artifact should include a `manifest.json`:

```json
{
  "e3cnc_version": "0.9.0",
  "moonraker_component_version": "0.9.0",
  "klipper_extras_version": "1",
  "config_schema": 2,
  "klipper_requires": ">=0.12.0, <0.13.0",
  "python_requires": ">=3.11",
  "checksum_algorithm": "sha256",
  "checksum": "abc123...",
  "compatibility_notes": "Requires Moonraker v0.9.x"
}
```

### Compatibility checks

Before activating a release, the CLI must validate:

1. **Checksum**: SHA-256 of the downloaded artifact matches the published checksum.
2. **Python version**: The host's Python version satisfies `python_requires`.
3. **Klipper version**: The installed Klipper version falls within `klipper_requires`. The CLI reads this from `~/klipper/klippy/.version` or via `git describe`.
4. **Config schema**: The current schema version (from the deployment journal) is compatible with `config_schema`. If a migration is needed, it must be available in the artifact's `migrations/` directory.
5. **Disk space**: At least 2× the artifact size is free on the target filesystem (for staging + backup).

If any check fails, the update command must refuse to proceed and print an actionable message.

## 4.3 Python dependency management

The Moonraker MCP server and metadata extractor have Python dependencies. These must be handled during deploy:

| Component | Dependencies | Strategy |
|---|---|---|
| `moonraker/mcp/` | `httpx`, `mcp` | CI vendors wheels into artifact at `moonraker/wheels/`. Deploy step runs `pip install --no-index --find-links wheels/ -r requirements.txt` into the host's venv. |
| `scripts/cnc_metadata_extractor.py` | Usually stdlib only | Include in script payload. If deps are added later, vendor wheels the same way. |
| `cnc_agent.py` / `cnc_metadata.py` | Moonraker's venv | These run inside Moonraker's process; they inherit Moonraker's venv. No additional pip install needed unless E3CNC adds non-stdlib imports. |

CI should run `pip download` to vendor all transitive dependencies into the artifact. This avoids network access during deploy and ensures reproducible deployments.

---

## 5. Single deploy/apply model

## 5.1 User-facing command

The safe update path should become one command:

```bash
./e3cnc-cli update
```

or, if renamed later:

```bash
./e3cnc-cli deploy-stack
```

This command is the **authoritative full-stack deploy path**.

## 5.2 Deploy sequence

The command should:

1. **download** the stack artifact (with `.part` extension; atomic rename after checksum)
2. **validate** artifact checksum against published `.sha256` file
3. **run pre-flight compatibility checks** (Python, Klipper, config schema, disk space)
4. **back up mutable state** (printer.cfg, moonraker.conf, Moonraker DB snapshot, journal file)
5. **unpack** into a new versioned release directory under `~/e3cnc/releases/`
6. **install pip dependencies** from vendored wheels (if any)
7. **apply config/schema migrations** (run migration scripts from `migrations/`)
8. **install/sync runtime files** (moonraker components → Moonraker tree, Klipper extras → Klipper tree, macros → printer_data config)
9. **update systemd unit paths** or drop-ins to point to the new release
10. **activate** by switching `~/e3cnc/current` symlink to the new release (atomic)
11. **restart services** in order: Moonraker first, then Klipper (if extras changed)
12. **run health checks** (see 5.4)
13. **on success**: update the deployment journal, mark `last_known_good`
14. **on failure**: automatic rollback to the previous release (see 12.5)

## 5.3 Important rule

The CNC host should **not** build the full stack locally during normal updates.

### Build in CI
- frontend build
- stack packaging
- release metadata generation
- pip wheel vendoring

### Apply on host
- download
- checksum verify
- pre-flight checks
- unpack
- migrate
- pip install (from vendored wheels)
- activate
- verify

This is especially important for low-memory devices.

## 5.4 Health checks

After activation, the CLI must run these health checks in order. If any check fails, the update is considered unhealthy:

| # | Check | Method | Max timeout |
|---|---|---|---|
| 1 | Moonraker process is running | `systemctl is-active <moonraker-service>` | 10s |
| 2 | Moonraker HTTP API responds | `curl -f http://localhost:<port>/server/info` | 15s |
| 3 | Moonraker reports `klippy_connected: true` | Parse `/server/info` JSON response | 15s |
| 4 | New E3CNC component loaded | `curl /machine/cnc_agent/info` returns 200 | 10s |
| 5 | Frontend serves index.html | `curl -f http://localhost:<frontend-port>/index.html` or check web root file | 10s |
| 6 | Deployment journal is consistent | Read `~/e3cnc/journal.json` — `current` matches the new release | 2s |
| 7 | Klipper process is running | `systemctl is-active <klipper-service>` | 10s |

If health check #1 or #2 fails, the CLI should wait and retry up to 3 times with a 5-second backoff before declaring failure.

### Health check failure response

If any health check fails:

1. Log the failure with diagnostic output (service logs, curl response body)
2. Run automatic rollback (see 12.5)
3. Print a summary of what failed and what was rolled back
4. Exit with non-zero status code

---

## 6. Runtime layout

Recommended runtime layout:

```text
~/e3cnc/
  releases/
    v0.9.0/
    v0.9.1/
  current -> ~/e3cnc/releases/v0.9.1
  journal.json
  stock-backup-<date>/          # only present in replace mode
```

Within each release:

```text
~/e3cnc/releases/v0.9.1/
  frontend/
  moonraker/                    # component files + vendored wheels
  klipper/
  config/
  scripts/
  migrations/
  theme.json
  manifest.json
```

## 6.1 Activation model

Runtime paths should resolve from `~/e3cnc/current/`.

That gives:

- one active release
- staged upgrades
- simpler rollback
- much lower partial-state risk

### Atomic activation and crash safety

The activation step switches `~/e3cnc/current` to the new release. This must be atomic:

```bash
ln -sfn releases/v0.9.1 ~/e3cnc/current.new
mv -T ~/e3cnc/current.new ~/e3cnc/current   # atomic rename on same filesystem
```

**Crash during activation:** If power is lost between the `mv` and the service restart, the system boots with `current` pointing to the new (unactivated) release. To handle this:
- The activation step is idempotent: if services are down, the CLI can detect this during the next `status` or `update` call and re-run activation.
- An `e3cnc-cli repair` command detects broken state (services not running, current symlink pointing to an unactivated release) and re-runs the activation sequence.
- The journal's `last_known_good` field provides a fallback: if `current` is broken, the CLI can fall back to `last_known_good`.

**Broken symlink detection:** If `~/e3cnc/current` is a dangling symlink (e.g., the target release directory was manually deleted), every CLI command should detect this on startup and offer to repair by falling back to `last_known_good` from the journal.

## 6.2 Integration with live paths

The stack still needs to connect to the live machine paths, but activation should be driven from the single release root.

### Systemd unit management

Moonraker and Klipper systemd units reference specific paths. The activation step must update these to point to the current release:

| Service | Path to update | Mechanism |
|---|---|---|
| Moonraker | `WorkingDirectory`, `ExecStart` path to Moonraker source | Systemd drop-in (`/etc/systemd/system/<service>.d/e3cnc-override.conf`) |
| Moonraker | `-c <config_path>` argument | Via env file or drop-in override of `MOONRAKER_ARGS` |
| Klipper | `ExecStart` path to Klipper source (if extras changed) | Drop-in override of `KLIPPER_ARGS` |
| MCP server | New systemd unit referencing `~/e3cnc/current/moonraker/mcp/` | Full unit file, installed on first deploy |

The systemd drop-in approach is preferred because it doesn't modify the upstream unit file and can be cleanly removed on uninstall.

### Path resolution

Examples of how the active release integrates with live paths:

- **Frontend:** Symlinked or synced to the web root (`~/mainsail` in replace mode, `~/e3cnc-current-frontend` in parallel mode).
- **Moonraker components:** Symlinked or copied into the Moonraker `components/` tree. The activation script manages these symlinks pointing to `~/e3cnc/current/moonraker/`.
- **Klipper extras:** Symlinked into Klipper's `klippy/extras/` directory.
- **Macros/config:** Symlinked or included via `[include]` directives in `printer.cfg` / `moonraker.conf`.

The important point is that these are all derived from **one release**, not from independent source copies.

## 6.3 Multi-instance architecture

This deployment model must support multiple CNC instances on one host.

### Shared on the host

These should be shared across all instances:

- downloaded stack artifact
- extracted release payload under `~/e3cnc/releases/...`
- active release pointer `~/e3cnc/current`
- frontend payload
- Moonraker component payload
- Klipper extras payload
- vendored pip wheels

### Per-instance on the host

These remain instance-specific:

- `printer_data` / `printer_*_data` directories
- `moonraker.conf` per instance
- `printer.cfg` per instance
- Moonraker service name per instance
- Klipper service name per instance
- Moonraker port per instance
- frontend web root / route per instance when needed
- instance-specific include/config wiring
- logs, health checks, backups, and restore scope
- Systemd drop-in files (each instance has its own override)

### Design rule

The **release is shared**, but **activation is instance-aware**.

That means the host installs the release payload once, then applies the instance-specific bindings for the selected instance or for all detected instances.

### Parallel mode requirement

In **parallel mode** the installer must not mutate the stock Moonraker/Mainsail stack for unrelated instances.

That means E3CNC should use its own per-instance:

- Moonraker service name
- Moonraker port
- frontend web root or URL path
- instance data/config scope

And it must not implicitly:

- overwrite the stock `~/mainsail`
- assume `moonraker.service`
- assume port `7125`
- disable stock update-manager entries for unrelated instances

### Command model

Per-instance apply:

```bash
./e3cnc-cli --instance test1 update
```

This should:

- reuse the shared release payload
- apply config/macro wiring for `test1`
- restart only that instance's Moonraker and Klipper services

All-instances apply:

```bash
./e3cnc-cli update --all-instances
```

This should:

- install the shared release once
- apply per-instance bindings for every detected instance
- restart services instance-by-instance in a controlled order

### Compatibility with current detection

The future model should preserve the current instance-aware behavior already implemented in `e3cnc-cli`, including support for:

- legacy layouts such as `printer_data`, `printer_data_2`
- KIAUH-style layouts such as `printer_test1_data`, `printer_test2_data`
- per-instance Moonraker/Klipper service names
- per-instance Moonraker ports derived from instance metadata

## 6.4 Release GC / disk space management

Old releases accumulate in `~/e3cnc/releases/`. The CLI should manage this with a configurable retention policy.

### Default policy

- Keep the **3 most recent releases** on disk.
- The rollback target (`previous`) is always preserved, even if it is the 4th-most-recent.
- `last_known_good` is always preserved.

### CLI commands

```bash
./e3cnc-cli releases                        # list all with size + age
./e3cnc-cli prune-releases                  # prune old releases (default: keep 3)
./e3cnc-cli prune-releases --keep 5         # custom retention
./e3cnc-cli prune-releases --dry-run        # show what would be pruned
```

### GC timing

Pruning runs automatically after a successful update, but only if the update didn't need a rollback. If prune would delete the rollback target, it is deferred until another release is installed.

---

## 7. Moonraker components in the repo

## 7.1 Recommendation

E3CNC Moonraker component files live in:

```text
E3CNC/moonraker/
```

This is the control-plane source of truth.

**Important clarification:** This is **not** a full fork of upstream Moonraker. It is a collection of E3CNC-specific component files and the MCP server that are deployed into a standard upstream Moonraker installation. The target machine must already have Moonraker installed (from the upstream repo or package). The deploy step installs these component files into the relevant paths inside the target's Moonraker tree.

## 7.2 What moves into `moonraker/`

| Source (old, `E3CNC_UI` layout) | Destination (new, `E3CNC` layout) | Type |
|---|---|---|
| `E3CNC/moonraker-mcp/src/moonraker_mcp/cnc_agent.py` | `moonraker/cnc_agent/cnc_agent.py` | Moonraker component |
| `E3CNC/moonraker-mcp/src/moonraker_mcp/cnc_metadata.py` | `moonraker/cnc_metadata/cnc_metadata.py` | Moonraker component |
| `E3CNC/moonraker-mcp/src/moonraker_mcp/mcp_server.py` | `moonraker/mcp/mcp_server.py` | Standalone MCP server |
| `E3CNC/moonraker-mcp/src/moonraker_mcp/__init__.py` | `moonraker/mcp/__init__.py` | MCP server package init |
| `E3CNC/moonraker-mcp/pyproject.toml` | `moonraker/pyproject.toml` | Python project metadata |
| `E3CNC/moonraker-mcp/moonraker.conf` | `moonraker/moonraker.conf.example` | Example config |
| `E3CNC/moonraker-mcp/tests/` | `tests/moonraker/` | Tests |

### What about the existing `moonraker-mcp`?

After the move, the old `E3CNC/moonraker-mcp/` directory is deleted. All tests move to `tests/moonraker/`.

## 7.3 What should stop

Retire the current model where E3CNC copies custom files into:

- `~/moonraker/moonraker/components/...`

That model should be replaced by deployment of the Moonraker component files from the stack artifact, driven by the release symlink structure.

---

## 8. Klipper strategy

## 8.1 Recommendation

Keep Klipper mostly upstream.

## 8.2 Keep only a small E3CNC patch/extras layer

Examples:

- `extras/work_coordinate_systems.py` — any minimal CNC-specific hooks that truly belong in Klipper

## 8.3 Rule

If a feature can live in Moonraker, it should **not** go into Klipper.

That keeps the machine plane narrow and reduces maintenance burden.

## 8.4 Compatibility validation

Because Klipper is upstream and updated independently, the release artifact must declare a `klipper_requires` version range in its manifest. The deploy step checks the installed Klipper version before activating. If there's a mismatch, the CLI warns and asks for confirmation before proceeding.

---

## 9. What changes in the installer

## 9.1 Current logic to retire

These patterns should be phased out:

- vendoring Moonraker component files into upstream Moonraker trees via Ansible copy tasks
- treating frontend deploy, Moonraker patching, Klipper extras, and macros as unrelated update flows
- using Moonraker Update Manager as if it were the full E3CNC updater
- building frontend on-device (for low-memory targets)
- referencing the repo as `E3CNC_UI` (now `E3CNC`)

## 9.2 Installer responsibilities in the new model

`e3cnc-cli` should become the stack apply tool.

It should own:

- artifact download
- checksum validation
- pre-flight compatibility checks
- staging
- migration (config + DB)
- pip dependency installation
- systemd unit management
- activation
- restart order
- health validation
- rollback
- release GC

## 9.3 Current files that will need refactor

- `e3cnc-cli` — update all `E3CNC_UI` references to `E3CNC`
- `_e3cnc_shared.py` — update path references
- `ansible/playbooks/install.yml` — update `repo.dest` to `~/E3CNC`
- `ansible/playbooks/redeploy.yml` — same
- `ansible/playbooks/uninstall.yml` — same
- `ansible/vars/main.yml` — update `repo.dest` and `repo.url`
- `build-scripts/post_update.sh` — update path references

## 9.4 Current files/roles likely to retire or shrink heavily

- `ansible/roles/agent/tasks/main.yml`
- parts of `ansible/roles/moonraker-config/tasks/main.yml`
- parts of `ansible/roles/klipper-extras/tasks/main.yml`
- parts of `ansible/roles/macros/tasks/main.yml`
- parts of `ansible/roles/frontend/tasks/main.yml`
- ad-hoc multi-destination copy logic across deploy roles

---

## 10. Configuration strategy

The deploy model should stop treating the main config files as endlessly patched documents.

## 10.1 Desired state

Keep installer-managed config limited to:

- enabling E3CNC-owned includes
- instance-specific path wiring where necessary
- release activation wiring

## 10.2 Distinguish E3CNC-managed sections from user-managed sections

Config files like `moonraker.conf` and `printer.cfg` contain both E3CNC-managed sections and user-edited sections. The deploy script must not overwrite user-managed sections.

**Approach:** Use `[include]` directives to pull in E3CNC-managed content from separate files:

```ini
# In moonraker.conf (user-managed):
[include E3CNC/moonraker_e3cnc.conf]

# In printer.cfg (user-managed):
[include E3CNC/printer_e3cnc.cfg]
[include E3CNC/macros/*.cfg]
```

The included files live in the printer_data config directory and are managed by the deploy step (symlinked from the release). The user's `moonraker.conf` and `printer.cfg` are only touched during initial install to add the include lines, and are never line-by-line patched again.

## 10.3 Avoid

- repeated line-by-line mutation of the same config files across many deploy phases
- regex-based sed patching of config files

---

## 11. Update Manager stance

Under this recommendation, **Moonraker Update Manager is not the primary full-stack updater**.

This is especially important in **parallel mode**, where stock Moonraker/Mainsail may still exist on the same host. E3CNC should not rely on update-manager behavior that mutates or replaces the stock stack implicitly.

The primary full-stack updater is:

```bash
./e3cnc-cli update
```

### Update Manager for visibility only

E3CNC may still register an `[update_manager E3CNC]` entry in `moonraker.conf`, but with a degraded role:

- It reports the current E3CNC version (read from the deployment journal)
- It **does not** run `git pull` or invoke `post_update_script`
- Instead, it displays a message: "Use `./e3cnc-cli update` to update E3CNC"
- In parallel mode, this entry belongs to the E3CNC Moonraker instance, not the stock one
- The update manager's `origin` points to `https://github.com/E3CNC/E3CNC.git`

**Migration note:** Existing installations have `[update_manager E3CNC_UI]`. During the rename, this must be changed to `[update_manager E3CNC]` pointing to the new repo URL. The `migrate-layout` CLI command handles this automatically.

This approach guarantees:

- one artifact
- one apply step
- one authoritative updater

---

## 12. Rollback design

Rollback should be implemented as **release switching**, not as a best-effort reversal of many copy operations.

## 12.1 Release rollback model

Keep immutable release directories on disk:

```text
~/e3cnc/releases/v0.9.0/
~/e3cnc/releases/v0.9.1/
~/e3cnc/current -> ~/e3cnc/releases/v0.9.1
```

Rollback then becomes:

1. stop or quiesce affected services
2. switch `~/e3cnc/current` to a previous release
3. re-apply any release-linked instance activation if needed (symlinks, paths)
4. run **reverse migrations** if the new release changed the config schema or database
5. restore mutable state snapshot if one was taken
6. restart services
7. run health checks

## 12.2 Mutable state vs release payload

Rollback must distinguish between:

### Immutable release payload
These should live inside a release directory:

- frontend assets
- Moonraker component files
- MCP server payload
- Klipper extras payload
- E3CNC macros/config fragments
- helper scripts that are versioned with the stack
- migration scripts
- manifest and release metadata
- vendored pip wheels

### Mutable instance state
These should be backed up before update/migration:

- `printer.cfg`
- `moonraker.conf`
- user-edited config fragments (included files)
- Moonraker DB state (if touched by migrations)
- generated local machine state (e.g., `wcs_offsets.json`)
- Moonraker database file (typically `~/.moonraker_database` or `~/printer_data/database/`)

### Moonraker DB state

E3CNC components write data to Moonraker's internal database. The plan must identify every DB namespace used:

| Component | DB namespace | Data | Rollback-safe? |
|---|---|---|---|
| `cnc_agent` | `cnc_agent.settings` | Dashboard settings, jog rate limit | Yes — can be backed up/restored as JSON |
| `cnc_agent` | `cnc_agent.state` | Last WCS, spindle state | Yes — restored from backup |
| Frontend | `mainsail.*` | UI settings, file browser state | Yes — backed up/restored |

**Backup strategy for Moonraker DB:** Before update, export all E3CNC-owned DB namespaces via Moonraker's `/server/database/export` API. On rollback, import them back. This avoids backing up the entire SQLite file (which could be large and include other Moonraker internal state).

If a Moonraker component changes its internal DB schema, a **data migration script** must be provided in the release's `migrations/` directory. The migration must be reversible (define `up()` and `down()` methods) so rollback can run the reverse migration.

This means rollback has two scopes:

1. **release rollback** — switch code/runtime/assets to a previous release
2. **state rollback** — restore mutable config/state if the failed release changed it

## 12.3 Deployment journal

Track active and historical release state in a small journal file at `~/e3cnc/journal.json`:

```json
{
  "current": "v0.9.1",
  "previous": "v0.9.0",
  "last_known_good": "v0.9.0",
  "applied_at": "2026-06-25T18:00:00Z",
  "config_schema": 2,
  "config_schema_previous": 1,
  "state_backup_path": "~/e3cnc/backups/pre-v0.9.1-20260625T180000/"
}
```

This makes rollback deterministic and machine-readable. The journal is read and validated on every CLI command invocation.

## 12.4 CLI shape

Recommended commands:

```bash
./e3cnc-cli releases
./e3cnc-cli rollback --previous
./e3cnc-cli rollback v0.9.0
```

### `releases`
Should show:

- installed releases (with size and date)
- current release (highlighted)
- previous release
- last known good release
- available disk space

### `rollback --previous`
Should:

- select the previously active release
- restore the matching state snapshot if required
- run reverse migrations if schema changed
- restart services
- run health checks

### `rollback <version>`
Should:

- activate a specific installed release
- verify compatibility with instance state
- restore matching state backup when needed
- run reverse migrations if needed
- restart services
- run health checks

## 12.5 Update flow with rollback support

Recommended update sequence:

1. download artifact (with `.part` staging; atomic rename after checksum)
2. verify artifact checksum
3. run pre-flight compatibility checks (Python, Klipper, disk space)
4. back up mutable state (config files, DB namespaces, journal)
5. unpack into a new versioned release directory
6. install pip dependencies (from vendored wheels)
7. run forward config/schema migrations (from `migrations/`)
8. activate: update systemd paths, switch `current` symlink (atomic)
9. restart services in order (Moonraker first, then Klipper)
10. run health checks (defined in 5.4)
11. **if healthy**: update journal (`previous = old current`, `last_known_good = new current`)
12. **if unhealthy**: automatic rollback:
    a. switch `current` back to the previous release
    b. run reverse migrations if forward migrations ran
    c. restore mutable state snapshot
    d. restart services
    e. run health checks on the restored state
    f. log failure details
    g. exit with non-zero status code

## 12.6 Scope for multi-instance hosts

For the first implementation, rollback should remain **host-version scoped**:

- one host
- one active E3CNC release
- all instances on that host roll back together

### Constraint this places on the release format

Because releases are shared across instances, per-instance mixed versions are impossible without making releases instance-specific. If per-instance mixed-version rollback is ever needed, the release directory structure would need to change to:

```text
~/e3cnc/releases/
  test1/
    v0.9.0/
    v0.9.1/
  test2/
    v0.9.0/
```

This adds significant complexity (per-instance GC, per-instance journal, N× the disk usage). The plan does not recommend this for the first implementation.

---

## 13. Migration from existing installations

Two migrations are involved:

### Migration A: rename from `E3CNC_UI` to `E3CNC`

The repo on GitHub is renamed from `E3CNC/E3CNC_UI` to `E3CNC/E3CNC`. This affects:

- All local clones (remote URL changes)
- All `[update_manager E3CNC_UI]` entries in moonraker.conf
- All `~/E3CNC_UI/` path references in scripts, ansible vars, and CLI code
- The nightly release asset name (was `E3CNC_UI-<version>.zip`, now `E3CNC-<version>.zip`)
- The deployment artifact name

### Migration B: new runtime layout (`~/e3cnc/releases/`)

Existing installations have files scattered across `~/moonraker/`, `~/mainsail/`, `~/printer_data/config/`, etc. The new layout (`~/e3cnc/releases/`) is a clean start. A migration command bridges the gap.

### Unified migration command

```bash
./e3cnc-cli migrate-layout
```

This should:

1. Detect that the current installation uses the old layout (no `~/e3cnc/` directory)
2. Update remote URL from `E3CNC_UI.git` to `E3CNC.git` (if still pointing at old repo)
3. Download the latest stack artifact (from the renamed repo's releases)
4. Create `~/e3cnc/` directory structure
5. Unpack the artifact into `~/e3cnc/releases/<version>/`
6. Back up existing state (config, DB namespaces)
7. Create the `~/e3cnc/current` symlink
8. Sync runtime files from the release into the existing live paths (Moonraker components, Klipper extras, macros, frontend web root)
9. Update systemd drop-ins to reference the new paths
10. Rewrite `[update_manager E3CNC_UI]` → `[update_manager E3CNC]` in moonraker.conf
11. Update the journal
12. Run health checks
13. If healthy, mark migration complete. Future updates use the new stack-artifact flow.

### Coexistence during migration

During migration, the old files (`~/moonraker/moonraker/components/cnc_agent/`, etc.) remain in place and are overwritten by the new release's symlinks or copies. The old Ansible-based update path is disabled after migration (the CLI refuses to run `ansible-playbook` directly).

### Bootstrap install (clean host)

```bash
./e3cnc-cli install --mode parallel
```

For a clean host without E3CNC, this command:

1. Checks dependencies (Python, systemd, git)
2. Clones the `E3CNC` repo
3. Downloads the latest stack artifact
4. Creates `~/e3cnc/` structure
5. Unpacks and activates the first release
6. Configures per-instance bindings
7. Adds `[update_manager E3CNC]` to moonraker.conf
8. Installs systemd drop-ins or unit files
9. Starts services
10. Runs health checks

---

## 14. Migration phases

### Installer defaults

The installer/CLI should default to:

```bash
./e3cnc-cli install --mode parallel
```

and require an explicit choice for replace behavior, for example:

```bash
./e3cnc-cli install --mode replace
```

The migration work should preserve this policy throughout the redesign.

---

## Phase 0 — Rename repo and flatten layout

### Objective
Rename the repo from `E3CNC_UI` to `E3CNC` on GitHub and flatten the internal directory structure.

### Work
- Rename `https://github.com/E3CNC/E3CNC_UI` → `https://github.com/E3CNC/E3CNC`
- Update all local remote URLs on developer machines
- Flatten directory layout per §3.3:
  - `E3CNC/extras/` → `extras/`
  - `E3CNC/macros/` → `macros/`
  - `E3CNC/post_processors/` → `post_processors/`
  - `E3CNC/scripts/` → `scripts/`
  - `E3CNC/theme.json` → `theme.json`
  - `E3CNC/examples/` → `examples/`
  - `scripts/` (repo root) → `build-scripts/`
  - Delete `E3CNC/` directory (now empty)
- Update all internal file references that point to old paths
- Update `ansible/vars/main.yml`:
  - `repo.url: https://github.com/E3CNC/E3CNC.git`
  - `repo.dest: '{{ ansible_env.HOME }}/E3CNC'`
- Update `_e3cnc_shared.py` version mismatch messages
- Update `build-scripts/post_update.sh` path references
- Update CI workflow `build-frontend.yml`: asset name `E3CNC-<version>.zip`
- Update `AGENTS.md`

### Exit criteria
- Repo is renamed on GitHub
- All paths in code reference the new layout
- CI produces assets named `E3CNC-*.zip`

---

## Phase 1 — Identify all stack artifact outputs

### Objective
Inventory everything that the stack artifact must contain.

### Work
- identify all runtime outputs currently produced by install/redeploy (frontend, moonraker components, klipper extras, macros, metadata extractor, scripts)
- identify all files that are shipped vs deployed (see §3.3 table)
- define the future stack artifact contents (complete inventory per §4.1)
- define release metadata format (per §4.2)
- define the `migrations/` directory convention

### Exit criteria
- there is a written inventory of what the stack artifact must contain
- every deployable file has a home in the source layout

---

## Phase 2 — Move Moonraker source into `moonraker/`

### Objective
Move the control-plane component files into the repo at `moonraker/`.

### Work
- create `moonraker/` with subdirectories `cnc_agent/`, `cnc_metadata/`, `mcp/`
- move all 4 Python files from `E3CNC/moonraker-mcp/` into their new homes
- move `pyproject.toml` and tests
- add `requirements.txt` with pinned deps for CI wheel vendoring
- delete the old `E3CNC/moonraker-mcp/` directory
- update all internal references that import from the old paths

### Exit criteria
- all E3CNC Moonraker runtime code is owned by `moonraker/`
- the old `E3CNC/moonraker-mcp/` directory is deleted

---

## Phase 3 — Build one stack artifact in CI

### Objective
Replace loose runtime outputs with one packaged release.

### Work
- build frontend in CI
- vendor pip wheels via `pip download`
- package Moonraker components payload
- package MCP server payload
- package Klipper extras payload
- package macros/config payload (merge `macros/` + `post_processors/klipper/macros/`)
- package `scripts/cnc_metadata_extractor.py`
- package `theme.json`
- generate manifest / metadata
- generate SHA-256 checksum
- publish one stack artifact per release (named `e3cnc-stack-v<version>.tar.zst`)
- update nightly release to also publish the stack artifact

### Exit criteria
- one release artifact can represent the full E3CNC runtime
- CI output includes `*.tar.zst` and `*.tar.zst.sha256`

---

## Phase 4 — Introduce staged runtime activation

### Objective
Deploy releases through a release root rather than direct ad-hoc copies.

### Work
- implement `~/e3cnc/releases/...`
- implement `~/e3cnc/current` (atomic symlink)
- implement `~/e3cnc/journal.json`
- stage artifact unpacking before activation (with `.part` download pattern)
- add rollback behavior (release switching + state restore)
- add release GC (`prune-releases --keep 3`)
- add broken symlink detection and repair
- add `releases` CLI command
- add `rollback` CLI command

### Exit criteria
- updates are staged and activated as one release
- rollback is functional
- old releases are cleaned up automatically

---

## Phase 5 — Add migration path for existing installations

### Objective
Give existing installs a way to adopt the new layout and repo name.

### Work
- implement `e3cnc-cli migrate-layout` (handles repo rename + layout migration)
- implement bootstrap `e3cnc-cli install` for clean hosts
- handle `[update_manager E3CNC_UI]` → `[update_manager E3CNC]` rewrite
- handle coexistence: old files get overwritten by new release symlinks
- disable old Ansible-based update path after migration

### Exit criteria
- existing installations can migrate to the new layout and repo name
- clean hosts can install directly into the new layout

---

## Phase 6 — Implement config/schema migration system

### Objective
Make config and database changes safe to apply and roll back.

### Work
- define migration script interface (`up()` / `down()`)
- implement migration runner in CLI
- add Moonraker DB namespace backup/restore
- add config file backup/restore
- integrate migrations into the update flow (forward on deploy, reverse on rollback)
- define schema 1 (baseline) and schema 2 (first migration)

### Exit criteria
- config schema migrations are applied and reversed correctly
- Moonraker DB state is backed up before updates

---

## Phase 7 — Add health checks and crash safety

### Objective
Make the update flow reliable even under adverse conditions.

### Work
- implement all 7 health checks defined in §5.4
- implement automatic rollback on health-check failure
- implement idempotent activation (recoverable after power loss)
- add `e3cnc-cli repair` for broken-state recovery
- implement pre-flight checks (Python, Klipper, disk space, compatibility)

### Exit criteria
- updates are automatically rolled back if health checks fail
- power-loss during activation is recoverable

---

## Phase 8 — Rewrite `e3cnc-cli update` as the stack apply tool

### Objective
Make one command the full-stack deployment authority.

### Work
- artifact download + checksum validation
- pre-flight compatibility checks
- mutable state backup
- unpack + pip install
- migration hooks
- activation logic (symlinks, systemd drop-ins)
- restart orchestration (Moonraker → Klipper)
- health checks
- rollback
- journal management
- release GC

### Exit criteria
- one command updates the full E3CNC stack together
- all rollback paths are tested

---

## Phase 9 — Reduce legacy deploy roles

### Objective
Retire the old multi-copy mental model.

### Work
- remove Ansible Moonraker vendoring role
- remove Ansible Klipper-extras copy role
- remove Ansible macros copy role
- remove ad-hoc multi-destination copy logic across deploy roles
- narrow remaining Ansible roles to activation-oriented logic only
- update `build-scripts/post_update.sh` to call `./e3cnc-cli update` instead of `ansible-playbook`

### Exit criteria
- deploy no longer feels like many unrelated copy operations
- `build-scripts/post_update.sh` delegates to `e3cnc-cli update`

---

## 15. Config/schema migration system detail

### Script interface

Each migration script in `releases/<version>/migrations/` must expose:

```python
# migrations/0002_add_machine_profile.py

SCHEMA_VERSION = 2

def up(state: dict, api: MigrationAPI) -> dict:
    """Upgrade state from schema 1 to schema 2."""
    state.setdefault("machine_profile", {})
    return state

def down(state: dict, api: MigrationAPI) -> dict:
    """Reverse from schema 2 back to schema 1."""
    state.pop("machine_profile", None)
    return state
```

### Migration runner

The CLI:

1. Reads the current `config_schema` from `journal.json`
2. Finds all migrations with `SCHEMA_VERSION > current_schema`, sorted ascending
3. Runs each `up()` function in order, passing the current state dict and an API object
4. After all forward migrations succeed, writes the new config schema version to the journal
5. On rollback: finds all migrations with `SCHEMA_VERSION > target_schema`, sorted descending
6. Runs each `down()` function in reverse order

### Schema version zero

`schema: 0` means "no E3CNC migration system exists yet" (pre-migration installations). The initial migration (`0001`) creates the baseline schema and populates any default state.

---

## 16. Success criteria

This migration is successful when:

- The repo is renamed from `E3CNC_UI` to `E3CNC` with flattened layout
- Moonraker component source lives in `moonraker/`
- CI produces one full stack artifact with checksums and vendored wheels
- the host applies one release at a time through the release-root layout
- `e3cnc-cli update` is the authoritative full-stack update path
- frontend, Moonraker components, MCP server, extras, macros, and config move together
- rollback is practical (release switching + state restore)
- health checks prevent bad updates from going live
- power loss during activation is recoverable
- Klipper remains mostly upstream, with validation against the release manifest
- existing installations have a migration path (`e3cnc-cli migrate-layout`)
- old releases are pruned automatically to save disk space
- Moonraker DB state is backed up before updates

---

## 17. Non-goals

This plan does **not** propose:

- a broad Klipper fork
- a full Moonraker fork (only component files live in the repo)
- continued reliance on split frontend/backend update flows
- using Moonraker Update Manager as the primary full-stack updater
- building the full stack on the target machine during normal updates
- keeping the repo named `E3CNC_UI`
- making replace-mode behavior the default install mode
- per-instance mixed-version rollback in the first implementation
- Docker/containerized deployment of the stack (native Linux only)

---

## 18. First implementation slice

Best first vertical slice:

1. Rename repo on GitHub (`E3CNC_UI` → `E3CNC`) and flatten layout per §3.3
2. Create `moonraker/` with the 4 Python files + deps
3. Define the complete stack artifact manifest (per §4.1)
4. Add CI packaging for a first stack bundle (frontend + components + extras + deps)
5. Prototype staged unpack/apply in `e3cnc-cli` (download → checksum → unpack → activate)
6. Implement `~/e3cnc/releases/` + `current` symlink + `journal.json`
7. Add `releases` and `rollback --previous` CLI commands
8. Retire `ansible/roles/agent/`

That slice starts the real architecture shift without forcing an immediate config migration, health check implementation, or Klipper redesign. Subsequent slices add migration, health checks, GC, and legacy role retirement in phases 4–9.
