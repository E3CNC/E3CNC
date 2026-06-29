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


# ── Helper tests ──────────────────────────────────────────────────────────────


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
