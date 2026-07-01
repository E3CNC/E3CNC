"""Tests for _e3cnc_supervisor.py — supervisor process management."""

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

from _e3cnc_shared import Instance, INSTANCES_DIR


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def mock_instance() -> Instance:
    """A minimal Instance for supervisor tests."""
    base = INSTANCES_DIR / "testbox"
    data = base / "data"
    config = data / "config"
    return Instance(
        name="testbox",
        printer_data_dir=str(data),
        config_dir=str(config),
        moonraker_conf=str(config / "moonraker.conf"),
        moonraker_log=str(data / "logs" / "moonraker.log"),
        scripts_dir=str(data / "scripts"),
        macros_dir=str(config / "E3CNC" / "macros"),
        E3CNC_dir=str(config / "E3CNC"),
        printer_cfg=str(config / "printer.cfg"),
        web_root=str(base / "frontend"),
    )


@pytest.fixture(autouse=True)
def _patch_sudo():
    """Prevent actual sudo calls in tests."""
    with patch("_e3cnc_shared._ensure_local_sudo_access"):
        yield


# ── _has_supervisor ──────────────────────────────────────────────────────


class TestHasSupervisor:
    def test_returns_true_when_which_finds_supervisorctl(self):
        from _e3cnc_supervisor import _has_supervisor
        with patch("_e3cnc_supervisor.shutil.which", return_value="/usr/bin/supervisorctl"):
            assert _has_supervisor() is True

    def test_returns_false_when_supervisorctl_not_found(self):
        from _e3cnc_supervisor import _has_supervisor
        with patch("_e3cnc_supervisor.shutil.which", return_value=None):
            assert _has_supervisor() is False


# ── _run_supervisorctl ──────────────────────────────────────────────────


class TestRunSupervisorctl:
    def test_runs_sudo_supervisorctl_with_args(self):
        from _e3cnc_supervisor import _run_supervisorctl
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        with patch("_e3cnc_supervisor.subprocess.run", return_value=mock_proc) as mock_run:
            _run_supervisorctl("status", "e3cnc-test-moonraker")
            mock_run.assert_called_once_with(
                ["sudo", "supervisorctl", "status", "e3cnc-test-moonraker"],
                capture_output=True, text=True, timeout=60,
            )

    def test_returns_subprocess_result(self):
        from _e3cnc_supervisor import _run_supervisorctl
        mock_proc = MagicMock(returncode=0, stdout="RUNNING", stderr="")
        with patch("_e3cnc_supervisor.subprocess.run", return_value=mock_proc):
            result = _run_supervisorctl("status", "e3cnc-test")
            assert result.returncode == 0
            assert result.stdout == "RUNNING"


# ── _ensure_sudo ─────────────────────────────────────────────────────────


class TestGetReleaseVendorDir:
    def test_returns_vendor_path_when_current_symlink_exists(self, tmp_path):
        from _e3cnc_supervisor import _get_release_vendor_dir
        link = tmp_path / "current"
        vendor_dir = tmp_path / "v0.9.0" / "vendor"
        vendor_dir.mkdir(parents=True)
        link.symlink_to(tmp_path / "v0.9.0")

        with patch("_e3cnc_supervisor.CURRENT_LINK", link):
            result = _get_release_vendor_dir()
            assert result == vendor_dir

    def test_returns_none_when_no_symlink(self, tmp_path):
        from _e3cnc_supervisor import _get_release_vendor_dir
        link = tmp_path / "nonexistent"
        with patch("_e3cnc_supervisor.CURRENT_LINK", link):
            assert _get_release_vendor_dir() is None


# ── _generate_config ─────────────────────────────────────────────────────


class TestGenerateConfig:
    def test_includes_instance_name_and_paths(self, mock_instance):
        from _e3cnc_supervisor import _generate_config
        with patch("_e3cnc_supervisor._get_release_vendor_dir", return_value=None):
            config = _generate_config(mock_instance)
        assert f"e3cnc-{mock_instance.name}-moonraker" in config
        assert f"e3cnc-{mock_instance.name}-klipper" in config
        assert mock_instance.name in config
        assert str(mock_instance.moonraker_conf) in config

    def test_uses_vendor_paths_when_release_symlink_exists(self, mock_instance, tmp_path):
        from _e3cnc_supervisor import _generate_config
        vendor = tmp_path / "vendor"
        vendor.mkdir()
        (vendor / "moonraker").mkdir(parents=True)
        (vendor / "klipper").mkdir(parents=True)
        moonraker_py = vendor / "moonraker" / "moonraker" / "moonraker.py"
        moonraker_py.parent.mkdir(parents=True)
        moonraker_py.write_text("")
        klipper_py = vendor / "klipper" / "klippy" / "klippy.py"
        klipper_py.parent.mkdir(parents=True)
        klipper_py.write_text("")

        with patch("_e3cnc_supervisor._get_release_vendor_dir", return_value=vendor):
            config = _generate_config(mock_instance)
        assert str(moonraker_py) in config
        assert str(klipper_py) in config


# ── _config_path ─────────────────────────────────────────────────────────


class TestConfigPath:
    def test_returns_expected_path(self, mock_instance):
        from _e3cnc_supervisor import _config_path, SUPERVISOR_CONF_DIR
        path = _config_path(mock_instance)
        assert path == SUPERVISOR_CONF_DIR / f"e3cnc-{mock_instance.name}.conf"


# ── install_supervisor ──────────────────────────────────────────────────


class TestInstallSupervisor:
    def test_returns_true_when_already_installed(self):
        from _e3cnc_supervisor import install_supervisor
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor.ok"):
                assert install_supervisor() is True

    def test_installs_via_apt(self):
        from _e3cnc_supervisor import install_supervisor
        with patch("_e3cnc_supervisor._has_supervisor", side_effect=[False, True]):
            with patch("_e3cnc_supervisor.subprocess.run") as mock_run:
                with patch("_e3cnc_supervisor.ok"):
                    assert install_supervisor() is True
                    mock_run.assert_called_once_with(
                        ["sudo", "apt-get", "install", "-y", "supervisor"],
                        check=True, capture_output=True, timeout=120,
                    )

    def test_returns_false_on_failure(self):
        from _e3cnc_supervisor import install_supervisor
        with patch("_e3cnc_supervisor._has_supervisor", side_effect=[False, False]):
            with patch("_e3cnc_supervisor.subprocess.run", side_effect=OSError("no apt")):
                with patch("_e3cnc_supervisor.warn"):
                    assert install_supervisor() is False


# ── register_instance ───────────────────────────────────────────────────


class TestRegisterInstance:
    def test_skips_when_supervisor_not_installed(self, mock_instance):
        from _e3cnc_supervisor import register_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=False):
            with patch("_e3cnc_supervisor.warn") as mock_warn:
                assert register_instance(mock_instance) is False
                mock_warn.assert_called_once()

    def test_writes_config_and_starts_services(self, mock_instance):
        from _e3cnc_supervisor import register_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor.subprocess.Popen") as mock_popen:
                proc = MagicMock()
                proc.returncode = 0
                proc.communicate.return_value = (b"", b"")
                mock_popen.return_value = proc
                with patch("_e3cnc_supervisor._run_supervisorctl"):
                    with patch("_e3cnc_supervisor.ok"):
                        assert register_instance(mock_instance) is True
                        assert mock_popen.called

    def test_returns_false_when_tee_fails(self, mock_instance):
        from _e3cnc_supervisor import register_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor.subprocess.Popen") as mock_popen:
                proc = MagicMock()
                proc.returncode = 1
                proc.communicate.return_value = (b"", b"permission denied")
                mock_popen.return_value = proc
                with patch("_e3cnc_supervisor.warn"):
                    assert register_instance(mock_instance) is False

    def test_handles_oserror_on_write(self, mock_instance):
        from _e3cnc_supervisor import register_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor.subprocess.Popen", side_effect=OSError("no sudo")):
                with patch("_e3cnc_supervisor.warn"):
                    assert register_instance(mock_instance) is False


# ── unregister_instance ─────────────────────────────────────────────────


class TestUnregisterInstance:
    def test_returns_true_when_no_supervisor(self, mock_instance):
        from _e3cnc_supervisor import unregister_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=False):
            assert unregister_instance(mock_instance) is True

    def test_stops_and_removes_config(self, mock_instance):
        from _e3cnc_supervisor import unregister_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._run_supervisorctl") as mock_ctl:
                with patch("_e3cnc_supervisor.subprocess.run") as mock_run:
                    with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                        mock_cfg.return_value.exists.return_value = True
                        with patch("_e3cnc_supervisor.ok"):
                            assert unregister_instance(mock_instance) is True
                            mock_ctl.assert_has_calls([
                                call("stop", f"e3cnc-{mock_instance.name}:*"),
                                call("reread"),
                                call("update"),
                            ])
                            mock_run.assert_called_once()

    def test_handles_rm_failure(self, mock_instance):
        from _e3cnc_supervisor import unregister_instance
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._run_supervisorctl"):
                with patch("_e3cnc_supervisor.subprocess.run",
                           side_effect=OSError("rm failed")):
                    with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                        mock_cfg.return_value.exists.return_value = True
                        with patch("_e3cnc_supervisor.warn"):
                            assert unregister_instance(mock_instance) is True


# ── restart_services ────────────────────────────────────────────────────


class TestRestartServices:
    def test_warns_when_no_supervisor(self, mock_instance):
        from _e3cnc_supervisor import restart_services
        with patch("_e3cnc_supervisor._has_supervisor", return_value=False):
            with patch("_e3cnc_supervisor.warn") as mock_warn:
                assert restart_services(mock_instance) is False
                mock_warn.assert_called_once()

    def test_registers_if_config_missing_then_skips_restart(self, mock_instance):
        """If we just registered (config was missing), services already started."""
        from _e3cnc_supervisor import restart_services
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                mock_cfg.return_value.exists.return_value = False
                with patch("_e3cnc_supervisor.register_instance", return_value=True) as mock_reg:
                    with patch("_e3cnc_supervisor.ok"):
                        assert restart_services(mock_instance) is True
                        mock_reg.assert_called_once_with(mock_instance)

    def test_registration_failure_returns_false(self, mock_instance):
        from _e3cnc_supervisor import restart_services
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                mock_cfg.return_value.exists.return_value = False
                with patch("_e3cnc_supervisor.register_instance", return_value=False):
                    with patch("_e3cnc_supervisor.warn"):
                        assert restart_services(mock_instance) is False

    def test_restarts_both_services_when_config_exists(self, mock_instance):
        from _e3cnc_supervisor import restart_services
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor._config_path") as mock_cfg:
                mock_cfg.return_value.exists.return_value = True
                with patch("_e3cnc_supervisor._run_supervisorctl") as mock_ctl:
                    def _ok_result(*args):
                        r = MagicMock()
                        r.returncode = 0
                        return r
                    mock_ctl.side_effect = _ok_result
                    with patch("_e3cnc_supervisor.ok"):
                        assert restart_services(mock_instance) is True
                        mock_ctl.assert_any_call("restart", f"e3cnc-{mock_instance.name}-moonraker")
                        mock_ctl.assert_any_call("restart", f"e3cnc-{mock_instance.name}-klipper")


# ── service_status ──────────────────────────────────────────────────────


class TestServiceStatus:
    def test_returns_dict_with_running_and_output(self, mock_instance):
        from _e3cnc_supervisor import service_status
        mock_proc = MagicMock(returncode=0, stdout="RUNNING e3cnc-testbox-moonraker", stderr="")
        with patch("_e3cnc_supervisor._run_supervisorctl", return_value=mock_proc):
            status = service_status(mock_instance)
            assert f"e3cnc-{mock_instance.name}-moonraker" in status
            assert status[f"e3cnc-{mock_instance.name}-moonraker"]["running"] is True

    def test_reports_not_running(self, mock_instance):
        from _e3cnc_supervisor import service_status
        mock_proc = MagicMock(returncode=3, stdout="STOPPED", stderr="")
        with patch("_e3cnc_supervisor._run_supervisorctl", return_value=mock_proc):
            status = service_status(mock_instance)
            assert status[f"e3cnc-{mock_instance.name}-moonraker"]["running"] is False


# ── update_service_paths ────────────────────────────────────────────────


class TestUpdateServicePaths:
    def test_returns_true_when_no_supervisor(self, mock_instance):
        from _e3cnc_supervisor import update_service_paths
        with patch("_e3cnc_supervisor._has_supervisor", return_value=False):
            assert update_service_paths(mock_instance) is True

    def test_calls_register_instance_when_supervisor_present(self, mock_instance):
        from _e3cnc_supervisor import update_service_paths
        with patch("_e3cnc_supervisor._has_supervisor", return_value=True):
            with patch("_e3cnc_supervisor.register_instance") as mock_reg:
                with patch("_e3cnc_supervisor.info"):
                    assert update_service_paths(mock_instance) is True
                    mock_reg.assert_called_once_with(mock_instance)
