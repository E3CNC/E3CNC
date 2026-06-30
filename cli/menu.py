"""Interactive menu for the E3CNC CLI."""

import sys

from _e3cnc_shared import (
    VERSION, TOOL_NAME, Style,
    print_banner, ok, info, warn, fail,
    get_active_instance, detect_instances, set_active_instance,
    INSTANCES_DIR, Instance,
)
from _e3cnc_deploy import get_current_release, generate_admin_page

# ── Terminal menu library (soft dependency) ────────────────────────────

_has_tui = False
try:
    from simple_term_menu import TerminalMenu
    _has_tui = True
except ImportError:
    pass


def _interactive_menu() -> None:
    """Display the interactive menu and dispatch user choices."""
    if sys.stdin.isatty() and _has_tui:
        _tui_menu()
    else:
        _numbered_menu()


def _tui_menu() -> None:
    """Full TUI menu with arrow keys, using simple-term-menu."""
    from cli.commands import (
        cmd_check, cmd_install, cmd_deploy, cmd_update, cmd_uninstall,
        cmd_status, cmd_backup, cmd_restore, cmd_diagnose, cmd_logs,
        cmd_releases, cmd_rollback, cmd_prune, cmd_instances, cmd_migrate,
        cmd_detect_mcu, cmd_flash_mcu, cmd_init_config,
    )

    all_items = [
        ("[s] Status",         "status",         ""),
        ("[i] Install",        "install",        ""),
        ("[d] Deploy",         "deploy",         ""),
        ("[u] Update",         "update",         ""),
        ("[x] Uninstall",      "uninstall",      ""),
        ("---",                "",               ""),
        ("[m] Detect MCU",     "detect-mcu",     ""),
        ("[f] Flash MCU",      "flash-mcu",      ""),
        ("[c] Init Config",    "init-config",    ""),
        ("---",                "",               ""),
        ("[n] Create Instance","create-instance",""),
        ("[r] Releases",       "releases",       ""),
        ("[b] Rollback",       "rollback",       ""),
        ("[p] Prune",          "prune",          ""),
        ("---",                "",               ""),
        ("[t] Instances",      "instances",      ""),
        ("[k] Check Deps",     "check",          ""),
        ("[a] Backup",         "backup",         ""),
        ("[e] Restore",        "restore",        ""),
        ("[g] Diagnose",       "diagnose",       ""),
        ("[l] Logs",           "logs",           ""),
        ("[h] Restart Svc",   "restart",        ""),
        ("---",                "",               ""),
        ("[w] Switch Instance","switch",         ""),
        ("[q] Quit",           "quit",           ""),
    ]
    entries = [item[0] for item in all_items]
    cmd_map = {item[0]: item[1] for item in all_items if item[1]}
    entry_count = len([e for e in entries if e != "---"])

    while True:
        cur = get_active_instance()
        label = cur.name if cur and cur.name != "cnc" else "default"
        config = cur.config_dir if cur else ""
        title = f"  {TOOL_NAME} v{VERSION}  —  Instance: {label}"

        menu = TerminalMenu(
            menu_entries=entries,
            title=title,
            status_bar=f"  {config}" if config else None,
            cycle_cursor=True,
            show_shortcut_hints=False,
            menu_highlight_style=("fg_green", "bold"),
            shortcut_key_highlight_style=("fg_green", "bold"),
            quit_keys=("q", "Q"),
            clear_screen=False,
            clear_menu_on_exit=True,
        )

        choice = menu.show()

        if choice is None:  # Quit
            ok("Goodbye")
            break

        entry = entries[choice]
        cmd = cmd_map.get(entry, "")
        if cmd == "switch":
            _switch_instance()
            _pause_after_output()
        elif cmd == "create-instance":
            _create_instance()
            _pause_after_output()
        elif cmd == "quit":
            ok("Goodbye")
            break
        elif cmd:
            _run_menu_command(cmd)
            _pause_after_output()


def _numbered_menu() -> None:
    """Fallback numbered menu for piped/non-TTY use or when simple-term-menu is missing."""
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

    # Build shortcut map
    shortcut_map = {}
    for label, cmd in display:
        if "[" in label and "]" in label:
            key = label[label.index("[") + 1:label.index("]")]
            shortcut_map[key.lower()] = cmd

    while True:
        print_banner()
        print(f"  {Style.BOLD}{Style.GREEN}{TOOL_NAME} v{VERSION}{Style.RESET}")

        cur = get_active_instance()
        if cur:
            label = cur.name if cur.name != "cnc" else "default"
            print(f"  {Style.DIM}Instance: {label}  ({cur.config_dir}){Style.RESET}")

        print()
        print(f"  {Style.BOLD}Select an action:{Style.RESET}")
        print()

        for i, (label, cmd) in enumerate(display):
            print(f"  {i + 1:>2}) {label}")

        print()
        try:
            choice = input(f"  {Style.BOLD}Choice [1-{len(display)}]{Style.RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not choice:
            continue

        # Number
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(display):
                cmd = display[idx][1]
                _run_menu_action(cmd)
                continue
        except ValueError:
            pass

        # Shortcut
        if choice.lower() in shortcut_map:
            _run_menu_action(shortcut_map[choice.lower()])
            continue

        print(f"  {Style.YELLOW}Invalid choice: {choice}{Style.RESET}")


def _run_menu_action(cmd: str) -> None:
    """Dispatch a menu action (switch, create-instance, or command)."""
    if cmd == "quit":
        ok("Goodbye")
        return
    if cmd == "switch":
        _switch_instance()
    elif cmd == "create-instance":
        _create_instance()
    else:
        _run_menu_command(cmd)


def _pause_after_output() -> None:
    """Wait for Enter so the user can read command output before menu reappears."""
    if sys.stdin.isatty():
        try:
            input(f"\n  {Style.DIM}Press Enter to return to menu...{Style.RESET}")
        except (EOFError, KeyboardInterrupt):
            print()


def _run_menu_command(cmd: str) -> None:
    """Run a command from the menu using a fake args namespace."""
    from cli.commands import (
        cmd_check, cmd_install, cmd_deploy, cmd_update, cmd_uninstall,
        cmd_status, cmd_backup, cmd_restore, cmd_diagnose, cmd_logs,
        cmd_releases, cmd_rollback, cmd_prune, cmd_instances, cmd_migrate,
        cmd_detect_mcu, cmd_flash_mcu, cmd_init_config,
        cmd_restart,
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
        "restart": cmd_restart,
    }

    handler = dispatch.get(cmd)
    if handler:
        handler(args)
    else:
        fail(f"Unknown command: {cmd}")


def _switch_instance() -> None:
    """Let the user switch the active instance interactively."""
    instances = detect_instances()
    if not instances:
        warn("No instances detected")
        return

    if len(instances) == 1:
        set_active_instance(instances[0])
        info(f"Switched to: {Style.BOLD}{instances[0].name}{Style.RESET}")
        return

    if _has_tui and sys.stdin.isatty():
        entries = [f"{'●' if inst.is_running else '○'} {inst.name}" for inst in instances]
        entries.append("+ Create new instance")
        entries.append("[Q] Quit")

        menu = TerminalMenu(
            menu_entries=entries,
            title="  Switch Instance",
            cycle_cursor=True,
            show_shortcut_hints=False,
            menu_highlight_style=("fg_green", "bold"),
            quit_keys=("q", "Q"),
            clear_screen=False,
        )
        choice = menu.show()
        if choice is None or choice == len(entries) - 1:
            return
        if choice == len(entries) - 2:
            _create_instance()
            return
        set_active_instance(instances[choice])
        info(f"Switched to: {Style.BOLD}{instances[choice].name}{Style.RESET}")
        return

    # Fallback: numbered input
    print()
    print(f"  {Style.BOLD}Available instances:{Style.RESET}")
    print()
    for i, inst in enumerate(instances):
        dot = "\x1b[32m\u25cf\x1b[0m" if inst.is_running else "\x1b[90m\u25cb\x1b[0m"
        print(f"  {i + 1:>2}) {dot} {Style.BOLD}{inst.name}{Style.RESET}")
        print(f"      Config: {inst.config_dir}")

    create_idx = len(instances) + 1
    print()
    print(f"  {create_idx:>2}) + Create new instance")
    print()

    try:
        choice = input(f"  {Style.BOLD}Choose instance [1-{create_idx}]{Style.RESET} ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    if choice == str(create_idx):
        _create_instance()
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
    """Interactively create a new instance using the shared helper."""
    from _e3cnc_shared import _create_new_instance

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

    inst = _create_new_instance()
    if inst:
        set_active_instance(inst)
