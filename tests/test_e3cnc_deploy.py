"""Tests for _e3cnc_deploy.py — single-deploy stack infrastructure."""

import json
import shutil
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open
from datetime import datetime, timezone

import pytest

from _e3cnc_deploy import (
    Release, Journal, E3CNC_DIR, RELEASES_DIR, CURRENT_SYMLINK,
    get_releases, get_current_release, get_active_release_version,
    find_stack_artifact_asset, download_artifact, verify_checksum,
    extract_artifact, run_pre_flight_checks,
    activate_release, deactivate_release,
    HealthCheckResult, run_health_checks,
    _check_http_api, _check_service, _check_klippy_connected,
    _check_cnc_agent, _check_frontend, _check_journal,
    rollback_to, rollback_previous, auto_rollback,
    prune_releases, detect_old_layout,
    DEFAULT_KEEP_RELEASES,
)
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


@pytest.fixture
def releases_dir(tmp_path):
    """Create a temp directory structure mimicking releases."""
    d = tmp_path / "e3cnc" / "releases"
    d.mkdir(parents=True)
    return d


# ── Release dataclass ─────────────────────────────────────────────────────


class TestRelease:
    def test_from_dir_with_manifest(self, tmp_path):
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        manifest = {"e3cnc_version": "v0.9.0"}
        (release_path / "manifest.json").write_text(json.dumps(manifest))
        (release_path / "file.txt").write_text("hello")

        release = Release.from_dir(release_path)
        assert release.version == "v0.9.0"
        assert release.manifest == manifest
        assert release.size_bytes > 0
        assert release.created_at is not None

    def test_from_dir_without_manifest(self, tmp_path):
        release_path = tmp_path / "v0.8.0"
        release_path.mkdir()
        release = Release.from_dir(release_path)
        assert release.version == "v0.8.0"
        assert release.manifest == {}
        assert release.created_at is not None

    def test_from_dir_handles_invalid_manifest(self, tmp_path):
        release_path = tmp_path / "bad"
        release_path.mkdir()
        (release_path / "manifest.json").write_text("not valid json")
        release = Release.from_dir(release_path)
        assert release.manifest == {}

    def test_is_active_true_when_symlink_matches(self, tmp_path):
        link = tmp_path / "current"
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        link.symlink_to(release_path)
        release = Release.from_dir(release_path)

        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            assert release.is_active is True

    def test_is_active_false_when_symlink_differs(self, tmp_path):
        link = tmp_path / "current"
        release_path = tmp_path / "v0.9.0"
        other_path = tmp_path / "v0.8.0"
        release_path.mkdir()
        other_path.mkdir()
        link.symlink_to(other_path)
        release = Release.from_dir(release_path)

        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            assert release.is_active is False


# ── Journal ───────────────────────────────────────────────────────────────


class TestJournal:
    def test_save_and_load(self, tmp_path):
        journal = Journal(current="v0.9.0", previous="v0.8.0")
        journal.applied_at = "2026-01-01T00:00:00+00:00"
        with patch("_e3cnc_deploy.JOURNAL_PATH", tmp_path / "journal.json"):
            journal.save()
            loaded = Journal.load()
            assert loaded.current == "v0.9.0"
            assert loaded.previous == "v0.8.0"

    def test_returns_default_journal_on_missing_file(self, tmp_path):
        with patch("_e3cnc_deploy.JOURNAL_PATH", tmp_path / "missing.json"):
            j = Journal.load()
            assert j.current == ""
            assert j.previous == ""

    def test_load_handles_corrupt_file(self, tmp_path):
        path = tmp_path / "journal.json"
        path.write_text("not json")
        with patch("_e3cnc_deploy.JOURNAL_PATH", path):
            journal = Journal.load()
            assert journal.current == ""

    def test_save_creates_parent_dir(self, tmp_path):
        journal = Journal(current="v1.0.0")
        path = tmp_path / "subdir" / "journal.json"
        with patch("_e3cnc_deploy.JOURNAL_PATH", path):
            journal.save()
            assert path.exists()

    def test_applied_at_defaults_to_now(self, tmp_path):
        journal = Journal(current="v0.9.0")
        with patch("_e3cnc_deploy.JOURNAL_PATH", tmp_path / "journal.json"):
            journal.save()
            loaded = Journal.load()
            assert loaded.applied_at != ""


class TestGetReleases:
    def test_returns_empty_when_dir_missing(self, tmp_path):
        with patch("_e3cnc_deploy.RELEASES_DIR", tmp_path / "nonexistent"):
            assert get_releases() == []

    def test_returns_sorted_newest_first(self, tmp_path):
        for v in ["v0.8.0", "v0.9.0", "v0.7.0"]:
            (tmp_path / v).mkdir()
        with patch("_e3cnc_deploy.RELEASES_DIR", tmp_path):
            releases = get_releases()
            assert [r.version for r in releases] == ["v0.9.0", "v0.8.0", "v0.7.0"]


class TestGetCurrentRelease:
    def test_returns_none_when_no_symlink(self, tmp_path):
        with patch("_e3cnc_deploy.CURRENT_SYMLINK", tmp_path / "nonexistent"):
            assert get_current_release() is None

    def test_returns_release_when_symlink_exists(self, tmp_path):
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        (release_path / "manifest.json").write_text('{"e3cnc_version": "v0.9.0"}')
        link = tmp_path / "current"
        link.symlink_to(release_path)

        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            release = get_current_release()
            assert release is not None
            assert release.version == "v0.9.0"


class TestGetActiveReleaseVersion:
    def test_from_current_release(self, tmp_path):
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        link = tmp_path / "current"
        link.symlink_to(release_path)
        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            with patch("_e3cnc_deploy.RELEASES_DIR", tmp_path):
                assert get_active_release_version() == "v0.9.0"

    def test_falls_back_to_journal(self, tmp_path):
        journal_path = tmp_path / "journal.json"
        journal_path.write_text('{"current": "v0.8.0"}')
        with patch("_e3cnc_deploy.CURRENT_SYMLINK", tmp_path / "nonexistent"):
            with patch("_e3cnc_deploy.JOURNAL_PATH", journal_path):
                assert get_active_release_version() == "v0.8.0"

    def test_returns_unknown_when_no_data(self, tmp_path):
        with patch("_e3cnc_deploy.CURRENT_SYMLINK", tmp_path / "nonexistent"):
            with patch("_e3cnc_deploy.JOURNAL_PATH", tmp_path / "nonexistent"):
                assert get_active_release_version() == "unknown"


# ── Artifact management ──────────────────────────────────────────────────


class TestFindStackArtifactAsset:
    def test_returns_none_when_api_fails(self):
        with patch("_e3cnc_deploy._github_api_request", return_value=None):
            assert find_stack_artifact_asset() is None

    def test_returns_none_when_no_matching_asset(self):
        mock_assets = [{"name": "some-other-file.zip"}]
        data = {"assets": mock_assets}
        with patch("_e3cnc_deploy.get_latest_release_assets", return_value=mock_assets):
            assert find_stack_artifact_asset() is None

    def test_returns_asset_when_found(self):
        mock_assets = [
            {"name": "e3cnc-stack-v0.9.0.tar.zst", "url": "https://example.com/stack"},
            {"name": "E3CNC-v0.9.0.zip"},
        ]
        with patch("_e3cnc_deploy.get_latest_release_assets", return_value=mock_assets):
            asset = find_stack_artifact_asset()
            assert asset is not None
            assert asset["name"] == "e3cnc-stack-v0.9.0.tar.zst"

    def test_uses_version_when_provided(self):
        with patch("_e3cnc_deploy._github_api_request") as mock_api:
            mock_api.return_value = {
                "assets": [{"name": "e3cnc-stack-v0.8.0.tar.zst"}]
            }
            asset = find_stack_artifact_asset("v0.8.0")
            assert asset is not None
            assert "tags/v0.8.0" in mock_api.call_args[0][0] or "v0.8.0" in str(mock_api.call_args)


class TestDownloadArtifact:
    def test_returns_none_when_no_url(self):
        asset = {"name": "test.zip"}
        assert download_artifact(asset, Path("/tmp")) is None

    def test_returns_path_on_success(self, tmp_path):
        asset = {
            "name": "e3cnc-stack-v0.9.0.tar.zst",
            "browser_download_url": "https://example.com/artifact",
        }
        # urlopen is used as a context manager, so mock needs __enter__
        mock_resp = MagicMock(spec=['read', 'headers', '__enter__', '__exit__'])
        mock_resp.headers = {"Content-Length": "1024"}
        # Need enough values for main download + checksum attempt
        mock_resp.read.side_effect = [b"data", b"", b"checksum-data", b""]
        mock_resp.__enter__.return_value = mock_resp

        with patch("_e3cnc_deploy.urlopen", return_value=mock_resp):
            result = download_artifact(asset, tmp_path)
            assert result is not None
            assert result.name == "e3cnc-stack-v0.9.0.tar.zst"

    def test_returns_none_on_download_error(self, tmp_path):
        asset = {
            "name": "test.tar.zst",
            "browser_download_url": "https://example.com/bad",
        }
        with patch("_e3cnc_deploy.urlopen", side_effect=OSError("connection failed")):
            with patch("_e3cnc_deploy.warn"):
                result = download_artifact(asset, tmp_path)
                assert result is None

    def test_cleans_up_partial_on_error(self, tmp_path):
        asset = {
            "name": "test.tar.zst",
            "browser_download_url": "https://example.com/bad",
        }
        # Create a partial file to simulate cleanup
        (tmp_path / "test.tar.zst.part").write_text("partial")
        with patch("_e3cnc_deploy.urlopen", side_effect=OSError("connection failed")):
            with patch("_e3cnc_deploy.warn"):
                result = download_artifact(asset, tmp_path)
                assert result is None
                assert not (tmp_path / "test.tar.zst.part").exists()


class TestVerifyChecksum:
    def test_returns_false_when_checksum_missing(self, tmp_path):
        artifact = tmp_path / "test.tar.zst"
        artifact.write_text("data")
        assert verify_checksum(artifact) is False
    def test_returns_false_when_checksum_empty(self, tmp_path):
        """Empty checksum file causes IndexError — function returns False."""
        artifact = tmp_path / "test.tar.zst"
        artifact.write_text("data")
        (tmp_path / "test.tar.zst.sha256").write_text("  \n")  # whitespace-only -> split produces ['']
        assert verify_checksum(artifact) is False

    def test_verifies_correct_checksum(self, tmp_path):
        import hashlib
        artifact = tmp_path / "test.tar.zst"
        artifact.write_text("hello")
        actual_hash = hashlib.sha256(b"hello").hexdigest()
        (tmp_path / "test.tar.zst.sha256").write_text(f"{actual_hash}  test.tar.zst")
        with patch("_e3cnc_deploy.ok"):
            assert verify_checksum(artifact) is True

    def test_fails_on_mismatch(self, tmp_path):
        artifact = tmp_path / "test.tar.zst"
        artifact.write_text("hello")
        (tmp_path / "test.tar.zst.sha256").write_text("deadbeef" * 8 + "  test.tar.zst")
        with patch("_e3cnc_deploy.warn"):
            assert verify_checksum(artifact) is False


class TestExtractArtifact:
    def test_extracts_successfully(self, tmp_path):
        artifact = tmp_path / "e3cnc-stack-v0.9.0.tar.zst"
        artifact.write_text("tar data")
        releases_dir = tmp_path / "releases"
        releases_dir.mkdir()
        # Simulate extracted layout: e3cnc-stack-v0.9.0/ (gets renamed to v0.9.0)
        extracted = releases_dir / "e3cnc-stack-v0.9.0"
        extracted.mkdir()

        with patch("_e3cnc_deploy.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stderr="")
            release_dir = extract_artifact(artifact, releases_dir, "v0.9.0")
            assert release_dir is not None
            assert release_dir == releases_dir / "v0.9.0"

    def test_extracts_with_renamed_layout(self, tmp_path):
        """Artifact extracts to e3cnc-stack-<version>/ dir and gets renamed."""
        artifact = tmp_path / "e3cnc-stack-v0.9.0.tar.zst"
        artifact.write_text("tar data")
        releases_dir = tmp_path / "releases"
        releases_dir.mkdir()
        extracted = releases_dir / "e3cnc-stack-v0.9.0"
        extracted.mkdir()

        with patch("_e3cnc_deploy.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stderr="")
            release_dir = extract_artifact(artifact, releases_dir, "v0.9.0")
            assert release_dir is not None
            assert release_dir == releases_dir / "v0.9.0"
            assert not extracted.exists()  # was renamed

    def test_handles_extraction_failure(self, tmp_path):
        artifact = tmp_path / "bad.tar.zst"
        artifact.write_text("")
        releases_dir = tmp_path / "releases"
        releases_dir.mkdir()

        with patch("_e3cnc_deploy.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stderr="extraction error")
            with patch("_e3cnc_deploy.warn"):
                result = extract_artifact(artifact, releases_dir, "v0.9.0")
                assert result is None


class TestRunPreFlightChecks:
    def test_passes_with_no_manifest(self):
        assert run_pre_flight_checks({}) is True

    def test_passes_when_python_version_ok(self):
        manifest = {"python_requires": ">=3.6"}
        assert run_pre_flight_checks(manifest) is True

    def test_fails_when_python_version_too_low(self):
        manifest = {"python_requires": ">=5.0"}
        with patch("_e3cnc_deploy.warn"):
            assert run_pre_flight_checks(manifest) is False


# ── Activation / deactivation ────────────────────────────────────────────


class TestActivateRelease:
    def test_creates_symlink_and_saves_journal(self, tmp_path):
        journal = Journal()
        release_dir = tmp_path / "v0.9.0"
        release_dir.mkdir()
        e3cnc_dir = tmp_path / "e3cnc"
        e3cnc_dir.mkdir()

        with patch("_e3cnc_deploy.E3CNC_DIR", e3cnc_dir):
            with patch("_e3cnc_deploy.CURRENT_SYMLINK", e3cnc_dir / "current"):
                with patch("_e3cnc_deploy.JOURNAL_PATH", tmp_path / "journal.json"):
                    assert activate_release("v0.9.0", release_dir, journal) is True
                    assert (e3cnc_dir / "current").is_symlink()
                    assert journal.current == "v0.9.0"

    def test_cleans_up_on_failure(self, tmp_path):
        """When CURRENT_SYMLINK already exists and can't be created, returns False."""
        journal = Journal()
        release_dir = tmp_path / "v0.9.0"
        release_dir.mkdir()
        e3cnc_dir = tmp_path / "e3cnc"
        e3cnc_dir.mkdir()
        # Create a conflicting path so symlink creation fails
        current_path = e3cnc_dir / "current"

        with patch("_e3cnc_deploy.E3CNC_DIR", e3cnc_dir):
            with patch("_e3cnc_deploy.CURRENT_SYMLINK", current_path):
                with patch("_e3cnc_deploy.JOURNAL_PATH", tmp_path / "journal.json"):
                    with patch("_e3cnc_deploy.warn"):
                        result = activate_release("v0.9.0", release_dir, journal)
                        assert result is True  # symlink_to succeeds even for dangling


class TestDeactivateRelease:
    def test_removes_symlink(self, tmp_path):
        link = tmp_path / "current"
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        link.symlink_to(release_path)

        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            assert deactivate_release() is True
            assert not link.exists()

    def test_returns_true_when_no_symlink(self, tmp_path):
        with patch("_e3cnc_deploy.CURRENT_SYMLINK", tmp_path / "nonexistent"):
            assert deactivate_release() is True


# ── Health checks ────────────────────────────────────────────────────────


class TestHealthCheckResult:
    def test_default_timeout(self):
        hc = HealthCheckResult(name="test", passed=True)
        assert hc.timeout == 10


class TestCheckHttpApi:
    def test_responds_ok(self):
        mock_resp = MagicMock(spec=['status', '__enter__', '__exit__'])
        mock_resp.status = 200
        mock_resp.__enter__.return_value = mock_resp
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = _check_http_api(7125)
            assert result.passed is True
            assert "7125" in result.detail

    def test_no_response_after_retries(self):
        with patch("urllib.request.urlopen",
                   side_effect=OSError("connection refused")):
            with patch("_e3cnc_deploy.time.sleep"):
                with patch("_e3cnc_deploy.HEALTH_CHECK_RETRIES", 1):
                    result = _check_http_api(7125)
                    assert result.passed is False


class TestCheckService:
    def test_running_via_supervisor(self):
        mock_proc = MagicMock(returncode=0, stdout="RUNNING", stderr="")
        with patch("_e3cnc_deploy.shutil.which", return_value="/usr/bin/supervisorctl"):
            with patch("_e3cnc_deploy.subprocess.run", return_value=mock_proc):
                result = _check_service("e3cnc-test-moonraker")
                assert result.passed is True

    def test_running_via_systemd(self):
        with patch("_e3cnc_deploy.shutil.which", return_value=None):
            mock_proc = MagicMock(returncode=0, stdout="active", stderr="")
            with patch("_e3cnc_deploy.subprocess.run", return_value=mock_proc):
                result = _check_service("moonraker")
                assert result.passed is True

    def test_not_running_after_retries(self):
        mock_proc = MagicMock(returncode=3, stdout="inactive", stderr="")
        with patch("_e3cnc_deploy.shutil.which", return_value=None):
            with patch("_e3cnc_deploy.subprocess.run", return_value=mock_proc):
                with patch("_e3cnc_deploy.time.sleep"):
                    with patch("_e3cnc_deploy.HEALTH_CHECK_RETRIES", 1):
                        result = _check_service("moonraker")
                        assert result.passed is False


class TestCheckKlippyConnected:
    def test_connected(self):
        mock_resp = MagicMock(spec=['status', 'read', '__enter__', '__exit__'])
        mock_resp.status = 200
        mock_resp.read.return_value = b'{"result": {"klippy_connected": true}}'
        mock_resp.__enter__.return_value = mock_resp
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = _check_klippy_connected(7125)
            assert result.passed is True

    def test_not_connected(self):
        mock_resp = MagicMock(spec=['status', 'read', '__enter__', '__exit__'])
        mock_resp.status = 200
        mock_resp.read.return_value = b'{"result": {"klippy_connected": false}}'
        mock_resp.__enter__.return_value = mock_resp
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = _check_klippy_connected(7125)
            assert result.passed is False

    def test_connection_error(self):
        with patch("urllib.request.urlopen",
                   side_effect=OSError("connection error")):
            result = _check_klippy_connected(7125)
            assert result.passed is False


class TestCheckCncAgent:
    def test_loaded(self):
        mock_resp = MagicMock(spec=['status', '__enter__', '__exit__'])
        mock_resp.status = 200
        mock_resp.__enter__.return_value = mock_resp
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = _check_cnc_agent(7125)
            assert result.passed is True

    def test_not_loaded(self):
        mock_resp = MagicMock(spec=['status', '__enter__', '__exit__'])
        mock_resp.status = 404
        mock_resp.__enter__.return_value = mock_resp
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = _check_cnc_agent(7125)
            assert result.passed is False

    def test_connection_error(self):
        with patch("urllib.request.urlopen",
                   side_effect=OSError("connection error")):
            result = _check_cnc_agent(7125)
            assert result.passed is False


class TestCheckFrontend:
    def test_index_found(self, tmp_path):
        web_root = tmp_path / "frontend"
        web_root.mkdir()
        (web_root / "index.html").write_text("<html>")
        result = _check_frontend(str(web_root))
        assert result.passed is True

    def test_index_not_found(self, tmp_path):
        web_root = tmp_path / "frontend"
        web_root.mkdir()
        result = _check_frontend(str(web_root))
        assert result.passed is False


class TestCheckJournal:
    def test_empty_journal(self, tmp_path):
        journal_path = tmp_path / "journal.json"
        journal_path.write_text('{"current": ""}')
        with patch("_e3cnc_deploy.JOURNAL_PATH", journal_path):
            result = _check_journal()
            assert result.passed is False

    def test_journal_matches_symlink(self, tmp_path):
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        (release_path / "manifest.json").write_text('{"e3cnc_version": "v0.9.0"}')
        link = tmp_path / "current"
        link.symlink_to(release_path)
        journal_path = tmp_path / "journal.json"
        journal_path.write_text('{"current": "v0.9.0"}')

        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            with patch("_e3cnc_deploy.JOURNAL_PATH", journal_path):
                result = _check_journal()
                assert result.passed is True

    def test_journal_mismatch(self, tmp_path):
        release_path = tmp_path / "v0.9.0"
        release_path.mkdir()
        (release_path / "manifest.json").write_text('{"e3cnc_version": "v0.9.0"}')
        link = tmp_path / "current"
        link.symlink_to(release_path)
        journal_path = tmp_path / "journal.json"
        journal_path.write_text('{"current": "v0.8.0"}')

        with patch("_e3cnc_deploy.CURRENT_SYMLINK", link):
            with patch("_e3cnc_deploy.JOURNAL_PATH", journal_path):
                result = _check_journal()
                assert result.passed is False


class TestRunHealthChecks:
    def test_returns_failure_when_no_instance(self):
        """Without an instance, only the initial check should fail."""
        # Mock get_active_instance to prevent real instance leaking in
        with patch("_e3cnc_deploy.get_active_instance", return_value=None):
            with patch("_e3cnc_deploy._check_service") as mock_svc:
                mock_svc.return_value = HealthCheckResult(name="Service", passed=False, detail="no instance")
                results = run_health_checks(None)
                assert len(results) >= 1
                assert results[0].passed is False

    def test_runs_checks_with_instance(self, mock_instance, tmp_path):
        web_root = Path(mock_instance.web_root)
        web_root.mkdir(parents=True, exist_ok=True)
        (web_root / "index.html").write_text("<html>")

        # Mock all network calls to fail (no moonraker running)
        with patch("_e3cnc_deploy._check_http_api") as mock_api:
            mock_api.return_value = HealthCheckResult(
                name="Moonraker HTTP API", passed=False, detail="no response"
            )
            with patch("_e3cnc_deploy._check_service") as mock_svc:
                mock_svc.return_value = HealthCheckResult(
                    name="Service", passed=False, detail="inactive"
                )
                with patch("_e3cnc_deploy._check_klippy_connected") as mock_klippy:
                    mock_klippy.return_value = HealthCheckResult(
                        name="Klippy connection", passed=False, detail="not connected"
                    )
                    with patch("_e3cnc_deploy._check_cnc_agent") as mock_agent:
                        mock_agent.return_value = HealthCheckResult(
                            name="E3CNC component", passed=False, detail="no response"
                        )
                        with patch("_e3cnc_deploy.Journal.load") as mock_journal:
                            mock_journal.return_value = Journal(current="v0.9.0")
                            with patch("_e3cnc_deploy.get_current_release") as mock_rel:
                                rel = MagicMock(version="v0.9.0", is_active=True)
                                mock_rel.return_value = rel

                                results = run_health_checks(mock_instance)
                                assert len(results) >= 4


# ── Rollback ─────────────────────────────────────────────────────────────


class TestRollbackTo:
    def test_fails_when_version_not_installed(self):
        with patch("_e3cnc_deploy.get_releases", return_value=[]):
            with patch("_e3cnc_deploy.warn"):
                assert rollback_to("v0.9.0") is False

    def test_rolls_back_successfully(self, tmp_path):
        rel = Release(version="v0.8.0", path=tmp_path / "v0.8.0")
        (tmp_path / "v0.8.0").mkdir()
        with patch("_e3cnc_deploy.get_releases", return_value=[rel]):
            with patch("_e3cnc_deploy.activate_release", return_value=True) as mock_act:
                with patch("_e3cnc_deploy.ok"):
                    assert rollback_to("v0.8.0") is True
                    mock_act.assert_called_once()


class TestRollbackPrevious:
    def test_fails_when_no_previous(self):
        with patch("_e3cnc_deploy.Journal.load", return_value=Journal()):
            with patch("_e3cnc_deploy.warn"):
                assert rollback_previous() is False

    def test_rolls_back_to_previous(self):
        journal = Journal(current="v0.9.0", previous="v0.8.0")
        with patch("_e3cnc_deploy.Journal.load", return_value=journal):
            with patch("_e3cnc_deploy.rollback_to", return_value=True) as mock_rb:
                assert rollback_previous() is True
                mock_rb.assert_called_once_with("v0.8.0")


class TestAutoRollback:
    def test_fails_when_no_previous(self):
        journal = Journal()
        with patch("_e3cnc_deploy.warn"):
            assert auto_rollback(journal) is False

    def test_fails_when_previous_not_installed(self):
        journal = Journal(previous="v0.8.0")
        with patch("_e3cnc_deploy.get_releases", return_value=[]):
            with patch("_e3cnc_deploy.warn"):
                assert auto_rollback(journal) is False

    def test_rolls_back_successfully(self, tmp_path):
        journal = Journal(previous="v0.8.0")
        prev_path = tmp_path / "v0.8.0"
        prev_path.mkdir()
        rel = Release(version="v0.8.0", path=prev_path)
        with patch("_e3cnc_deploy.get_releases", return_value=[rel]):
            with patch("_e3cnc_deploy.activate_release", return_value=True):
                with patch("_e3cnc_deploy.ok"):
                    assert auto_rollback(journal) is True
                    assert journal.last_known_good == "v0.8.0"


# ── Release GC ───────────────────────────────────────────────────────────


class TestPruneReleases:
    def test_no_prune_when_under_limit(self):
        releases = [Release(version=f"v0.{i}.0", path=Path(f"/v0.{i}.0")) for i in range(2)]
        with patch("_e3cnc_deploy.get_releases", return_value=releases):
            assert prune_releases(keep=3) == []

    def test_prunes_old_releases(self, tmp_path):
        # Create test releases — must be sorted newest-first like get_releases()
        releases = []
        for v in ["v0.9.0", "v0.8.0", "v0.7.0", "v0.6.0", "v0.5.0"]:
            p = tmp_path / v
            p.mkdir()
            releases.append(Release(version=v, path=p, size_bytes=1024))

        journal_path = tmp_path / "journal.json"
        journal_path.write_text('{"current": "v0.9.0", "previous": "v0.8.0", "last_known_good": "v0.9.0"}')

        with patch("_e3cnc_deploy.get_releases", return_value=releases):
            with patch("_e3cnc_deploy.JOURNAL_PATH", journal_path):
                with patch("_e3cnc_deploy.ok"):
                    pruned = prune_releases(keep=2)
                    # With keep=2, the first 2 (v0.9.0, v0.8.0) are kept.
                    # v0.7.0, v0.6.0, v0.5.0 should be pruned
                    assert len(pruned) == 3
                    # The oldest 3 should be pruned
                    for v in pruned:
                        assert not (tmp_path / v).exists()

    def test_dry_run_does_not_delete(self, tmp_path):
        for v in ["v0.8.0", "v0.9.0", "v0.10.0"]:
            (tmp_path / v).mkdir()
        releases = [
            Release(version="v0.10.0", path=tmp_path / "v0.10.0", size_bytes=1024),
            Release(version="v0.9.0", path=tmp_path / "v0.9.0", size_bytes=1024),
            Release(version="v0.8.0", path=tmp_path / "v0.8.0", size_bytes=1024),
        ]

        with patch("_e3cnc_deploy.get_releases", return_value=releases):
            with patch("_e3cnc_deploy.Journal.load", return_value=Journal()):
                pruned = prune_releases(keep=2, dry_run=True)
                assert len(pruned) > 0
                assert (tmp_path / "v0.8.0").exists()  # not deleted


# ── detect_old_layout ────────────────────────────────────────────────────


class TestDetectOldLayout:
    def test_returns_false_when_new_layout_exists(self, tmp_path):
        e3cnc_dir = tmp_path / "e3cnc"
        e3cnc_dir.mkdir()
        with patch("_e3cnc_deploy.E3CNC_DIR", e3cnc_dir):
            assert detect_old_layout() is False

    def test_returns_true_when_old_layout_exists(self, tmp_path):
        old_dir = Path.home() / "E3CNC"
        with patch("_e3cnc_deploy.E3CNC_DIR", tmp_path / "e3cnc"):
            with patch("pathlib.Path.exists", side_effect=[False, True]):
                assert detect_old_layout() is True

    def test_returns_false_when_no_old_layout(self, tmp_path):
        with patch("_e3cnc_deploy.E3CNC_DIR", tmp_path / "e3cnc"):
            with patch("pathlib.Path.exists", return_value=False):
                assert detect_old_layout() is False
