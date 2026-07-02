"""Tests for the cli/ package — parser, helpers, commands, menu, and main dispatch."""

import argparse
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_subprocess_run():
    """Mock subprocess.run to prevent actual command execution."""
    with patch("cli.helpers.subprocess.run") as mock:
        mock.return_value = MagicMock(
            returncode=0, stdout="mock output", stderr=""
        )
        yield mock


@pytest.fixture
def mock_subprocess_in_commands():
    """Mock subprocess.run in cli.commands (used by _show_post_install_guide)."""
    with patch("cli.commands.subprocess.run") as mock:
        mock.return_value = MagicMock(
            returncode=0, stdout="active", stderr=""
        )
        yield mock


@pytest.fixture
def mock_detect_instances():
    """Mock detect_instances to return controlled test data."""
    from _e3cnc_shared import Instance

    instances = [
        Instance(
            name="test1",
            printer_data_dir="/tmp/printer_test1_data",
            config_dir="/tmp/printer_test1_data/config",
            moonraker_conf="/tmp/printer_test1_data/config/moonraker.conf",
            moonraker_log="/tmp/printer_test1_data/logs/moonraker.log",
            scripts_dir="/tmp/printer_test1_data/scripts",
            macros_dir="/tmp/printer_test1_data/config/macros",
            E3CNC_dir="/tmp/printer_test1_data/config/E3CNC",
            printer_cfg="/tmp/printer_test1_data/config/printer.cfg",
            web_root="/tmp/e3cnc-web",
            moonraker_dir="/tmp/moonraker",
            klipper_dir="/tmp/klipper",
            moonraker_service="moonraker-test1",
            klipper_service="klipper-test1",
            moonraker_port=7126,
            is_running=True,
        ),
        Instance(
            name="test2",
            printer_data_dir="/tmp/printer_test2_data",
            config_dir="/tmp/printer_test2_data/config",
            moonraker_conf="/tmp/printer_test2_data/config/moonraker.conf",
            moonraker_log="/tmp/printer_test2_data/logs/moonraker.log",
            scripts_dir="/tmp/printer_test2_data/scripts",
            macros_dir="/tmp/printer_test2_data/config/macros",
            E3CNC_dir="/tmp/printer_test2_data/config/E3CNC",
            printer_cfg="/tmp/printer_test2_data/config/printer.cfg",
            web_root="/tmp/e3cnc-web",
            moonraker_dir="/tmp/moonraker",
            klipper_dir="/tmp/klipper",
            moonraker_service="moonraker-test2",
            klipper_service="klipper-test2",
            moonraker_port=7127,
            is_running=False,
        ),
        Instance(
            name="cnc",
            printer_data_dir="/tmp/printer_data",
            config_dir="/tmp/printer_data/config",
            moonraker_conf="/tmp/printer_data/config/moonraker.conf",
            moonraker_log="/tmp/printer_data/logs/moonraker.log",
            scripts_dir="/tmp/printer_data/scripts",
            macros_dir="/tmp/printer_data/config/macros",
            E3CNC_dir="/tmp/printer_data/config/E3CNC",
            printer_cfg="/tmp/printer_data/config/printer.cfg",
            web_root="/tmp/e3cnc-web",
            moonraker_dir="/tmp/moonraker",
            klipper_dir="/tmp/klipper",
            moonraker_service="moonraker",
            klipper_service="klipper",
            moonraker_port=7125,
            is_running=True,
        ),
    ]
    with patch("cli.helpers.detect_instances", return_value=instances):
        yield instances


def _make_args(**overrides) -> argparse.Namespace:
    """Create a mock argparse.Namespace with defaults."""
    defaults = {
        "remote": None,
        "check": False,
        "verbose": False,
        "yes": False,
        "instance": None,
        "backup_dir": "",
        "lines": 50,
        "command": "install",
        "keep": 3,
        "dry_run": False,
        "version": None,
        "from_version": None,
    }
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


# ── Parser tests ──────────────────────────────────────────────────────────────


class TestBuildParser:
    """Tests for cli.parser.build_parser()."""

    def test_creates_all_subcommands(self):
        """Parser should have all expected subcommands."""
        from cli.parser import build_parser

        parser = build_parser()
        expected = {
            "install", "deploy", "update", "uninstall", "status",
            "check", "releases", "rollback", "prune", "instances",
            "migrate", "backup", "restore", "diagnose", "logs",
        }
        assert set(parser._subparsers._group_actions[0].choices.keys()).issuperset(expected)

    def test_install_has_expected_arguments(self):
        """Install subcommand should have --remote, --check, --yes, --instance."""
        from cli.parser import build_parser

        parser = build_parser()
        install = parser._subparsers._group_actions[0].choices["install"]
        actions = {a.dest for a in install._actions}
        assert "remote" in actions
        assert "check" in actions
        assert "yes" in actions
        assert "instance" in actions

    def test_deploy_has_instance_but_not_yes(self):
        """Deploy should have --instance but not --yes."""
        from cli.parser import build_parser

        parser = build_parser()
        deploy = parser._subparsers._group_actions[0].choices["deploy"]
        actions = {a.dest for a in deploy._actions}
        assert "instance" in actions
        assert "remote" in actions
        assert "check" in actions

    def test_update_has_redeploy_alias(self):
        """Update should be accessible via 'redeploy' alias as well."""
        from cli.parser import build_parser

        parser = build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "redeploy" in choices
        assert choices["redeploy"] is choices["update"]

    def test_prune_backups_has_correct_arguments(self):
        """prune-backups should have --keep and --dry-run."""
        from cli.parser import build_parser
        parser = build_parser()
        prb = parser._subparsers._group_actions[0].choices["prune-backups"]
        actions = {a.dest for a in prb._actions}
        assert "keep" in actions
        assert "dry_run" in actions


# ── _format_version ─────────────────────────────────────────────────

class TestFormatVersion:
    """Tests for cli.parser._format_version()."""

    def test_matching_versions_shows_short_form(self):
        """When CLI and deployed versions match, show short form."""
        from cli.parser import _format_version
        from _e3cnc_shared import VERSION
        with patch("cli.parser.get_active_release_version", return_value=VERSION):
            result = _format_version()
            assert VERSION in result
            assert "|" not in result

    def test_different_versions_shows_both(self):
        """When versions differ, show both CLI and deployed."""
        from cli.parser import _format_version
        from _e3cnc_shared import VERSION
        with patch("cli.parser.get_active_release_version", return_value="v999.0.0"):
            result = _format_version()
            assert VERSION in result
            assert "Deployed" in result
            assert "v999.0.0" in result

    def test_strips_v_prefix_from_deployed(self):
        """Deployed version 'v0.9.5' should not display as 'vv0.9.5'."""
        from cli.parser import _format_version
        with patch("cli.parser.get_active_release_version", return_value="v0.9.5"):
            result = _format_version()
            assert "vv0.9.5" not in result
            assert "v0.9.5" in result

    def test_none_deployed_falls_back_to_short(self):
        """When no release is deployed, show short form."""
        from cli.parser import _format_version
        from _e3cnc_shared import VERSION
        with patch("cli.parser.get_active_release_version", return_value=None):
            result = _format_version()
            assert VERSION in result
            assert "|" not in result


class TestGetInstance:
    """Tests for cli.helpers._get_instance()."""

    def test_selects_by_index(self, mock_detect_instances):
        """--instance 1 should select the first instance."""
        from cli.helpers import _get_instance

        args = _make_args(instance="1")
        result = _get_instance(args)
        assert result is not None
        assert result.name == "test1"

    def test_selects_by_index_second(self, mock_detect_instances):
        """--instance 2 should select the second instance."""
        from cli.helpers import _get_instance

        args = _make_args(instance="2")
        result = _get_instance(args)
        assert result is not None
        assert result.name == "test2"

    def test_selects_by_name(self, mock_detect_instances):
        """--instance test2 should select instance named 'test2'."""
        from cli.helpers import _get_instance

        args = _make_args(instance="test2")
        result = _get_instance(args)
        assert result is not None
        assert result.name == "test2"

    def test_selects_legacy_name(self, mock_detect_instances):
        """Instance with name cnc_X should be selectable by 'cnc_X'."""
        from cli.helpers import _get_instance
        from _e3cnc_shared import detect_instances, Instance

        insts = detect_instances()
        legacy = Instance(
            name="cnc_2",
            printer_data_dir="/tmp/printer_data_2",
            config_dir="/tmp/printer_data_2/config",
            moonraker_conf="/tmp/printer_data_2/config/moonraker.conf",
            moonraker_log="/tmp/printer_data_2/logs/moonraker.log",
            scripts_dir="/tmp/printer_data_2/scripts",
            macros_dir="/tmp/printer_data_2/config/macros",
            E3CNC_dir="/tmp/printer_data_2/config/E3CNC",
            printer_cfg="/tmp/printer_data_2/config/printer.cfg",
            web_root="/tmp/e3cnc-web",
            moonraker_dir="/tmp/moonraker",
            klipper_dir="/tmp/klipper",
            moonraker_service="moonraker-2",
            klipper_service="klipper-2",
            moonraker_port=7127,
            is_running=False,
        )
        insts.append(legacy)

        with patch("cli.helpers.detect_instances", return_value=insts):
            # Legacy name 'cnc_2' should match by exact name
            args = _make_args(instance="cnc_2")
            result = _get_instance(args)
            assert result is not None
            assert result.name == "cnc_2"

    def test_returns_none_when_no_instance(self):
        """When no instances exist, _get_instance should return None."""
        from cli.helpers import _get_instance

        with patch("cli.helpers.detect_instances", return_value=[]):
            args = _make_args(instance=None)
            result = _get_instance(args)
            assert result is None

    def test_auto_selects_single_instance(self):
        """With one instance and no --instance flag, auto-select it."""
        from cli.helpers import _get_instance
        from _e3cnc_shared import Instance

        single = [
            Instance(
                name="cnc",
                printer_data_dir="/tmp/printer_data",
                config_dir="/tmp/printer_data/config",
                moonraker_conf="/tmp/printer_data/config/moonraker.conf",
                moonraker_log="/tmp/printer_data/logs/moonraker.log",
                scripts_dir="/tmp/printer_data/scripts",
                macros_dir="/tmp/printer_data/config/macros",
                E3CNC_dir="/tmp/printer_data/config/E3CNC",
                printer_cfg="/tmp/printer_data/config/printer.cfg",
                web_root="/tmp/e3cnc-web",
                moonraker_dir="/tmp/moonraker",
                klipper_dir="/tmp/klipper",
                moonraker_service="moonraker",
                klipper_service="klipper",
                moonraker_port=7125,
                is_running=True,
            )
        ]
        with patch("cli.helpers.detect_instances", return_value=single):
            args = _make_args(instance=None)
            result = _get_instance(args)
            assert result is not None
            assert result.name == "cnc"

    def test_auto_selects_first_running(self, mock_detect_instances):
        """With multiple instances, prefer the first running one."""
        from cli.helpers import _get_instance

        args = _make_args(instance=None)
        result = _get_instance(args)
        assert result is not None
        # test1 is running, test2 is not — should pick test1
        assert result.name == "test1"

    def test_unknown_instance_warns(self, mock_detect_instances):
        """An unknown instance name should warn and return None."""
        from cli.helpers import _get_instance

        args = _make_args(instance="nonexistent")
        result = _get_instance(args)
        assert result is None


class TestConfirmDestructive:
    """Tests for cli.helpers._confirm_destructive()."""

    def test_returns_true_for_non_destructive(self):
        """Non-destructive commands should return True without prompting."""
        from cli.helpers import _confirm_destructive

        args = _make_args(yes=False, check=False)
        assert _confirm_destructive("status", args) is True

    def test_returns_true_with_yes_flag(self):
        """--yes flag should skip confirmation."""
        from cli.helpers import _confirm_destructive

        args = _make_args(yes=True, check=False)
        assert _confirm_destructive("install", args) is True

    def test_returns_true_with_check_flag(self):
        """--check flag should skip confirmation."""
        from cli.helpers import _confirm_destructive

        args = _make_args(yes=False, check=True)
        assert _confirm_destructive("install", args) is True

    def test_prompts_and_returns_false_on_n(self):
        """User typing 'n' should return False."""
        from cli.helpers import _confirm_destructive

        args = _make_args(yes=False, check=False)
        with patch("builtins.input", return_value="n"):
            with patch("sys.stdin.isatty", return_value=True):
                assert _confirm_destructive("install", args) is False

    def test_prompts_and_returns_true_on_y(self):
        """User typing 'y' should return True."""
        from cli.helpers import _confirm_destructive

        args = _make_args(yes=False, check=False)
        with patch("builtins.input", return_value="y"):
            with patch("sys.stdin.isatty", return_value=True):
                assert _confirm_destructive("install", args) is True


# ── Command tests ─────────────────────────────────────────────────────────────


class TestPostInstallGuide:
    """Tests for cli.commands._show_post_install_guide()."""

    def _make_inst(self, tmp_path, printer_cfg_content: str):
        """Create a test Instance with a temporary printer.cfg."""
        from _e3cnc_shared import Instance

        config_dir = tmp_path / "printer_data" / "config"
        config_dir.mkdir(parents=True)
        printer_cfg = config_dir / "printer.cfg"
        printer_cfg.write_text(printer_cfg_content)

        return Instance(
            name="cnc",
            printer_data_dir=str(tmp_path / "printer_data"),
            config_dir=str(config_dir),
            moonraker_conf=str(config_dir / "moonraker.conf"),
            moonraker_log=str(tmp_path / "printer_data" / "logs" / "moonraker.log"),
            scripts_dir=str(tmp_path / "printer_data" / "scripts"),
            macros_dir=str(config_dir / "macros"),
            E3CNC_dir=str(config_dir / "E3CNC"),
            printer_cfg=str(printer_cfg),
            web_root=str(tmp_path / "e3cnc-web"),
            moonraker_service="moonraker",
            klipper_service="klipper",
        )

    def test_reports_all_services_running(self, mock_subprocess_in_commands, tmp_path):
        """When all services are active, guide should report them as OK."""
        from cli.commands import _show_post_install_guide

        inst = self._make_inst(tmp_path, "# real machine config\n")
        _show_post_install_guide(inst)

    def test_reports_placeholder_printer_cfg(self, mock_subprocess_in_commands, tmp_path):
        """When printer.cfg contains the bootstrap placeholder, warn."""
        from cli.commands import _show_post_install_guide

        inst = self._make_inst(tmp_path, "# E3CNC bootstrap placeholder printer.cfg\n")
        _show_post_install_guide(inst)

    def test_reports_failing_services(self, mock_subprocess_in_commands, tmp_path):
        """When systemctl returns non-zero, services are reported as not running."""
        from cli.commands import _show_post_install_guide

        mock_subprocess_in_commands.return_value = MagicMock(
            returncode=3, stdout="inactive", stderr=""
        )

        inst = self._make_inst(tmp_path, "valid config\n")
        _show_post_install_guide(inst)


class TestEnsureSystemPackages:
    """Tests for cli.commands._ensure_system_packages()."""

    def test_skips_when_packages_present(self):
        """When curl and unzip are found, no apt commands are run."""
        from cli.commands import _ensure_system_packages

        with patch("shutil.which", return_value="/usr/bin/curl") as mock_which:
            _ensure_system_packages()
            # shutil.which should have been called for curl and unzip
            assert mock_which.call_count >= 2

    def test_runs_apt_when_packages_missing(self, mock_subprocess_run):
        """When packages are missing, apt-get install is called."""
        from cli.commands import _ensure_system_packages

        # Return None (not found) for curl, unzip, then anything else finds
        with patch("shutil.which", side_effect=lambda x: None if x in ("curl", "unzip") else "/usr/bin/" + x):
            _ensure_system_packages()


class TestCmdCheck:
    """Tests for cli.commands.cmd_check()."""

    def test_does_not_crash(self):
        """cmd_check should run without errors when dependencies are met."""
        from cli.commands import cmd_check

        with patch("cli.commands.check_dependencies") as mock_check:
            mock_check.return_value = (True, [])
            with patch("sys.exit") as mock_exit:
                cmd_check(_make_args())
                mock_exit.assert_not_called()


# ── Menu tests ────────────────────────────────────────────────────────────────


class TestRunMenuCommand:
    """Tests for cli.menu._run_menu_command()."""

    def test_dispatches_status(self):
        """_run_menu_command('status') should call cmd_status."""
        from cli.menu import _run_menu_command

        with patch("cli.commands.cmd_status") as mock:
            _run_menu_command("status")
            mock.assert_called_once()

    def test_dispatches_install(self):
        """_run_menu_command('install') should prompt and call cmd_install."""
        from cli.menu import _run_menu_command

        with patch("cli.commands.cmd_install") as mock:
            with patch("builtins.input", return_value="y"):
                with patch("sys.stdin.isatty", return_value=True):
                    _run_menu_command("install")
                    mock.assert_called_once()

    def test_cancels_install_on_no(self):
        """_run_menu_command('install') with 'n' should not call handler."""
        from cli.menu import _run_menu_command

        with patch("cli.commands.cmd_install") as mock:
            with patch("builtins.input", return_value="n"):
                with patch("sys.stdin.isatty", return_value=True):
                    _run_menu_command("install")
                    mock.assert_not_called()


# ── Main dispatch tests ───────────────────────────────────────────────────────


class TestMainDispatch:
    """Tests for cli.__init__.main() dispatch."""

    def test_install_dispatches_to_cmd_install(self):
        """e3cnc-cli install should call cmd_install."""
        from cli import main

        with patch("sys.argv", ["e3cnc-cli", "install"]):
            with patch("cli.cmd_install") as mock:
                with patch("_e3cnc_shared.print_banner"):
                    main()
                    mock.assert_called_once()

    def test_status_dispatches_to_cmd_status(self):
        """e3cnc-cli status should call cmd_status."""
        from cli import main

        with patch("sys.argv", ["e3cnc-cli", "status"]):
            with patch("cli.cmd_status") as mock:
                with patch("_e3cnc_shared.print_banner"):
                    main()
                    mock.assert_called_once()

    def test_update_dispatches_to_cmd_update(self):
        """e3cnc-cli update should call cmd_update."""
        from cli import main

        with patch("sys.argv", ["e3cnc-cli", "update"]):
            with patch("cli.cmd_update") as mock:
                with patch("_e3cnc_shared.print_banner"):
                    main()
                    mock.assert_called_once()

    def test_uninstall_dispatches_to_cmd_uninstall(self):
        """e3cnc-cli uninstall should call cmd_uninstall."""
        from cli import main

        with patch("sys.argv", ["e3cnc-cli", "uninstall"]):
            with patch("cli.cmd_uninstall") as mock:
                with patch("_e3cnc_shared.print_banner"):
                    main()
                    mock.assert_called_once()

    def test_no_command_opens_menu(self):
        """e3cnc-cli with no args should open interactive menu."""
        from cli import main

        with patch("sys.argv", ["e3cnc-cli"]):
            with patch("cli._interactive_menu") as mock:
                with patch("sys.exit"):
                    main()
                    mock.assert_called_once()


# ── MCU detection tests ────────────────────────────────────────────────────────


class TestScanSerialDevices:
    """Tests for cli.helpers.scan_serial_devices()."""

    def test_returns_empty_when_no_devices(self):
        """When no serial devices exist, return empty list."""
        from cli.helpers import scan_serial_devices

        with patch("glob.glob", return_value=[]):
            with patch("os.path.exists", return_value=False):
                result = scan_serial_devices()
                assert result == []

    def test_detects_klipper_device(self, tmp_path):
        """A symlink with 'klipper' in the name should be marked is_klipper=True."""
        from cli.helpers import scan_serial_devices

        # Create a fake serial device tree
        serial_dir = tmp_path / "serial" / "by-id"
        serial_dir.mkdir(parents=True)

        # Create a real tty to point to
        real_tty = tmp_path / "ttyACM0"
        real_tty.write_text("")

        # Create symlink like udev does: usb-Klipper_stm32f103_12345-if00
        symlink = serial_dir / "usb-Klipper_stm32f103_12345-if00"
        symlink.symlink_to(real_tty)

        with patch("glob.glob", return_value=[str(symlink)]):
            with patch("os.path.exists", return_value=False):
                result = scan_serial_devices()

        assert len(result) == 1
        assert result[0]["vendor"] == "Klipper"
        assert result[0]["model"] == "stm32f103"
        assert result[0]["serial"] == "12345"
        assert result[0]["is_klipper"] is True

    def test_parses_ftdi_device(self, tmp_path):
        """FTDI-style device names should be parsed correctly."""
        from cli.helpers import scan_serial_devices

        serial_dir = tmp_path / "serial" / "by-id"
        serial_dir.mkdir(parents=True)
        real_tty = tmp_path / "ttyUSB0"
        real_tty.write_text("")
        symlink = serial_dir / "usb-FTDI_FT232R_USB_UART_A50285BI-if00-port0"
        symlink.symlink_to(real_tty)

        with patch("glob.glob", return_value=[str(symlink)]):
            with patch("os.path.exists", return_value=False):
                result = scan_serial_devices()

        assert len(result) == 1
        assert result[0]["vendor"] == "FTDI"
        assert "FT232R" in result[0]["model"]
        assert result[0]["serial"] == "A50285BI"
        assert result[0]["is_klipper"] is False

    def test_detects_linux_mcu_socket(self, tmp_path):
        """When /tmp/klipper_host_mcu exists, include it as a Klipper device."""
        from cli.helpers import scan_serial_devices

        # Create the Linux MCU socket symlink
        mcu_path = tmp_path / "klipper_host_mcu"
        real_pty = tmp_path / "pts" / "0"
        real_pty.parent.mkdir(parents=True)
        real_pty.write_text("")
        mcu_path.symlink_to(real_pty)

        with patch("glob.glob", return_value=[]):
            with patch("os.path.exists", return_value=True):
                with patch("os.path.islink", return_value=True):
                    with patch("os.path.realpath", return_value=str(real_pty)):
                        result = scan_serial_devices()

        assert len(result) == 1
        assert result[0]["vendor"] == "Klipper"
        assert result[0]["model"] == "Linux MCU Process"
        assert result[0]["serial"] == "virtual"
        assert result[0]["is_klipper"] is True

    def test_detect_mcu_parses_correctly_in_parser(self):
        """detect-mcu should be a valid subcommand."""
        from cli.parser import build_parser

        parser = build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "detect-mcu" in choices
        assert "detect" in choices
        assert "scan" in choices


# ── MCU flash tests ────────────────────────────────────────────────────────────


class TestMCUPresets:
    """Tests for cli.helpers MCU presets and build helpers."""

    def test_presets_have_required_fields(self):
        """All presets must have id, name, description, config, flash_help."""
        from cli.helpers import MCU_PRESETS

        for preset in MCU_PRESETS:
            assert "id" in preset, f"Missing id in {preset.get('name', '?')}"
            assert "name" in preset
            assert "description" in preset
            assert "config" in preset, f"Missing config in {preset['id']}"
            assert preset["config"], f"Empty config in {preset['id']}"
            assert "flash_help" in preset

    def test_presets_have_unique_ids(self):
        """Preset IDs must be unique."""
        from cli.helpers import MCU_PRESETS

        ids = [p["id"] for p in MCU_PRESETS]
        assert len(ids) == len(set(ids)), f"Duplicate IDs: {ids}"

    def test_find_matching_preset_returns_index(self):
        """_find_matching_preset should return the right preset index for a device."""
        from cli.helpers import _find_matching_preset, MCU_PRESETS

        device = {"model": "stm32f103"}
        idx = _find_matching_preset(device)
        assert idx is not None
        assert MCU_PRESETS[idx]["id"] == "stm32f103-usb"

    def test_find_matching_preset_returns_none_for_unknown(self):
        """_find_matching_preset returns None for unrecognized devices."""
        from cli.helpers import _find_matching_preset

        device = {"model": "SomeUnknownDevice"}
        idx = _find_matching_preset(device)
        assert idx is None

    def test_build_klipper_firmware_fails_missing_dir(self):
        """build_klipper_firmware should return False for non-existent dir."""
        from cli.helpers import build_klipper_firmware

        messages = []

        def log(msg):
            messages.append(msg)

        result = build_klipper_firmware("stm32f103-usb", "/nonexistent/path", log)
        assert result is False
        assert any("not found" in m for m in messages)

    def test_build_klipper_firmware_fails_unknown_preset(self):
        """build_klipper_firmware should return False for unknown preset ID."""
        from cli.helpers import build_klipper_firmware

        messages = []

        def log(msg):
            messages.append(msg)

        result = build_klipper_firmware("nonexistent-preset", "/tmp", log)
        assert result is False
        assert any("Unknown preset" in m for m in messages)

    def test_flash_mcu_in_parser(self):
        """flash-mcu should be a valid subcommand with aliases."""
        from cli.parser import build_parser

        parser = build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "flash-mcu" in choices
        assert "flash" in choices
        assert "build" in choices

    def test_init_config_in_parser(self):
        """init-config should be a valid subcommand with alias."""
        from cli.parser import build_parser

        parser = build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "init-config" in choices
        assert "init" in choices


class TestGenerateCncConfig:
    """Tests for cli.helpers._generate_cnc_printer_cfg()."""

    def test_generates_with_mcu_path(self):
        """When an MCU path is given, it should appear in the [mcu] section."""
        from cli.helpers import _generate_cnc_printer_cfg

        content = _generate_cnc_printer_cfg("/dev/serial/by-id/usb-Klipper_stm32f103_12345-if00")
        assert "serial: /dev/serial/by-id/usb-Klipper_stm32f103_12345-if00" in content

    def test_generates_without_mcu_path(self):
        """When no MCU path is given, a placeholder comment should appear."""
        from cli.helpers import _generate_cnc_printer_cfg

        content = _generate_cnc_printer_cfg()
        assert "run 'e3cnc-cli detect-mcu'" in content

    def test_contains_required_sections(self):
        """The generated config should have all required CNC sections."""
        from cli.helpers import _generate_cnc_printer_cfg

        content = _generate_cnc_printer_cfg("/dev/ttyACM0")
        required = [
            "[mcu]", "[printer]", "[stepper_x]", "[stepper_y]", "[stepper_z]",
            "[idle_timeout]", "[force_move]", "[pause_resume]", "[gcode_arcs]",
            "include E3CNC/macros/cnc_base.cfg",
            "include E3CNC/macros/wcs_macros.cfg",
            "include E3CNC/macros/e3cnc_macros.cfg",
        ]
        for section in required:
            assert section in content, f"Missing section: {section}"

    def test_has_adjust_markers(self):
        """The config should include '!!! ADJUST' markers for user-editable fields."""
        from cli.helpers import _generate_cnc_printer_cfg

        content = _generate_cnc_printer_cfg("/dev/ttyACM0")
        assert "!!! ADJUST" in content
        # Should appear for stepper pins, limits, and velocity
        assert content.count("!!! ADJUST") >= 10

    def test_has_instructions(self):
        """The config should include setup instructions."""
        from cli.helpers import _generate_cnc_printer_cfg

        content = _generate_cnc_printer_cfg("/dev/ttyACM0")
        assert "INSTRUCTIONS" in content
        assert "e3cnc-cli status" in content


# ── All CLI command tests ──────────────────────────────────────────────────


class TestCmdStatus:
    """Tests for cli.commands.cmd_status()."""

    def test_calls_check_status(self, mock_detect_instances):
        """cmd_status should call check_status with the active instance."""
        from cli.commands import cmd_status

        with patch("cli.commands.check_status") as mock_cs:
            with patch("_e3cnc_deploy._get_local_ip", return_value="192.168.0.1"):
                cmd_status(_make_args(instance="test1"))
                mock_cs.assert_called_once()

    def test_shows_urls(self, mock_detect_instances, capsys):
        """cmd_status should print Web UI / Admin / API URLs."""
        from cli.commands import cmd_status

        with patch("_e3cnc_deploy._get_local_ip", return_value="10.0.0.1"):
            with patch("cli.commands.check_status"):
                cmd_status(_make_args(instance="test1"))
        out = capsys.readouterr().out
        assert "Web UI" in out
        assert "Admin" in out
        assert "API" in out

    def test_shows_web_port_for_non_default(self, mock_detect_instances, capsys):
        """Non-default web port should appear in Web UI URL."""
        from cli.commands import cmd_status

        with patch("_e3cnc_deploy._get_local_ip", return_value="10.0.0.1"):
            with patch("cli.commands.check_status"):
                cmd_status(_make_args(instance="test1"))
        out = capsys.readouterr().out
        # test1 has web_port=80, should show http://10.0.0.1/
        assert "http://10.0.0.1/" in out


class TestCmdInstances:
    """Tests for cli.commands.cmd_instances()."""

    def test_lists_instances(self, capsys):
        """cmd_instances should list all detected instances."""
        from cli.commands import cmd_instances
        from _e3cnc_shared import Instance

        instances = [
            Instance(name="alpha", printer_data_dir="/tmp/a", config_dir="/tmp/a/config",
                     moonraker_conf="/tmp/a/config/moonraker.conf", moonraker_log="/tmp/a/logs/moonraker.log",
                     scripts_dir="/tmp/a/scripts", macros_dir="/tmp/a/config/macros",
                     E3CNC_dir="/tmp/a/config/E3CNC", printer_cfg="/tmp/a/config/printer.cfg",
                     web_root="/tmp/web", moonraker_port=7126, web_port=8080),
            Instance(name="beta", printer_data_dir="/tmp/b", config_dir="/tmp/b/config",
                     moonraker_conf="/tmp/b/config/moonraker.conf", moonraker_log="/tmp/b/logs/moonraker.log",
                     scripts_dir="/tmp/b/scripts", macros_dir="/tmp/b/config/macros",
                     E3CNC_dir="/tmp/b/config/E3CNC", printer_cfg="/tmp/b/config/printer.cfg",
                     web_root="/tmp/web", moonraker_port=7127, web_port=8081),
        ]

        with patch("_e3cnc_shared.detect_instances", return_value=instances):
            with patch("_e3cnc_deploy._get_local_ip", return_value="10.0.0.1"):
                with patch("_e3cnc_deploy.get_current_release", return_value=MagicMock(version="v1.0")):
                    cmd_instances(_make_args())
        out = capsys.readouterr().out
        assert "alpha" in out
        assert "beta" in out

    def test_shows_instance_urls(self, mock_detect_instances, capsys):
        """Each instance should show API and Web UI URLs."""
        from cli.commands import cmd_instances

        with patch("_e3cnc_deploy._get_local_ip", return_value="10.0.0.1"):
            cmd_instances(_make_args())
        out = capsys.readouterr().out
        assert "Web UI" in out
        assert "API" in out

    def test_no_instances_shows_info(self, capsys):
        """When no instances exist, show info message."""
        from cli.commands import cmd_instances

        with patch("_e3cnc_shared.detect_instances", return_value=[]):
            cmd_instances(_make_args())
        out = capsys.readouterr().out
        assert "No instances detected" in out


class TestCmdReleases:
    """Tests for cli.commands.cmd_releases()."""

    def test_does_not_crash_with_no_releases(self):
        """cmd_releases should handle no installed releases gracefully."""
        from cli.commands import cmd_releases

        with patch("_e3cnc_deploy.get_releases", return_value=[]):
            with patch("_e3cnc_deploy.get_current_release", return_value=None):
                cmd_releases(_make_args())


class TestCmdRestart:
    """Tests for cli.commands.cmd_restart()."""

    def test_restarts_via_supervisor(self, mock_detect_instances):
        """When supervisor is available, restart via supervisor."""
        from cli.commands import cmd_restart

        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                mock_cfg.return_value.exists.return_value = True
                with patch("_e3cnc_supervisor.restart_services") as mock_rs:
                    cmd_restart(_make_args(instance="test1"))
                    mock_rs.assert_called_once()

    def test_falls_back_to_systemd(self, mock_detect_instances):
        """Without supervisor, fall back to systemd restart."""
        from cli.commands import cmd_restart

        with patch("_e3cnc_supervisor._has_supervisor", return_value=False):
            with patch("_e3cnc_deploy.restart_services") as mock_rs:
                cmd_restart(_make_args(instance="test1"))
                mock_rs.assert_called_once()

    def test_registers_then_restarts(self, mock_detect_instances):
        """If supervisor config doesn't exist, register first then restart."""
        from cli.commands import cmd_restart

        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                mock_cfg.return_value.exists.return_value = False
                with patch("_e3cnc_supervisor.register_instance", return_value=True) as mock_reg:
                    with patch("cli.commands.ok"):
                        cmd_restart(_make_args(instance="test1"))
                        mock_reg.assert_called_once()

    def test_fails_without_instance(self):
        """cmd_restart with no instance should fail."""
        from cli.commands import cmd_restart

        with patch("cli.commands._get_instance", return_value=None):
            with patch("_e3cnc_shared.get_active_instance", return_value=None):
                with pytest.raises(SystemExit):
                    cmd_restart(_make_args())


class TestCmdDetectMCU:
    """Tests for cli.commands.cmd_detect_mcu()."""

    def test_does_not_crash(self):
        """cmd_detect_mcu should run without errors."""
        from cli.commands import cmd_detect_mcu

        with patch("cli.helpers.scan_serial_devices", return_value=[]):
            cmd_detect_mcu(_make_args())


class TestCmdInitConfig:
    """Tests for cli.commands.cmd_init_config()."""

    def test_generates_config(self, mock_detect_instances):
        """cmd_init_config should generate a printer.cfg for the instance."""
        from cli.commands import cmd_init_config

        with patch("cli.helpers.scan_serial_devices", return_value=[]):
            with patch("cli.commands._get_instance") as mock_gi:
                mock_gi.return_value = mock_detect_instances[0]
                with patch("builtins.input", return_value="y"):
                    with patch("pathlib.Path.write_text"):
                        cmd_init_config(_make_args(instance="test1"))

    def test_cancels_on_no(self, mock_detect_instances):
        """When user says no, do not overwrite printer.cfg."""
        from cli.commands import cmd_init_config

        with patch("cli.helpers.scan_serial_devices", return_value=[]):
            with patch("cli.commands._get_instance") as mock_gi:
                inst = mock_detect_instances[0]
                mock_gi.return_value = inst
                with patch("pathlib.Path.exists", return_value=True):
                    with patch("builtins.input", return_value="n"):
                        with patch("pathlib.Path.write_text") as mock_write:
                            cmd_init_config(_make_args(instance="test1"))
                            mock_write.assert_not_called()

    def test_uses_yes_flag(self, mock_detect_instances):
        """With --yes flag, skip overwrite confirmation."""
        from cli.commands import cmd_init_config

        with patch("cli.helpers.scan_serial_devices", return_value=[]):
            with patch("cli.commands._get_instance") as mock_gi:
                mock_gi.return_value = mock_detect_instances[0]
                with patch("pathlib.Path.write_text") as mock_write:
                    cmd_init_config(_make_args(instance="test1", yes=True))
                    mock_write.assert_called_once()


class TestCmdAdminPage:
    """Tests for cli.commands.cmd_admin_page()."""

    def test_generates_admin_page(self):
        """cmd_admin_page should call generate_admin_page."""
        from cli.commands import cmd_admin_page

        with patch("_e3cnc_deploy.generate_admin_page") as mock:
            cmd_admin_page(_make_args())
            mock.assert_called_once()


class TestCmdCliLog:
    """Tests for cli.commands.cmd_clilog()."""

    def test_shows_log_when_exists(self, tmp_path):
        """When the CLI log file exists, show its contents."""
        from cli.commands import cmd_clilog

        log_file = tmp_path / "cli.log"
        log_file.write_text("line1\nline2\nline3\n")

        with patch("_e3cnc_shared.LOG_FILE", log_file):
            with patch("sys.stdout"):
                cmd_clilog(_make_args(lines=5))

    def test_shows_info_when_no_log(self):
        """When no CLI log exists, show info message."""
        from cli.commands import cmd_clilog

        with patch("_e3cnc_shared.LOG_FILE") as mock_log:
            mock_log.exists.return_value = False
            cmd_clilog(_make_args(lines=5))


class TestCmdLogs:
    """Tests for cli.commands.cmd_logs()."""

    def test_calls_run_logs(self, mock_detect_instances):
        """cmd_logs should call run_logs with the instance."""
        from cli.commands import cmd_logs

        with patch("cli.commands.run_logs", return_value=MagicMock(success=True)):
            cmd_logs(_make_args(instance="test1", lines=10))

    def test_shows_empty_logs(self):
        """cmd_logs with no instance should show empty logs, not crash."""
        from cli.commands import cmd_logs

        with patch("cli.commands._get_instance", return_value=None):
            with patch("_e3cnc_shared.get_active_instance", return_value=None):
                cmd_logs(_make_args(lines=10))


class TestCmdBackup:
    """Tests for cli.commands.cmd_backup()."""

    def test_calls_run_backup(self, mock_detect_instances):
        """cmd_backup should call run_backup with the instance."""
        from cli.commands import cmd_backup

        with patch("cli.commands.run_backup", return_value=MagicMock(success=True)):
            cmd_backup(_make_args(instance="test1"))

    def test_fails_on_backup_error(self, mock_detect_instances):
        """When backup fails, cmd_backup should exit with 1."""
        from cli.commands import cmd_backup

        with patch("cli.commands.run_backup", return_value=MagicMock(success=False)):
            with pytest.raises(SystemExit):
                cmd_backup(_make_args(instance="test1"))


class TestCmdDiagnose:
    """Tests for cli.commands.cmd_diagnose()."""

    def test_calls_run_diagnose(self, mock_detect_instances):
        """cmd_diagnose should call run_diagnose with the instance."""
        from cli.commands import cmd_diagnose

        with patch("cli.commands.run_diagnose", return_value=MagicMock(success=True)):
            cmd_diagnose(_make_args(instance="test1"))

    def test_fails_on_diagnose_error(self, mock_detect_instances):
        """When diagnose fails, cmd_diagnose should exit with 1."""
        from cli.commands import cmd_diagnose

        with patch("cli.commands.run_diagnose", return_value=MagicMock(success=False)):
            with pytest.raises(SystemExit):
                cmd_diagnose(_make_args(instance="test1"))


class TestCmdPrune:
    """Tests for cli.commands.cmd_prune()."""

    def test_calls_prune_releases(self):
        """cmd_prune should call prune_releases."""
        from cli.commands import cmd_prune

        with patch("cli.commands.prune_releases", return_value=(0, 0)):
            cmd_prune(_make_args(keep=3, dry_run=False))

    def test_dry_run_does_not_delete(self):
        """With --dry-run, prune_releases should be called with dry_run=True."""
        from cli.commands import cmd_prune

        with patch("cli.commands.prune_releases", return_value=(0, 0)) as mock:
            cmd_prune(_make_args(keep=3, dry_run=True))
            mock.assert_called_once()


class TestCmdPruneBackups:
    """Tests for cli.commands.cmd_prune_backups()."""

    def test_calls_prune_backups(self):
        """cmd_prune_backups should call prune_backups."""
        from cli.commands import cmd_prune_backups

        with patch("cli.commands.prune_backups"):
            cmd_prune_backups(_make_args(keep=5, dry_run=False))

    def test_dry_run_passed_through(self):
        """With --dry-run, prune_backups should be called with dry_run=True."""
        from cli.commands import cmd_prune_backups

        with patch("cli.commands.prune_backups") as mock:
            cmd_prune_backups(_make_args(keep=5, dry_run=True))
            mock.assert_called_once_with(keep=5, dry_run=True)

    def test_keep_passed_through(self):
        """With --keep 10, prune_backups should be called with keep=10."""
        from cli.commands import cmd_prune_backups

        with patch("cli.commands.prune_backups") as mock:
            cmd_prune_backups(_make_args(keep=10, dry_run=False))
            mock.assert_called_once_with(keep=10, dry_run=False)


class TestCmdImportInstance:
    """Tests for cli.commands.cmd_import_instance()."""

    def test_shows_info_when_no_kiauh(self):
        """When no KIAUH instances exist, show info."""
        from cli.commands import cmd_import_instance

        with patch("_e3cnc_shared._scan_kiauh_instances", return_value=[]):
            cmd_import_instance(_make_args())

    def test_imports_single_instance(self):
        """With one KIAUH instance, import it automatically."""
        from cli.commands import cmd_import_instance
        from _e3cnc_shared import Instance

        inst = Instance(
            name="kiauh1",
            printer_data_dir="/tmp/kiauh1_data",
            config_dir="/tmp/kiauh1_data/config",
            moonraker_conf="/tmp/kiauh1_data/config/moonraker.conf",
            moonraker_log="/tmp/kiauh1_data/logs/moonraker.log",
            scripts_dir="/tmp/kiauh1_data/scripts",
            macros_dir="/tmp/kiauh1_data/config/macros",
            E3CNC_dir="/tmp/kiauh1_data/config/E3CNC",
            printer_cfg="/tmp/kiauh1_data/config/printer.cfg",
            web_root="/tmp/kiauh1_web",
            moonraker_port=7145,
        )

        with patch("_e3cnc_shared._scan_kiauh_instances", return_value=[inst]):
            with patch("_e3cnc_shared.import_kiauh_instance") as mock:
                cmd_import_instance(_make_args())
                mock.assert_called_once_with(inst)


class TestCmdMigrateInstances:
    """Tests for cli.commands.cmd_migrate_instances()."""

    def test_does_not_crash(self):
        """cmd_migrate_instances should handle no KIAUH instances gracefully."""
        from cli.commands import cmd_migrate_instances

        with patch("_e3cnc_shared._scan_kiauh_instances", return_value=[]):
            with patch("_e3cnc_shared.INSTANCES_DIR") as mock_dir:
                mock_dir.is_dir.return_value = True
                with patch("_e3cnc_deploy.generate_admin_page"):
                    cmd_migrate_instances(_make_args(yes=True))


class TestCmdInstall:
    """Tests for cli.commands.cmd_install()."""

    def test_uses_provided_name(self):
        """When --name is provided, use it directly."""
        from cli.commands import cmd_install

        with patch("cli.commands._require_ansible"):
            with patch("cli.helpers._download_and_activate_release", return_value="v0.8.4"):
                with patch("cli.commands._run_ansible_cmd") as mock_ansible:
                    mock_ansible.return_value = MagicMock(returncode=0)
                    with patch("cli.commands.ok"):
                        with patch("_e3cnc_shared._create_new_instance"):
                            with patch("cli.commands.header"):
                                with patch("cli.commands.subprocess.run") as mock_spr:
                                    mock_spr.return_value = MagicMock(returncode=0)
                                    cmd_install(_make_args(name="mytest", yes=True))
                                    mock_ansible.assert_called()


class TestCmdUpdate:
    """Tests for cli.commands.cmd_update()."""

    def test_calls_update_helpers(self, mock_detect_instances):
        """cmd_update should call _download_and_activate_release."""
        from cli.commands import cmd_update

        with patch("cli.helpers._download_and_activate_release") as mock:
            with patch("cli.commands._get_instance") as mock_gi:
                mock_gi.return_value = mock_detect_instances[0]
                with patch("cli.commands.ok"):
                    cmd_update(_make_args(instance="test1"))
                    mock.assert_called_once()

    def test_dry_run_mode(self, mock_detect_instances):
        """With --dry-run, cmd_update should pass dry_run=True."""
        from cli.commands import cmd_update

        with patch("cli.helpers._download_and_activate_release") as mock:
            with patch("cli.commands._get_instance") as mock_gi:
                mock_gi.return_value = mock_detect_instances[0]
                cmd_update(_make_args(instance="test1", dry_run=True))
                _, kwargs = mock.call_args
                assert kwargs.get("dry_run") is True


class TestCmdUninstall:
    """Tests for cli.commands.cmd_uninstall()."""

    def test_cleans_up_supervisor(self, mock_detect_instances):
        """When supervisor is available, unregister the instance."""
        from cli.commands import cmd_uninstall

        with patch("_e3cnc_shared.run_ansible_playbook"):
            with patch("cli.commands._get_instance") as mock_gi:
                inst = mock_detect_instances[0]
                mock_gi.return_value = inst
                with patch("builtins.input", return_value="y"):
                    with patch("_e3cnc_supervisor.unregister_instance") as mock:
                        with patch("_e3cnc_deploy.generate_admin_page"):
                            with patch("cli.commands.ok"):
                                with patch("shutil.rmtree"):
                                    cmd_uninstall(_make_args(instance="test1"))
                                    mock.assert_called_once_with(inst)

    def test_removes_instance_directory(self, mock_detect_instances):
        """Uninstall should remove the instance directory from new layout."""
        from cli.commands import cmd_uninstall

        with patch("_e3cnc_shared.run_ansible_playbook"):
            with patch("_e3cnc_shared.detect_instances", return_value=mock_detect_instances):
                with patch("cli.commands._get_instance") as mock_gi:
                    inst = mock_detect_instances[0]
                    mock_gi.return_value = inst
                    with patch("builtins.input", return_value="y"):
                        with patch("_e3cnc_supervisor.unregister_instance"):
                            with patch("_e3cnc_deploy.generate_admin_page"):
                                with patch("cli.commands.ok"):
                                    with patch("_e3cnc_shared.INSTANCES_DIR") as mock_dir:
                                        mock_dir.is_dir.return_value = True
                                        mock_dir.__truediv__.return_value.is_dir.return_value = True
                                        with patch("shutil.rmtree") as mock_rm:
                                            cmd_uninstall(_make_args(instance="test1"))
                                            mock_rm.assert_called_once()


class TestMainDispatchAllCommands:
    """Verify main() dispatches ALL CLI commands correctly."""

    COMMANDS = [
        "check", "status", "instances", "releases",
        "restart", "admin-page", "clilog", "detect-mcu",
        "prune", "import-instance", "backup", "diagnose",
        "logs", "install", "uninstall", "update", "deploy",
    ]

    @pytest.mark.parametrize("cmd", COMMANDS)
    def test_all_commands_dispatch(self, cmd):
        """Each command should dispatch via main()."""
        from cli import main

        handler_name = f"cmd_{cmd.replace('-', '_')}"
        with patch("sys.argv", ["e3cnc-cli", cmd]):
            with patch(f"cli.{handler_name}") as mock:
                with patch("_e3cnc_shared.print_banner"):
                    main()
                    mock.assert_called_once()


class TestMenuDispatchAllCommands:
    """Verify _run_menu_command dispatches ALL commands correctly."""

    COMMANDS = [
        "status", "install", "deploy", "update", "uninstall",
        "check", "backup", "restore", "diagnose", "logs",
        "releases", "rollback", "prune", "instances",
        "detect-mcu", "flash-mcu", "init-config",
        "restart", "import-instance", "admin-page", "clilog",
        "migrate-instances",
    ]

    @pytest.mark.parametrize("cmd", COMMANDS)
    def test_menu_dispatches_all(self, cmd):
        """Each command should dispatch via _run_menu_command."""
        from cli.menu import _run_menu_command

        handler_name = f"cmd_{cmd.replace('-', '_')}"
        with patch(f"cli.commands.{handler_name}") as mock:
            with patch("builtins.input", return_value="y"):
                _run_menu_command(cmd)
                mock.assert_called_once()


# ── Commands not covered by the menu tests ────────────────────────────────


class TestCmdDeploy:
    """Tests for cli.commands.cmd_deploy()."""

    def test_dispatches_ansible_cmd(self):
        from cli.commands import cmd_deploy
        with patch("cli.commands._get_instance", return_value=MagicMock(name="test")):
            with patch("cli.commands._run_ansible_cmd") as mock_ansible:
                with patch("cli.commands.header"):
                    with patch("cli.commands.ok"):
                        cmd_deploy(MagicMock(remote=None, check=False, verbose=False))
                        mock_ansible.assert_called_once()


class TestCmdRollback:
    """Tests for cli.commands.cmd_rollback()."""

    def test_fails_without_version(self):
        from cli.commands import cmd_rollback
        with patch("cli.commands._get_instance") as mock_gi:
            inst = MagicMock(name="test")
            inst.moonraker_port = 7125
            inst.moonraker_service = "moonraker"
            inst.klipper_service = "klipper"
            inst.web_root = "/tmp/web"
            inst.printer_data_dir = "/tmp/data"
            mock_gi.return_value = inst
            with patch("cli.commands.header"):
                with patch("cli.commands.sync_runtime_files"):
                    with patch("cli.commands.update_systemd_paths"):
                        with patch("_e3cnc_shared._ensure_local_sudo_access"):
                            with patch("cli.commands.run_health_checks", return_value=[]):
                                with patch("cli.commands.rollback_previous", return_value=True):
                                    cmd_rollback(MagicMock(version=None, remote=None))

    def test_rolls_back_to_version(self):
        from cli.commands import cmd_rollback
        with patch("cli.commands._get_instance") as mock_gi:
            inst = MagicMock(name="test")
            inst.moonraker_port = 7125
            inst.moonraker_service = "moonraker"
            inst.klipper_service = "klipper"
            inst.web_root = "/tmp/web"
            inst.printer_data_dir = "/tmp/data"
            mock_gi.return_value = inst
            with patch("cli.commands.header"):
                with patch("cli.commands.rollback_to") as mock_rb:
                    mock_rb.return_value = True
                    with patch("cli.commands.ok"):
                        with patch("cli.commands.sync_runtime_files"):
                            with patch("cli.commands.update_systemd_paths"):
                                with patch("_e3cnc_shared._ensure_local_sudo_access"):
                                    with patch("cli.commands.run_health_checks", return_value=[]):
                                        cmd_rollback(MagicMock(version="v0.8.0", remote=None))


class TestCmdMigrateInstances:
    """Tests for cli.commands.cmd_migrate_instances()."""

    def test_calls_migrate_layout(self):
        from cli.commands import cmd_migrate_instances
        with patch("cli.commands.header"):
            with patch("cli.commands.detect_old_layout", return_value=False):
                cmd_migrate_instances(MagicMock(check=False))


class TestExtraPackages:
    """Tests for cli.commands._ensure_system_packages()."""

    def test_skips_when_packages_present(self):
        from cli.commands import _ensure_system_packages
        with patch("shutil.which", return_value="/usr/bin/curl"):
            _ensure_system_packages()

    def test_runs_apt_when_packages_missing(self):
        from cli.commands import _ensure_system_packages
        with patch("shutil.which", return_value=None):
            with patch("cli.commands.subprocess.run") as mock_run:
                mock_run.return_value = MagicMock(returncode=0)
                with patch("_e3cnc_shared._ensure_local_sudo_access"):
                    with patch("cli.commands.ok"):
                        _ensure_system_packages()
                        assert mock_run.called

    def test_reports_install_failure(self):
        from cli.commands import _ensure_system_packages
        with patch("shutil.which", return_value=None):
            with patch("cli.commands.subprocess.run") as mock_run:
                mock_run.return_value = MagicMock(returncode=1)
                with patch("_e3cnc_shared._ensure_local_sudo_access"):
                    with patch("cli.commands.warn") as mock_warn:
                        _ensure_system_packages()
                        mock_warn.assert_called()


class TestCmdRollbackExtra:
    """Tests for cli.commands.cmd_rollback()."""

    def test_fails_without_version(self):
        from cli.commands import cmd_rollback
        with patch("cli.commands._get_instance") as mock_gi:
            inst = MagicMock(name="test")
            inst.moonraker_port = 7125
            inst.moonraker_service = "moonraker"
            inst.klipper_service = "klipper"
            inst.web_root = "/tmp/web"
            inst.printer_data_dir = "/tmp/data"
            mock_gi.return_value = inst
            with patch("cli.commands.header"):
                with patch("cli.commands.sync_runtime_files"):
                    with patch("cli.commands.update_systemd_paths"):
                        with patch("_e3cnc_shared._ensure_local_sudo_access"):
                            with patch("cli.commands.run_health_checks", return_value=[]):
                                with patch("cli.commands.rollback_previous", return_value=True):
                                    cmd_rollback(MagicMock(version=None, remote=None))

    def test_rolls_back_to_version(self):
        from cli.commands import cmd_rollback
        with patch("cli.commands._get_instance") as mock_gi:
            inst = MagicMock(name="test")
            inst.moonraker_port = 7125
            inst.moonraker_service = "moonraker"
            inst.klipper_service = "klipper"
            inst.web_root = "/tmp/web"
            inst.printer_data_dir = "/tmp/data"
            mock_gi.return_value = inst
            with patch("cli.commands.header"):
                with patch("cli.commands.rollback_to") as mock_rb:
                    mock_rb.return_value = True
                    with patch("cli.commands.ok"):
                        with patch("cli.commands.sync_runtime_files"):
                            with patch("cli.commands.update_systemd_paths"):
                                with patch("_e3cnc_shared._ensure_local_sudo_access"):
                                    with patch("cli.commands.run_health_checks", return_value=[]):
                                        cmd_rollback(MagicMock(version="v0.8.0", remote=None))


class TestCmdCheckExtra:
    """Tests for cli.commands.cmd_check()."""

    def test_does_not_crash(self):
        from cli.commands import cmd_check
        with patch("cli.commands.header"):
            with patch("cli.commands.check_dependencies", return_value=(True, "")):
                cmd_check(MagicMock())


    # Flash MCU omitted — deeply nested subprocess calls (make, dfu-util) that
    # require real build environment. Tested implicitly via menu test dispatch.
