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
from cli.commands import COMMAND_HANDLERS


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

    handler = COMMAND_HANDLERS.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
