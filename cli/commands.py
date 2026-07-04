"""Command handlers for the E3CNC CLI."""

import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

from _e3cnc_shared import (
    VERSION, Style, ok, info, warn, fail, header,
    check_dependencies, check_status, Instance,
    run_backup, run_restore, run_diagnose, run_logs,
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
    backup_deployment_state, prune_backups, migrate_layout, detect_old_layout,
    RELEASES_DIR, DEFAULT_KEEP_RELEASES,
)

from cli.helpers import _get_instance, _run_ansible_cmd, _require_ansible

# Paths
from _e3cnc_shared import INSTALL_PLAYBOOK, DEPLOY_PLAYBOOK, UNINSTALL_PLAYBOOK


def cmd_check(args) -> None:
    """Check dependencies."""
    all_ok, lines = check_dependencies(output_callback=None)

    if getattr(args, "json", False):
        result = {
            "all_ok": all_ok,
            "checks": []
        }
        current_section = ""
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            if not stripped.startswith("✓") and not stripped.startswith("⚠") and not stripped.startswith("→"):
                current_section = stripped
                continue
            status = "passed" if stripped.startswith("✓") else "failed"
            # Strip leading ✓/⚠ and leading/trailing whitespace
            detail = stripped[1:].strip() if stripped.startswith(("✓", "⚠")) else stripped
            result["checks"].append({
                "section": current_section,
                "status": status,
                "detail": detail
            })
        import json
        print(json.dumps(result, indent=2))
        if not all_ok:
            sys.exit(1)
        return

    header("Dependencies")
    for line in lines:
        print(line)
    if not all_ok:
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
    """Full installation: bootstrap infrastructure + download release + activate."""
    from cli.helpers import _download_and_activate_release
    from _e3cnc_shared import INSTANCES_DIR, set_active_instance

    # Handle --name: set up instance before bootstrap creates directories
    if args.name:
        inst = Instance.from_name(args.name)
        set_active_instance(inst)
        info(f"Installing instance: {Style.BOLD}{args.name}{Style.RESET}")
    else:
        inst = _get_instance(args)
        # No existing instances detected — prompt for a name
        if not inst and sys.stdin.isatty():
            print()
            try:
                prompt = f"  {Style.BOLD}Name this machine [default]: {Style.RESET}"
                raw = input(prompt).strip()
            except (EOFError, KeyboardInterrupt):
                raw = ""
            name = raw or "default"
            name = re.sub(r"[^a-z0-9-]", "", name.lower().replace(" ", "-")) or "default"
            info(f"Creating instance: {Style.BOLD}{name}{Style.RESET}")
            inst = Instance.from_name(name)
            set_active_instance(inst)
        elif not inst:
            # Non-interactive and no instance — use default
            name = "default"
            info(f"Using instance: {Style.BOLD}default{Style.RESET}")
            inst = Instance.from_name("default")
            set_active_instance(inst)

    header("Prerequisites")
    _require_ansible()
    _ensure_system_packages()

    # Step 1: Bootstrap infrastructure (packages, venvs, systemd, nginx, moonraker config)
    _run_ansible_cmd(INSTALL_PLAYBOOK, args, "Bootstrap infrastructure",
                     extra_tags="bootstrap-stack,moonraker-config")

    # Step 2: Download and activate the latest release
    print()
    header("Release")
    info("Downloading latest stack artifact...")
    if args.check:
        _download_and_activate_release(inst=inst, skip_backup=True, auto_yes=True, dry_run=True)
        ok("Install check complete — no files were modified")
        return

    version = _download_and_activate_release(inst=inst, skip_backup=True, auto_yes=args.yes)
    ok(f"E3CNC v{version} deployed")

    # Generate admin page
    from _e3cnc_deploy import generate_admin_page
    generate_admin_page()

    # Step 3: Post-install guidance
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
        print(f"    http://e3cnc.local:8080/  (mDNS)")
        print(f"    or http://<ip>:8080/")
    print()
    info("Next steps:")
    print("    1. Run 'e3cnc-cli detect-mcu' to find your controller")
    print("    2. Run 'e3cnc-cli init-config' to generate a printer.cfg template")
    print("    3. Edit printer.cfg: fill in your stepper pins, endstops, and limits")
    print("    4. Run 'e3cnc-cli flash-mcu' to build and flash Klipper firmware")
    print("    5. Restart Klipper: sudo systemctl start klipper")
    print("    6. Run 'e3cnc-cli update' for future releases")
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
    from cli.helpers import _download_and_activate_release

    header("Stack Update")

    if args.dry_run:
        info("Dry-run mode — no files will be modified")
        print()

    if args.remote:
        warn("Remote update not yet supported — running locally")

    inst = _get_instance(args) if not args.remote else None
    _download_and_activate_release(inst=inst, skip_backup=False, auto_yes=args.yes,
                                   dry_run=args.dry_run, artifact_path=args.artifact)


def cmd_releases(args) -> None:
    """List installed releases."""
    from _e3cnc_deploy import get_releases, get_current_release

    if getattr(args, "json", False):
        import json
        releases = get_releases()
        current = get_current_release()
        result = {
            "current_version": current.version if current else None,
            "releases": []
        }
        for r in releases:
            result["releases"].append({
                "version": r.version,
                "is_active": r.is_active,
                "size_bytes": r.size_bytes,
                "created_at": r.created_at,
                "path": str(r.path),
            })
        print(json.dumps(result, indent=2))
        return

    from _e3cnc_deploy import format_release_list
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


def cmd_migrate_instances(args) -> None:
    """Migrate KIAUH instance layout to new ~/e3cnc/instances/{name} layout."""
    from _e3cnc_deploy import migrate_instances

    header("Instance Layout Migration")
    if not args.yes:
        reply = input(
            f"  {Style.YELLOW}This will migrate your KIAUH-layout instances to ~/e3cnc/instances/{{name}}/. Continue? [y/N] {Style.RESET}"
        ).strip().lower()
        if reply != "y":
            fail("Migration cancelled")

    migrated = migrate_instances(auto_yes=args.yes)
    if migrated:
        ok(f"Migrated {migrated} instance(s)")
    else:
        info("Nothing to migrate")


def cmd_prune(args) -> None:
    """Prune old releases."""
    header("Prune Releases")
    prune_releases(keep=args.keep, dry_run=args.dry_run)


def cmd_prune_backups(args) -> None:
    """Prune old backups."""
    header("Prune Backups")
    prune_backups(keep=args.keep, dry_run=args.dry_run)


def cmd_instances(args) -> None:
    """List detected instances with ports, web roots, and frontend URLs."""
    from _e3cnc_shared import detect_instances
    insts = detect_instances()

    if getattr(args, "json", False):
        from _e3cnc_deploy import _get_local_ip, get_current_release
        import json
        ip = _get_local_ip()
        current = get_current_release()
        result = {
            "local_ip": ip,
            "release_version": current.version if current else None,
            "instances": []
        }
        for inst in insts:
            result["instances"].append({
                "name": inst.name,
                "is_running": inst.is_running,
                "config_dir": inst.config_dir,
                "moonraker_service": inst.moonraker_service,
                "klipper_service": inst.klipper_service,
                "moonraker_port": inst.moonraker_port,
                "web_port": inst.web_port,
                "web_root": inst.web_root,
                "printer_data_dir": inst.printer_data_dir,
            })
        print(json.dumps(result, indent=2))
        return

    header("Instances")
    if not insts:
        info("No instances detected")
        info("Install one with: e3cnc-cli install --name <name>")
        return

    from _e3cnc_deploy import _get_local_ip
    ip = _get_local_ip()

    # Check for current release version
    from _e3cnc_deploy import get_current_release
    current = get_current_release()
    release_ver = current.version if current else "(no release)"

    for inst in insts:
        dot = "\033[32m\u25cf\033[0m" if inst.is_running else "\033[90m\u25cb\033[0m"
        web = "" if inst.web_port == 80 else f":{inst.web_port}"
        print(f"  {dot} {Style.BOLD}{inst.name}{Style.RESET}")
        print(f"      Config:     {inst.config_dir}")
        print(f"      Services:   {inst.moonraker_service}, {inst.klipper_service}")
        print(f"      API:        http://{ip}:{inst.moonraker_port}/server/info")
        print(f"      Web UI:     http://{ip}{web}/")
        print(f"      Web root:   {inst.web_root}")
        print(f"      Data:       {inst.printer_data_dir}")
        print(f"      Release:    {release_ver}")
        print()

    # Offer to create a new instance if running interactively
    if sys.stdin.isatty():
        print(f"  {len(insts) + 1:>2}) + Create new instance")
        print()
        try:
            choice = input(f"  {Style.BOLD}Option [1-{len(insts) + 1}]{Style.RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if choice == str(len(insts) + 1):
            from _e3cnc_shared import _create_new_instance, set_active_instance
            inst = _create_new_instance()
            if inst:
                set_active_instance(inst)
                info(f"Switched to: {Style.BOLD}{inst.name}{Style.RESET}")
            return

    info("Run 'e3cnc-cli status --instance <name>' for component details")
    info("Run 'e3cnc-cli update --instance <name>' to update")


def cmd_restart(args) -> None:
    """Restart services (Moonraker, Klipper) for an instance."""
    from _e3cnc_supervisor import _has_supervisor, _config_path, restart_services
    from _e3cnc_deploy import restart_services as svc_restart
    from _e3cnc_shared import get_active_instance

    header("Restart Services")

    # Use --instance flag first, then fall back to active instance
    if args.instance:
        inst = _get_instance(args)
    else:
        from _e3cnc_shared import get_active_instance
        inst = get_active_instance()
        if not inst:
            inst = _get_instance(args)
    if not inst:
        fail("No instance selected")

    # Use supervisor if available AND instance has a supervisor config
    if _has_supervisor() and _config_path(inst).exists():
        restart_services(inst)
    elif _has_supervisor():
        # Instance exists but not in supervisor → register it
        from _e3cnc_supervisor import register_instance
        if register_instance(inst):
            ok(f"Instance '{inst.name}' registered and started with supervisor")
        else:
            warn(f"Falling back to systemd for '{inst.name}'...")
            svc_restart(inst)
    else:
        svc_restart(inst)


def cmd_import_instance(args) -> None:
    """Import a KIAUH instance into the new E3CNC layout.

    Creates ~/e3cnc/instances/{name}/ with configs copied from the
    existing KIAUH installation. The original KIAUH setup is untouched.
    """
    from _e3cnc_shared import import_kiauh_instance, _scan_kiauh_instances

    header("Import KIAUH Instance")

    kiauh_insts = _scan_kiauh_instances()
    if not kiauh_insts:
        info("No KIAUH instances detected on this system")
        return

    if len(kiauh_insts) == 1:
        target = kiauh_insts[0]
    else:
        print()
        for i, inst in enumerate(kiauh_insts):
            print(f"  {i + 1:>2}) {inst.name}  ({inst.config_dir})")
        print()
        try:
            choice = input(f"  {Style.BOLD}Choose instance [1-{len(kiauh_insts)}]{Style.RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        try:
            idx = int(choice) - 1
            target = kiauh_insts[idx]
        except (ValueError, IndexError):
            warn("Invalid choice")
            return

    import_kiauh_instance(target)


def cmd_admin_page(args) -> None:
    """Regenerate the admin page at ~/e3cnc/admin/index.html."""
    from _e3cnc_deploy import generate_admin_page

    header("Admin Page")
    generate_admin_page()
    info("Available at http://<host>/admin")


def cmd_clilog(args) -> None:
    """View the CLI log file at ~/e3cnc/cli.log."""
    from _e3cnc_shared import LOG_FILE

    header("CLI Log")
    if not LOG_FILE.exists():
        info("No CLI log file found yet")
        return

    lines = args.lines or 50
    try:
        text = LOG_FILE.read_text()
        all_lines = text.strip().splitlines()
        tail = all_lines[-lines:]
        for line in tail:
            print(f"  {line}")
    except OSError as e:
        warn(f"Failed to read log: {e}")


def cmd_uninstall(args) -> None:
    """Remove one or all E3CNC instances."""
    from _e3cnc_shared import INSTANCES_DIR, detect_instances, instance_extra_vars, run_ansible_playbook
    from _e3cnc_deploy import generate_admin_page

    # Only uninstall new-layout E3CNC instances (under ~/e3cnc/instances/)
    all_instances = [i for i in detect_instances() if INSTANCES_DIR.is_dir() and (INSTANCES_DIR / i.name).is_dir()]

    if not all_instances:
        warn("No E3CNC instances found under ~/e3cnc/instances/")
        return

    # Determine which instances to uninstall
    targets: list[Instance] = []
    if args.instance:
        inst = _get_instance(args)
        if inst:
            targets = [inst]
    elif len(all_instances) == 1:
        targets = all_instances
    else:
        print()
        header("Select instances to uninstall")
        print(f"  {Style.DIM}Found {len(all_instances)} E3CNC instance(s){Style.RESET}")
        print()
        for idx, inst in enumerate(all_instances, 1):
            label = f"  [{idx}] {inst.name}"
            if inst.is_running:
                label += f"  {Style.GREEN}(running){Style.RESET}"
            print(label)
        print(f"  [a] All")
        print(f"  [{len(all_instances)+1}] Cancel")
        print()
        try:
            choice = input(f"  Select instance to uninstall [1-{len(all_instances)}, a, {len(all_instances)+1}]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            info("Cancelled")
            return

        if choice == "a":
            targets = list(all_instances)
        elif choice == str(len(all_instances) + 1) or choice == "":
            info("Cancelled")
            return
        else:
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(all_instances):
                    targets = [all_instances[idx]]
                else:
                    warn("Invalid selection")
                    return
            except ValueError:
                warn("Invalid selection")
                return

    if not targets:
        return

    # Confirm before proceeding
    names = ", ".join(i.name for i in targets)
    if not args.yes:
        plural = "s" if len(targets) > 1 else ""
        try:
            reply = input(f"  Remove E3CNC instance{plural} '{names}'? This cannot be undone. [y/N] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            info("Cancelled")
            return
        if reply != "y":
            info("Cancelled")
            return

    for inst in targets:
        print()
        header(f"Uninstalling: {inst.name}")
        ok(f"Instance: {inst.name}")
        ok(f"Config:    {inst.moonraker_conf}")
        ok(f"Data:      {inst.printer_data_dir}")

        # Run ansible uninstall playbook for this instance
        extra_vars = instance_extra_vars(inst)
        ok(f"Running Ansible uninstall playbook for '{inst.name}'...")
        run_ansible_playbook(
            UNINSTALL_PLAYBOOK, remote_host=args.remote,
            check_mode=args.check, verbose=False,
            label=f"Uninstall {inst.name}",
            extra_vars=extra_vars,
        )

        # Unregister from supervisor if available
        try:
            from _e3cnc_supervisor import unregister_instance
            unregister_instance(inst)
            ok(f"Unregistered '{inst.name}' from supervisor")
        except ImportError:
            pass
        except Exception as e:
            warn(f"Could not unregister from supervisor: {e}")

        # Remove instance directory
        inst_dir = INSTANCES_DIR / inst.name
        if inst_dir.is_dir():
            import shutil
            shutil.rmtree(inst_dir)
            ok(f"Removed instance directory: {inst_dir}")

    # Regenerate admin page
    print()
    generate_admin_page()
    ok("Uninstall complete")

    info("The ~/E3CNC repo checkout was NOT deleted.")
    info("To restore stock Mainsail, see: https://github.com/mainsail-crew/mainsail")


def cmd_status(args) -> None:
    """Check installation status."""
    inst = None
    if not args.remote:
        from _e3cnc_shared import get_active_instance
        if args.instance:
            inst = _get_instance(args)
        else:
            inst = get_active_instance()
            if not inst:
                inst = _get_instance(args)

    if getattr(args, "json", False):
        import json
        ok_count, total_checks, lines = check_status(args.remote, output_callback=None, inst=inst)
        result = {
            "ok_count": ok_count,
            "total_checks": total_checks,
            "all_ok": ok_count == total_checks,
            "checks": []
        }
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            result["checks"].append(stripped)
        if inst:
            from _e3cnc_deploy import _get_local_ip
            ip = _get_local_ip()
            result["instance"] = {
                "name": inst.name,
                "api_url": f"http://{ip}:{inst.moonraker_port}/server/info",
                "web_url": f"http://{ip}{':' + str(inst.web_port) if inst.web_port != 80 else ''}/",
            }
        print(json.dumps(result, indent=2))
        return

    if inst and inst.name != "cnc":
        info(f"Using instance: {Style.BOLD}{inst.name}{Style.RESET}")
    header("Installation Status")
    print(f"  {Style.DIM}Repository root: {Path(__file__).resolve().parent.parent}{Style.RESET}")
    check_status(args.remote, output_callback=lambda line: print(line, end=""), inst=inst)

    # Show access URL
    if inst:
        from _e3cnc_deploy import _get_local_ip
        ip = _get_local_ip()
        port = inst.moonraker_port
        web = inst.web_port
        if web == 80:
            print(f"\n  {Style.GREEN}Web UI:{Style.RESET}     http://{ip}/")
        else:
            print(f"\n  {Style.GREEN}Web UI:{Style.RESET}     http://{ip}:{web}/")
        print(f"  {Style.GREEN}Admin:{Style.RESET}      http://{ip}/admin")
        print(f"  {Style.GREEN}API:{Style.RESET}        http://{ip}:{port}/server/info")


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


def cmd_detect_mcu(args) -> None:
    """Scan for connected MCU/serial devices and help identify the right one."""
    from cli.helpers import scan_serial_devices

    header("MCU Detection")

    devices = scan_serial_devices()

    if not devices:
        info("No serial/MCU devices detected.")
        print()
        info("Common checks:")
        print("  1. Is your controller board connected via USB?")
        print("  2. Try: ls -la /dev/serial/by-id/")
        print("  3. Try: ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null")
        print("  4. Inside a VM/container? Serial passthrough may be needed.")
        print("  5. On macOS? Run this on the actual Raspberry Pi / target machine.")
        print()
        info("If you see devices but they don't appear here,")
        info("run 'sudo e3cnc-cli detect-mcu' for full access.")
        return

    print(f"  Found {len(devices)} device(s):")
    print()
    print(f"  {'#':<3} {'Device':<35} {'Vendor':<22} {'Model':<28} {'Serial'}")
    print(f"  {'─'*3} {'─'*35} {'─'*22} {'─'*28} {'─'*20}")
    for i, dev in enumerate(devices, 1):
        marker = "◉" if dev.get("is_klipper") else "○"
        print(f"  {i:<3} {dev['path']:<35} {dev['vendor']:<22} {dev['model']:<28} {dev['serial']:<20}  {marker}")

    klipper_devs = [d for d in devices if d.get("is_klipper")]
    if klipper_devs:
        print()
        info("◉ = Klipper firmware detected — ready to use")
    else:
        print()
        info("○ = No Klipper firmware detected")
        info("Run 'e3cnc-cli flash-mcu' to flash a controller board")

    print()
    info("To use a device, add to your printer.cfg:")
    print("  [mcu]")
    print(f"  serial: {devices[0]['path']}")

    if klipper_devs:
        print()
        info(f"Suggested MCU: {klipper_devs[0]['path']} ({klipper_devs[0]['vendor']} {klipper_devs[0]['model']})")


def cmd_flash_mcu(args) -> None:
    """Build and flash Klipper firmware for a connected MCU."""
    from cli.helpers import (
        scan_serial_devices, MCU_PRESETS,
        _find_matching_preset, build_klipper_firmware,
    )

    header("Flash MCU")

    # Step 1: Detect already-flashed Klipper devices
    devices = scan_serial_devices()
    klipper_devs = [d for d in devices if d.get("is_klipper")]
    if klipper_devs:
        info("Klipper firmware detected on:")
        for d in klipper_devs:
            print(f"    {d['path']}  ({d['vendor']} {d['model']})")
        print()
        info("Your MCU may already have Klipper firmware flashed.")
        if not args.yes:
            try:
                reply = input(
                    f"  {Style.YELLOW}Rebuild and reflash? [y/N] {Style.RESET}"
                ).strip().lower()
            except (EOFError, KeyboardInterrupt):
                reply = "n"
            if reply != "y":
                info("Cancelled — your existing firmware is intact.")
                return

    # Step 2: Show MCU type selection
    print()
    info("Select your MCU type:")
    print()

    # Try to suggest a preset based on detected Klipper device model
    suggested_idx = None
    for dev in devices:
        suggested_idx = _find_matching_preset(dev)
        if suggested_idx is not None:
            break

    for i, preset in enumerate(MCU_PRESETS):
        marker = "▸" if i == suggested_idx else " "
        print(f"  {marker} {i + 1}. {preset['name']}")
        print(f"       {preset['description']}")

    print()
    try:
        choice = input(
            f"  {Style.CYAN}Enter number (1-{len(MCU_PRESETS)}) [default: {(suggested_idx or 0) + 1}]: {Style.RESET}"
        ).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        info("Cancelled")
        return

    if not choice:
        idx = suggested_idx if suggested_idx is not None else 0
    else:
        try:
            idx = int(choice) - 1
            if idx < 0 or idx >= len(MCU_PRESETS):
                fail(f"Invalid choice: {choice}")
                return
        except ValueError:
            fail(f"Invalid choice: {choice}")
            return

    preset = MCU_PRESETS[idx]
    print()
    info(f"Building {preset['name']}...")

    # Step 3: Build firmware
    def _progress(msg):
        print(f"  {Style.DIM}→ {msg}{Style.RESET}")

    inst = _get_instance(args)
    klipper_dir = inst.klipper_dir if inst else "~/klipper"

    success = build_klipper_firmware(preset["id"], klipper_dir, _progress)
    if not success:
        fail("Firmware build failed")
        print()
        info("Common issues:")
        print("  1. Missing toolchain — install: sudo apt install arm-none-eabi-gcc")
        print("  2. Missing build tools — install: sudo apt install make")
        print("  3. Klipper directory not found at", klipper_dir)
        return

    # Step 4: Show flash instructions
    print()
    header("Flash Instructions")
    print()
    for line in preset["flash_help"].split("\n"):
        print(f"  {line}")
    print()
    info("Firmware files are in: ~/klipper/out/")
    print()


def cmd_init_config(args) -> None:
    """Generate a CNC printer.cfg with auto-detected MCU path."""
    from cli.helpers import (
        scan_serial_devices, _find_matching_preset,
        _generate_cnc_printer_cfg,
    )
    from pathlib import Path

    header("Init Config")

    # Step 1: Detect MCU
    devices = scan_serial_devices()
    klipper_devs = [d for d in devices if d.get("is_klipper")]
    all_devs = klipper_devs or devices

    mcu_path = None
    if all_devs:
        # Pick Klipper device first, or first detected device
        best = all_devs[0]
        mcu_path = best["path"]
        info(f"Detected MCU: {best['vendor']} {best['model']} ({best['path']})")
        # Show all detected devices
        if len(all_devs) > 1:
            info("Other detected devices:")
            for d in all_devs[1:]:
                print(f"    {d['path']}  ({d['vendor']} {d['model']})")
    else:
        info("No MCU detected. The config will include a placeholder.")
        info("Run 'e3cnc-cli detect-mcu' after connecting your controller.")

    print()

    # Step 2: Determine target path
    inst = _get_instance(args)
    if inst:
        config_path = Path(inst.printer_cfg)
    else:
        config_path = Path.home() / "printer_data" / "config" / "printer.cfg"

    if config_path.exists() and not args.yes:
        try:
            reply = input(
                f"  {Style.YELLOW}Overwrite {config_path}? [y/N] {Style.RESET}"
            ).strip().lower()
        except (EOFError, KeyboardInterrupt):
            reply = "n"
        if reply != "y":
            info("Cancelled")
            return

    # Step 3: Generate and write config
    config_dir = config_path.parent
    config_dir.mkdir(parents=True, exist_ok=True)

    printer_data_dir = inst.printer_data_dir if inst else "~/printer_data"
    content = _generate_cnc_printer_cfg(mcu_path, printer_data_dir)
    try:
        config_path.write_text(content)
        ok(f"Generated: {config_path}")
    except OSError as e:
        fail(f"Failed to write {config_path}: {e}")
        return

    print()
    info("Next steps:")
    print("  1. Edit printer.cfg and search for '!!! ADJUST'")
    print("  2. Fill in your machine's step/dir/enable pins")
    print("  3. Set endstop pins and travel limits")
    print("  4. Configure spindle control")
    print("  5. Restart Klipper: sudo systemctl restart klipper")
    print("  6. Connect to the web interface")
    print()


# ── Command registry ────────────────────────────────────────────────────────
# Single source of truth for all CLI commands and their handlers.
# Used by cli/__init__.py (dispatch) and cli/menu.py (TUI + numbered menus).

COMMAND_HANDLERS = {
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
    "prune-backups": cmd_prune_backups,
    "migrate": cmd_migrate,
    "migrate-layout": cmd_migrate,
    "migrate-instances": cmd_migrate_instances,
    "admin-page": cmd_admin_page,
    "clilog": cmd_clilog,
    "restart": cmd_restart,
    "import-instance": cmd_import_instance,
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


def menu_args_factory(command: str) -> object:
    """Create a menu-style args namespace for dispatching a command.

    Returns a simple object with all attributes that command handlers
    may access, defaulted to safe values. Called from the TUI and
    numbered menus instead of constructing _Fake() manually.
    """
    from types import SimpleNamespace
    return SimpleNamespace(
        remote=None,
        check=False,
        verbose=False,
        backup_dir="",
        yes=True,
        lines=50,
        instance=None,
        dry_run=False,
        keep=3,
        name=None,
        version=None,
        from_version=None,
        command=command,
    )
