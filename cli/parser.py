"""Arguable parser definition for the E3CNC CLI."""

import argparse

from _e3cnc_shared import VERSION, TOOL_NAME
from _e3cnc_deploy import DEFAULT_KEEP_RELEASES


def build_parser() -> argparse.ArgumentParser:
    """Build and return the argument parser with all subcommands."""
    parser = argparse.ArgumentParser(
        prog=TOOL_NAME,
        description=f"{TOOL_NAME} — Unified CLI for installing, deploying, and managing E3CNC UI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""Examples:
  %(prog)s install                   Full install (bootstrap + download release)
  %(prog)s install --check           Dry-run / check mode
  %(prog)s update                    Download stack artifact, activate, verify
  %(prog)s uninstall                 Remove all components
  %(prog)s status                    Check installation status
  %(prog)s backup                    Create backup
  %(prog)s restore e3cnc-backup-20250301-120000
  %(prog)s diagnose                  Run diagnostics
  %(prog)s logs                      Tail logs
  %(prog)s --version                 Show version
""",
    )

    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
    parser.add_argument("--verbose", "-v", action="store_true")

    shared_remote = argparse.ArgumentParser(add_help=False)
    shared_remote.add_argument("--remote", metavar="HOST", default=None,
                               help="Remote SSH target (e.g., pi@192.168.1.100)")

    shared_check = argparse.ArgumentParser(add_help=False)
    shared_check.add_argument("--check", "-n", action="store_true",
                              help="Dry-run mode (Ansible check mode)")

    shared_yes = argparse.ArgumentParser(add_help=False)
    shared_yes.add_argument("--yes", "-y", action="store_true",
                            help="Skip confirmation prompts")

    shared_instance = argparse.ArgumentParser(add_help=False)
    shared_instance.add_argument("--instance", "-p", metavar="NAME", default=None,
                                 help="CNC instance name (e.g., 'test2', 'lab', or 'default')")

    shared_instance_name = argparse.ArgumentParser(add_help=False)
    shared_instance_name.add_argument("--name", metavar="NAME", default=None,
                                      help="Instance name for bootstrap (creates ~/e3cnc/instances/{NAME})")

    p = subparsers = parser.add_subparsers(dest="command", title="Commands")

    p.add_parser("install", parents=[shared_remote, shared_check, shared_yes, shared_instance, shared_instance_name],
                 help="Full installation: bootstrap infrastructure + download release + activate")
    p.add_parser("deploy", parents=[shared_remote, shared_check, shared_instance],
                 help="Deploy frontend (download from GitHub release)")
    # Update with dry-run support
    update_parser = p.add_parser("update", parents=[shared_remote, shared_check, shared_yes, shared_instance],
                                  aliases=["redeploy"],
                                  help="Full-stack update: download stack artifact, activate, verify")
    update_parser.add_argument("--dry-run", action="store_true",
                               help="Show what would change without modifying anything")
    p.add_parser("uninstall", parents=[shared_remote, shared_check, shared_yes, shared_instance],
                 help="Remove all E3CNC components")
    p.add_parser("status", parents=[shared_remote, shared_instance],
                 help="Check installation status of all components")
    p.add_parser("check", help="Check dependencies")

    # MCU commands
    p.add_parser("detect-mcu", aliases=["detect", "scan"],
                 help="Scan for connected MCU/serial devices and identify them")
    p.add_parser("flash-mcu", aliases=["flash", "build"],
                 parents=[shared_yes, shared_instance],
                 help="Build and flash Klipper firmware for a connected MCU")
    p.add_parser("init-config", aliases=["init"],
                 parents=[shared_yes, shared_instance],
                 help="Generate a CNC printer.cfg with detected MCU path")

    # Single-deploy commands
    p.add_parser("releases", aliases=["rel"],
                 help="List installed releases")

    rlb = p.add_parser("rollback", parents=[shared_remote, shared_instance],
                       help="Roll back to a previous release")
    rlb.add_argument("version", nargs="?", default=None,
                     help="Specific version to roll back to (default: previous)")

    prn = p.add_parser("prune",
                       help="Remove old releases")
    prn.add_argument("--keep", type=int, default=DEFAULT_KEEP_RELEASES,
                     help=f"Number of releases to keep (default: {DEFAULT_KEEP_RELEASES})")
    prn.add_argument("--dry-run", "-n", action="store_true",
                     help="Show what would be pruned without deleting")

    p.add_parser("instances", aliases=["inst", "list"],
                 help="List detected instances with ports and frontend URLs")

    mig = p.add_parser("migrate", aliases=["migrate-layout"],
                       parents=[shared_remote, shared_yes, shared_instance],
                       help="Migrate from old layout to single-deploy layout")
    mig.add_argument("--from-version", metavar="VER", default=None,
                     help="Specific version to migrate to (default: latest release)")

    mig_inst = p.add_parser("migrate-instances",
                            parents=[shared_yes],
                            help="Migrate KIAUH instance layout to new ~/e3cnc/instances/{name} layout",
                            description="Migrate KIAUH-layout instances (printer_data, printer_*_data) to the new ~/e3cnc/instances/{name} layout.")

    p.add_parser("admin-page",
                 help="Regenerate the admin page at /admin")

    cli_log = p.add_parser("clilog",
                           help="View the CLI log at ~/e3cnc/cli.log")
    cli_log.add_argument("--lines", "-n", type=int, default=50)

    bp = p.add_parser("backup", parents=[shared_remote, shared_instance],
                      help="Create a timestamped backup")

    rp = p.add_parser("restore", parents=[shared_remote],
                      help="Restore from a backup")
    rp.add_argument("backup_dir", help="Backup directory name or path")
    rp.add_argument("--yes", "-y", action="store_true")

    p.add_parser("diagnose", parents=[shared_remote, shared_instance],
                 aliases=["diag", "doctor"],
                 help="Run comprehensive diagnostics")

    lp = p.add_parser("logs", parents=[shared_remote, shared_instance],
                      help="Tail Moonraker and nginx logs")
    lp.add_argument("--lines", "-n", type=int, default=50)

    return parser
