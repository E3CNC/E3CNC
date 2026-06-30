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
        ("",                               "",               ""),
        ("── Maintenance ──",               "",               ""),
        (" 1) Status",                      "status",         "Check installation status"),
        (" 2) Install",                     "install",        "Bootstrap + download release"),
        (" 3) Deploy",                      "deploy",         "Deploy frontend from release"),
        (" 4) Update",                      "update",         "Full-stack update & verify"),
        (" 5) Uninstall",                   "uninstall",      "Remove all E3CNC components"),
        ("",                               "",               ""),
        ("── MCU ──",                       "",               ""),
        (" 6) Detect MCU",                  "detect-mcu",     "Scan for connected MCU devices"),
        (" 7) Flash MCU",                   "flash-mcu",      "Build & flash Klipper firmware"),
        (" 8) Init Config",                 "init-config",    "Generate CNC printer.cfg"),
        ("",                               "",               ""),
        ("── Instances ──",                 "",               ""),
        (" 9) Create Instance",             "create-instance","Create a new E3CNC instance"),
        ("10) Releases",                    "releases",       "List installed releases"),
        ("11) Rollback",                    "rollback",       "Roll back to a previous release"),
        ("12) Prune",                       "prune",          "Remove old releases"),
        ("13) Migrate Instances",           "migrate-instances","Import KIAUH instances to new layout"),
        ("",                               "",               ""),
        ("── Tools ──",                     "",               ""),
        ("14) Import KIAUH",                "import-instance","Copy KIAUH config into E3CNC layout"),
        ("15) Instances",                   "instances",      "List all instances with URLs"),
        ("16) Check Deps",                  "check",          "Verify system dependencies"),
        ("17) Restart Svc",                 "restart",        "Restart Moonraker & Klipper"),
        ("18) Admin Page",                  "admin-page",     "Generate admin overview page"),
        ("19) CLI Log",                     "clilog",         "View CLI operation logs"),
        ("20) Backup",                      "backup",         "Create timestamped backup"),
        ("21) Restore",                     "restore",        "Restore from a backup"),
        ("22) Diagnose",                    "diagnose",       "Run system diagnostics"),
        ("23) Logs",                        "logs",           "Tail Moonraker & nginx logs"),
        ("",                               "",               ""),
        ("── Navigation ──",                "",               ""),
        ("24) Switch Instance",             "switch",         "Change active instance"),
        ("25) Quit",                        "quit",           "Exit the CLI"),
    ]
    entries = []
    for item in all_items:
        if item[2]:  # has description
            entries.append(f"{item[0]:24s}{item[2]}")
        elif item[1]:  # has command but no description
            entries.append(item[0])
        else:  # header
            entries.append(item[0])
    cmd_map = {item[0]: item[1] for item in all_items if item[1]}

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
            show_shortcut_hints=True,
            menu_highlight_style=("fg_green", "bold"),
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
        ("", ""),
        ("── Maintenance ──", ""),
        (" 1) Status",      "status"),
        (" 2) Install",     "install"),
        (" 3) Deploy",      "deploy"),
        (" 4) Update",      "update"),
        (" 5) Uninstall",   "uninstall"),
        ("", ""),
        ("── MCU ──",       ""),
        (" 6) Detect MCU",  "detect-mcu"),
        (" 7) Flash MCU",   "flash-mcu"),
        (" 8) Init Config", "init-config"),
        ("", ""),
        ("── Instances ──", ""),
        (" 9) Create Instance", "create-instance"),
        ("10) Releases",    "releases"),
        ("11) Rollback",    "rollback"),
        ("12) Prune",       "prune"),
        ("13) Migrate Instances", "migrate-instances"),
        ("", ""),
        ("── Tools ──",     ""),
        ("14) Import KIAUH","import-instance"),
        ("15) Instances",   "instances"),
        ("16) Check Deps",  "check"),
        ("17) Restart Svc", "restart"),
        ("18) Admin Page",  "admin-page"),
        ("19) CLI Log",     "clilog"),
        ("20) Backup",      "backup"),
        ("21) Restore",     "restore"),
        ("22) Diagnose",    "diagnose"),
        ("23) Logs",        "logs"),
        ("", ""),
        ("── Navigation ──",""),
        ("24) Switch Instance", "switch"),
        ("25) Quit",        "quit"),
    ]
    # Build flat list of actionable items for number input
    items = [(label, cmd) for label, cmd in all_items if label and cmd]
    display = [(l, c) for l, c in all_items if l and c]

    # Description map for numbered menu
    descs = {
        "status": "Check installation status",
        "install": "Bootstrap + download release",
        "deploy": "Deploy frontend from release",
        "update": "Full-stack update & verify",
        "uninstall": "Remove all E3CNC components",
        "detect-mcu": "Scan for connected MCU devices",
        "flash-mcu": "Build & flash Klipper firmware",
        "init-config": "Generate CNC printer.cfg",
        "create-instance": "Create a new E3CNC instance",
        "releases": "List installed releases",
        "rollback": "Roll back to a previous release",
        "prune": "Remove old releases",
        "migrate-instances": "Import KIAUH instances to new layout",
        "import-instance": "Copy KIAUH config into E3CNC layout",
        "instances": "List all instances with URLs",
        "check": "Verify system dependencies",
        "restart": "Restart Moonraker & Klipper",
        "admin-page": "Generate admin overview page",
        "clilog": "View CLI operation logs",
        "backup": "Create timestamped backup",
        "restore": "Restore from a backup",
        "diagnose": "Run system diagnostics",
        "logs": "Tail Moonraker & nginx logs",
        "switch": "Change active instance",
        "quit": "Exit the CLI",
    }

    # Build shortcut map — skip headers and blank lines
    shortcut_map = {}
    for item in all_items:
        c = item[1]
        if c:
            shortcut_map[c] = c

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

        idx = 0
        for item in all_items:
            label, cmd = item[0], item[1]
            if not label and not cmd:  # blank line
                print()
            elif label and not cmd:  # section header
                print(f"  {Style.DIM}{label}{Style.RESET}")
            else:  # actionable item
                idx += 1
                desc = descs.get(cmd, "")
                print(f"  {idx:>2}) {label:22s}{desc}")

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
            if 0 <= idx < len(items):
                cmd = items[idx][1]
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
        cmd_import_instance,
        cmd_admin_page,
        cmd_clilog,
        cmd_migrate_instances,
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
        "import-instance": cmd_import_instance,
        "admin-page": cmd_admin_page,
        "clilog": cmd_clilog,
        "migrate-instances": cmd_migrate_instances,
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
