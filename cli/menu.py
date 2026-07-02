"""Interactive menu for the E3CNC CLI."""
import sys

from _e3cnc_shared import (
    VERSION, TOOL_NAME, Style,
    print_banner, ok, info, warn, fail,
    get_active_instance, detect_instances, set_active_instance,
    INSTANCES_DIR, Instance,
)
from _e3cnc_deploy import get_current_release, get_active_release_version, generate_admin_page

# ── Terminal menu library (soft dependency) ────────────────────────────

_has_tui = False
try:
    from simple_term_menu import TerminalMenu
    _has_tui = True
except ImportError:
    pass


def _menu_title() -> str:
    """Format the menu header with CLI and deployed versions."""
    deployed = get_active_release_version()
    if deployed and deployed != VERSION:
        disp = deployed.lstrip("v")
        return f"  {TOOL_NAME} CLI v{VERSION}  |  Stack v{disp}"
    return f"  {TOOL_NAME} v{VERSION}"


def _interactive_menu() -> None:
    """Display the interactive menu and dispatch user choices."""
    if sys.stdin.isatty() and _has_tui:
        _tui_menu()
    else:
        _numbered_menu()


# Menu item definition shared by TUI and numbered menus
_ALL_COMMANDS = [
    ("[s] Status",                      "status",         "Check installation status"),
    ("[i] Install",                     "install",        "Bootstrap + download release"),
    ("[d] Deploy",                      "deploy",         "Deploy frontend from release"),
    ("[u] Update",                      "update",         "Full-stack update & verify"),
    ("[x] Uninstall",                   "uninstall",      "Remove all E3CNC components"),
    ("[m] Detect MCU",                  "detect-mcu",     "Scan for connected MCU devices"),
    ("[f] Flash MCU",                   "flash-mcu",      "Build & flash Klipper firmware"),
    ("[c] Init Config",                 "init-config",    "Generate CNC printer.cfg"),
    ("[n] Create Instance",             "create-instance","Create a new E3CNC instance"),
    ("[r] Releases",                    "releases",       "List installed releases"),
    ("[b] Rollback",                    "rollback",       "Roll back to a previous release"),
    ("[p] Prune",                       "prune",          "Remove old releases"),
    ("[v] Prune Backups",               "prune-backups",  "Remove old backups"),
    ("[g] Migrate Insts",               "migrate-instances","Import KIAUH instances"),
    ("[h] Import KIAUH",                "import-instance","Copy KIAUH config into E3CNC layout"),
    ("[t] Instances",                   "instances",      "List all instances with URLs"),
    ("[k] Check Deps",                  "check",          "Verify system dependencies"),
    ("[e] Restart Svc",                 "restart",        "Restart Moonraker & Klipper"),
    ("[a] Admin Page",                  "admin-page",     "Generate admin overview page"),
    ("[l] CLI Log",                     "clilog",         "View CLI operation logs"),
    ("[y] Backup",                      "backup",         "Create timestamped backup"),
    ("[o] Restore",                     "restore",        "Restore from a backup"),
    ("[w] Diagnose",                    "diagnose",       "Run system diagnostics"),
    ("[j] Logs",                        "logs",           "Tail Moonraker & nginx logs"),
    ("[q] Switch Instance",             "switch",         "Change active instance"),
    ("[z] Quit",                        "quit",           "Exit the CLI"),
]


def _tui_menu() -> None:
    """Full TUI menu with arrow keys, using simple-term-menu."""
    entries = [f"{label:24s}{desc}" for label, cmd, desc in _ALL_COMMANDS if label and cmd]
    cmd_map = {item[0]: item[1] for item in _ALL_COMMANDS if item[1]}

    while True:
        cur = get_active_instance()
        label = cur.name if cur and cur.name != "cnc" else "default"
        config = cur.config_dir if cur else ""
        title = _menu_title() + f"  —  Instance: {label}"

        menu = TerminalMenu(
            menu_entries=entries,
            title=title,
            status_bar=f"  {config}" if config else None,
            cycle_cursor=True,
            menu_highlight_style=("fg_green", "bold"),
            show_shortcut_hints=False,
            quit_keys=("q", "Q"),
            clear_screen=True,
            clear_menu_on_exit=True,
        )

        choice = menu.show()

        if choice is None:  # Quit
            ok("Goodbye")
            break

        entry = entries[choice]
        cmd = _ALL_COMMANDS[choice][1] if choice < len(_ALL_COMMANDS) else ""
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
    from cli.commands import COMMAND_HANDLERS

    items = [(l, c) for l, c, d in _ALL_COMMANDS if l and c]
    display = items

    descs = {cmd: desc for _, cmd, desc in _ALL_COMMANDS if cmd}

    # Build shortcut map — extract [x] from labels like "[s] Status" → "s"
    shortcut_map = {}
    for label, cmd in items:
        if cmd and label and label.startswith("[") and "]" in label:
            key = label[1:label.index("]")].strip().lower()
            if key:
                shortcut_map[key] = cmd

    while True:
        print_banner()
        print(f"  {Style.BOLD}{Style.GREEN}{_menu_title()}{Style.RESET}")

        cur = get_active_instance()
        if cur:
            iname = cur.name if cur.name != "cnc" else "default"
            print(f"  {Style.DIM}Instance: {iname}  ({cur.config_dir}){Style.RESET}")

        print()
        print(f"  {Style.BOLD}Select an action:{Style.RESET}")
        print()

        idx = 0
        for label, cmd in display:
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
        sys.exit(0)
    if cmd == "switch":
        _switch_instance()
    elif cmd == "create-instance":
        _create_instance()
    else:
        _run_menu_command(cmd)


def _pause_after_output() -> None:
    """Wait for Enter so the user can read command output before menu reappears."""
    try:
        input(f"\n  {Style.DIM}Press Enter to return to menu...{Style.RESET}")
    except (EOFError, KeyboardInterrupt):
        print()


def _run_menu_command(cmd: str) -> None:
    """Run a command from the menu using a shared args factory."""
    from cli.commands import COMMAND_HANDLERS, menu_args_factory

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

    args = menu_args_factory(cmd)

    handler = COMMAND_HANDLERS.get(cmd)
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
        entries = [f"[{i+1}] {'●' if inst.is_running else '○'} {inst.name}" for i, inst in enumerate(instances)]
        entries.append(f"[{len(instances)+1}] + Create new instance")
        entries.append("[q] Quit")

        menu = TerminalMenu(
            menu_entries=entries,
            title="  Switch Instance",
            cycle_cursor=True,
            show_shortcut_hints=False,
            menu_highlight_style=("fg_green", "bold"),
            quit_keys=("q", "Q"),
            clear_screen=True,
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
    cancel_idx = create_idx + 1
    print()
    print(f"  {create_idx:>2}) + Create new instance")
    print(f"  {cancel_idx:>2}) Cancel")
    print()

    try:
        choice = input(f"  {Style.BOLD}Choose instance [1-{cancel_idx}]{Style.RESET} ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    if choice == str(cancel_idx) or choice == "":
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
