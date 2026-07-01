"""Tests for cli/helpers.py — CLI helper functions."""

import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch, call, mock_open

import pytest

from _e3cnc_shared import Instance


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def mock_instance():
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


# ── _confirm_destructive ──────────────────────────────────────────────────


class TestConfirmDestructive:
    def test_returns_true_for_non_destructive(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=False, check=False)
        assert _confirm_destructive("status", args) is True

    def test_returns_true_with_yes_flag(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=True, check=False)
        assert _confirm_destructive("install", args) is True

    def test_returns_true_with_check_flag(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=False, check=True)
        assert _confirm_destructive("install", args) is True

    def test_prompts_and_returns_false_on_n(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=False, check=False)
        with patch("cli.helpers.sys.stdin.isatty", return_value=True):
            with patch("builtins.input", return_value="n"):
                assert _confirm_destructive("install", args) is False

    def test_prompts_and_returns_true_on_y(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=False, check=False)
        with patch("cli.helpers.sys.stdin.isatty", return_value=True):
            with patch("builtins.input", return_value="y"):
                assert _confirm_destructive("install", args) is True

    def test_returns_true_when_not_interactive(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=False, check=False)
        with patch("cli.helpers.sys.stdin.isatty", return_value=False):
            assert _confirm_destructive("install", args) is True

    def test_handles_eof(self):
        from cli.helpers import _confirm_destructive
        args = MagicMock(yes=False, check=False)
        with patch("cli.helpers.sys.stdin.isatty", return_value=True):
            with patch("builtins.input", side_effect=EOFError()):
                assert _confirm_destructive("install", args) is False


# ── _validate_ssh ─────────────────────────────────────────────────────────


class TestValidateSSH:
    def test_connects_successfully(self):
        from cli.helpers import _validate_ssh
        mock_result = MagicMock(returncode=0)
        with patch("cli.helpers._ssh_run", return_value=mock_result):
            with patch("cli.helpers.ok"):
                assert _validate_ssh("user@host") is True

    def test_fails_on_connection_error(self):
        from cli.helpers import _validate_ssh
        mock_result = MagicMock(returncode=1)
        with patch("cli.helpers._ssh_run", return_value=mock_result):
            with patch("cli.helpers.fail") as mock_fail:
                with patch("cli.helpers.print"):
                    with pytest.raises(SystemExit):
                        _validate_ssh("user@host")
                    mock_fail.assert_called()


# ── _require_ansible (test the non-install code paths) ────────────────────


class TestRequireAnsible:
    def test_returns_when_ansible_playbook_found(self):
        from cli.helpers import _require_ansible
        with patch("cli.helpers.shutil.which", return_value="/usr/bin/ansible-playbook"):
            _require_ansible()  # Should not raise

    def test_tries_pip_install_when_missing(self):
        from cli.helpers import _require_ansible
        # ansible-playbook missing → pip3 found → ansible install succeeds → ansible-playbook still missing → fail
        which_results = {
            "ansible-playbook": None,
            "pip3": "/usr/bin/pip3",
        }
        with patch("cli.helpers.shutil.which", side_effect=lambda x: which_results.get(x)):
            with patch("cli.helpers._ensure_local_sudo_access"):
                with patch("cli.helpers.subprocess.run", return_value=MagicMock(returncode=0)):
                    with patch("cli.helpers.fail") as mock_fail:
                        with patch("cli.helpers.ok"), patch("cli.helpers.print"):
                            _require_ansible()
                            mock_fail.assert_called()

    def test_installs_pip_if_missing(self):
        from cli.helpers import _require_ansible
        # ansible-playbook, pip3 and pip all missing, then pip becomes available, then ansible-playbook still missing
        call_count = [0]
        def _mock_which(cmd):
            call_count[0] += 1
            if cmd == "ansible-playbook":
                return None
            if cmd in ("pip3", "pip"):
                # First 2 calls (line 94: pip3 and pip) → None, then after install → /usr/bin/pip3
                return None if call_count[0] <= 3 else "/usr/bin/pip3"
            return None

        with patch("cli.helpers.shutil.which", side_effect=_mock_which):
            with patch("cli.helpers.subprocess.run") as mock_run:
                mock_run.return_value = MagicMock(returncode=0)
                with patch("cli.helpers._ensure_local_sudo_access"):
                    with patch("cli.helpers.fail"):
                        with patch("cli.helpers.ok"), patch("cli.helpers.info"):
                            with patch("cli.helpers.print"):
                                _require_ansible()
            # Should have called ensurepip at least once
            ensurepip_calls = [
                c for c in mock_run.call_args_list
                if "ensurepip" in str(c)
            ]
            assert len(ensurepip_calls) >= 1


# ── _get_instance ─────────────────────────────────────────────────────────


class TestGetInstance:
    def test_selects_by_name(self, mock_instance):
        from cli.helpers import _get_instance
        with patch("cli.helpers.detect_instances", return_value=[mock_instance]):
            args = MagicMock(instance="testcnc")
            inst = _get_instance(args)
            assert inst is not None
            assert inst.name == "testcnc"

    def test_selects_by_legacy_name(self, mock_instance):
        """Match cnc_instance_name pattern."""
        from cli.helpers import _get_instance
        legacy = Instance(
            name="cnc_otherbox",
            printer_data_dir="/tmp/other/data",
            config_dir="/tmp/other/data/config",
            moonraker_conf="/tmp/other/data/config/moonraker.conf",
            moonraker_log="/tmp/other/data/logs/moonraker.log",
            scripts_dir="/tmp/other/data/scripts",
            macros_dir="/tmp/other/data/config/E3CNC/macros",
            E3CNC_dir="/tmp/other/data/config/E3CNC",
            printer_cfg="/tmp/other/data/config/printer.cfg",
            web_root="/tmp/other/frontend",
        )
        with patch("cli.helpers.detect_instances", return_value=[legacy, mock_instance]):
            args = MagicMock(instance="otherbox")
            inst = _get_instance(args)
            assert inst is not None
            assert inst.name == "cnc_otherbox"

    def test_selects_by_index(self, mock_instance):
        from cli.helpers import _get_instance
        inst2 = Instance(
            name="beta", printer_data_dir="/tmp/b/data",
            config_dir="/tmp/b/data/config",
            moonraker_conf="/tmp/b/config/moonraker.conf",
            moonraker_log="/tmp/b/logs/moonraker.log",
            scripts_dir="/tmp/b/scripts",
            macros_dir="/tmp/b/config/E3CNC/macros",
            E3CNC_dir="/tmp/b/config/E3CNC",
            printer_cfg="/tmp/b/config/printer.cfg",
            web_root="/tmp/b/frontend",
        )
        with patch("cli.helpers.detect_instances", return_value=[mock_instance, inst2]):
            args = MagicMock(instance="2")
            inst = _get_instance(args)
            assert inst is not None
            assert inst.name == "beta"

    def test_unknown_instance_warns(self):
        from cli.helpers import _get_instance
        with patch("cli.helpers.detect_instances", return_value=[]):
            args = MagicMock(instance="nonexistent")
            with patch("cli.helpers.warn") as mock_warn:
                inst = _get_instance(args)
                assert inst is None
                mock_warn.assert_called()

    def test_auto_selects_single_instance(self, mock_instance):
        from cli.helpers import _get_instance
        with patch("cli.helpers.detect_instances", return_value=[mock_instance]):
            args = MagicMock(instance=None)
            inst = _get_instance(args)
            assert inst is not None
            assert inst.name == mock_instance.name

    def test_returns_none_when_no_instances(self):
        from cli.helpers import _get_instance
        with patch("cli.helpers.detect_instances", return_value=[]):
            args = MagicMock(instance=None)
            inst = _get_instance(args)
            assert inst is None

    def test_auto_selects_first_running(self):
        from cli.helpers import _get_instance
        stopped = Instance(
            name="stopped", printer_data_dir="/tmp/s/data",
            config_dir="/tmp/s/data/config",
            moonraker_conf="/tmp/s/config/moonraker.conf",
            moonraker_log="/tmp/s/logs/moonraker.log",
            scripts_dir="/tmp/s/scripts",
            macros_dir="/tmp/s/config/E3CNC/macros",
            E3CNC_dir="/tmp/s/config/E3CNC",
            printer_cfg="/tmp/s/config/printer.cfg",
            web_root="/tmp/s/frontend",
            is_running=False,
        )
        running = Instance(
            name="active", printer_data_dir="/tmp/a/data",
            config_dir="/tmp/a/data/config",
            moonraker_conf="/tmp/a/config/moonraker.conf",
            moonraker_log="/tmp/a/logs/moonraker.log",
            scripts_dir="/tmp/a/scripts",
            macros_dir="/tmp/a/config/E3CNC/macros",
            E3CNC_dir="/tmp/a/config/E3CNC",
            printer_cfg="/tmp/a/config/printer.cfg",
            web_root="/tmp/a/frontend",
            is_running=True,
        )
        with patch("cli.helpers.detect_instances", return_value=[stopped, running]):
            args = MagicMock(instance=None)
            inst = _get_instance(args)
            assert inst is not None
            assert inst.name == "active"


# ── _run_ansible_cmd ──────────────────────────────────────────────────────


class TestRunAnsibleCmd:
    def test_calls_run_ansible_playbook(self):
        from cli.helpers import _run_ansible_cmd
        playbook = Path("/tmp/test-playbook.yml")
        args = MagicMock(remote=None, check=False, verbose=False)
        with patch("cli.helpers._require_ansible"):
            with patch("_e3cnc_shared.run_ansible_playbook") as mock_rap:
                mock_rap.return_value = MagicMock(success=True, returncode=0)
                with patch("_e3cnc_shared.header"), patch("cli.helpers.print"):
                    _run_ansible_cmd(playbook, args, "Test")
                    mock_rap.assert_called_once()

    def test_exits_on_failure(self):
        from cli.helpers import _run_ansible_cmd
        playbook = Path("/tmp/test-playbook.yml")
        args = MagicMock(remote=None, check=False, verbose=False)
        with patch("cli.helpers._require_ansible"):
            with patch("_e3cnc_shared.run_ansible_playbook") as mock_rap:
                mock_rap.return_value = MagicMock(success=False, returncode=1)
                with patch("cli.helpers.fail") as mock_fail:
                    with patch("cli.helpers.print"):
                        with patch("_e3cnc_shared.header"):
                            with pytest.raises(SystemExit):
                                _run_ansible_cmd(playbook, args, "Test")
                            mock_fail.assert_called()


# ── _generate_cnc_printer_cfg ────────────────────────────────────────────


class TestGenerateCncPrinterCfg:
    def test_generates_with_mcu_path(self):
        from cli.helpers import _generate_cnc_printer_cfg
        result = _generate_cnc_printer_cfg("/dev/serial/by-id/usb-Klipper")
        assert "serial: /dev/serial/by-id/usb-Klipper" in result

    def test_generates_without_mcu_path(self):
        from cli.helpers import _generate_cnc_printer_cfg
        result = _generate_cnc_printer_cfg(None)
        assert "# serial:" in result

    def test_contains_required_sections(self):
        from cli.helpers import _generate_cnc_printer_cfg
        result = _generate_cnc_printer_cfg(None)
        assert "[mcu]" in result
        assert "[printer]" in result
        assert "[stepper_x]" in result
        assert "[stepper_y]" in result
        assert "[stepper_z]" in result
        assert "[idle_timeout]" in result
        assert "[force_move]" in result
        assert "[pause_resume]" in result
        assert "[gcode_arcs]" in result

    def test_has_adjust_markers(self):
        from cli.helpers import _generate_cnc_printer_cfg
        result = _generate_cnc_printer_cfg(None)
        assert "!!! ADJUST" in result

    def test_has_instructions(self):
        from cli.helpers import _generate_cnc_printer_cfg
        result = _generate_cnc_printer_cfg(None)
        assert "INSTRUCTIONS:" in result


# ── MCU presets ──────────────────────────────────────────────────────────


class TestMCUPresets:
    def test_presets_have_required_fields(self):
        from cli.helpers import MCU_PRESETS
        for preset in MCU_PRESETS:
            assert "id" in preset
            assert "name" in preset
            assert "description" in preset
            assert "config" in preset
            assert "flash_help" in preset

    def test_presets_have_unique_ids(self):
        from cli.helpers import MCU_PRESETS
        ids = [p["id"] for p in MCU_PRESETS]
        assert len(ids) == len(set(ids))

    def test_find_matching_preset_returns_index(self):
        from cli.helpers import _find_matching_preset
        result = _find_matching_preset({"model": "STM32F103 Blue Pill"})
        assert result is not None
        assert result >= 0

    def test_find_matching_preset_returns_none_for_unknown(self):
        from cli.helpers import _find_matching_preset
        result = _find_matching_preset({"model": "Unknown Device XYZ"})
        assert result is None


# ── build_klipper_firmware ───────────────────────────────────────────────


class TestBuildKlipperFirmware:
    def test_fails_on_unknown_preset(self):
        from cli.helpers import build_klipper_firmware
        result = build_klipper_firmware("nonexistent")
        assert result is False

    def test_fails_on_missing_klipper_dir(self):
        from cli.helpers import build_klipper_firmware
        with patch("os.path.exists", return_value=False):
            result = build_klipper_firmware("stm32f103-usb", klipper_dir="/tmp/nonexistent")
            assert result is False

    def test_build_fails_on_config_write_error(self):
        from cli.helpers import build_klipper_firmware
        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", side_effect=OSError("permission denied")):
                result = build_klipper_firmware("stm32f103-usb", klipper_dir="/tmp/klipper")
                assert result is False

    def test_build_fails_on_make_olddefconfig_error(self):
        from cli.helpers import build_klipper_firmware
        with patch("os.path.exists", return_value=True):
            with patch("builtins.open", mock_open()):
                with patch("cli.helpers.subprocess.run") as mock_run:
                    mock_result = MagicMock(returncode=1, stderr="config error")
                    mock_run.return_value = mock_result
                    result = build_klipper_firmware("stm32f103-usb", klipper_dir="/tmp/klipper")
                    assert result is False

    def test_build_success_with_elf_output(self):
        from cli.helpers import build_klipper_firmware
        callback = MagicMock()
        with patch("os.path.exists", side_effect=[
            True,       # klippy.py exists
            True,       # elf_path exists
            False,      # bin_path doesn't exist
            False,      # uf2_path doesn't exist
        ]):
            with patch("builtins.open", mock_open()):
                with patch("cli.helpers.subprocess.run") as mock_run:
                    mock_run.return_value = MagicMock(returncode=0, stderr="")
                    with patch("os.path.getsize", return_value=1024):
                        result = build_klipper_firmware(
                            "stm32f103-usb", klipper_dir="/tmp/klipper",
                            progress_callback=callback,
                        )
                        assert result is True
                        callback.assert_any_call("Build complete: out/klipper.elf (1 KB)")

    def test_build_no_output_files_found(self):
        from cli.helpers import build_klipper_firmware
        callback = MagicMock()
        with patch("os.path.exists", side_effect=[
            True,       # klippy.py exists
            False,      # elf_path doesn't exist
            False,      # bin_path doesn't exist
            False,      # uf2_path doesn't exist
        ]):
            with patch("builtins.open", mock_open()):
                with patch("cli.helpers.subprocess.run") as mock_run:
                    mock_run.return_value = MagicMock(returncode=0, stderr="")
                    result = build_klipper_firmware(
                        "stm32f103-usb", klipper_dir="/tmp/klipper",
                        progress_callback=callback,
                    )
                    assert result is False
                    callback.assert_any_call("Build completed but no output files found in out/")
