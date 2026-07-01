"""
Unit tests for the e3cnc-cli shared module (_e3cnc_shared.py).

Tests cover:
  - check_dependencies()
  - check_status()
  - run_backup() / run_restore()
  - run_diagnose()
  - run_logs()
  - run_ansible_playbook()
  - _ensure_remote_inventory()
  - _ssh_run()
  - Utility functions (_dir_size, _write_manifest)
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import ANY, MagicMock, call, patch

import pytest

# Add repo root to path so _e3cnc_shared can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _e3cnc_shared import (
    VERSION,
    TOOL_NAME,
    HERE,
    Style,
    CmdResult,
    check_dependencies,
    check_status,
    run_backup,
    run_restore,
    run_diagnose,
    run_logs,
    run_ansible_playbook,
    _ensure_remote_inventory,
    _ssh_run,
    print_banner,
    BANNER_RAW,
    INSTALL_PLAYBOOK,
    DEPLOY_PLAYBOOK,
    UNINSTALL_PLAYBOOK,
    REDEPLOY_PLAYBOOK,
    ANSIBLE_DIR,
    LOCAL_INVENTORY,
    Instance,
    detect_instances,
    select_instance,
    get_active_instance,
    set_active_instance,
    instance_extra_vars,
)


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_subprocess_run():
    """Mock subprocess.run to prevent actual command execution."""
    with patch("_e3cnc_shared.subprocess.run") as mock:
        mock.return_value = MagicMock(
            returncode=0, stdout="mock output", stderr=""
        )
        yield mock


@pytest.fixture
def mock_subprocess_popen():
    """Mock subprocess.Popen for streaming output."""
    with patch("_e3cnc_shared.subprocess.Popen") as mock:
        proc = MagicMock()
        proc.stdout = ["line 1\n", "line 2\n"]
        proc.returncode = 0
        mock.return_value = proc
        yield mock


@pytest.fixture
def mock_shutil_which():
    """Mock shutil.which to simulate finding/not finding commands."""
    with patch("_e3cnc_shared.shutil.which") as mock:
        mock.return_value = "/usr/bin/git"
        yield mock


@pytest.fixture
def mock_path_home(tmp_path):
    """Mock Path.home() to use a temp directory."""
    with patch("_e3cnc_shared.Path.home") as mock:
        mock.return_value = tmp_path
        yield tmp_path


@pytest.fixture
def mock_ssh_run():
    """Mock _ssh_run to avoid actual SSH connections."""
    with patch("_e3cnc_shared._ssh_run") as mock:
        mock.return_value = MagicMock(
            returncode=0, stdout="/home/user\n", stderr=""
        )
        yield mock


# ── Basic sanity tests ────────────────────────────────────────────────────

class TestBasicSanity:
    """Verify module loads and constants are correct."""

    def test_version(self):
        assert isinstance(VERSION, str)
        assert VERSION.count(".") == 2  # semver

    def test_tool_name(self):
        assert TOOL_NAME == "e3cnc-cli"

    def test_repo_root_exists(self):
        assert HERE.is_dir()
        assert (HERE / "ansible").is_dir()

    def test_playbook_paths(self):
        for pb in [INSTALL_PLAYBOOK, DEPLOY_PLAYBOOK, UNINSTALL_PLAYBOOK, REDEPLOY_PLAYBOOK]:
            assert str(pb).startswith(str(HERE))
            assert pb.name.endswith(".yml")

    def test_banner_raw(self):
        assert "█" in BANNER_RAW
        assert len(BANNER_RAW) > 50

    def test_print_banner(self, capsys):
        print_banner()
        captured = capsys.readouterr()
        assert "█" in captured.out


# ── Style tests ──────────────────────────────────────────────────────────

class TestStyle:
    def test_colors_are_strings(self):
        assert isinstance(Style.GREEN, str)
        assert isinstance(Style.RESET, str)

    def test_bold_contains_escape(self):
        assert "\033[" in Style.BOLD or Style.BOLD == ""

    def test_reset_is_escape_zero(self):
        assert Style.RESET == "\033[0m" or Style.RESET == ""


# ── CmdResult tests ──────────────────────────────────────────────────────

class TestCmdResult:
    def test_success_result(self):
        r = CmdResult(True, "all good", "Test")
        assert r.success is True
        assert r.output == "all good"
        assert r.label == "Test"

    def test_failure_result(self):
        r = CmdResult(False, "failed", "Test")
        assert r.success is False


# ── check_dependencies tests ────────────────────────────────────────────

class TestCheckDependencies:
    @patch("_e3cnc_shared.subprocess.run")
    def test_returns_tuple(self, mock_run, mock_shutil_which):
        mock_run.return_value = MagicMock(returncode=0, stdout="ansible-playbook 2.14.0\n", stderr="")
        result, lines = check_dependencies()
        assert isinstance(result, bool)
        assert isinstance(lines, list)
        assert len(lines) > 0

    @patch("_e3cnc_shared.subprocess.run")
    def test_missing_dep_reported(self, mock_run, mock_shutil_which):
        # Return None for all commands to simulate missing
        mock_shutil_which.return_value = None
        result, lines = check_dependencies()
        warnings = [l for l in lines if "not found" in l]
        assert len(warnings) > 0

    @patch("_e3cnc_shared.PLAYBOOKS_DIR")
    @patch("_e3cnc_shared.subprocess.run")
    def test_missing_playbooks(self, mock_run, mock_dir, mock_shutil_which):
        mock_shutil_which.return_value = "/usr/bin/git"
        mock_dir.is_dir.return_value = False
        result, lines = check_dependencies()
        playbook_warnings = [l for l in lines if "playbooks" in l and "not found" in l]
        assert len(playbook_warnings) > 0

    @patch("_e3cnc_shared.subprocess.run")
    def test_output_callback(self, mock_run, mock_shutil_which):
        mock_run.return_value = MagicMock(returncode=0, stdout="ansible-playbook 2.14.0\n", stderr="")
        received = []
        result, lines = check_dependencies(output_callback=lambda line: received.append(line))
        assert len(received) > 0
        assert all(isinstance(l, str) for l in received)


# ── check_status tests ──────────────────────────────────────────────────

class TestCheckStatus:
    def test_returns_tuple(self):
        ok_count, total, lines = check_status()
        assert isinstance(ok_count, int)
        assert isinstance(total, int)
        assert isinstance(lines, list)
        assert total == 9  # We have 9 component checks

    def test_local_status_runs(self):
        # Should not crash when run locally (even if nothing is found)
        ok_count, total, lines = check_status()
        assert 0 <= ok_count <= total

    def test_output_callback(self):
        received = []
        ok_count, total, lines = check_status(output_callback=lambda line: received.append(line))
        assert len(received) > 0

    @patch("_e3cnc_shared.Path.home")
    def test_status_with_mock_home(self, mock_home, tmp_path):
        # Create a realistic fake structure
        mock_home.return_value = tmp_path
        ok_count, total, lines = check_status()
        assert ok_count == 0  # Nothing should be found


# ── run_backup tests ─────────────────────────────────────────────────────

class TestRunBackup:
    def test_backup_creates_directory(self, mock_path_home):
        result = run_backup()
        # Should find backup dirs
        backup_dirs = list(mock_path_home.parent.glob("e3cnc-backup-*"))
        # The backup is created relative to HERE, not home
        # Check it was created somewhere

    def test_backup_manifest_written(self, mock_path_home):
        # Create some source directories for backup
        mainsail = mock_path_home / "mainsail"
        mainsail.mkdir(parents=True)
        (mainsail / "index.html").write_text("<html></html>")

        config = mock_path_home / "printer_data" / "config"
        config.mkdir(parents=True)
        (config / "moonraker.conf").write_text("[server]\n")

        wcs = mock_path_home / "wcs_offsets.json"
        wcs.write_text('{"G54": [0, 0, 0]}')

        result = run_backup()
        assert result.success is True

        # Check output mentions each component
        assert "Frontend" in result.output
        assert "config" in result.output
        assert "WCS" in result.output

    def test_backup_no_sources(self, mock_path_home):
        result = run_backup()
        # Should not crash when sources are missing
        assert "No frontend" in result.output or result.success is True

    def test_backup_output_callback(self, mock_path_home):
        received = []
        result = run_backup(output_callback=lambda line: received.append(line))
        assert len(received) > 0

    @patch("_e3cnc_shared._ssh_run")
    def test_remote_backup(self, mock_ssh, mock_path_home):
        mock_ssh.return_value = MagicMock(returncode=0, stdout="backup-name\n", stderr="")
        result = run_backup(remote_host="pi@cnc")
        # Remote backup was attempted
        assert mock_ssh.called


# ── run_restore tests ───────────────────────────────────────────────────

class TestRunRestore:
    def test_restore_no_backup(self):
        result = run_restore("nonexistent-backup")
        assert result.success is False
        assert "not found" in result.output.lower()

    def test_restore_from_backup(self, mock_path_home, tmp_path):
        # Create a fake backup
        backup_dir = tmp_path / "test-backup"
        (backup_dir / "frontend").mkdir(parents=True)
        (backup_dir / "frontend" / "index.html").write_text("<html></html>")
        (backup_dir / "config").mkdir(parents=True)
        (backup_dir / "config" / "moonraker.conf").write_text("[server]")
        (backup_dir / "wcs_offsets.json").write_text('{"G54": [0, 0, 0]}')
        (backup_dir / "manifest.json").write_text('{"createdAt": "2024-01-01"}')

        result = run_restore(str(backup_dir), auto_yes=True)
        assert result.success is True
        assert "Frontend" in result.output

    def test_restore_output_callback(self, tmp_path):
        received = []
        result = run_restore("nonexistent", output_callback=lambda line: received.append(line))
        assert len(received) > 0

    @patch("_e3cnc_shared._ssh_run")
    def test_remote_restore(self, mock_ssh):
        mock_ssh.return_value = MagicMock(returncode=0, stdout="", stderr="")
        result = run_restore("test-backup", remote_host="pi@cnc")
        assert mock_ssh.called


# ── run_diagnose tests ──────────────────────────────────────────────────

class TestRunDiagnose:
    @patch("_e3cnc_shared.subprocess.run")
    def test_diagnose_returns_cmd_result(self, mock_run):
        # Mock a successful Moonraker response
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='{"result": {"state": "ready", "hostname": "test", "software_version": "v1.0", "cpu_info": "4 cores"}}\nready\nTest\nv1.0\n4 cores\n',
            stderr="",
        )
        result = run_diagnose()
        assert isinstance(result, CmdResult)
        assert result.success is True

    def test_diagnose_output_callback(self):
        received = []
        result = run_diagnose(output_callback=lambda line: received.append(line))
        assert len(received) > 0


# ── run_logs tests ──────────────────────────────────────────────────────

class TestRunLogs:
    @patch("_e3cnc_shared.subprocess.run")
    def test_logs_returns_cmd_result(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0, stdout="log line 1\nlog line 2\n", stderr=""
        )
        result = run_logs(lines=10)
        assert isinstance(result, CmdResult)
        assert result.success is True
        assert "log line" in result.output

    def test_logs_default_lines(self):
        result = run_logs(lines=5)
        assert isinstance(result, CmdResult)


# ── run_ansible_playbook tests ──────────────────────────────────────────

class TestRunAnsiblePlaybook:
    def test_returns_cmd_result(self, mock_subprocess_run):
        result = run_ansible_playbook(
            INSTALL_PLAYBOOK, None, False, False, "Install"
        )
        assert isinstance(result, CmdResult)

    def test_install_playbook_path(self, mock_subprocess_run):
        result = run_ansible_playbook(
            INSTALL_PLAYBOOK, None, False, False, "Install"
        )
        assert mock_subprocess_run.called

    def test_deploy_playbook(self, mock_subprocess_run):
        result = run_ansible_playbook(
            DEPLOY_PLAYBOOK, None, False, False, "Deploy"
        )
        assert result.success is True

    def test_check_mode(self, mock_subprocess_run):
        result = run_ansible_playbook(
            INSTALL_PLAYBOOK, None, True, False, "Install (dry-run)"
        )
        # Should include --check in the command
        call_args = mock_subprocess_run.call_args
        if call_args:
            cmd = call_args[0][0] if call_args[0] else []
            assert "--check" in cmd

    def test_output_callback(self, mock_subprocess_popen):
        received = []
        result = run_ansible_playbook(
            INSTALL_PLAYBOOK, None, False, False, "Install",
            output_callback=lambda line: received.append(line),
        )
        # Streaming output path uses Popen
        assert mock_subprocess_popen.called


# ── _ensure_remote_inventory tests ──────────────────────────────────────

class TestEnsureRemoteInventory:
    def test_creates_inventory_file(self):
        path = _ensure_remote_inventory("pi@192.168.1.100")
        assert path.exists()
        content = path.read_text()
        assert "ansible_host: 192.168.1.100" in content
        assert "ansible_user: pi" in content
        # Cleanup
        path.unlink()

    def test_with_port(self):
        path = _ensure_remote_inventory("pi@192.168.1.100:2222")
        content = path.read_text()
        assert "ansible_port: 2222" in content
        path.unlink()

    def test_hostname_only(self):
        path = _ensure_remote_inventory("cnc")
        content = path.read_text()
        assert "ansible_host: cnc" in content
        path.unlink()


# ── _ssh_run tests ──────────────────────────────────────────────────────

class TestSshRun:
    def test_calls_subprocess_with_ssh(self, mock_subprocess_run):
        _ssh_run("cnc", "echo hello")
        args, kwargs = mock_subprocess_run.call_args
        assert "ssh" in args[0]
        assert "-o" in args[0]
        assert "cnc" in args[0]
        assert "echo hello" in args[0]


# ── Edge case tests ─────────────────────────────────────────────────────

class TestEdgeCases:
    @patch("_e3cnc_shared._get_remote_home")
    def test_check_status_remote_failure(self, mock_get_home):
        mock_get_home.return_value = "/home/user"
        with patch("_e3cnc_shared.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=1, stdout="", stderr="Connection refused"
            )
            ok_count, total, lines = check_status(remote_host="cnc")
        assert ok_count == 0

    def test_backup_dangling_symlink(self, mock_path_home):
        """Backup should handle dangling symlinks without crashing."""
        config = mock_path_home / "printer_data" / "config"
        config.mkdir(parents=True)
        (config / "moonraker.conf").write_text("[server]")
        # Create a dangling symlink
        os.symlink("/nonexistent/path", str(config / "broken.cfg"))

        result = run_backup()
        assert result.success is True

    def test_restore_empty_backup_dir(self, tmp_path):
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        result = run_restore(str(empty_dir))
        assert result.success is False

    def test_diagnose_with_remote(self, mock_subprocess_run):
        mock_subprocess_run.return_value = MagicMock(
            returncode=0, stdout="ready\n", stderr=""
        )
        result = run_diagnose(remote_host="pi@cnc")
        assert isinstance(result, CmdResult)


# ── Instance detection tests ────────────────────────────────────────────

class TestInstance:
    """Tests for multi-instance detection and selection."""

    def teardown_method(self):
        """Reset global active instance after each test."""
        set_active_instance(None)

    def test_instance_from_printer_data_default(self, tmp_path):
        """Instance.from_printer_data with a standard printer_data dir."""
        base = tmp_path / "printer_data"
        base.mkdir()
        inst = Instance.from_printer_data(str(base), home=str(tmp_path))
        assert inst.name == "cnc"
        assert inst.printer_data_dir == str(base)
        assert inst.config_dir == str(base / "config")
        assert inst.moonraker_conf == str(base / "config" / "moonraker.conf")
        assert inst.moonraker_log == str(base / "logs" / "moonraker.log")
        assert inst.scripts_dir == str(base / "scripts")
        assert inst.macros_dir == str(base / "config" / "macros")
        assert inst.E3CNC_dir == str(base / "config" / "E3CNC")
        assert inst.printer_cfg == str(base / "config" / "printer.cfg")
        assert inst.moonraker_dir == str(tmp_path / "moonraker")
        assert inst.klipper_dir == str(tmp_path / "klipper")
        assert inst.web_root == str(tmp_path / "mainsail")
        assert inst.moonraker_service == "moonraker"
        assert inst.klipper_service == "klipper"
        assert inst.moonraker_port == 7125

    def test_instance_prefers_e3cnc_web_root_when_present(self, tmp_path):
        """Fresh bootstrap installs should prefer the E3CNC web root over legacy mainsail paths."""
        base = tmp_path / "printer_data"
        base.mkdir()
        (tmp_path / "mainsail").mkdir()
        (tmp_path / "e3cnc-web").mkdir()

        inst = Instance.from_printer_data(str(base), home=str(tmp_path))
        assert inst.web_root == str(tmp_path / "e3cnc-web")

    def test_instance_from_kiauh_style_printer_data(self, tmp_path):
        """KIAUH-style printer_<name>_data should derive service names from the instance, not moonraker.asvc lists."""
        base = tmp_path / "printer_test1_data"
        (base / "config").mkdir(parents=True)
        (base / "systemd").mkdir(parents=True)
        (base / "config" / "moonraker.conf").write_text("[server]\nport: 7126\n")
        (base / "systemd" / "moonraker.env").write_text(
            f'MOONRAKER_ARGS="{tmp_path}/moonraker/moonraker/moonraker.py -d {base}"\n'
        )
        (base / "systemd" / "klipper.env").write_text(
            f'KLIPPER_ARGS="{tmp_path}/klipper/klippy/klippy.py {base}/config/printer.cfg -I {base}/comms/klippy.serial -l {base}/logs/klippy.log -a {base}/comms/klippy.sock"\n'
        )
        (base / "moonraker.asvc").write_text("klipper_mcu\nwebcamd\nMoonCord\n")

        inst = Instance.from_printer_data(str(base), home=str(tmp_path))
        assert inst.name == "test1"
        assert inst.moonraker_dir == str(tmp_path / "moonraker")
        assert inst.klipper_dir == str(tmp_path / "klipper")
        assert inst.web_root == str(tmp_path / "mainsail")
        assert inst.moonraker_service == "moonraker-test1"
        assert inst.klipper_service == "klipper-test1"
        assert inst.moonraker_port == 7126

    def test_instance_ignores_unrelated_single_line_moonraker_asvc(self, tmp_path):
        """A single non-service token in moonraker.asvc should not override the derived moonraker service name."""
        base = tmp_path / "printer_test2_data"
        (base / "config").mkdir(parents=True)
        (base / "systemd").mkdir(parents=True)
        (base / "config" / "moonraker.conf").write_text("[server]\nport: 7127\n")
        (base / "systemd" / "moonraker.env").write_text(
            f'MOONRAKER_ARGS="{tmp_path}/moonraker/moonraker/moonraker.py -d {base}"\n'
        )
        (base / "systemd" / "klipper.env").write_text(
            f'KLIPPER_ARGS="{tmp_path}/klipper/klippy/klippy.py {base}/config/printer.cfg -I {base}/comms/klippy.serial -l {base}/logs/klippy.log -a {base}/comms/klippy.sock"\n'
        )
        (base / "moonraker.asvc").write_text("klipper_mcu\n")

        inst = Instance.from_printer_data(str(base), home=str(tmp_path))
        assert inst.moonraker_service == "moonraker-test2"
        assert inst.klipper_service == "klipper-test2"
        assert inst.moonraker_port == 7127

    def test_instance_from_printer_data_second(self, tmp_path):
        """Legacy printer_data_2 naming still works."""
        base = tmp_path / "printer_data_2"
        base.mkdir()
        inst = Instance.from_printer_data(str(base), home=str(tmp_path))
        assert inst.name == "cnc_2"
        assert inst.moonraker_service == "moonraker-2"
        assert inst.klipper_service == "klipper-2"

    def test_detect_instances_single(self, tmp_path):
        """detect_instances with a single printer_data dir."""
        base = tmp_path / "printer_data"
        (base / "config").mkdir(parents=True)
        (base / "config" / "moonraker.conf").write_text("[server]\n")

        with patch("_e3cnc_shared.Path.home") as mock_home:
            mock_home.return_value = tmp_path
            with patch("_e3cnc_shared.INSTANCES_DIR", tmp_path / "e3cnc" / "instances"):
                instances = detect_instances()
                assert len(instances) == 1
                assert instances[0].name == "cnc"

    def test_detect_instances_multiple(self, tmp_path):
        """detect_instances should support default, legacy, and KIAUH-style dirs."""
        for name in ["printer_data", "printer_data_2", "printer_test1_data"]:
            base = tmp_path / name
            (base / "config").mkdir(parents=True)
            (base / "config" / "moonraker.conf").write_text("[server]\n")

        with patch("_e3cnc_shared.Path.home") as mock_home:
            mock_home.return_value = tmp_path
            with patch("_e3cnc_shared.INSTANCES_DIR", tmp_path / "e3cnc" / "instances"):
                instances = detect_instances()
                assert len(instances) == 3
                assert [inst.name for inst in instances] == ["cnc", "cnc_2", "test1"]

    def test_detect_instances_none(self, tmp_path):
        """detect_instances with no printer_data dirs."""
        with patch("_e3cnc_shared.Path.home") as mock_home:
            mock_home.return_value = tmp_path
            with patch("_e3cnc_shared.INSTANCES_DIR", tmp_path / "e3cnc" / "instances"):
                instances = detect_instances()
                assert len(instances) == 0

    def test_detect_instances_skips_missing_config(self, tmp_path):
        """Skip instance dirs that don't have a moonraker.conf."""
        (tmp_path / "printer_test1_data").mkdir()
        (tmp_path / "printer_test2_data" / "config").mkdir(parents=True)
        (tmp_path / "printer_test2_data" / "config" / "moonraker.conf").write_text("[server]")

        with patch("_e3cnc_shared.Path.home") as mock_home:
            mock_home.return_value = tmp_path
            with patch("_e3cnc_shared.INSTANCES_DIR", tmp_path / "e3cnc" / "instances"):
                instances = detect_instances()
                assert len(instances) == 1
                assert instances[0].name == "test2"

    def test_select_instance_single(self):
        """Single instance should be auto-selected without prompt."""
        inst = Instance(
            name="test",
            printer_data_dir="/tmp/test",
            config_dir="/tmp/test/config",
            moonraker_conf="/tmp/test/config/moonraker.conf",
            moonraker_log="/tmp/test/logs/moonraker.log",
            scripts_dir="/tmp/test/scripts",
            macros_dir="/tmp/test/config/macros",
            E3CNC_dir="/tmp/test/config/E3CNC",
            printer_cfg="/tmp/test/config/printer.cfg",
            web_root="/home/user/mainsail",
        )
        result = select_instance([inst])
        assert result is inst

    def test_select_instance_empty(self):
        """Empty list should return None."""
        assert select_instance([]) is None

    def test_get_active_instance_caching(self, tmp_path):
        """get_active_instance should cache the result."""
        # Setup: one instance exists
        base = tmp_path / "printer_data"
        (base / "config").mkdir(parents=True)
        (base / "config" / "moonraker.conf").write_text("[server]")

        with patch("_e3cnc_shared.Path.home") as mock_home:
            mock_home.return_value = tmp_path
            with patch("_e3cnc_shared.INSTANCES_DIR", tmp_path / "e3cnc" / "instances"):

                # First call should detect
                inst1 = get_active_instance()
                assert inst1 is not None
                assert inst1.name == "cnc"

                # Second call should return cached (no re-scan)
                inst2 = get_active_instance()
                assert inst2 is inst1

        # Cleanup
        set_active_instance(None)

    def test_set_active_instance(self):
        """set_active_instance should override the active instance."""
        inst = Instance(
            name="custom",
            printer_data_dir="/tmp/test",
            config_dir="/tmp/test/config",
            moonraker_conf="/tmp/test/config/moonraker.conf",
            moonraker_log="/tmp/test/logs/moonraker.log",
            scripts_dir="/tmp/test/scripts",
            macros_dir="/tmp/test/config/macros",
            E3CNC_dir="/tmp/test/config/E3CNC",
            printer_cfg="/tmp/test/config/printer.cfg",
            web_root="/home/user/mainsail",
        )
        set_active_instance(inst)
        result = get_active_instance()
        assert result is inst
        assert result.name == "custom"
        set_active_instance(None)

    def test_instance_extra_vars(self):
        """instance_extra_vars should generate correct Ansible vars."""
        inst = Instance(
            name="test2",
            printer_data_dir="/home/user/printer_test2_data",
            config_dir="/home/user/printer_test2_data/config",
            moonraker_conf="/home/user/printer_test2_data/config/moonraker.conf",
            moonraker_log="/home/user/printer_test2_data/logs/moonraker.log",
            scripts_dir="/home/user/printer_test2_data/scripts",
            macros_dir="/home/user/printer_test2_data/config/macros",
            E3CNC_dir="/home/user/printer_test2_data/config/E3CNC",
            printer_cfg="/home/user/printer_test2_data/config/printer.cfg",
            web_root="/home/user/mainsail",
            moonraker_dir="/home/user/moonraker",
            klipper_dir="/home/user/klipper",
            moonraker_service="moonraker-test2",
            klipper_service="klipper-test2",
            moonraker_port=7127,
        )
        vars = instance_extra_vars(inst)
        assert f"printer_data_dir={inst.printer_data_dir}" in vars
        assert f"moonraker_dir={inst.moonraker_dir}" in vars
        assert f"klipper_dir={inst.klipper_dir}" in vars
        assert f"moonraker_conf={inst.moonraker_conf}" in vars
        assert f"frontend_web_root={inst.web_root}" in vars
        assert f"moonraker_service={inst.moonraker_service}" in vars
        assert f"klipper_service={inst.klipper_service}" in vars
        assert f"moonraker_port={inst.moonraker_port}" in vars

    def test_instance_is_running(self, tmp_path):
        """is_running should be True when moonraker.conf exists."""
        base = tmp_path / "printer_data"
        (base / "config").mkdir(parents=True)
        (base / "config" / "moonraker.conf").write_text("[server]")
        inst = Instance.from_printer_data(str(base))
        assert inst.is_running is True

    def test_instance_not_running(self, tmp_path):
        """is_running should be False when moonraker.conf missing."""
        base = tmp_path / "printer_data"
        base.mkdir()
        inst = Instance.from_printer_data(str(base))
        assert inst.is_running is False


# ── Integration-style tests ─────────────────────────────────────────────

class TestIntegration:
    """Light integration tests that verify real file access."""

    def test_playbook_files_exist(self):
        for pb in [INSTALL_PLAYBOOK, DEPLOY_PLAYBOOK, UNINSTALL_PLAYBOOK, REDEPLOY_PLAYBOOK]:
            assert pb.exists(), f"Missing playbook: {pb}"

    def test_ansible_inventory_exists(self):
        assert LOCAL_INVENTORY.exists()
        assert (ANSIBLE_DIR / "vars" / "main.yml").exists()

    def test_shared_module_reexports(self):
        """Verify key functions are importable from the CLI wrapper module."""
        import importlib
        spec = importlib.util.spec_from_file_location(
            "e3cnc_cli",
            str(HERE / "e3cnc-cli"),
        )
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            for name in ["cmd_status", "cmd_check", "cmd_install", "cmd_deploy"]:
                assert hasattr(mod, name), f"Missing {name} in e3cnc-cli"
