"""Command handlers for the E3CNC CLI."""

import subprocess
import sys
from pathlib import Path
from typing import Optional

from _e3cnc_shared import (
    VERSION, Style, ok, info, warn, fail, header,
    check_dependencies, check_status, Instance,
    run_backup, run_restore, run_diagnose, run_logs,
    get_active_instance,
)
from _e3cnc_deploy import (
    find_stack_artifact_asset, download_artifact, verify_checksum,
    extract_artifact, run_pre_flight_checks,
    activate_release, Journal,
    install_pip_deps, run_migrations,
    sync_runtime_files, update_systemd_paths, restart_services,
    run_health_checks,
    rollback_to, rollback_previous,
    prune_releases, format_release_list,
    backup_deployment_state, migrate_layout, detect_old_layout,
    RELEASES_DIR, DEFAULT_KEEP_RELEASES,
)

from cli.helpers import _get_instance, _run_ansible_cmd, _require_ansible

# Paths
from _e3cnc_shared import INSTALL_PLAYBOOK, DEPLOY_PLAYBOOK, UNINSTALL_PLAYBOOK


def cmd_check(args) -> None:
    """Check dependencies."""
    header("Dependencies")
    ok, _ = check_dependencies(output_callback=lambda line: print(line, end=""))
    if not ok:
        sys.exit(1)


def _ensure_system_packages() -> None:
    """Install system packages needed for frontend download and Ansible."""
    import shutil
    from _e3cnc_shared import _ensure_local_sudo_access

    missing = []
    for pkg in ["curl", "unzip"]:
        if not shutil.which(pkg):
            missing.append(pkg)
    if not missing:
        return
    info(f"Installing system packages: {' '.join(missing)}...")
    _ensure_local_sudo_access(f"installing system packages: {' '.join(missing)}")
    subprocess.run(["sudo", "apt-get", "update"])
    result = subprocess.run(
        ["sudo", "apt-get", "install", "-y"] + missing,
        text=True,
    )
    if result.returncode == 0:
        ok(f"Installed: {' '.join(missing)}")
    else:
        warn(f"Failed to install: {' '.join(missing)}")
        warn("Install manually: sudo apt install " + " ".join(missing))


def cmd_install(args) -> None:
    """Full installation: bootstrap stack, extractor, config, macros, frontend."""
    header("Prerequisites")
    _require_ansible()
    _ensure_system_packages()
    _run_ansible_cmd(INSTALL_PLAYBOOK, args, "Install")

    inst = _get_instance(args)
    _show_post_install_guide(inst)


def _show_post_install_guide(inst: Optional[Instance] = None) -> None:
    """Print a post-install summary with next steps."""
    header("Install Summary")

    services_ok = True

    nginx = subprocess.run(
        ["systemctl", "is-active", "nginx"], capture_output=True, text=True
    )
    if nginx.returncode == 0:
        ok("Nginx is running — serving frontend")
    else:
        warn("Nginx is not running — check: sudo systemctl start nginx")
        services_ok = False

    if inst:
        mr = subprocess.run(
            ["systemctl", "is-active", inst.moonraker_service],
            capture_output=True, text=True,
        )
        if mr.returncode == 0:
            ok(f"Moonraker ({inst.moonraker_service}) is running")
        else:
            warn(f"Moonraker ({inst.moonraker_service}) is not running")
            services_ok = False

    if inst:
        kl = subprocess.run(
            ["systemctl", "is-active", inst.klipper_service],
            capture_output=True, text=True,
        )
        if kl.returncode == 0:
            ok(f"Klipper ({inst.klipper_service}) is running")
        else:
            warn(f"Klipper ({inst.klipper_service}) is not running — needs a real printer.cfg")

    if inst:
        printer_cfg = Path(inst.printer_cfg)
        if printer_cfg.exists():
            content = printer_cfg.read_text()
            if "E3CNC bootstrap placeholder" in content:
                warn("printer.cfg is a bootstrap placeholder — needs a real machine config")
            else:
                ok("printer.cfg found")

    print()
    info("To access the web interface:")
    if inst:
        print(f"    http://e3cnc.local/  (mDNS)")
        print(f"    or use the machine's IP address")
    print()
    info("Next steps:")
    print("    1. Configure printer.cfg with your machine's settings")
    print("    2. Build and flash Klipper firmware for your MCU")
    print("       (see vendor/klipper/docs/Installation.md)")
    print("    3. Restart Klipper: sudo systemctl start klipper")
    print("    4. Run 'e3cnc-cli update' to ensure the latest release")
    print()
    if not services_ok:
        warn("Some services failed to start — check logs with: e3cnc-cli logs")
    else:
        ok("Installation complete")


def cmd_deploy(args) -> None:
    """Deploy frontend only."""
    _run_ansible_cmd(DEPLOY_PLAYBOOK, args, "Deploy")


def cmd_update(args) -> None:
    """Full-stack update: download stack artifact, activate, verify."""
    header("Stack Update")

    if args.remote:
        warn("Remote update not yet supported — running locally")

    inst = _get_instance(args) if not args.remote else None

    RELEASES_DIR.mkdir(parents=True, exist_ok=True)

    step_num = 1

    def _step(label):
        nonlocal step_num
        from _e3cnc_shared import step
        step(step_num, 14, label)
        step_num += 1

    _step("Finding latest release")
    asset = find_stack_artifact_asset()
    if not asset:
        fail("No stack artifact found. Create a release on GitHub first, or use the legacy update.")
    version = asset.get("name", "").replace("e3cnc-stack-", "").replace(".tar.zst", "")
    info(f"Found stack artifact: {asset.get('name', 'unknown')}")

    _step("Downloading artifact")
    download_dir = Path("/tmp") / "e3cnc-download"
    download_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = download_artifact(asset, download_dir)
    if not artifact_path:
        fail("Download failed")

    _step("Verifying checksum")
    if not verify_checksum(artifact_path):
        if args.yes:
            warn("Checksum mismatch — continuing (--yes set)")
        else:
            reply = input(
                f"  {Style.YELLOW}Checksum mismatch. Continue anyway? [y/N] {Style.RESET}"
            ).strip().lower()
            if reply != "y":
                fail("Update cancelled")

    _step("Running pre-flight checks")
    import json as _json
    try:
        manifest = _json.loads(artifact_path.with_name("manifest.json").read_text()) if (
            artifact_path.with_name("manifest.json").exists()
        ) else {}
    except (OSError, _json.JSONDecodeError):
        manifest = {}
    if not run_pre_flight_checks(manifest):
        if not args.yes:
            reply = input(
                f"  {Style.YELLOW}Pre-flight checks failed. Continue? [y/N] {Style.RESET}"
            ).strip().lower()
            if reply != "y":
                fail("Update cancelled")

    _step("Backing up current state")
    backup_deployment_state(inst)

    _step("Extracting release")
    release_dir = extract_artifact(artifact_path, RELEASES_DIR, version)
    if not release_dir:
        fail("Extraction failed")

    _step("Activating new release")
    journal = Journal.load()
    if not activate_release(version, release_dir, journal):
        fail("Activation failed")

    _step("Installing pip dependencies")
    if not install_pip_deps(release_dir):
        info("Pip dependencies skipped — continuing")

    _step("Running config/schema migrations")
    run_migrations(release_dir, direction="up")

    _step("Syncing runtime files to live paths")
    if not sync_runtime_files(inst):
        warn("Runtime file sync had issues — continuing")

    _step("Updating systemd paths")
    update_systemd_paths(inst)

    _step("Restarting services")
    restart_services(inst)

    _step("Running health checks")
    results = run_health_checks(inst)
    all_passed = all(r.passed for r in results)
    for r in results:
        if r.passed:
            ok(f"{r.name}: {r.detail}")
        else:
            warn(f"{r.name}: {r.detail}")

    _step("Finalizing")
    if all_passed:
        journal.last_known_good = version
        journal.save()
        ok(f"Update to {version} complete")
        prune_releases(DEFAULT_KEEP_RELEASES)
    else:
        warn(f"Health checks failed — rolling back to {journal.previous}")
        from _e3cnc_deploy import auto_rollback
        auto_rollback(journal)
        fail("Update rolled back due to health check failures")


def cmd_releases(args) -> None:
    """List installed releases."""
    from _e3cnc_deploy import get_releases, format_release_list

    header("Releases")
    releases = get_releases()
    if not releases:
        info("No releases installed")
        info("Run 'e3cnc-cli update' to install the latest release")
        return
    print(format_release_list(releases))


def cmd_rollback(args) -> None:
    """Roll back to a previous release."""
    header("Rollback")
    inst = _get_instance(args) if not args.remote else None

    if args.version:
        success = rollback_to(args.version)
    else:
        success = rollback_previous()
    if not success:
        fail("Rollback failed")

    info("Syncing runtime files from rolled-back release...")
    sync_runtime_files(inst)
    info("Updating systemd paths...")
    update_systemd_paths(inst)
    info("Restarting services...")
    restart_services(inst)
    info("Running health checks after rollback...")
    results = run_health_checks(inst)
    all_passed = all(r.passed for r in results)
    for r in results:
        if r.passed:
            ok(f"{r.name}: {r.detail}")
        else:
            warn(f"{r.name}: {r.detail}")
    if all_passed:
        ok("Rollback complete — system healthy")
    else:
        warn("Rollback complete — some checks failed (pre-existing condition?)")


def cmd_migrate(args) -> None:
    """Migrate from old layout to single-deploy layout."""
    header("Layout Migration")
    if args.remote:
        warn("Remote migration not yet supported — run on the target machine directly")
        return

    if not detect_old_layout():
        from _e3cnc_deploy import E3CNC_DIR
        if E3CNC_DIR.exists():
            info("Already using new single-deploy layout — nothing to migrate")
            return
        info("No old layout detected. Use 'e3cnc-cli install' for a fresh install.")
        return

    if not args.yes:
        reply = input(
            f"  {Style.YELLOW}This will migrate your installation to the new layout (~/e3cnc/releases/). Continue? [y/N] {Style.RESET}"
        ).strip().lower()
        if reply != "y":
            fail("Migration cancelled")

    success = migrate_layout(version=args.from_version)
    if success:
        ok("Migration complete")
        info("Run 'e3cnc-cli update' for future updates")
    else:
        fail("Migration failed — see errors above")


def cmd_prune(args) -> None:
    """Prune old releases."""
    header("Prune Releases")
    prune_releases(keep=args.keep, dry_run=args.dry_run)


def cmd_instances(args) -> None:
    """List detected instances with ports, web roots, and frontend URLs."""
    header("Instances")
    from _e3cnc_shared import detect_instances
    insts = detect_instances()
    if not insts:
        info("No instances detected")
        return
    print(f"  {'Name':<12} {'Port':<8} {'Web Root':<30} {'Frontend URL'}")
    print(f"  {'-'*12} {'-'*8} {'-'*30} {'-'*40}")
    for i, inst in enumerate(insts):
        dot = "\033[32m\u25cf\033[0m" if inst.is_running else "\033[31m\u25cf\033[0m"
        port = inst.moonraker_port
        if i == 0:
            fe_url = "http://<host>"
        else:
            fe_url = f"http://<host>:{8080 + i}"
        print(f"  {dot} {inst.name:<10} {port:<8} {Path(inst.web_root).name:<30} {fe_url}")
    print()
    info("Run 'e3cnc-cli status --instance <name>' for component details")


def cmd_uninstall(args) -> None:
    """Remove all E3CNC components."""
    _run_ansible_cmd(UNINSTALL_PLAYBOOK, args, "Uninstall")
    info("The ~/E3CNC repo checkout was NOT deleted.")
    info("To restore stock Mainsail, see: https://github.com/mainsail-crew/mainsail")


def cmd_status(args) -> None:
    """Check installation status."""
    inst = None
    if not args.remote:
        inst = _get_instance(args)
        if inst and inst.name != "cnc":
            info(f"Using instance: {Style.BOLD}{inst.name}{Style.RESET}")
    header("Installation Status")
    print(f"  {Style.DIM}Repository root: {Path(__file__).resolve().parent.parent}{Style.RESET}")
    check_status(args.remote, output_callback=lambda line: print(line, end=""), inst=inst)


def cmd_backup(args) -> None:
    """Create a timestamped backup."""
    header("Backup")
    inst = None if args.remote else _get_instance(args)
    result = run_backup(args.remote, output_callback=lambda line: print(line, end=""), inst=inst)
    if not result.success:
        sys.exit(1)


def cmd_restore(args) -> None:
    """Restore from a backup."""
    header("Restore")
    inst = None if args.remote else _get_instance(args)
    result = run_restore(
        args.backup_dir, args.remote, args.yes,
        output_callback=lambda line: print(line, end=""), inst=inst,
    )
    if not result.success:
        sys.exit(1)


def cmd_diagnose(args) -> None:
    """Run diagnostics."""
    header("Diagnostics")
    inst = None if args.remote else _get_instance(args)
    result = run_diagnose(args.remote, output_callback=lambda line: print(line, end=""), inst=inst)
    if not result.success:
        sys.exit(1)


def cmd_logs(args) -> None:
    """Tail logs."""
    header("Logs")
    inst = None if args.remote else _get_instance(args)
    result = run_logs(args.remote, args.lines, output_callback=lambda line: print(line, end=""), inst=inst)
    if not result.success:
        sys.exit(1)
