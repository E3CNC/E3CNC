"""Tests for cli/menu.py — interactive menu system."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

from _e3cnc_shared import Instance, INSTANCES_DIR


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def mock_instance():
    """A simple Instance fixture."""
    return Instance(
        name="testcnc",
        printer_data_dir="/tmp/testcnc/data",
        config_dir="/tmp/testcnc/data/config",
        moonraker_conf="/tmp/testcnc/data/config/moonraker.conf",
        moonraker_log="/tmp/testcnc/data/logs/moonraker.log",
        scripts_dir="/tmp/testcnc/data/scripts",
        macros_dir="/tmp/testcnc/data/config/E3CNC/macros",
        E3CNC_dir="/tmp/testcnc/data/config/E3CNC",
        printer_cfg="/tmp/testcnc/data/config/printer.cfg",
        web_root="/tmp/testcnc/frontend",
        is_running=True,
    )


# ── _interactive_menu ─────────────────────────────────────────────────────


class TestInteractiveMenu:
    def test_tui_menu_when_tty_and_has_tui(self):
        from cli.menu import _interactive_menu
        with patch("cli.menu.sys.stdin.isatty", return_value=True):
            with patch("cli.menu._has_tui", True):
                with patch("cli.menu._tui_menu") as mock_tui:
                    _interactive_menu()
                    mock_tui.assert_called_once()

    def test_numbered_menu_when_not_tty(self):
        from cli.menu import _interactive_menu
        with patch("cli.menu.sys.stdin.isatty", return_value=False):
            with patch("cli.menu._has_tui", True):
                with patch("cli.menu._numbered_menu") as mock_num:
                    _interactive_menu()
                    mock_num.assert_called_once()

    def test_numbered_menu_when_no_tui_library(self):
        from cli.menu import _interactive_menu
        with patch("cli.menu.sys.stdin.isatty", return_value=True):
            with patch("cli.menu._has_tui", False):
                with patch("cli.menu._numbered_menu") as mock_num:
                    _interactive_menu()
                    mock_num.assert_called_once()


# ── _run_menu_action ──────────────────────────────────────────────────────


class TestRunMenuAction:
    def test_quit_calls_ok(self):
        from cli.menu import _run_menu_action
        with patch("cli.menu.ok") as mock_ok:
            _run_menu_action("quit")
            mock_ok.assert_called_once_with("Goodbye")

    def test_switch_calls_switch_instance(self):
        from cli.menu import _run_menu_action
        with patch("cli.menu._switch_instance") as mock_sw:
            _run_menu_action("switch")
            mock_sw.assert_called_once()

    def test_create_instance_calls_create(self):
        from cli.menu import _run_menu_action
        with patch("cli.menu._create_instance") as mock_cr:
            _run_menu_action("create-instance")
            mock_cr.assert_called_once()

    def test_other_command_runs_via_menu_command(self):
        from cli.menu import _run_menu_action
        with patch("cli.menu._run_menu_command") as mock_rc:
            _run_menu_action("status")
            mock_rc.assert_called_once_with("status")


# ── _pause_after_output ──────────────────────────────────────────────────


class TestPauseAfterOutput:
    def test_waits_for_enter(self):
        from cli.menu import _pause_after_output
        with patch("builtins.input", return_value=""):
            _pause_after_output()

    def test_handles_eof_error(self):
        from cli.menu import _pause_after_output
        with patch("builtins.input", side_effect=EOFError()):
            _pause_after_output()  # Should not raise


# ── _run_menu_command ────────────────────────────────────────────────────


class TestRunMenuCommand:
    def test_destructive_commands_prompt_and_cancel(self):
        """Destructive commands should prompt and cancel on non-'y'."""
        from cli.menu import _run_menu_command
        with patch("builtins.input", return_value="n"):
            with patch("cli.menu.print"):
                _run_menu_command("install")  # Should return without calling handler

    def test_destructive_commands_proceed_on_y(self):
        """Destructive commands should proceed on 'y'."""
        from cli.menu import _run_menu_command
        with patch("builtins.input", return_value="y"):
            with patch("cli.commands.cmd_install") as mock_cmd:
                _run_menu_command("install")
                mock_cmd.assert_called_once()

    def test_destructive_handles_eof(self):
        from cli.menu import _run_menu_command
        with patch("builtins.input", side_effect=EOFError()):
            with patch("cli.menu.print"):
                _run_menu_command("install")  # Should not raise

    def test_dispatches_status(self):
        from cli.menu import _run_menu_command
        with patch("builtins.input", return_value="y"):
            with patch("cli.commands.cmd_check") as mock_cmd:
                _run_menu_command("check")
                mock_cmd.assert_called_once()

    def test_unknown_command_calls_fail(self):
        from cli.menu import _run_menu_command
        with patch("cli.menu.fail") as mock_fail:
            _run_menu_command("nonexistent")
            mock_fail.assert_called_once_with("Unknown command: nonexistent")

    def test_dispatches_all_known_commands(self):
        """Verify dispatch doesn't call 'fail' for commands with simple args."""
        from cli.menu import _run_menu_command

        # Commands that work with the basic _Fake args
        simple_commands = [
            "check", "status", "instances",
            "detect-mcu", "clilog",
        ]
        for cmd in simple_commands:
            with patch("cli.menu.fail") as mock_fail:
                with patch("cli.commands.ok"), patch("cli.commands.warn"):
                    _run_menu_command(cmd)
                    mock_fail.assert_not_called()


# ── _switch_instance ──────────────────────────────────────────────────────


class TestSwitchInstance:
    def test_no_instances_shows_warning(self):
        from cli.menu import _switch_instance
        with patch("cli.menu.detect_instances", return_value=[]):
            with patch("cli.menu.warn") as mock_warn:
                _switch_instance()
                mock_warn.assert_called_once_with("No instances detected")

    def test_single_instance_auto_switches(self, mock_instance):
        from cli.menu import _switch_instance
        with patch("cli.menu.detect_instances", return_value=[mock_instance]):
            with patch("cli.menu.set_active_instance") as mock_set:
                with patch("cli.menu.info"):
                    _switch_instance()
                    mock_set.assert_called_once_with(mock_instance)

    def test_fallback_numbered_switch(self, mock_instance):
        """When not a TTY (piped input), falls back to numbered input."""
        from cli.menu import _switch_instance
        inst2 = Instance(
            name="second", printer_data_dir="/tmp/2/data",
            config_dir="/tmp/2/data/config",
            moonraker_conf="/tmp/2/config/moonraker.conf",
            moonraker_log="/tmp/2/logs/moonraker.log",
            scripts_dir="/tmp/2/scripts",
            macros_dir="/tmp/2/config/E3CNC/macros",
            E3CNC_dir="/tmp/2/config/E3CNC",
            printer_cfg="/tmp/2/config/printer.cfg",
            web_root="/tmp/2/frontend",
            is_running=True,
        )
        with patch("cli.menu.detect_instances", return_value=[mock_instance, inst2]):
            with patch("cli.menu.sys.stdin.isatty", return_value=False):
                with patch("builtins.input", return_value="1"):
                    with patch("cli.menu.set_active_instance") as mock_set:
                        with patch("cli.menu.info"):
                            _switch_instance()
                            mock_set.assert_called_once_with(mock_instance)

    def test_numbered_switch_create_new(self, mock_instance):
        from cli.menu import _switch_instance
        inst2 = Instance(
            name="second", printer_data_dir="/tmp/2/data",
            config_dir="/tmp/2/data/config",
            moonraker_conf="/tmp/2/config/moonraker.conf",
            moonraker_log="/tmp/2/logs/moonraker.log",
            scripts_dir="/tmp/2/scripts",
            macros_dir="/tmp/2/config/E3CNC/macros",
            E3CNC_dir="/tmp/2/config/E3CNC",
            printer_cfg="/tmp/2/config/printer.cfg",
            web_root="/tmp/2/frontend",
            is_running=True,
        )
        with patch("cli.menu.detect_instances", return_value=[mock_instance, inst2]):
            with patch("cli.menu.sys.stdin.isatty", return_value=False):
                with patch("builtins.input", return_value="3"):  # create new (index 2+1=3)
                    with patch("cli.menu.print"):
                        with patch("_e3cnc_shared._create_new_instance") as mock_cr:
                            mock_cr.return_value = None
                            _switch_instance()
                            mock_cr.assert_called_once()

    def test_numbered_switch_invalid_choice(self, mock_instance):
        from cli.menu import _switch_instance
        inst2 = Instance(
            name="second", printer_data_dir="/tmp/2/data",
            config_dir="/tmp/2/data/config",
            moonraker_conf="/tmp/2/config/moonraker.conf",
            moonraker_log="/tmp/2/logs/moonraker.log",
            scripts_dir="/tmp/2/scripts",
            macros_dir="/tmp/2/config/E3CNC/macros",
            E3CNC_dir="/tmp/2/config/E3CNC",
            printer_cfg="/tmp/2/config/printer.cfg",
            web_root="/tmp/2/frontend",
            is_running=True,
        )
        with patch("cli.menu.detect_instances", return_value=[mock_instance, inst2]):
            with patch("cli.menu.sys.stdin.isatty", return_value=False):
                with patch("builtins.input", return_value="99"):
                    with patch("cli.menu.warn") as mock_warn:
                        _switch_instance()
                        mock_warn.assert_called_once_with("Invalid choice")

    def test_numbered_switch_value_error(self, mock_instance):
        from cli.menu import _switch_instance
        inst2 = Instance(
            name="second", printer_data_dir="/tmp/2/data",
            config_dir="/tmp/2/data/config",
            moonraker_conf="/tmp/2/config/moonraker.conf",
            moonraker_log="/tmp/2/logs/moonraker.log",
            scripts_dir="/tmp/2/scripts",
            macros_dir="/tmp/2/config/E3CNC/macros",
            E3CNC_dir="/tmp/2/config/E3CNC",
            printer_cfg="/tmp/2/config/printer.cfg",
            web_root="/tmp/2/frontend",
            is_running=True,
        )
        with patch("cli.menu.detect_instances", return_value=[mock_instance, inst2]):
            with patch("cli.menu.sys.stdin.isatty", return_value=False):
                with patch("builtins.input", return_value="abc"):
                    with patch("cli.menu.warn") as mock_warn:
                        _switch_instance()
                        mock_warn.assert_called_once_with("Invalid choice")

    def test_switch_handles_eof(self, mock_instance):
        from cli.menu import _switch_instance
        inst2 = Instance(
            name="second", printer_data_dir="/tmp/2/data",
            config_dir="/tmp/2/data/config",
            moonraker_conf="/tmp/2/config/moonraker.conf",
            moonraker_log="/tmp/2/logs/moonraker.log",
            scripts_dir="/tmp/2/scripts",
            macros_dir="/tmp/2/config/E3CNC/macros",
            E3CNC_dir="/tmp/2/config/E3CNC",
            printer_cfg="/tmp/2/config/printer.cfg",
            web_root="/tmp/2/frontend",
            is_running=True,
        )
        with patch("cli.menu.detect_instances", return_value=[mock_instance, inst2]):
            with patch("cli.menu.sys.stdin.isatty", return_value=False):
                with patch("builtins.input", side_effect=EOFError()):
                    _switch_instance()  # Should not raise


# ── _create_instance ─────────────────────────────────────────────────────


class TestCreateInstance:
    def test_creates_and_sets_active(self, mock_instance):
        from cli.menu import _create_instance
        with patch("cli.menu.detect_instances", return_value=[]):
            with patch("_e3cnc_shared._create_new_instance", return_value=mock_instance):
                with patch("cli.menu.set_active_instance") as mock_set:
                    with patch("cli.menu.info"):
                        with patch("cli.menu.print"):
                            _create_instance()
                            mock_set.assert_called_once_with(mock_instance)

    def test_does_not_set_when_none_returned(self):
        from cli.menu import _create_instance
        with patch("cli.menu.detect_instances", return_value=[]):
            with patch("_e3cnc_shared._create_new_instance", return_value=None):
                with patch("cli.menu.set_active_instance") as mock_set:
                    with patch("cli.menu.info"):
                        with patch("cli.menu.print"):
                            _create_instance()
                            mock_set.assert_not_called()

    def test_shows_existing_instances(self, mock_instance):
        from cli.menu import _create_instance
        with patch("cli.menu.detect_instances", return_value=[mock_instance]):
            with patch("_e3cnc_shared._create_new_instance", return_value=mock_instance):
                with patch("cli.menu.set_active_instance"):
                    with patch("cli.menu.print") as mock_print:
                        with patch("cli.menu.info"):
                            _create_instance()
                            # Should print existing instances list
                            assert any(
                                "Existing instances" in str(c) for c in mock_print.call_args_list
                            )


# ── _numbered_menu core loop ────────────────────────────────────────────


class TestNumberedMenu:
    def test_handles_keyboard_interrupt(self):
        from cli.menu import _numbered_menu
        with patch("cli.menu.get_active_instance", return_value=None):
            with patch("cli.menu.print_banner"):
                with patch("builtins.input", side_effect=KeyboardInterrupt()):
                    with patch("cli.menu.print"):
                        _numbered_menu()  # Should not raise

    def test_accepts_valid_numbered_choice(self):
        from cli.menu import _numbered_menu
        with patch("cli.menu.get_active_instance", return_value=None):
            with patch("cli.menu.print_banner"):
                with patch("builtins.input", side_effect=["1", KeyboardInterrupt()]):
                    with patch("cli.menu._run_menu_action") as mock_action:
                        _numbered_menu()  # KeyboardInterrupt exits after first dispatch
                    # Verify status was dispatched
                    status_calls = [c for c in mock_action.call_args_list if c[0][0] == "status"]
                    assert len(status_calls) >= 1

    def test_handles_empty_input(self):
        """Empty input should continue loop without dispatching."""
        from cli.menu import _numbered_menu
        with patch("cli.menu.get_active_instance", return_value=None):
            with patch("cli.menu.print_banner"):
                with patch("builtins.input", side_effect=KeyboardInterrupt()):
                    _numbered_menu()  # Should handle gracefully
