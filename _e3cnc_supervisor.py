"""Supervisor process management for E3CNC instances.

Replaces systemd for managing Moonraker and Klipper processes.
Each instance gets two supervisor programs:

    e3cnc-{name}-moonraker
    e3cnc-{name}-klipper

Configs are written to /etc/supervisor/conf.d/e3cnc-{name}.conf
and managed via supervisorctl.
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from _e3cnc_shared import (
    get_active_instance, detect_instances, Instance,
    ok, info, warn, fail, Style,
)
from _e3cnc_shared import INSTANCES_DIR


# ── Paths ──────────────────────────────────────────────────────────────

SUPERVISOR_CONF_DIR = Path("/etc/supervisor/conf.d")
CURRENT_LINK = Path.home() / "e3cnc" / "current"


# ── Helpers ────────────────────────────────────────────────────────────


def _has_supervisor() -> bool:
    """Check if supervisor is installed."""
    return shutil.which("supervisorctl") is not None


def _ensure_sudo(why: str) -> None:
    """Prompt for sudo access, fail if unavailable."""
    from _e3cnc_shared import _ensure_local_sudo_access
    _ensure_local_sudo_access(why)


def _run_supervisorctl(*args: str) -> subprocess.CompletedProcess:
    """Run supervisorctl with the given args. Returns the result."""
    cmd = ["sudo", "supervisorctl"] + list(args)
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30)


def _get_release_vendor_dir() -> Optional[Path]:
    """Resolve path to current release's vendor directory."""
    if CURRENT_LINK.is_symlink():
        resolved = CURRENT_LINK.resolve()
        return resolved / "vendor"
    return None


# ── Config generation ──────────────────────────────────────────────────


def _generate_config(inst: Instance) -> str:
    """Generate supervisor config content for a single instance."""
    vendor = _get_release_vendor_dir()
    moonraker_dir = vendor / "moonraker" if vendor else Path.home() / "moonraker"
    klipper_dir = vendor / "klipper" if vendor else Path.home() / "klipper"

    moonraker_py = moonraker_dir / "moonraker" / "moonraker.py"
    klipper_py = klipper_dir / "klippy" / "klippy.py"
    klippy_venv = Path.home() / "klippy-env" / "bin" / "python"
    moonraker_venv = Path.home() / "moonraker-env" / "bin" / "python"

    return f"""; E3CNC instance: {inst.name}
; Auto-generated — do not edit manually.

[program:e3cnc-{inst.name}-moonraker]
command={moonraker_venv} {moonraker_py} -c {inst.moonraker_conf}
directory={moonraker_dir}
user={os.environ.get("USER", "root")}
autostart=true
autorestart=true
stopwaitsecs=30
stopasgroup=true
killasgroup=true
stdout_logfile={inst.printer_data_dir}/logs/moonraker.log
stderr_logfile={inst.printer_data_dir}/logs/moonraker.err
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB

[program:e3cnc-{inst.name}-klipper]
command={klippy_venv} {klipper_py} -a {inst.printer_data_dir}/comms/klippy.sock -l {inst.printer_data_dir}/logs/klippy.log {inst.printer_data_dir}/config/printer.cfg
directory={klipper_dir}
user={os.environ.get("USER", "root")}
autostart=true
autorestart=true
stopwaitsecs=30
stopasgroup=true
killasgroup=true
stdout_logfile={inst.printer_data_dir}/logs/klipper.log
stderr_logfile={inst.printer_data_dir}/logs/klipper.err
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
"""


def _config_path(inst: Instance) -> Path:
    """Path to the supervisor config file for an instance."""
    return SUPERVISOR_CONF_DIR / f"e3cnc-{inst.name}.conf"


# ── Public API ─────────────────────────────────────────────────────────


def install_supervisor() -> bool:
    """Install supervisor via apt if not present."""
    if _has_supervisor():
        ok("supervisor already installed")
        return True

    info("Installing supervisor...")
    try:
        subprocess.run(
            ["sudo", "apt-get", "install", "-y", "supervisor"],
            check=True, capture_output=True, timeout=120,
        )
        ok("supervisor installed")
        return True
    except (subprocess.CalledProcessError, OSError, ValueError) as e:
        warn(f"Failed to install supervisor: {e}")
        return False


def register_instance(inst: Instance) -> bool:
    """Create supervisor config for an instance and load it."""
    if not _has_supervisor():
        warn("supervisor not installed — skipping instance registration")
        return False

    _ensure_sudo(f"registering instance {inst.name} with supervisor")

    # Write config
    conf = _generate_config(inst)
    path = _config_path(inst)
    try:
        # Use sudo tee to write as root
        proc = subprocess.Popen(
            ["sudo", "tee", str(path)], stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
        _, stderr = proc.communicate(input=conf.encode(), timeout=15)
        if proc.returncode != 0:
            warn(f"Failed to write supervisor config: {stderr.decode().strip()}")
            return False
        ok(f"Supervisor config written: {path}")
    except OSError as e:
        warn(f"Failed to write supervisor config: {e}")
        return False

    # Load the new config
    _run_supervisorctl("reread")
    _run_supervisorctl("update")

    # Start programs
    _run_supervisorctl("start", f"e3cnc-{inst.name}:*")
    ok(f"Instance '{inst.name}' registered and started")
    return True


def unregister_instance(inst: Instance) -> bool:
    """Stop and remove supervisor config for an instance."""
    if not _has_supervisor():
        return True  # Nothing to do

    _ensure_sudo(f"unregistering instance {inst.name} from supervisor")

    # Stop programs
    _run_supervisorctl("stop", f"e3cnc-{inst.name}:*")

    # Remove config file
    path = _config_path(inst)
    if path.exists():
        try:
            subprocess.run(["sudo", "rm", str(path)], check=True, capture_output=True, timeout=10)
            ok(f"Removed supervisor config: {path}")
        except (OSError, subprocess.CalledProcessError) as e:
            warn(f"Failed to remove supervisor config: {e}")

    # Reload supervisor
    _run_supervisorctl("reread")
    _run_supervisorctl("update")
    return True


def restart_services(inst: Instance) -> bool:
    """Restart an instance's services via supervisorctl."""
    if not _has_supervisor():
        warn("supervisor not available — cannot restart services")
        return False

    _ensure_sudo(f"restarting services for instance {inst.name}")

    # Register instance if not already registered
    if not _config_path(inst).exists():
        info(f"No supervisor config found for '{inst.name}' — registering now...")
        if not register_instance(inst):
            warn("Failed to register instance with supervisor")
            return False

    for name in (f"e3cnc-{inst.name}-moonraker", f"e3cnc-{inst.name}-klipper"):
        result = _run_supervisorctl("restart", name)
        if result.returncode == 0:
            ok(f"{name} restarted")
        else:
            warn(f"{name} restart failed: {result.stderr.strip()}")
    return True


def service_status(inst: Instance) -> dict:
    """Get supervisor status for an instance's services."""
    result = {}
    for name in (f"e3cnc-{inst.name}-moonraker", f"e3cnc-{inst.name}-klipper"):
        r = _run_supervisorctl("status", name)
        result[name] = {
            "running": "RUNNING" in r.stdout,
            "output": r.stdout.strip() or r.stderr.strip(),
        }
    return result


def update_service_paths(inst: Instance) -> bool:
    """Update supervisor config paths after a release switch.
    Supervisor reads the config at process start, so we just restart.
    The 'current' symlink is already updated by the time this runs."""
    if not _has_supervisor():
        return True

    info(f"Re-registering {inst.name} with updated release paths...")
    register_instance(inst)
    return True
