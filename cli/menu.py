"""Interactive menu for the E3CNC CLI."""

import sys

from _e3cnc_shared import (
    VERSION, TOOL_NAME, Style,
    print_banner, ok, info, warn, fail,
    get_active_instance, detect_instances, set_active_instance,
)


def _switch_instance() -> None:
    """Detect instances and let the user pick one."""
    instances = detect_instances()
    if not instances:
        print(f"  {Style.YELLOW}No instances detected.{Style.RESET}")
        input(f"  {Style.DIM}Press Enter...{Style.RESET}")
        return

    if len(instances) == 1:
        set_active_instance(instances[0])
        print(f"  {Style.GREEN}Using instance: {Style.BOLD}{instances[0].name}{Style.RESET}")
        input(f"  {Style.DIM}Press Enter...{Style.RESET}")
        return

    print()
    print(f"  {Style.BOLD}Available CNC instances:{Style.RESET}")
    print()
    for i, inst in enumerate(instances):
        dot = "\x1b[32m\u25cf\x1b[0m" if inst.is_running else "\x1b[90m\u25cb\x1b[0m"
        print(f"  {i + 1:>2}) {dot} {Style.BOLD}{inst.name}{Style.RESET}")
        print(f"      Config: {inst.config_dir}")
        print(f"      Service: {inst.moonraker_service}  Port: {inst.moonraker_port}")
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
            print(f"  {Style.GREEN}Using instance: {Style.BOLD}{instances[idx].name}{Style.RESET}")
        else:
            print(f"  {Style.YELLOW}Invalid choice.{Style.RESET}")
    except ValueError:
        print(f"  {Style.YELLOW}Invalid choice.{Style.RESET}")

    input(f"  {Style.DIM}Press Enter...{Style.RESET}")


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


def _interactive_menu() -> None:
    """Show an interactive numbered menu that loops until Quit."""
    from cli.commands import cmd_migrate

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

    while True:
        print_banner()
        print(f"  {Style.BOLD}{Style.GREEN}{TOOL_NAME} v{VERSION}{Style.RESET}")

        cur = get_active_instance()
        if cur:
            label = f"{cur.name}" if cur.name != "cnc" else "default"
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

        try:
            idx = int(choice) - 1
            if idx < 0 or idx >= len(display):
                print(f"  {Style.YELLOW}Invalid choice: {choice}{Style.RESET}")
                continue
            _, cmd = display[idx]
        except ValueError:
            choice_lower = choice.lower()
            found = None
            for l, c in display:
                if c and l.lower().startswith(f"[{choice_lower}]"):
                    found = c
                    break
            if not found:
                print(f"  {Style.YELLOW}Invalid choice: {choice}{Style.RESET}")
                continue
            cmd = found

        if cmd == "quit":
            break
        if cmd == "switch":
            _switch_instance()
            continue
        if cmd == "":
            continue

        _run_menu_command(cmd)

        print()
        input(f"  {Style.DIM}Press Enter to return to menu...{Style.RESET}")
