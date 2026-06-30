"""Interactive menu for the E3CNC CLI."""

import sys
import tty
import termios
import atexit
from pathlib import Path

from _e3cnc_shared import (
    VERSION, TOOL_NAME, Style,
    print_banner, ok, info, warn, fail,
    get_active_instance, detect_instances, set_active_instance,
    INSTANCES_DIR, Instance,
)
from _e3cnc_deploy import get_current_release, generate_admin_page


# ── Raw terminal input ─────────────────────────────────────────────────

_old_term: list = []


def _setup_terminal() -> None:
    """Switch stdin to non-canonical mode for single-key input.
    Leaves output processing intact so newlines work normally."""
    if not sys.stdin.isatty():
        return
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    _old_term.append(old)
    new = termios.tcgetattr(fd)
    # Disable canonical mode, echo, and signal chars on INPUT only
    new[tty.LFLAG] &= ~(termios.ECHO | termios.ICANON | termios.ISIG)
    # Read one byte at a time, no timeout
    new[tty.CC][termios.VMIN] = 1
    new[tty.CC][termios.VTIME] = 0
    termios.tcsetattr(fd, termios.TCSADRAIN, new)


def _restore_terminal() -> None:
    """Restore terminal to cooked mode."""
    if _old_term:
        for fd_term in _old_term:
            try:
                termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, fd_term)
            except (termios.error, OSError, ValueError):
                pass
        _old_term.clear()


atexit.register(_restore_terminal)


def _get_key() -> str:
    """Read a single keypress. Returns escape sequences for arrows/enter."""
    fd = sys.stdin.fileno()
    try:
        ch = sys.stdin.read(1)
    except (OSError, ValueError):
        return ""
    if ch == "\x1b":
        # Read the rest of the escape sequence (non-blocking)
        import select
        rest = ""
        for _ in range(2):
            if select.select([sys.stdin], [], [], 0.05)[0]:
                try:
                    rest += sys.stdin.read(1)
                except (OSError, ValueError):
                    break
            else:
                break
        if rest:
            return ch + rest
    return ch


# ── Menu ───────────────────────────────────────────────────────────────


def _interactive_menu() -> None:
    """Display the interactive menu and dispatch user choices."""
    from cli.commands import (
        cmd_check, cmd_install, cmd_deploy, cmd_update, cmd_uninstall,
        cmd_status, cmd_backup, cmd_restore, cmd_diagnose, cmd_logs,
        cmd_releases, cmd_rollback, cmd_prune, cmd_instances, cmd_migrate,
        cmd_detect_mcu, cmd_flash_mcu, cmd_init_config,
    )

    all_items = [
        ("[S] Status",      "status"),
        ("[I] Install",     "install"),
        ("[D] Deploy",      "deploy"),
        ("[U] Update",      "update"),
        ("[X] Uninstall",   "uninstall"),
        ("",                ""),
        ("[Dm] Detect MCU", "detect-mcu"),
        ("[Fm] Flash MCU",  "flash-mcu"),
        ("[Ic] Init Config","init-config"),
        ("",                ""),
        ("[Ci] Create Instance", "create-instance"),
        ("[Rl] Releases",   "releases"),
        ("[Rb] Rollback",   "rollback"),
        ("[P] Prune",       "prune"),
        ("",                ""),
        ("[N] Instances",   "instances"),
        ("[C] Check Deps",  "check"),
        ("[B] Backup",      "backup"),
        ("[Rr] Restore",    "restore"),
        ("[G] Diagnose",    "diagnose"),
        ("[L] Logs",        "logs"),
        ("",                ""),
        ("[W] Switch Instance", "switch"),
        ("[Q] Quit",        "quit"),
    ]
    display = [(l, c) for l, c in all_items if l]
    cur_idx = 0
    has_terminal = sys.stdin.isatty()

    # Resolve active instance before raw mode so select_instance() has echo
    cur = get_active_instance()

    if has_terminal:
        _setup_terminal()

    try:
        while True:
            print_banner()
            print(f"  {Style.BOLD}{Style.GREEN}{TOOL_NAME} v{VERSION}{Style.RESET}")

            # Refresh instance after switch/create/run operations
            if cur:
                label = cur.name if cur.name != "cnc" else "default"
                print(f"  {Style.DIM}Instance: {label}  ({cur.config_dir}){Style.RESET}")

            print()
            print(f"  {Style.BOLD}Select an action:{Style.RESET}")
            print()

            for i, (label, cmd) in enumerate(display):
                if i == cur_idx and has_terminal:
                    print(f"  {Style.GREEN}>{Style.RESET} {i + 1:>2}) {label}")
                else:
                    print(f"    {i + 1:>2}) {label}")

            print()
            if has_terminal:
                sys.stdout.write(f"  {Style.DIM}arrows to move, enter to select, q to quit{Style.RESET}")
                sys.stdout.flush()

                key = _get_key()
                if key == "q" or key == "Q":
                    ok("Goodbye")
                    break

                if key == "\x1b[A":  # Up arrow
                    cur_idx = (cur_idx - 1) % len(display)
                    sys.stdout.write("\r\033[2K")
                    sys.stdout.flush()
                    continue

                if key == "\x1b[B":  # Down arrow
                    cur_idx = (cur_idx + 1) % len(display)
                    sys.stdout.write("\r\033[2K")
                    sys.stdout.flush()
                    continue

                if key in ("\r", "\n"):  # Enter
                    _, cmd = display[cur_idx]
                    if cmd == "quit":
                        ok("Goodbye")
                        break
                    _restore_terminal()
                    if cmd == "switch":
                        _switch_instance()
                    elif cmd == "create-instance":
                        _create_instance()
                    else:
                        _run_menu_command(cmd)
                    cur = get_active_instance()
                    _setup_terminal()
                    continue

                if key and key.isdigit():
                    idx = int(key) - 1
                    if 0 <= idx < len(display):
                        cur_idx = idx
                        _, cmd = display[idx]
                        if cmd == "quit":
                            ok("Goodbye")
                            break
                        _restore_terminal()
                        if cmd == "switch":
                            _switch_instance()
                        elif cmd == "create-instance":
                            _create_instance()
                        else:
                            _run_menu_command(cmd)
                        cur = get_active_instance()
                        _setup_terminal()
                        continue

                if key in ("\x03",):  # Ctrl+C
                    print()
                    break
            else:
                # Non-TTY mode: use regular input()
                try:
                    choice = input(f"  {Style.BOLD}Choice [1-{len(display)}]{Style.RESET} ").strip()
                except (EOFError, KeyboardInterrupt):
                    print()
                    break

                if not choice:
                    continue

                try:
                    idx = int(choice) - 1
                    if idx < 0 or idx >= len(display):
                        print(f"  {Style.YELLOW}Invalid choice: {choice}{Style.RESET}")
                        continue
                except ValueError:
                    print(f"  {Style.YELLOW}Invalid choice: {choice}{Style.RESET}")
                    continue

                _, cmd = display[idx]
                if cmd == "quit":
                    ok("Goodbye")
                    break
                if cmd == "switch":
                    _switch_instance()
                elif cmd == "create-instance":
                    _create_instance()
                else:
                    _run_menu_command(cmd)

    finally:
        _restore_terminal()


def _run_menu_command(cmd: str) -> None:
    """Run a command from the menu using a fake args namespace."""
    from cli.commands import (
        cmd_check, cmd_install, cmd_deploy, cmd_update, cmd_uninstall,
        cmd_status, cmd_backup, cmd_restore, cmd_diagnose, cmd_logs,
        cmd_releases, cmd_rollback, cmd_prune, cmd_instances, cmd_migrate,
        cmd_detect_mcu, cmd_flash_mcu, cmd_init_config,
    )

    _DESTRUCTIVE = ("install", "update", "uninstall")
    labels = {"install": "Install", "update": "Update", "uninstall": "Uninstall"}

    if cmd in _DESTRUCTIVE:
        print()
        try:
            answer = input(
                f"  {Style.YELLOW}\u26a0 {labels.get(cmd, cmd)} is destructive. Continue? [y/N] {Style.RESET}"
            ).strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if answer != "y":
            print(f"  {Style.DIM}Cancelled{Style.RESET}")
            return

    class _Fake:
        pass

    args = _Fake()
    args.remote = None
    args.check = False
    args.verbose = False
    args.backup_dir = ""
    args.yes = True
    args.lines = 50
    args.instance = None
    args.dry_run = False
    args.name = None
    args.command = cmd

    dispatch = {
        "check": cmd_check,
        "install": cmd_install,
        "deploy": cmd_deploy,
        "update": cmd_update,
        "uninstall": cmd_uninstall,
        "status": cmd_status,
        "backup": cmd_backup,
        "restore": cmd_restore,
        "diagnose": cmd_diagnose,
        "diag": cmd_diagnose,
        "doctor": cmd_diagnose,
        "logs": cmd_logs,
        "releases": cmd_releases,
        "rel": cmd_releases,
        "rollback": cmd_rollback,
        "prune": cmd_prune,
        "migrate": cmd_migrate,
        "migrate-layout": cmd_migrate,
        "instances": cmd_instances,
        "inst": cmd_instances,
        "list": cmd_instances,
        "detect-mcu": cmd_detect_mcu,
        "detect": cmd_detect_mcu,
        "scan": cmd_detect_mcu,
        "flash-mcu": cmd_flash_mcu,
        "flash": cmd_flash_mcu,
        "build": cmd_flash_mcu,
        "init-config": cmd_init_config,
        "init": cmd_init_config,
    }

    handler = dispatch.get(cmd)
    if handler:
        handler(args)
    else:
        fail(f"Unknown command: {cmd}")


def _switch_instance() -> None:
    """Let the user switch the active instance interactively."""
    from _e3cnc_shared import detect_instances

    instances = detect_instances()
    if not instances:
        warn("No instances detected")
        return

    if len(instances) == 1:
        set_active_instance(instances[0])
        info(f"Switched to: {Style.BOLD}{instances[0].name}{Style.RESET}")
        return

    print()
    print(f"  {Style.BOLD}Available instances:{Style.RESET}")
    print()
    for i, inst in enumerate(instances):
        dot = "\x1b[32m\u25cf\x1b[0m" if inst.is_running else "\x1b[90m\u25cb\x1b[0m"
        print(f"  {i + 1:>2}) {dot} {Style.BOLD}{inst.name}{Style.RESET}")
        print(f"      Config: {inst.config_dir}")

    print()
    try:
        choice = input(f"  {Style.BOLD}Choose instance [1-{len(instances)}]{Style.RESET} ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(instances):
            set_active_instance(instances[idx])
            info(f"Switched to: {Style.BOLD}{instances[idx].name}{Style.RESET}")
        else:
            warn("Invalid choice")
    except ValueError:
        warn("Invalid choice")


def _create_instance() -> None:
    """Interactively create a new instance."""
    import re

    print()
    info("Creating a new E3CNC instance")
    print()

    existing = detect_instances()
    if existing:
        print(f"  {Style.BOLD}Existing instances:{Style.RESET}")
        for inst in existing:
            dot = "\x1b[32m\u25cf\x1b[0m" if inst.is_running else "\x1b[90m\u25cb\x1b[0m"
            print(f"    {dot} {inst.name}  ({inst.config_dir})")
        print()

    try:
        raw = input(f"  {Style.BOLD}Instance name: {Style.RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    name = re.sub(r"[^a-z0-9-]", "", raw.lower().replace(" ", "-"))
    if not name:
        warn("Invalid name — use lowercase letters, numbers, and hyphens")
        return

    if (INSTANCES_DIR / name).exists():
        warn(f"Instance '{name}' already exists at {INSTANCES_DIR / name}")
        return

    inst = Instance.from_name(name)
    set_active_instance(inst)

    print()
    info(f"Creating instance: {Style.BOLD}{name}{Style.RESET}")

    data = INSTANCES_DIR / name / "data"
    frontend = INSTANCES_DIR / name / "frontend"
    for subdir in ["config", "config/E3CNC/macros", "logs", "database", "comms", "scripts", "gcodes"]:
        (data / subdir).mkdir(parents=True, exist_ok=True)
    frontend.mkdir(parents=True, exist_ok=True)
    ok(f"Directories created at {INSTANCES_DIR / name}")

    used_ports = {inst.moonraker_port for inst in existing}
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
    ok(f"moonraker.conf created (port {port})")

    generate_admin_page()

    printer_cfg = data / "config" / "printer.cfg"
    printer_cfg.write_text("""# E3CNC bootstrap placeholder printer.cfg
# Replace with your actual machine configuration.
# Run 'e3cnc-cli init-config' to generate a CNC template.
""")
    ok("Placeholder printer.cfg created")

    print()
    info(f"Instance '{name}' created")
    info(f"  Config: {conf_path}")
    info(f"  Service: e3cnc-{name}-moonraker")
    info(f"  Port: {port}")
    print()
    info("Next steps:")
    print(f"  1. Run 'e3cnc-cli update' to deploy runtime files")
    print(f"  2. Edit {printer_cfg} with your machine config")
    info("To use this instance: e3cnc-cli --instance {name} <command>")
