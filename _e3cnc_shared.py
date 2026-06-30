"""
Shared command logic for e3cnc-cli and e3cnc-tui.

Contains all the core functionality: Ansible wrappers, dependency checks,
install/deploy/update/uninstall/status/backup/restore/diagnose/logs.

This file is imported by both the CLI (e3cnc-cli) and TUI (e3cnc-tui) frontends.
"""

import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass
from typing import List, NoReturn, Optional, Tuple, Set, TextIO

# ── Metadata ────────────────────────────────────────────────────────────────

VERSION = "0.8.4"
TOOL_NAME = "e3cnc-cli"

# ── Paths (relative to this script's location) ─────────────────────────────

HERE = Path(__file__).resolve().parent
ANSIBLE_DIR = HERE / "ansible"
PLAYBOOKS_DIR = ANSIBLE_DIR / "playbooks"
SCRIPTS_DIR = HERE / "scripts"

INSTALL_PLAYBOOK = PLAYBOOKS_DIR / "install.yml"
DEPLOY_PLAYBOOK = PLAYBOOKS_DIR / "deploy.yml"
UNINSTALL_PLAYBOOK = PLAYBOOKS_DIR / "uninstall.yml"
REDEPLOY_PLAYBOOK = PLAYBOOKS_DIR / "redeploy.yml"
LOCAL_INVENTORY = ANSIBLE_DIR / "inventory" / "local.yml"

# ── Logging ──────────────────────────────────────────────────────────────
LOG_FILE = Path.home() / "e3cnc" / "cli.log"
_LOG_HANDLE: Optional[TextIO] = None


def _ensure_log() -> TextIO:
    """Get or create the log file handle. Opens in append mode."""
    global _LOG_HANDLE
    if _LOG_HANDLE is None:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        _LOG_HANDLE = LOG_FILE.open("a")
    return _LOG_HANDLE


def _log(level: str, msg: str) -> None:
    """Write a timestamped line to the log file."""
    try:
        fh = _ensure_log()
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        fh.write(f"[{ts}] {level} {msg}\n")
        fh.flush()
    except OSError:
        pass


# ── Instance directory layout ──────────────────────────────────────────
# Instances are stored under ~/e3cnc/instances/{name}/
INSTANCES_DIR = Path.home() / "e3cnc" / "instances"
INSTANCES_DIR.mkdir(parents=True, exist_ok=True)

# Within each instance:
#   data/config/      → config_dir, moonraker_conf, printer_cfg
#   data/logs/        → moonraker_log
#   data/scripts/     → scripts_dir
#   data/database/    → database
#   data/comms/       → communication sockets
#   data/gcodes/      → uploaded gcode files
#   frontend/         → web_root (nginx serves this)

# ── ANSI styling (shared for both CLIs) ─────────────────────────────────────

_STYLE_ENABLED = sys.stdout.isatty() and os.name != "nt"


def _sc(code: str) -> str:
    return f"\033[{code}m" if _STYLE_ENABLED else ""


class Style:
    """Minimal terminal styling — degrades gracefully when piped."""
    GREEN = _sc("32")
    CYAN = _sc("36")
    YELLOW = _sc("33")
    RED = _sc("31")
    BOLD = _sc("1")
    DIM = _sc("2")
    RESET = _sc("0")


def ok(msg: str) -> None:
    print(f"  {Style.GREEN}✓{Style.RESET} {msg}")
    _log("OK", msg)


def info(msg: str) -> None:
    print(f"  {Style.CYAN}→{Style.RESET} {msg}")
    _log("INFO", msg)


def warn(msg: str) -> None:
    print(f"  {Style.YELLOW}⚠{Style.RESET} {msg}", file=sys.stderr)
    _log("WARN", msg)


def fail(msg: str, code: int = 1) -> NoReturn:
    print(f"\n  {Style.RED}✗{Style.RESET} {msg}", file=sys.stderr)
    _log("FAIL", msg)
    sys.exit(code)


def step(num: int, total: int, label: str) -> None:
    print(f"\n  {Style.BOLD}[{num}/{total}]{Style.RESET} {label}")
    _log("STEP", f"[{num}/{total}] {label}")


def header(title: str) -> None:
    print(f"\n  {Style.BOLD}{Style.GREEN}{TOOL_NAME}{Style.RESET} — {title}\n")
    print(f"  {Style.DIM}Repository root: {HERE}{Style.RESET}")
    _log("HEADER", title)


# ── Banner ──────────────────────────────────────────────────────────────────

BANNER_RAW = r"""
 ███████╗ ██████╗   ██████╗ ███╗   ██╗  ██████╗
 ██╔════╝ ╚════██╗ ██╔════╝ ████╗  ██║ ██╔════╝
 █████╗    █████╔╝ ██║      ██╔██╗ ██║ ██║
 ██╔══╝    ╚═══██╗ ██║      ██║╚██╗██║ ██║
 ███████╗ ██████╔╝ ╚██████╗ ██║ ╚████║ ╚██████╗
 ╚══════╝ ╚═════╝   ╚═════╝ ╚═╝  ╚═══╝  ╚═════╝"""


def print_banner() -> None:
    """Print the E3CNC logo banner in green."""
    try:
        print(Style.GREEN + BANNER_RAW + Style.RESET)
    except UnicodeEncodeError:
        # Terminal doesn't support the banner characters (e.g. latin-1 encoding)
        print(f"{Style.GREEN}E3CNC{Style.RESET}")


# ── Data classes for TUI results ────────────────────────────────────────────

class CmdResult:
    """Holds the result of running a command, so the TUI can display it."""

    def __init__(self, success: bool, output: str, label: str = "", returncode: int = 0):
        self.success = success
        self.output = output
        self.label = label
        self.returncode = returncode


# ── Ansible helpers ─────────────────────────────────────────────────────────

def _build_ansible_cmd(
    playbook: Path,
    inventory: Path,
    *,
    check: bool = False,
    verbose: bool = False,
    extra_vars: Optional[List[str]] = None,
    tags: str = "",
) -> List[str]:
    """Build an ansible-playbook command with common flags."""
    cmd = ["ansible-playbook"]
    cmd.extend(["-i", str(inventory)])
    cmd.append(str(playbook))
    if check:
        cmd.append("--check")
    if verbose:
        cmd.append("-v")
    if extra_vars:
        for ev in extra_vars:
            cmd.extend(["-e", ev])
    if tags:
        cmd.extend(["--tags", tags])
    return cmd


def run_ansible(
    playbook: Path,
    inventory: Path,
    *,
    check: bool = False,
    verbose: bool = False,
    extra_vars: Optional[List[str]] = None,
    output_callback=None,
    tags: str = "",
) -> int:
    """Run ansible-playbook and return the exit code."""
    cmd = _build_ansible_cmd(
        playbook, inventory, check=check, verbose=verbose,
        extra_vars=extra_vars, tags=tags,
    )

    if output_callback:
        output_callback(f"$ {' '.join(cmd)}\n")

    if output_callback:
        proc = subprocess.Popen(cmd, cwd=str(ANSIBLE_DIR), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        assert proc.stdout is not None
        for line in proc.stdout:
            output_callback(line)
        proc.wait()
        return proc.returncode
    else:
        print(f"\n  {Style.DIM}$ {' '.join(cmd)}{Style.RESET}\n")
        result = subprocess.run(cmd, cwd=ANSIBLE_DIR)
        return result.returncode


# ── Dependency checks ───────────────────────────────────────────────────────

def check_dependencies(output_callback=None) -> Tuple[bool, List[str]]:
    """Check dependencies, return (all_ok, lines) for display."""
    lines: List[str] = []
    _w = lambda m: lines.append(f"  ⚠ {m}")

    def _check(name: str, hint: str = "") -> bool:
        found = shutil.which(name) is not None
        if found:
            lines.append(f"  ✓ {name} found")
        else:
            hint_txt = f"\n    {hint}" if hint else ""
            _w(f"{name} not found{hint_txt}")
        return found

    lines.append("")
    lines.append("  Core tools")
    all_ok = True
    all_ok &= _check("git")
    all_ok &= _check("python3", "Install Python 3: sudo apt install python3")
    all_ok &= _check("curl")
    all_ok &= _check("unzip")

    lines.append("")
    lines.append("  Ansible")
    has_ansible = _check("ansible-playbook", "Install: pip3 install ansible --user")
    if has_ansible:
        ansible_ver = subprocess.run(
            ["ansible-playbook", "--version"], capture_output=True, text=True
        ).stdout.splitlines()[0]
        lines.append(f"  → ansible-playbook version: {ansible_ver.strip()}")

    lines.append("")
    lines.append("  Project structure")
    if PLAYBOOKS_DIR.is_dir():
        lines.append(f"  ✓ Ansible playbooks at {PLAYBOOKS_DIR}")
    else:
        _w(f"Ansible playbooks directory not found at {PLAYBOOKS_DIR}")
        all_ok = False

    lines.append("")
    if all_ok:
        lines.append("  ✓ All dependencies satisfied")
    else:
        lines.append("  ⚠ Some dependencies are missing")

    if output_callback:
        for l in lines:
            output_callback(l + "\n")

    return all_ok, lines


# ── Status ──────────────────────────────────────────────────────────────────

def _instance_name_from_printer_data(path: Path) -> str:
    name = path.name
    if name == "printer_data":
        return "cnc"
    match = re.fullmatch(r"printer_data_(.+)", name)
    if match:
        return f"cnc_{match.group(1)}"
    match = re.fullmatch(r"printer_(.+)_data", name)
    if match:
        return match.group(1)
    return name


def _default_service_name(kind: str, instance_name: str) -> str:
    if instance_name == "cnc":
        return kind
    legacy = re.fullmatch(r"cnc_(.+)", instance_name)
    suffix = legacy.group(1) if legacy else instance_name
    return f"{kind}-{suffix}"


def _read_text(path: Path) -> str:
    try:
        return path.read_text().strip()
    except OSError:
        return ""


def _read_service_name(printer_data_path: Path, kind: str, instance_name: str) -> str:
    raw = _read_text(printer_data_path / f"{kind}.asvc")
    default = _default_service_name(kind, instance_name)
    if not raw:
        return default

    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if len(lines) != 1:
        return default

    token = lines[0].removesuffix(".service")
    if token == kind or token == default:
        return token

    legacy = re.fullmatch(r"cnc_(.+)", instance_name)
    suffix = legacy.group(1) if legacy else instance_name
    if token in {instance_name, suffix}:
        return default

    if token.startswith(f"{kind}-"):
        return token

    return default


def _read_python_service_dir(env_path: Path, env_key: str, script_name: str, fallback: str) -> str:
    text = _read_text(env_path)
    match = re.search(rf"^{env_key}=\"?(.*?)\"?$", text, re.MULTILINE)
    if match:
        try:
            args = shlex.split(match.group(1))
            for token in args:
                if token.endswith(f"/{script_name}"):
                    return str(Path(token).parent.parent)
        except ValueError:
            pass
    return fallback


def _read_moonraker_port(conf_path: Path, default: int = 7125) -> int:
    text = _read_text(conf_path)
    match = re.search(r"(?m)^port:\s*(\d+)\s*$", text)
    if match:
        return int(match.group(1))
    return default


def _default_web_root(home: str, instance_name: str) -> str:
    home_path = Path(home)
    candidates: List[Path] = []
    if instance_name != "cnc":
        legacy = re.fullmatch(r"cnc_(.+)", instance_name)
        if legacy:
            candidates.append(home_path / f"e3cnc-web-{legacy.group(1)}")
        candidates.append(home_path / f"e3cnc-web-{instance_name}")
        if legacy:
            candidates.append(home_path / f"mainsail-{legacy.group(1)}")
        candidates.append(home_path / f"mainsail-{instance_name}")
    candidates.append(home_path / "e3cnc-web")
    candidates.append(home_path / "mainsail")
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return str(candidates[-1])


def _default_instance(home: str) -> "Instance":
    return Instance.from_printer_data(f"{home}/printer_data", home=home)


def check_status(remote_host: Optional[str] = None, output_callback=None, inst: Optional["Instance"] = None) -> Tuple[int, int, List[str]]:
    """Check installation status. Returns (ok_count, total_checks, output_lines)."""
    lines: List[str] = []

    if remote_host:
        remote_home = _get_remote_home(remote_host)
        _run_remote = lambda cmd: _ssh_run(remote_host, cmd)
        active_inst = inst or _default_instance(remote_home)
    else:
        remote_home = str(Path.home())
        _run_remote = lambda cmd: subprocess.run(
            cmd, capture_output=True, text=True, shell=True
        )
        active_inst = inst or _default_instance(remote_home)

    total_checks = 9
    ok_count = 0

    def _check(label: str, cmd: str, success_hint: str) -> bool:
        nonlocal ok_count
        result = _run_remote(cmd)
        if result.returncode == 0 and success_hint in result.stdout:
            lines.append(f"  ✓ {label}")
            ok_count += 1
            return True
        lines.append(f"  ⚠ {label} — not found")
        return False

    repo_dir = f"{remote_home}/E3CNC"
    _check("Repository checkout", f"test -d '{repo_dir}/.git' && echo 'found' || true", "found")
    _check("Moonraker cnc_agent component", f"test -f '{active_inst.moonraker_dir}/moonraker/components/cnc_agent/cnc_agent.py' && echo 'found' || true", "found")
    _check("Moonraker cnc_metadata component", f"test -f '{active_inst.moonraker_dir}/moonraker/components/cnc_metadata/cnc_metadata.py' && echo 'found' || true", "found")
    _check("Metadata extractor script", f"test -x '{active_inst.scripts_dir}/cnc_metadata_extractor.py' && echo 'found' || true", "found")
    _check("Moonraker config [cnc_agent] section", f"grep -qE '^\\[cnc_agent\\]' '{active_inst.moonraker_conf}' 2>/dev/null && echo 'found' || true", "found")
    _check("Moonraker config [cnc_metadata] section", f"grep -qE '^\\[cnc_metadata\\]' '{active_inst.moonraker_conf}' 2>/dev/null && echo 'found' || true", "found")
    _check("Klipper WCS plugin", f"test -f '{active_inst.klipper_dir}/klippy/extras/work_coordinate_systems.py' && echo 'found' || true", "found")
    _check("E3CNC macros directory", f"test -d '{active_inst.E3CNC_dir}/macros' && echo 'found' || true", "found")
    _check("Frontend deployed", f"test -f '{active_inst.web_root}/index.html' && echo 'found' || true", "found")

    lines.append("")
    if ok_count == total_checks:
        lines.append(f"  ✓ All {total_checks} components installed")
    else:
        lines.append(f"  ⚠ {ok_count}/{total_checks} components installed ({total_checks - ok_count} missing)")

    if output_callback:
        for l in lines:
            output_callback(l + "\n")

    return ok_count, total_checks, lines


# ── Backup ──────────────────────────────────────────────────────────────────

BACKUP_EXCLUDES = ("node_modules", ".git", ".venv", "__pycache__", "*.pyc")


# ── Multi-instance detection ────────────────────────────────────────────────

@dataclass
class Instance:
    """Represents a detected Klipper/Moonraker instance.

    Use from_name() for new-layout instances stored under ~/e3cnc/instances/{name}/.
    Use from_printer_data() for legacy KIAUH-layout instances (migration only).
    """
    name: str
    printer_data_dir: str
    config_dir: str
    moonraker_conf: str
    moonraker_log: str
    scripts_dir: str
    macros_dir: str
    E3CNC_dir: str
    printer_cfg: str
    web_root: str
    moonraker_dir: str = ""
    klipper_dir: str = ""
    moonraker_service: str = "moonraker"
    klipper_service: str = "klipper"
    moonraker_port: int = 7125
    web_port: int = 80
    is_running: bool = False

    @classmethod
    def from_name(cls, name: str) -> "Instance":
        """Create an Instance from a name, using the new directory layout.

        Paths are deterministic:
          ~/e3cnc/instances/{name}/data/config/
          ~/e3cnc/instances/{name}/data/logs/
          ~/e3cnc/instances/{name}/frontend/
        """
        base = INSTANCES_DIR / name
        data = base / "data"
        config = data / "config"

        # Resolve moonraker/klipper dirs from current release (if any)
        current_link = Path.home() / "e3cnc" / "current"
        moonraker_dir = str(Path.home() / "moonraker")
        klipper_dir = str(Path.home() / "klipper")
        if current_link.is_symlink():
            current_path = current_link.resolve()
            mdir = current_path / "vendor" / "moonraker"
            if mdir.is_dir():
                moonraker_dir = str(mdir)
            kdir = current_path / "vendor" / "klipper"
            if kdir.is_dir():
                klipper_dir = str(kdir)

        # Read port from moonraker.conf or use default
        port = 7125
        conf_file = config / "moonraker.conf"
        if conf_file.exists():
            try:
                text = conf_file.read_text()
                m = re.search(r"(?m)^port:\s*(\d+)\s*$", text)
                if m:
                    port = int(m.group(1))
            except OSError:
                pass

        return cls(
            name=name,
            printer_data_dir=str(data),
            config_dir=str(config),
            moonraker_conf=str(conf_file),
            moonraker_log=str(data / "logs" / "moonraker.log"),
            scripts_dir=str(data / "scripts"),
            macros_dir=str(config / "E3CNC" / "macros"),
            E3CNC_dir=str(config / "E3CNC"),
            printer_cfg=str(config / "printer.cfg"),
            web_root=str(base / "frontend"),
            moonraker_dir=moonraker_dir,
            klipper_dir=klipper_dir,
            moonraker_service=f"e3cnc-{name}-moonraker",
            klipper_service=f"e3cnc-{name}-klipper",
            moonraker_port=port,
            web_port=_compute_web_port(name),
            is_running=conf_file.exists(),
        )

    @classmethod
    def from_printer_data(cls, base: str, web_root: str = "", home: str = "") -> "Instance":
        """Create an Instance from a printer_data directory path (legacy KIAUH layout).

        Kept for migration support. New code should use from_name().
        """
        printer_data_path = Path(base)
        config = f"{base}/config"
        home = home or str(Path.home())
        instance_name = _instance_name_from_printer_data(printer_data_path)
        conf_path = printer_data_path / "config" / "moonraker.conf"
        systemd_dir = printer_data_path / "systemd"
        moonraker_dir = _read_python_service_dir(
            systemd_dir / "moonraker.env",
            "MOONRAKER_ARGS",
            "moonraker.py",
            f"{home}/moonraker",
        )
        klipper_dir = _read_python_service_dir(
            systemd_dir / "klipper.env",
            "KLIPPER_ARGS",
            "klippy.py",
            f"{home}/klipper",
        )
        if not web_root:
            web_root = _default_web_root(home, instance_name)
        return cls(
            name=instance_name,
            printer_data_dir=base,
            config_dir=config,
            moonraker_conf=f"{config}/moonraker.conf",
            moonraker_log=f"{base}/logs/moonraker.log",
            scripts_dir=f"{base}/scripts",
            macros_dir=f"{config}/macros",
            E3CNC_dir=f"{config}/E3CNC",
            printer_cfg=f"{config}/printer.cfg",
            web_root=web_root,
            moonraker_dir=moonraker_dir,
            klipper_dir=klipper_dir,
            moonraker_service=_read_service_name(printer_data_path, "moonraker", instance_name),
            klipper_service=_default_service_name("klipper", instance_name),
            moonraker_port=_read_moonraker_port(conf_path),
            is_running=conf_path.exists(),
        )


# ── Migration detection (old KIAUH layout) ────────────────────────────────

def _scan_kiauh_instances() -> List[Instance]:
    """Scan for legacy KIAUH-layout instances (~/printer_data, ~/printer_*_data).

    Used only by detect_instances() fallback and migrate_instances().
    """
    instances: List[Instance] = []
    home = str(Path.home())
    seen: Set[Path] = set()

    for pattern in ("printer_data", "printer_data_*", "printer_*_data"):
        for candidate in sorted(Path(home).glob(pattern)):
            if candidate in seen or not candidate.is_dir():
                continue
            seen.add(candidate)
            conf = candidate / "config" / "moonraker.conf"
            if conf.exists():
                instances.append(Instance.from_printer_data(str(candidate), home=home))

    return instances


# ── Active instance ────────────────────────────────────────────────────────

_active_instance: Optional[Instance] = None


def detect_instances() -> List[Instance]:
    """Scan for instances — try new layout first, then fall back to KIAUH layout."""
    instances: List[Instance] = []

    # 1. New layout: list ~/e3cnc/instances/{name}/
    if INSTANCES_DIR.is_dir():
        for d in sorted(INSTANCES_DIR.iterdir()):
            if d.is_dir() and not d.name.startswith("."):
                instances.append(Instance.from_name(d.name))

    if instances:
        return instances

    # 2. Fallback: KIAUH layout (for migration)
    return _scan_kiauh_instances()


def select_instance(instances: List[Instance]) -> Optional[Instance]:
    """Pick an instance interactively, or return the only one."""
    import re as _re

    if not instances:
        return None
    if len(instances) == 1:
        return instances[0]

    # Try TUI menu if available
    if sys.stdin.isatty():
        try:
            from simple_term_menu import TerminalMenu as _TM
            entries = [f"{'●' if inst.is_running else '○'} {inst.name}" for inst in instances]
            entries.append("+ Create new instance")
            entries.append("[Q] Quit")

            menu = _TM(
                menu_entries=entries,
                title="  Multiple instances detected",
                cycle_cursor=True,
                show_shortcut_hints=False,
                menu_highlight_style=("fg_green", "bold"),
                quit_keys=("q", "Q"),
                clear_screen=False,
            )
            choice = menu.show()
            if choice is None or choice == len(entries) - 1:
                print()
                info("Goodbye")
                sys.exit(0)
            if choice == len(entries) - 2:
                return _create_new_instance()
            return instances[choice]
        except ImportError:
            pass

    # Fallback: numbered input loop
    while True:
        print()
        print(f"  {Style.BOLD}Multiple instances detected:{Style.RESET}")
        print()
        for i, inst in enumerate(instances):
            dot = "\x1b[32m\u25cf\x1b[0m" if inst.is_running else "\x1b[90m\u25cb\x1b[0m"
            print(f"  {i + 1:>2}) {dot} {Style.BOLD}{inst.name}{Style.RESET}")
            print(f"      Config: {inst.config_dir}")
            print(f"      Service: {inst.moonraker_service}  Port: {inst.moonraker_port}")
            print()

        create_idx = len(instances) + 1
        print(f"  {create_idx:>2}) + Create new instance")
        print()
        print(f"   q) Quit")
        print()

        try:
            choice = input(f"  {Style.BOLD}Choose instance [1-{create_idx} or q]{Style.RESET} ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return None

        if choice in ("q", "quit", "exit"):
            print()
            info("Goodbye")
            sys.exit(0)

        if choice == str(create_idx):
            return _create_new_instance()

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(instances):
                return instances[idx]
        except ValueError:
            pass

        warn(f"Invalid choice: {choice}")


def _create_new_instance() -> Optional[Instance]:
    """Prompt for a name and create a new instance. Returns the new Instance or None."""
    import re as _re

    print()
    try:
        raw = input(f"  {Style.BOLD}Instance name: {Style.RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None

    name = _re.sub(r"[^a-z0-9-]", "", raw.lower().replace(" ", "-"))
    # Strip common redundant prefixes
    for prefix in ("e3cnc-", "e3cnc_", "moonraker-", "klipper-"):
        if name.startswith(prefix) and len(name) > len(prefix):
            name = name[len(prefix):]
    if not name:
        warn("Invalid name — use lowercase letters, numbers, and hyphens")
        return None

    if (INSTANCES_DIR / name).exists():
        warn(f"Instance '{name}' already exists")
        return None

    new_inst = Instance.from_name(name)

    # Create directory structure
    data = INSTANCES_DIR / name / "data"
    frontend = INSTANCES_DIR / name / "frontend"
    for subdir in ["config", "config/E3CNC/macros", "logs", "database", "comms", "scripts", "gcodes"]:
        (data / subdir).mkdir(parents=True, exist_ok=True)
    frontend.mkdir(parents=True, exist_ok=True)

    # Find available port
    all_instances = detect_instances()
    used_ports = {inst.moonraker_port for inst in all_instances}
    port = 7125
    while port in used_ports:
        port += 1

    conf_path = data / "config" / "moonraker.conf"
    conf_path.write_text(f"""[server]
host: 0.0.0.0
port: {port}
klippy_uds_address: {data / 'comms' / 'klippy.sock'}

[file_manager]
config_path: {data / 'config'}

[database]
database_path: {data / 'database'}

[authorization]
cors_domains:
    *
trusted_clients:
    127.0.0.1
    ::1

[cnc_agent]

[cnc_metadata]
extractor_path: {data / 'scripts' / 'cnc_metadata_extractor.py'}
timeout: 30
""")

    printer_cfg = data / "config" / "printer.cfg"
    printer_cfg.write_text("# E3CNC bootstrap placeholder printer.cfg\n")

    try:
        from _e3cnc_deploy import generate_admin_page
        generate_admin_page()
    except ImportError:
        pass

    # Register with supervisor if available
    try:
        from _e3cnc_supervisor import register_instance
        register_instance(new_inst)
    except ImportError:
        pass

    # Deploy nginx config for this instance
    try:
        deploy_nginx_config(new_inst)
    except Exception:
        pass

    ok(f"Instance '{name}' created (port {port})")
    print()
    return Instance.from_name(name)


def get_active_instance() -> Optional[Instance]:
    """Get the globally active instance, auto-detecting if needed."""
    global _active_instance
    if _active_instance is not None:
        return _active_instance
    instances = detect_instances()
    _active_instance = select_instance(instances)
    return _active_instance


def set_active_instance(inst: Optional[Instance]) -> None:
    """Set the globally active instance."""
    global _active_instance
    _active_instance = inst


def instance_extra_vars(inst: Instance) -> List[str]:
    """Generate Ansible extra vars for a specific instance."""
    return [
        f"instance_name={inst.name}",
        f"printer_data_dir={inst.printer_data_dir}",
        f"moonraker_dir={inst.moonraker_dir}",
        f"klipper_dir={inst.klipper_dir}",
        f"moonraker_conf={inst.moonraker_conf}",
        f"frontend_web_root={inst.web_root}",
        f"moonraker_service={inst.moonraker_service}",
        f"klipper_service={inst.klipper_service}",
        f"moonraker_port={inst.moonraker_port}",
    ]


_SUDO_READY = False


def _ensure_local_sudo_access(reason: str = "this operation") -> None:
    """Prompt once for sudo so non-interactive subprocesses can reuse it."""
    global _SUDO_READY
    if _SUDO_READY or os.geteuid() == 0 or not shutil.which("sudo"):
        return
    if subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode == 0:
        _SUDO_READY = True
        return
    print(f"\n  sudo access required for {reason}.")
    if subprocess.run(["sudo", "-v"]).returncode != 0:
        fail("sudo authentication failed")
    _SUDO_READY = True


def run_backup(remote_host: Optional[str] = None, output_callback=None, inst: Optional[Instance] = None) -> CmdResult:
    """Create a timestamped backup. Returns CmdResult."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    if remote_host:
        return _run_remote_backup(remote_host, output_callback, inst)

    active_inst = inst or get_active_instance() or _default_instance(str(Path.home()))
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    prefix = f"e3cnc-backup-{active_inst.name}-" if active_inst.name != "cnc" else "e3cnc-backup-"
    backup_dir = HERE / f"{prefix}{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    _o(f"Backing up frontend ({active_inst.web_root})...")
    web_root = Path(active_inst.web_root)
    if web_root.is_dir():
        subprocess.run(["cp", "-a", str(web_root), str(backup_dir / "frontend")], capture_output=True)
        _o(f"  ✓ Frontend backed up ({_dir_size(web_root)} MB)")
    else:
        _o("  ⚠ No frontend directory found")

    _o(f"Backing up printer config ({active_inst.config_dir})...")
    config_dir = Path(active_inst.config_dir)
    if config_dir.is_dir():
        subprocess.run(["cp", "-a", str(config_dir), str(backup_dir / "config")], capture_output=True)
        _o("  ✓ Printer config backed up")
    else:
        _o("  ⚠ No config directory found")

    _o("Backing up WCS offsets...")
    wcs_file = Path.home() / "wcs_offsets.json"
    if wcs_file.is_file():
        shutil.copy2(wcs_file, backup_dir / "wcs_offsets.json")
        _o("  ✓ WCS offsets backed up")
    else:
        _o("  ⚠ No WCS offsets found")

    manifest = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "tool": TOOL_NAME,
        "version": VERSION,
        "hostname": os.uname().nodename,
        "instance": active_inst.name,
        "printer_data_dir": active_inst.printer_data_dir,
        "web_root": active_inst.web_root,
        "moonraker_service": active_inst.moonraker_service,
    }
    (backup_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    _o("  ✓ Backup manifest written")
    _o(f"\n  >>> BACKUP SAVED >>>")
    _o(f"  >>> {backup_dir}")
    _o(f"  To restore: e3cnc-cli restore {backup_dir.name}")
    return CmdResult(True, "\n".join(out), "Backup")


def _run_remote_backup(host: str, output_callback=None, inst: Optional[Instance] = None) -> CmdResult:
    """Run backup over SSH."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_name = f"e3cnc-backup-{timestamp}"
    active_inst = inst or _default_instance(_get_remote_home(host))

    _o(f"Creating backup on remote host {host}...")
    cmds = "; ".join([
        f"mkdir -p ~/{backup_name}",
        f"if [ -d '{active_inst.web_root}' ]; then cp -a '{active_inst.web_root}' ~/{backup_name}/frontend; fi",
        f"if [ -d '{active_inst.config_dir}' ]; then cp -a '{active_inst.config_dir}' ~/{backup_name}/config; fi",
        "if [ -f ~/wcs_offsets.json ]; then cp -a ~/wcs_offsets.json ~/{backup_name}/; fi",
        f"echo '{{\"createdAt\":\"{datetime.now(timezone.utc).isoformat()}\",\"tool\":\"{TOOL_NAME}\",\"version\":\"{VERSION}\",\"instance\":\"{active_inst.name}\"}}' > ~/{backup_name}/manifest.json",
        f"echo '{backup_name}'",
    ])
    result = _ssh_run(host, cmds)
    if result.returncode == 0:
        _o(f"  ✓ Remote backup created at ~/{backup_name} on {host}")
        _o(f"  To restore: e3cnc-cli restore {backup_name} --remote {host}")
        return CmdResult(True, "\n".join(out), "Remote Backup")
    _o(f"  ✗ Remote backup failed: {result.stderr}")
    return CmdResult(False, "\n".join(out), "Remote Backup")


# ── Restore ─────────────────────────────────────────────────────────────────

def run_restore(backup_dir_name: str, remote_host: Optional[str] = None, auto_yes: bool = False, output_callback=None, inst: Optional[Instance] = None) -> CmdResult:
    """Restore from a backup directory. Returns CmdResult."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    if remote_host:
        return _run_remote_restore(remote_host, backup_dir_name, output_callback, inst)

    active_inst = inst or get_active_instance() or _default_instance(str(Path.home()))
    backup_path = Path(backup_dir_name)
    if not backup_path.is_absolute():
        candidates = [HERE / backup_dir_name, Path.cwd() / backup_dir_name]
        for c in candidates:
            if c.is_dir():
                backup_path = c
                break
        else:
            _o(f"Backup directory not found: {backup_dir_name}")
            return CmdResult(False, "\n".join(out), "Restore")

    if not backup_path.is_dir():
        _o(f"Backup directory not found: {backup_path}")
        return CmdResult(False, "\n".join(out), "Restore")

    manifest = backup_path / "manifest.json"
    if manifest.is_file():
        try:
            meta = json.loads(manifest.read_text())
            _o(f"Backup created: {meta.get('createdAt', 'unknown')}")
            if meta.get("instance"):
                _o(f"Backup instance: {meta['instance']}")
        except (json.JSONDecodeError, OSError):
            _o("Could not read backup manifest")

    restorables = []
    if (backup_path / "frontend").is_dir():
        restorables.append("frontend")
    if (backup_path / "config").is_dir():
        restorables.append("config")
    if (backup_path / "wcs_offsets.json").is_file():
        restorables.append("WCS offsets")
    if not restorables:
        _o("No restorable components found in backup")
        return CmdResult(False, "\n".join(out), "Restore")

    _o("The following will be RESTORED:")
    for comp in restorables:
        _o(f"  • {comp}")

    fe_src = backup_path / "frontend"
    if fe_src.is_dir():
        _o("Restoring frontend...")
        fe_dest = Path(active_inst.web_root)
        if fe_dest.is_dir():
            shutil.rmtree(fe_dest)
        shutil.copytree(fe_src, fe_dest)
        _o("  ✓ Frontend restored")

    cfg_src = backup_path / "config"
    if cfg_src.is_dir():
        _o("Restoring printer config...")
        cfg_dest = Path(active_inst.config_dir)
        if cfg_dest.is_dir():
            for item in cfg_src.iterdir():
                dest = cfg_dest / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                else:
                    shutil.copy2(item, dest)
        else:
            shutil.copytree(cfg_src, cfg_dest)
        _o("  ✓ Printer config restored")

    wcs_src = backup_path / "wcs_offsets.json"
    if wcs_src.is_file():
        _o("Restoring WCS offsets...")
        shutil.copy2(wcs_src, Path.home() / "wcs_offsets.json")
        _o("  ✓ WCS offsets restored")

    _o("")
    _o("  ✓ Restore complete")
    _o("  You may need to restart Moonraker:")
    _o(f"    sudo systemctl restart {active_inst.moonraker_service}")
    return CmdResult(True, "\n".join(out), "Restore")


def _run_remote_restore(host: str, backup_name: str, output_callback=None, inst: Optional[Instance] = None) -> CmdResult:
    """Restore from a backup on a remote host."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    active_inst = inst or _default_instance(_get_remote_home(host))
    _o(f"Restoring from ~/{backup_name} on {host}...")
    cmds = "; ".join([
        f"if [ -d ~/{backup_name}/frontend ]; then rm -rf '{active_inst.web_root}' && cp -a ~/{backup_name}/frontend '{active_inst.web_root}'; fi",
        f"if [ -d ~/{backup_name}/config ]; then cp -a ~/{backup_name}/config/* '{active_inst.config_dir}/'; fi",
        f"if [ -f ~/{backup_name}/wcs_offsets.json ]; then cp -a ~/{backup_name}/wcs_offsets.json ~/wcs_offsets.json; fi",
        f"sudo systemctl restart {active_inst.moonraker_service}",
    ])
    result = _ssh_run(host, cmds)
    if result.returncode == 0:
        _o("  ✓ Remote restore complete — Moonraker restarted")
        return CmdResult(True, "\n".join(out), "Remote Restore")
    _o(f"  ✗ Remote restore failed: {result.stderr}")
    return CmdResult(False, "\n".join(out), "Remote Restore")


# ── Diagnose ────────────────────────────────────────────────────────────────

def run_diagnose(remote_host: Optional[str] = None, output_callback=None, inst: Optional[Instance] = None) -> CmdResult:
    """Run diagnostics on the CNC host."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    if remote_host:
        runner = lambda cmd: _ssh_run(remote_host, cmd)
        label = f"remote host {remote_host}"
        active_inst = inst or _default_instance(_get_remote_home(remote_host))
    else:
        runner = lambda cmd: subprocess.run(cmd, capture_output=True, text=True, shell=True)
        label = "localhost"
        active_inst = inst or get_active_instance() or _default_instance(str(Path.home()))

    _o(f"Running diagnostics on {label}...")
    api_base = f"http://127.0.0.1:{active_inst.moonraker_port}"
    checks = [
        ("Moonraker API", f'''curl -sf {api_base}/printer/info 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin).get('result', {{}})
print(d.get('state', 'unknown'))
host = d.get('hostname', '?')
ver = d.get('software_version', '?')
cpu = d.get('cpu_info', '?')
print(f'Host: {{host}}')
print(f'Version: {{ver}}')
print(f'CPU: {{cpu}}')
" 2>/dev/null'''),
        ("Klippy state", f"curl -sf {api_base}/printer/info 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('result',{{}}).get('state','unknown'))\" 2>/dev/null"),
        ("Agent loaded", f"curl -sf {api_base}/server/info 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print('yes' if 'cnc_agent' in str(d.get('result',{{}})) else 'no')\" 2>/dev/null || echo 'no'"),
        ("Metadata loaded", f"curl -sf {api_base}/server/info 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print('yes' if 'cnc_metadata' in str(d.get('result',{{}})) else 'no')\" 2>/dev/null || echo 'no'"),
        ("Nginx serving", "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1/ 2>/dev/null || echo 'unreachable'"),
    ]

    for check_label, cmd in checks:
        result = runner(cmd)
        status = result.stdout.strip() if result.returncode == 0 else "error"
        if not status or status in ("error", "unreachable", "no"):
            _o(f"  ⚠ {check_label}: {status}")
            continue
        lines = status.split("\n")
        _o(f"  ✓ {check_label}: {lines[0].strip()}")
        for extra in lines[1:]:
            if extra.strip():
                _o(f"      {extra.strip()}")

    _o("")
    _o("  For detailed logs: e3cnc-cli logs" + (f" --remote {remote_host}" if remote_host else ""))
    return CmdResult(True, "\n".join(out), "Diagnostics")


# ── Logs ────────────────────────────────────────────────────────────────────

def run_logs(remote_host: Optional[str] = None, lines: int = 50, output_callback=None, inst: Optional[Instance] = None) -> CmdResult:
    """Fetch and display logs."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    if remote_host:
        active_inst = inst or _default_instance(_get_remote_home(remote_host))
        prefix = f"ssh {remote_host} "
    else:
        active_inst = inst or get_active_instance() or _default_instance(str(Path.home()))
        prefix = ""
        _ensure_local_sudo_access("viewing logs")

    _o(f"  Moonraker log (last {lines} lines):")
    result = subprocess.run(
        f'{prefix} sudo journalctl -u {active_inst.moonraker_service} -n {lines} --no-pager 2>/dev/null || '
        f'{prefix} tail -{lines} {shlex.quote(active_inst.moonraker_log)} 2>/dev/null || '
        f'echo "  (no moonraker logs found)"',
        capture_output=True, text=True, shell=True,
    )
    for line in result.stdout.splitlines():
        _o(f"    {line}")

    _o("")
    _o(f"  Nginx access log (last {lines} lines):")
    result = subprocess.run(
        f'{prefix} sudo tail -{lines} /var/log/nginx/access.log 2>/dev/null || '
        f'echo "  (no nginx access log found)"',
        capture_output=True, text=True, shell=True,
    )
    for line in result.stdout.splitlines():
        _o(f"    {line}")

    _o("")
    _o(f"  Nginx error log (last {lines} lines):")
    result = subprocess.run(
        f'{prefix} sudo tail -{lines} /var/log/nginx/error.log 2>/dev/null || '
        f'echo "  (no nginx error log found)"',
        capture_output=True, text=True, shell=True,
    )
    for line in result.stdout.splitlines():
        _o(f"    {line}")

    return CmdResult(True, "\n".join(out), "Logs")


# ── Utility functions ──────────────────────────────────────────────────────

def _dir_size(path: Path) -> str:
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    return f"{total / (1024 * 1024):.1f}"


def _ensure_remote_inventory(host: str) -> Path:
    inventory_path = ANSIBLE_DIR / "inventory" / ".e3cnc-cli-remote.yml"
    inventory_path.parent.mkdir(parents=True, exist_ok=True)
    user_part = ""
    host_part = host
    port_part = ""

    if "@" in host:
        user_part, host_part = host.rsplit("@", 1)
    if ":" in host_part:
        host_part, port_part = host_part.split(":", 1)

    content = ["all:", "  hosts:", "    cnc:"]
    if host_part:
        content.append(f"      ansible_host: {host_part}")
    if user_part:
        content.append(f"      ansible_user: {user_part}")
    if port_part:
        content.append(f"      ansible_port: {port_part}")

    inventory_path.write_text("\n".join(content) + "\n")
    return inventory_path


def _get_remote_home(host: str) -> str:
    result = _ssh_run(host, "echo $HOME")
    if result.returncode != 0:
        raise RuntimeError(f"Cannot connect to {host}: {result.stderr}")
    return result.stdout.strip()


def _ssh_run(host: str, cmd: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["ssh", "-o", "BatchMode=yes", host, cmd],
        capture_output=True, text=True,
    )


def run_ansible_playbook(
    playbook: Path,
    remote_host: Optional[str],
    check_mode: bool,
    verbose: bool,
    label: str,
    output_callback=None,
    extra_vars: Optional[List[str]] = None,
    tags: str = "",
) -> CmdResult:
    """Run one of the Ansible playbooks and return a CmdResult."""
    out: List[str] = []
    _o = lambda m: (out.append(m), output_callback(m + "\n") if output_callback else None)

    _o(f"Running {label}...")

    if remote_host:
        inventory = _ensure_remote_inventory(remote_host)
        _o(f"  Remote: {remote_host}")
    else:
        inventory = LOCAL_INVENTORY
        _o("  Local: localhost")

    if check_mode:
        _o("  Mode: dry-run (--check)")

    if extra_vars:
        _o(f"  Instance: {'  '.join(extra_vars)}")

    if tags:
        _o(f"  Tags: {tags}")

    if not remote_host:
        _ensure_local_sudo_access(f"{label.lower()} (Ansible become tasks)")

    _o("")

    rc = run_ansible(
        playbook, inventory, check=check_mode, verbose=verbose,
        extra_vars=extra_vars, output_callback=output_callback, tags=tags,
    )

    _o("")
    if rc == 0:
        _o(f"  ✓ {label} completed successfully")
        return CmdResult(True, "\n".join(out), label, returncode=rc)
    else:
        _o(f"  ✗ {label} failed (exit code {rc})")
        return CmdResult(False, "\n".join(out), label, returncode=rc)


# ── KIAUH import ─────────────────────────────────────────────────────────


def import_kiauh_instance(kiauh_inst: Instance) -> Optional[Instance]:
    """Create an E3CNC-style instance from an existing KIAUH instance.

    Extracts the KIAUH instance's config and creates a new E3CNC instance
    at ~/e3cnc/instances/{name}/ without modifying the original KIAUH setup.
    """
    import shutil as _shutil

    name = kiauh_inst.name

    # Check if already imported
    inst_dir = INSTANCES_DIR / name
    if inst_dir.exists():
        warn(f"Instance '{name}' already exists at {inst_dir}")
        return None

    # Create directory structure
    data = inst_dir / "data"
    frontend = inst_dir / "frontend"
    for subdir in ["config", "config/E3CNC/macros", "logs", "database", "comms", "scripts", "gcodes"]:
        (data / subdir).mkdir(parents=True, exist_ok=True)
    frontend.mkdir(parents=True, exist_ok=True)

    # Copy printer.cfg (the machine config)
    klippy_cfg = Path(kiauh_inst.printer_cfg)
    if klippy_cfg.exists():
        _shutil.copy2(klippy_cfg, data / "config" / "printer.cfg")
        ok(f"Copied printer.cfg from KIAUH instance '{name}'")
    else:
        (data / "config" / "printer.cfg").write_text("# Placeholder — no KIAUH printer.cfg found\n")

    # Copy moonraker.conf and patch for the new paths
    mr_conf = Path(kiauh_inst.moonraker_conf)
    if mr_conf.exists():
        new_conf = data / "config" / "moonraker.conf"
        content = mr_conf.read_text()
        # Override paths for the new layout
        content += f"""

# E3CNC instance paths (auto-generated from KIAUH import)
[file_manager]
config_path: {data / 'config'}

[database]
database_path: {data / 'database'}
"""
        # Update port to be unique
        existing_ports = {inst.moonraker_port for inst in detect_instances()}
        port = kiauh_inst.moonraker_port
        while port in existing_ports:
            port += 1
        if port != kiauh_inst.moonraker_port:
            content = content.replace(f"port: {kiauh_inst.moonraker_port}", f"port: {port}")
            info(f"Port adjusted from {kiauh_inst.moonraker_port} to {port} (was taken)")

        new_conf.write_text(content)
        ok(f"Copied moonraker.conf from KIAUH instance '{name}'")
    else:
        _generate_minimal_moonraker_conf(data, kiauh_inst.moonraker_port)
        info(f"Generated new moonraker.conf for '{name}'")

    # Copy config/E3CNC directory if present
    e3cnc_dir = Path(kiauh_inst.E3CNC_dir)
    if e3cnc_dir.is_dir():
        _shutil.copytree(e3cnc_dir, data / "config" / "E3CNC", dirs_exist_ok=True)
        ok("Copied E3CNC config from KIAUH instance")

    # Copy frontend if present
    fe_src = Path(kiauh_inst.web_root)
    if fe_src.is_dir() and fe_src != frontend:
        _shutil.copytree(fe_src, frontend, dirs_exist_ok=True)
        ok(f"Copied frontend from {fe_src}")

    # Generate admin page
    try:
        from _e3cnc_deploy import generate_admin_page
        generate_admin_page()
    except ImportError:
        pass

    new_inst = Instance.from_name(name)

    # Register with supervisor
    try:
        from _e3cnc_supervisor import register_instance
        register_instance(new_inst)
    except ImportError:
        pass

    ok(f"Instance '{name}' imported from KIAUH layout")
    print()
    return new_inst


def _generate_minimal_moonraker_conf(data_dir: Path, port: int) -> Path:
    """Generate a minimal moonraker.conf for a new instance."""
    conf_path = data_dir / "config" / "moonraker.conf"
    conf_path.write_text(f"""[server]
host: 0.0.0.0
port: {port}
klippy_uds_address: {data_dir / 'comms' / 'klippy.sock'}

[file_manager]
config_path: {data_dir / 'config'}

[database]
database_path: {data_dir / 'database'}

[authorization]
cors_domains:
    *
trusted_clients:
    127.0.0.1
    ::1
""")
    return conf_path


def _compute_web_port(name: str) -> int:
    """Compute the web port for an instance.

    'cnc' and 'default' get port 80. Other instances get 8080, 8081, ...
    """
    if name in ("cnc", "default"):
        return 80
    used = {inst.web_port for inst in detect_instances()}
    for port in range(8080, 9000):
        if port not in used:
            return port
    return 8080


def generate_nginx_config(inst: Instance) -> str:
    """Generate an nginx server block for an instance.

    Each instance gets its own port for the web frontend, with
    Moonraker API proxied to the instance's port.
    """
    return f"""# E3CNC instance: {inst.name}
# Auto-generated — do not edit manually.

server {{
    listen {inst.web_port};
    listen [::]:{inst.web_port};

    root {inst.web_root};
    index index.html;
    server_name _;

    location / {{
        try_files $uri $uri/ /index.html;
    }}

    location /websocket {{
        proxy_pass http://127.0.0.1:{inst.moonraker_port}/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }}

    location /printer/ {{
        proxy_pass http://127.0.0.1:{inst.moonraker_port}/printer/;
        proxy_set_header Host $host;
    }}

    location /api/ {{
        proxy_pass http://127.0.0.1:{inst.moonraker_port}/api/;
        proxy_set_header Host $host;
    }}

    location /server/ {{
        proxy_pass http://127.0.0.1:{inst.moonraker_port}/server/;
        proxy_set_header Host $host;
    }}

    location /access/ {{
        proxy_pass http://127.0.0.1:{inst.moonraker_port}/access/;
        proxy_set_header Host $host;
    }}
}}
"""


def deploy_nginx_config(inst: Instance) -> bool:
    """Write nginx config for an instance and reload nginx."""
    import subprocess as _subprocess

    conf = generate_nginx_config(inst)
    path = Path(f"/etc/nginx/sites-available/e3cnc-{inst.name}")
    enabled = Path(f"/etc/nginx/sites-enabled/e3cnc-{inst.name}")

    try:
        proc = _subprocess.Popen(
            ["sudo", "tee", str(path)], stdin=_subprocess.PIPE,
            stdout=_subprocess.DEVNULL, stderr=_subprocess.PIPE,
        )
        _, stderr = proc.communicate(input=conf.encode(), timeout=15)
        if proc.returncode != 0:
            warn(f"Failed to write nginx config: {stderr.decode().strip()}")
            return False
        ok(f"Nginx config written: {path}")
    except OSError as e:
        warn(f"Failed to write nginx config: {e}")
        return False

    if not enabled.exists():
        _subprocess.run(["sudo", "ln", "-sf", str(path), str(enabled)], check=True, timeout=10)

    result = _subprocess.run(["sudo", "nginx", "-t"], capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        warn(f"Nginx config test failed: {result.stderr.strip()}")
        return False

    _subprocess.run(["sudo", "systemctl", "reload", "nginx"], check=True, timeout=15)
    ok(f"Nginx reloaded — {inst.name} available on port {inst.web_port}")
    return True
