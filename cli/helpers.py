"""CLI-specific helper functions — not in _e3cnc_shared."""

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

from _e3cnc_shared import (
    Style, ok, info, warn, fail,
    _ssh_run, _ensure_local_sudo_access,
    detect_instances, set_active_instance, get_active_instance,
    instance_extra_vars, Instance,
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
) -> None:
    """Run an Ansible playbook with proper error handling and instance paths."""
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
        extra_vars=extra_vars,
    )

    print(f"  {Style.DIM}{'─' * 50}{Style.RESET}")
    if result.success:
        ok(f"{label} completed")
    else:
        code = result.returncode if hasattr(result, 'returncode') else '?'
        fail(f"{label} failed (exit code {code})")
        sys.exit(1)
