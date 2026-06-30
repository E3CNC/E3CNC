"""CLI-specific helper functions — not in _e3cnc_shared."""

import argparse
import json as _json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple

from _e3cnc_shared import (
    Style, ok, info, warn, fail,
    _ssh_run, _ensure_local_sudo_access,
    detect_instances, set_active_instance, get_active_instance,
    instance_extra_vars, Instance,
)
from _e3cnc_deploy import (
    RELEASES_DIR, DEFAULT_KEEP_RELEASES,
    find_stack_artifact_asset, download_artifact, verify_checksum,
    extract_artifact, run_pre_flight_checks,
    activate_release, deactivate_release, Journal,
    install_pip_deps, run_migrations,
    sync_runtime_files, update_systemd_paths, restart_services,
    run_health_checks, prune_releases,
    backup_deployment_state, rollback_to, rollback_previous, auto_rollback,
)

_DESTRUCTIVE = ("install", "update", "uninstall")


def _confirm_destructive(cmd: str, args: argparse.Namespace) -> bool:
    """Ask for confirmation before destructive commands.
    Skips if --yes, --check, or non-interactive."""
    if cmd not in _DESTRUCTIVE:
        return True
    if args.yes or args.check:
        return True
    if not sys.stdin.isatty():
        return True
    label = {"install": "Install", "update": "Update", "uninstall": "Uninstall"}[cmd]
    print()
    try:
        answer = input(
            f"  {Style.YELLOW}⚠ {label} is a destructive operation. Continue? [y/N] {Style.RESET}"
        ).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    return answer == "y"


def _validate_ssh(host: str) -> bool:
    """Test SSH connection before running a remote command."""
    info(f"Testing SSH connection to {host}...")
    result = _ssh_run(host, "echo connected")
    if result.returncode != 0:
        print()
        fail(f"Cannot connect to {host}. Check:")
        fail(f"  • SSH key is configured: ssh-copy-id {host}")
        fail(f"  • Host is reachable: ping {host.split('@')[-1].split(':')[0]}")
        fail(f"  • SSH config is correct: ssh {host}")
        sys.exit(1)
    ok(f"Connected to {host}")
    return True


def _require_ansible() -> None:
    """Ensure ansible-playbook is available, auto-installing if needed."""
    from _e3cnc_shared import run_ansible

    if shutil.which("ansible-playbook"):
        return

    print(f"  {Style.CYAN}→{Style.RESET} Installing Ansible...")

    def _install_pip() -> bool:
        result = subprocess.run(
            [sys.executable, "-m", "ensurepip", "--upgrade"],
            capture_output=True, text=True,
        )
        if result.returncode == 0 and (shutil.which("pip3") or shutil.which("pip")):
            return True
        info("Installing python3-pip via apt...")
        _ensure_local_sudo_access("installing python3-pip")
        subprocess.run(["sudo", "apt-get", "update"])
        result = subprocess.run(
            ["sudo", "apt-get", "install", "-y", "python3-pip"],
            text=True,
        )
        return result.returncode == 0 and (shutil.which("pip3") or shutil.which("pip"))

    if not shutil.which("pip3") and not shutil.which("pip"):
        info("Installing pip...")
        if not _install_pip():
            fail("Could not install pip. Try: sudo apt install python3-pip")
        ok("pip installed")

    pip_cmd = "pip3" if shutil.which("pip3") else "pip"
    info("Installing Ansible via pip...")
    result = subprocess.run(
        [pip_cmd, "install", "--user", "ansible"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        result = subprocess.run(
            [pip_cmd, "install", "--user", "--break-system-packages", "ansible"],
            capture_output=True, text=True,
        )
    if result.returncode != 0:
        fail(f"Ansible installation failed: {result.stderr}")

    local_bin = Path.home() / ".local" / "bin"
    os.environ["PATH"] = f"{local_bin}:{os.environ.get('PATH', '')}"

    if not shutil.which("ansible-playbook"):
        fail(f"Ansible installed but not found in PATH. Add {local_bin} to your PATH and re-run.")
    ok("Ansible installed")


def _get_instance(args: argparse.Namespace) -> Optional[Instance]:
    """Resolve the active instance from --instance flag or auto-detect."""
    if args.instance:
        instances = detect_instances()
        if args.instance.isdigit():
            idx = int(args.instance) - 1
            if 0 <= idx < len(instances):
                set_active_instance(instances[idx])
                return instances[idx]
        for inst in instances:
            if inst.name == args.instance:
                set_active_instance(inst)
                return inst
            legacy = re.fullmatch(r"cnc_(.+)", inst.name)
            if legacy and legacy.group(1) == args.instance:
                set_active_instance(inst)
                return inst
        warn(f"Instance '{args.instance}' not found. Available: {[i.name for i in instances]}")
        return None

    instances = detect_instances()
    if len(instances) == 0:
        return None
    if len(instances) == 1:
        set_active_instance(instances[0])
        return instances[0]
    for inst in instances:
        if inst.is_running:
            set_active_instance(inst)
            return inst
    set_active_instance(instances[0])
    return instances[0]


def _run_ansible_cmd(
    playbook: Path,
    args: argparse.Namespace,
    label: str,
    extra_tags: str = "",
) -> None:
    """Run an Ansible playbook with proper error handling and instance paths.
    
    Args:
        extra_tags: Comma-separated Ansible tags to limit which roles run.
    """
    from _e3cnc_shared import run_ansible_playbook, header

    _require_ansible()

    if args.remote:
        _validate_ssh(args.remote)

    extra_vars = None
    if not args.remote:
        inst = _get_instance(args)
        if inst:
            extra_vars = instance_extra_vars(inst)
            if inst.name != "cnc":
                info(f"Using instance: {Style.BOLD}{inst.name}{Style.RESET}")

    if not _confirm_destructive(label.lower(), args):
        info("Cancelled")
        return

    header(f"{label}")
    print(f"  {Style.DIM}{'─' * 50}{Style.RESET}")

    result = run_ansible_playbook(
        playbook, args.remote, args.check, args.verbose,
        label, output_callback=lambda line: print(line, end=""),
        extra_vars=extra_vars, tags=extra_tags,
    )

    print(f"  {Style.DIM}{'─' * 50}{Style.RESET}")
    if result.success:
        ok(f"{label} completed")
    else:
        code = result.returncode if hasattr(result, 'returncode') else '?'
        fail(f"{label} failed (exit code {code})")
        sys.exit(1)


def _download_and_activate_release(
    inst: Optional[Instance] = None,
    skip_backup: bool = False,
    auto_yes: bool = False,
    dry_run: bool = False,
) -> str:
    """Download the latest stack artifact, verify, extract, sync, and restart services.

    When dry_run=True, performs discovery, download, backup, and shows what
    would change — but does NOT activate the release or touch live paths.

    Used by both cmd_install and cmd_update. Returns the activated version string.
    """
    from _e3cnc_shared import step, header

    RELEASES_DIR.mkdir(parents=True, exist_ok=True)

    step_num = 1

    def _step(label: str) -> None:
        nonlocal step_num
        step(step_num, 9, label)
        step_num += 1

    _step("Finding latest release")
    asset = find_stack_artifact_asset()
    if not asset:
        fail("No stack artifact found. Create a release on GitHub first, or use a local build.")
    version = asset.get("name", "").replace("e3cnc-stack-", "").replace(".tar.zst", "")
    info(f"Found stack artifact: {asset.get('name', 'unknown')}")

    _step("Downloading artifact")
    download_dir = Path("/tmp") / "e3cnc-download"
    download_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = download_artifact(asset, download_dir)
    if not artifact_path:
        fail("Download failed")

    _step("Verifying checksum")
    if not verify_checksum(artifact_path):
        if auto_yes:
            warn("Checksum mismatch — continuing (--yes set)")
        else:
            reply = input(
                f"  {Style.YELLOW}Checksum mismatch. Continue anyway? [y/N] {Style.RESET}"
            ).strip().lower()
            if reply != "y":
                fail("Cancelled")

    _step("Running pre-flight checks")
    try:
        manifest = _json.loads(artifact_path.with_name("manifest.json").read_text()) if (
            artifact_path.with_name("manifest.json").exists()
        ) else {}
    except (OSError, _json.JSONDecodeError):
        manifest = {}
    if not run_pre_flight_checks(manifest):
        if not auto_yes:
            reply = input(
                f"  {Style.YELLOW}Pre-flight checks failed. Continue? [y/N] {Style.RESET}"
            ).strip().lower()
            if reply != "y":
                fail("Cancelled")

    # Backup configs before anything destructive
    if not dry_run and not skip_backup:
        backup_deployment_state(inst)
    elif dry_run and not skip_backup:
        info("Skipping backup in dry-run mode")

    if dry_run:
        info("Dry-run complete — no files were modified.")
        print()
        info("The following would happen on a real update:")
        print(f"  1. Release v{version} extracted to {RELEASES_DIR / version}")
        print(f"  2. Activated as current release (symlink updated)")
        print(f"  3. Runtime files synced to live paths:")
        print(f"     - Moonraker components (cnc_agent, cnc_metadata)")
        print(f"     - Klipper extras")
        print(f"     - Macros ({inst.E3CNC_dir}/macros/)" if inst else "")
        print(f"     - Metadata extractor")
        print(f"  4. Services restarted (Moonraker, nginx)")
        print(f"  5. Health checks run")
        print(f"  6. Rollback on failure")
        print()
        info("Config files (printer.cfg, moonraker.conf, moonraker DB)")
        info("are backed up and will NOT be overwritten.")
        return version

    _step("Extracting release")
    release_dir = extract_artifact(artifact_path, RELEASES_DIR, version)
    if not release_dir:
        fail("Extraction failed")

    _step("Activating new release")
    journal = Journal.load()
    if not activate_release(version, release_dir, journal):
        fail("Activation failed")

    info("Installing pip dependencies (optional)...")
    if not install_pip_deps(release_dir):
        info("Pip dependencies skipped — continuing")

    info("Running config/schema migrations...")
    run_migrations(release_dir, direction="up")

    _step("Syncing runtime files to live paths")
    if not sync_runtime_files(inst):
        warn("Runtime file sync had issues — continuing")

    _step("Restarting services")
    update_systemd_paths(inst)
    restart_services(inst)

    _step("Running health checks")
    results = run_health_checks(inst)
    all_passed = all(r.passed for r in results)
    for r in results:
        if r.passed:
            ok(f"{r.name}: {r.detail}")
        else:
            warn(f"{r.name}: {r.detail}")

    _step("Finalizing")
    if all_passed:
        journal.last_known_good = version
        journal.save()
        ok(f"Release {version} activated")
        prune_releases(DEFAULT_KEEP_RELEASES)
        return version
    else:
        warn(f"Health checks failed — rolling back to {journal.previous}")
        auto_rollback(journal)
        fail("Release rolled back due to health check failures")


def scan_serial_devices() -> 'list[dict]':
    """Scan for serial/MCU devices and return a list of device dicts.

    Each dict has: path, vendor, model, serial, is_klipper
    Returns empty list if no devices found or if not on Linux.
    """
    import glob

    devices = []

    # 1. Scan udev-managed symlinks (most reliable — stable names)
    serial_by_id = glob.glob("/dev/serial/by-id/*")
    for sp in sorted(serial_by_id):
        try:
            real = os.path.realpath(sp)
            name = os.path.basename(sp)
            # Parse "usb-VENDOR_MODEL_SERIAL-ifXX" format
            rest = name
            if rest.startswith("usb-"):
                rest = rest[4:]
            if rest.startswith("pci-"):
                rest = rest[4:]

            # Split off the -ifXX port suffix
            if "-if" in rest:
                rest = rest[: rest.rindex("-if")]

            # Split vendor_model_serial (underscore-separated)
            parts = rest.split("_")
            if len(parts) >= 3:
                vendor = parts[0]
                model = "_".join(parts[1:-1])
                serial = parts[-1]
            elif len(parts) == 2:
                vendor = parts[0]
                model = parts[1]
                serial = ""
            else:
                vendor = parts[0] if parts else ""
                model = ""
                serial = ""

            # Detect Klipper firmware
            is_klipper = "klipper" in name.lower()

            devices.append({
                "path": sp,
                "real": real,
                "vendor": vendor or "Unknown",
                "model": model or "Unknown",
                "serial": serial or "N/A",
                "is_klipper": is_klipper,
            })
        except (OSError, ValueError):
            continue

    # 2. Fallback: raw tty devices (no udev info available)
    tty_devs = glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*")
    existing = {d["real"] for d in devices}
    for td in sorted(tty_devs):
        real_td = os.path.realpath(td)
        if real_td not in existing:
            devices.append({
                "path": td,
                "real": real_td,
                "vendor": "Unknown",
                "model": f"Serial device ({os.path.basename(td)})",
                "serial": "N/A",
                "is_klipper": False,
            })

    # 3. Check for Klipper Linux MCU process socket
    if os.path.exists("/tmp/klipper_host_mcu"):
        devices.append({
            "path": "/tmp/klipper_host_mcu",
            "real": os.path.realpath("/tmp/klipper_host_mcu") if os.path.islink("/tmp/klipper_host_mcu") else "/tmp/klipper_host_mcu",
            "vendor": "Klipper",
            "model": "Linux MCU Process",
            "serial": "virtual",
            "is_klipper": True,
        })

    return devices


def _generate_cnc_printer_cfg(mcu_path: 'str | None' = None) -> str:
    """Generate a complete CNC printer.cfg with the detected MCU path.

    The output is a well-commented template. Sections marked with
    '!!! ADJUST' need machine-specific values filled in by the user.
    """
    mcu_line = f"serial: {mcu_path}" if mcu_path else "# serial: /dev/serial/by-id/usb-XXXX (run 'e3cnc-cli detect-mcu')"

    return f"""# =============================================================================
# E3CNC — CNC Machine Configuration
# =============================================================================
# Generated by: e3cnc-cli init-config
#
# INSTRUCTIONS:
#   1. Search for "!!! ADJUST" and replace with your machine's values
#   2. Verify step/dir/enable pins match your controller board wiring
#   3. Verify endstop pins and logic
#   4. Verify spindle configuration
#   5. Restart Klipper: sudo systemctl restart klipper
#   6. Run: e3cnc-cli status
#
# For detailed documentation:
#   https://www.klipper3d.org/Config_Reference.html
# =============================================================================

# ── MCU (Micro-Controller) ───────────────────────────────────────────────────
[mcu]
{mcu_line}
baud: 250000
restart_method: command

# ── Printer Kinematics ───────────────────────────────────────────────────────
# CNC machines typically use 'none' for independent axis movement.
# For gantry-style CNCs, use 'cartesian'.
[printer]
kinematics: none
max_velocity: 300        # !!! ADJUST — max safe feedrate (mm/s)
max_accel: 500           # !!! ADJUST — max safe acceleration (mm/s²)
max_z_velocity: 100      # !!! ADJUST — Z max safe feedrate (mm/s)
max_z_accel: 200         # !!! ADJUST — Z max safe acceleration (mm/s²)

# ── Stepper X Axis ───────────────────────────────────────────────────────────
# !!! ADJUST: Set step_pin, dir_pin, enable_pin for your controller board
# !!! ADJUST: Set position_endstop, position_min, position_max for your machine
[stepper_x]
step_pin:                 # !!! e.g., PB13
dir_pin:                  # !!! e.g., PB12
enable_pin: !             # !!! e.g., PB14 (active low = prefixed with !)
microsteps: 16
rotation_distance: 40     # !!! Belt-drive: (pulley_teeth * belt_pitch) / (motor_steps * microsteps)
                           #    Leadscrew: (screw_lead * microsteps) / (full_steps_per_rotation)
endstop_pin: ^            # !!! e.g., ^PC0  (^ = active low)
position_endstop: 0       # !!! Physical position when endstop triggers (mm)
position_min: -1          # !!! Allow minor over-travel past endstop
position_max: 300         # !!! !!! ADJUST — max X travel (mm)
homing_speed: 50          # !!! ADJUST — homing feedrate (mm/s)
homing_retract_dist: 5    # Retract distance after hitting endstop (mm)
homing_positive_dir: true # Direction to move when homing

# ── Stepper Y Axis ───────────────────────────────────────────────────────────
# !!! ADJUST: Same as X axis — set pins and travel limits
[stepper_y]
step_pin:                 # !!! e.g., PB11
dir_pin:                  # !!! e.g., PB10
enable_pin: !             # !!! e.g., PB2
microsteps: 16
rotation_distance: 40
endstop_pin: ^            # !!! e.g., ^PC1
position_endstop: 0
position_min: -1
position_max: 200         # !!! ADJUST — max Y travel (mm)
homing_speed: 50
homing_retract_dist: 5
homing_positive_dir: true

# ── Stepper Z Axis ───────────────────────────────────────────────────────────
# !!! ADJUST: Same as X/Y — set pins and travel limits
[stepper_z]
step_pin:                 # !!! e.g., PB1
dir_pin:                  # !!! e.g., PB0
enable_pin: !             # !!! e.g., PA7
microsteps: 16
rotation_distance: 8      # !!! Leadscrew pitch-dependent
endstop_pin: ^            # !!! e.g., ^PC2
position_endstop: 0
position_min: -5          # Allow minor over-travel for tool changes
position_max: 100         # !!! ADJUST — max Z travel (mm)
homing_speed: 20
homing_retract_dist: 5
homing_positive_dir: true
# second_homing_speed: 10   # Slow approach for precision Z homing
# homing_retract_dist: 3
# homing_positive_dir: false  # Set false if Z homes in negative direction

# ── Endstop Phases (optional — improves repeatability) ──────────────────────
# Enable if your endstops have repeatability issues.
#[endstop_phase]
#trigger_phase: 0

# ── Spindle / Router ─────────────────────────────────────────────────────────
# Two common configurations:
#
# A) Relay control (on/off only) — uncomment [output_pin SPINDLE_RELAY]
#    and wire relay to the listed pin.
#
# B) PWM speed control (variable RPM) — uncomment [pwm_tool SPINDLE]
#    Requires a PWM-capable pin and spindle driver (VFD, PWM controller).

# Option A: Simple relay on/off
#[output_pin SPINDLE_RELAY]
#pin:                            # !!! e.g., PC13
#pwm: false
#value: 0
#shutdown_value: 0

# Option B: PWM speed control
#[pwm_tool SPINDLE]
#pin:                            # !!! e.g., PB7
#cycle_time: 0.010              # PWM frequency = 100 Hz
#hardware_pwm: false
#scale: 100                     # Max RPM at 100% PWM
#maximum: 100
#shutdown_value: 0

# ── Coolant (Flood / Mist) ────────────────────────────────────────────────────
# Uncomment if you have coolant relay(s) wired.
#[output_pin COOLANT_FLOOD]
#pin:                            # !!! e.g., PC14
#value: 0
#shutdown_value: 0

#[output_pin COOLANT_MIST]
#pin:                            # !!! e.g., PC15
#value: 0
#shutdown_value: 0

# ── Safety ────────────────────────────────────────────────────────────────────
[idle_timeout]
gcode:
    M84                    # Disable steppers on idle timeout

[force_move]
enable_force_move: true    # Allow manual jogging from web interface

[pause_resume]             # Required by Moonraker/job_state

[gcode_arcs]
resolution: 1.0            # G2/G3 arc resolution (mm)

# ── Temperature / Monitoring ─────────────────────────────────────────────────
# Uncomment to monitor temperature sensors.
#[temperature_sensor chamber]
#sensor_type: temperature_host
#min_temp: 0
#max_temp: 100

# ── E3CNC Macro Includes ─────────────────────────────────────────────────────
# These provide CNC-specific macros (homing, PAUSE/RESUME, spindle overrides)
# e3cnc_macros.cfg MUST be last to override PAUSE/RESUME correctly.
[include E3CNC/macros/cnc_base.cfg]
[include E3CNC/macros/wcs_macros.cfg]
[include E3CNC/macros/e3cnc_macros.cfg]

# ── User Macros (optional) ───────────────────────────────────────────────────
# Add your own macros below, or include additional config files.
# [include my_macros.cfg]
"""


# ── MCU firmware presets ──────────────────────────────────────────────────────

# Each preset defines:
#   name:        Human-readable label
#   description: Short description of the board
#   config:      List of Kconfig lines to write to .config (MCU + comm interface)
#                make olddefconfig fills in the rest automatically
#   flash_help:  Instructions shown after building
#   alias:       Matched against detected device model names for auto-suggest

MCU_PRESETS: 'list[dict]' = [
    {
        "id": "stm32f103-usb",
        "name": "STM32F103 (USB)",
        "description": "Blue Pill / generic STM32F103 board via USB CDC",
        "config": [
            "CONFIG_LOW_LEVEL_OPTIONS=y",
            "CONFIG_MACH_STM32=y",
            "CONFIG_MACH_STM32F103=y",
            "CONFIG_STM32_USB_PA11_PA12=y",
        ],
        "flash_help": "Put your board in DFU mode (BOOT0=HIGH, then power cycle),\n"
                       "then run: make flash FLASH_DEVICE=0483:df11",
        "alias": ["stm32f103"],
    },
    {
        "id": "stm32f103-serial",
        "name": "STM32F103 (Serial)",
        "description": "Blue Pill / generic STM32F103 via USART1 (PA10/PA9)",
        "config": [
            "CONFIG_LOW_LEVEL_OPTIONS=y",
            "CONFIG_MACH_STM32=y",
            "CONFIG_MACH_STM32F103=y",
            "CONFIG_STM32_SERIAL_USART1=y",
        ],
        "flash_help": "Use an external USB-serial adapter connected to PA10/PA9,\n"
                       "then run: make serialflash FLASH_DEVICE=/dev/ttyUSB0",
        "alias": ["stm32f103"],
    },
    {
        "id": "stm32f407-usb",
        "name": "STM32F407 (USB)",
        "description": "STM32F407 board via USB CDC (common in CNC)",
        "config": [
            "CONFIG_LOW_LEVEL_OPTIONS=y",
            "CONFIG_MACH_STM32=y",
            "CONFIG_MACH_STM32F407=y",
            "CONFIG_STM32_USB_PA11_PA12=y",
        ],
        "flash_help": "Put your board in DFU mode, then run:\n"
                       "make flash FLASH_DEVICE=0483:df11",
        "alias": ["stm32f407"],
    },
    {
        "id": "stm32f446-usb",
        "name": "STM32F446 (USB)",
        "description": "STM32F446 board via USB CDC",
        "config": [
            "CONFIG_LOW_LEVEL_OPTIONS=y",
            "CONFIG_MACH_STM32=y",
            "CONFIG_MACH_STM32F446=y",
            "CONFIG_STM32_USB_PA11_PA12=y",
        ],
        "flash_help": "Put your board in DFU mode, then run:\n"
                       "make flash FLASH_DEVICE=0483:df11",
        "alias": ["stm32f446"],
    },
    {
        "id": "rp2040-usb",
        "name": "RP2040 (USB)",
        "description": "Raspberry Pi Pico or RP2040 board via USB",
        "config": [
            "CONFIG_LOW_LEVEL_OPTIONS=y",
            "CONFIG_MACH_RPXXXX=y",
            "CONFIG_MACH_RP2040=y",
            "CONFIG_RP2040_USB=y",
        ],
        "flash_help": "Hold BOOTSEL while connecting USB, then copy\n"
                       "out/klipper.uf2 to the RPI-RP2 mass storage device",
        "alias": ["rp2040"],
    },
    {
        "id": "linux",
        "name": "Linux MCU Process",
        "description": "Run Klipper as a Linux userspace process (dev/testing)",
        "config": [
            "CONFIG_LOW_LEVEL_OPTIONS=y",
            "CONFIG_MACH_LINUX=y",
        ],
        "flash_help": "No flashing needed. The MCU binary is at out/klipper.elf.\n"
                       "Run it directly: ./out/klipper.elf -I /tmp/klipper_host_mcu",
        "alias": ["linux"],
    },
]


def _find_matching_preset(device: dict) -> 'int | None':
    """Find the index of the best-matching preset for a detected device."""
    model = device.get("model", "").lower()
    for i, preset in enumerate(MCU_PRESETS):
        for alias in preset.get("alias", []):
            if alias in model:
                return i
    return None


def build_klipper_firmware(
    preset_id: str,
    klipper_dir: str = "~/klipper",
    progress_callback=None,
) -> bool:
    """Build Klipper firmware for the given preset.

    Returns True on success, False on failure.
    """
    import glob as _glob
    import shutil as _shutil

    preset = None
    for p in MCU_PRESETS:
        if p["id"] == preset_id:
            preset = p
            break
    if not preset:
        if progress_callback:
            progress_callback(f"Unknown preset: {preset_id}")
        return False

    klipper_path = os.path.expanduser(klipper_dir)

    if not os.path.exists(os.path.join(klipper_path, "klippy", "klippy.py")):
        if progress_callback:
            progress_callback(f"Klipper directory not found: {klipper_path}")
        return False

    def _log(msg):
        if progress_callback:
            progress_callback(msg)

    # Write .config
    config_path = os.path.join(klipper_path, ".config")
    _log(f"Writing config for {preset['name']}...")
    try:
        with open(config_path, "w") as f:
            for line in preset["config"]:
                f.write(line + "\n")
    except OSError as e:
        _log(f"Failed to write config: {e}")
        return False

    # Run make olddefconfig to fill in defaults
    _log("Resolving configuration defaults...")
    result = subprocess.run(
        ["make", "olddefconfig"],
        cwd=klipper_path,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        _log(f"Config resolution failed:\n{result.stderr}")
        return False

    # Run make to build the firmware
    _log("Building firmware (make -j4)...")
    result = subprocess.run(
        ["make", "-j4"],
        cwd=klipper_path,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        _log(f"Build failed:\n{result.stderr[-500:]}")
        return False

    # Verify output
    elf_path = os.path.join(klipper_path, "out", "klipper.elf")
    bin_path = os.path.join(klipper_path, "out", "klipper.bin")
    uf2_path = os.path.join(klipper_path, "out", "klipper.uf2")

    outputs = []
    if os.path.exists(elf_path):
        outputs.append(f"out/klipper.elf ({round(os.path.getsize(elf_path) / 1024)} KB)")
    if os.path.exists(bin_path):
        outputs.append(f"out/klipper.bin ({round(os.path.getsize(bin_path) / 1024)} KB)")
    if os.path.exists(uf2_path):
        outputs.append(f"out/klipper.uf2 ({round(os.path.getsize(uf2_path) / 1024)} KB)")

    if outputs:
        _log(f"Build complete: {', '.join(outputs)}")
        return True
    else:
        _log("Build completed but no output files found in out/")
        return False
