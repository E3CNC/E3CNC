"""e3cnc-cli — Unified CLI package.

Entry point for the CLI. Delegates to submodules for commands, parser, and menu.
"""

import sys

from _e3cnc_shared import (
    VERSION, TOOL_NAME, Style, print_banner, info, warn, fail,
    get_active_instance, check_status,
)
from _e3cnc_deploy import (
    get_releases, get_current_release,
)

from cli.parser import build_parser
from cli.menu import _interactive_menu
from cli.helpers import _require_ansible, _validate_ssh, _get_instance
from cli.commands import (
    cmd_check, cmd_install, cmd_deploy, cmd_update, cmd_uninstall,
    cmd_status, cmd_backup, cmd_restore, cmd_diagnose, cmd_logs,
    cmd_releases, cmd_rollback, cmd_migrate, cmd_migrate_instances, cmd_prune, cmd_instances,
    cmd_admin_page,
    cmd_clilog,
    cmd_restart,
    cmd_detect_mcu,
    cmd_flash_mcu,
    cmd_init_config,
)


def main() -> None:
    """Main entry point — parse args, dispatch to command handler or menu."""
    parser = build_parser()
    args = parser.parse_args()

    if args.command is None:
        _interactive_menu()
        sys.exit(0)

    print_banner()

    # Validate SSH for remote commands before dispatching
    if getattr(args, "remote", None):
        if args.command in ("install", "deploy", "update", "uninstall"):
            _require_ansible()
        _validate_ssh(args.remote)

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
        "migrate-instances": cmd_migrate_instances,
        "admin-page": cmd_admin_page,
        "clilog": cmd_clilog,
        "restart": cmd_restart,
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

    handler = dispatch.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
