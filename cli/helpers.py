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
) -> str:
    """Download the latest stack artifact, verify, extract, sync, and restart services.

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

    # Backup only for updates (fresh install has nothing to back up)
    if not skip_backup:
        backup_deployment_state(inst)

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


def scan_serial_devices() -> list[dict]:
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
