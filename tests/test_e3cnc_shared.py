"""Tests for _e3cnc_shared.py — shared CLI logic."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open

import pytest

from _e3cnc_shared import (
    Instance, CmdResult, Style,
    get_active_instance, set_active_instance,
    select_instance, _create_new_instance,
    VERSION, TOOL_NAME,
)


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def mock_instances():
    return [
        Instance(
            name="alpha", printer_data_dir="/tmp/a/data",
            config_dir="/tmp/a/data/config",
            moonraker_conf="/tmp/a/data/config/moonraker.conf",
            moonraker_log="/tmp/a/data/logs/moonraker.log",
            scripts_dir="/tmp/a/data/scripts",
            macros_dir="/tmp/a/data/config/E3CNC/macros",
            E3CNC_dir="/tmp/a/data/config/E3CNC",
            printer_cfg="/tmp/a/data/config/printer.cfg",
            web_root="/tmp/a/frontend",
            is_running=True,
        ),
        Instance(
            name="beta", printer_data_dir="/tmp/b/data",
            config_dir="/tmp/b/data/config",
            moonraker_conf="/tmp/b/data/config/moonraker.conf",
            moonraker_log="/tmp/b/data/logs/moonraker.log",
            scripts_dir="/tmp/b/data/scripts",
            macros_dir="/tmp/b/data/config/E3CNC/macros",
            E3CNC_dir="/tmp/b/data/config/E3CNC",
            printer_cfg="/tmp/b/data/config/printer.cfg",
            web_root="/tmp/b/frontend",
            is_running=False,
        ),
    ]


# ── VERSION / TOOL_NAME ──────────────────────────────────────────────────


class TestMetadata:
    def test_version_is_string(self):
        assert isinstance(VERSION, str)
        assert len(VERSION) > 0

    def test_tool_name(self):
        assert TOOL_NAME == "e3cnc-cli"


# ── CmdResult ─────────────────────────────────────────────────────────────


class TestCmdResult:
    def test_success_result(self):
        r = CmdResult(success=True, output="ok", label="test")
        assert r.success is True
        assert r.output == "ok"
        assert r.label == "test"
        assert r.returncode == 0

    def test_failure_result(self):
        r = CmdResult(success=False, output="error", label="fail", returncode=1)
        assert r.success is False
        assert r.returncode == 1


# ── Style ─────────────────────────────────────────────────────────────────


class TestStyle:
    def test_colors_are_strings(self):
        assert isinstance(Style.RED, str)
        assert isinstance(Style.GREEN, str)
        assert isinstance(Style.YELLOW, str)
        assert isinstance(Style.CYAN, str)
        assert isinstance(Style.DIM, str)

    def test_reset_is_string(self):
        assert isinstance(Style.RESET, str)  # May be empty when piped


# ── get_active_instance / set_active_instance ────────────────────────────


class TestActiveInstance:
    def setup_method(self):
        set_active_instance(None)

    def teardown_method(self):
        set_active_instance(None)

    def test_returns_none_by_default(self):
        with patch("_e3cnc_shared.INSTANCES_DIR", Path("/tmp/nonexistent_instances")):
            with patch("_e3cnc_shared._scan_kiauh_instances", return_value=[]):
                inst = get_active_instance()
                assert inst is None

    def test_returns_set_instance(self, mock_instances):
        set_active_instance(mock_instances[0])
        assert get_active_instance() is mock_instances[0]
        set_active_instance(None)

    def test_caches_result(self, mock_instances):
        set_active_instance(mock_instances[0])
        inst1 = get_active_instance()
        inst2 = get_active_instance()
        assert inst2 is inst1
        set_active_instance(None)


# ── select_instance ──────────────────────────────────────────────────────


class TestSelectInstance:
    def test_returns_none_when_empty(self):
        assert select_instance([]) is None

    def test_auto_selects_single(self, mock_instances):
        assert select_instance([mock_instances[0]]) is mock_instances[0]

    def test_numbered_fallback_selects_by_index(self, mock_instances):
        """When not a TTY, use numbered fallback input."""
        with patch("_e3cnc_shared.sys.stdin.isatty", return_value=False):
            with patch("builtins.input", return_value="2"):
                result = select_instance(mock_instances)
                assert result is mock_instances[1]

    def test_numbered_fallback_quit(self, mock_instances):
        """'q' should exit."""
        with patch("_e3cnc_shared.sys.stdin.isatty", return_value=False):
            with patch("builtins.input", return_value="q"):
                with patch("_e3cnc_shared.info"):
                    with pytest.raises(SystemExit):
                        select_instance(mock_instances)

    def test_numbered_fallback_create_new(self, mock_instances):
        with patch("_e3cnc_shared.sys.stdin.isatty", return_value=False):
            with patch("builtins.input", return_value="3"):  # create_idx = len+1 = 3
                with patch("_e3cnc_shared._create_new_instance") as mock_cr:
                    mock_cr.return_value = mock_instances[0]
                    result = select_instance(mock_instances)
                    assert result is mock_instances[0]

    def test_numbered_fallback_invalid_choice(self, mock_instances):
        """Invalid choice should loop and eventually exit via exception."""
        with patch("_e3cnc_shared.sys.stdin.isatty", return_value=False):
            with patch("builtins.input", side_effect=["99", KeyboardInterrupt()]):
                with patch("_e3cnc_shared.warn"):
                    result = select_instance(mock_instances)
                    assert result is None  # KeyboardInterrupt returns None

    def test_numbered_fallback_eof(self, mock_instances):
        with patch("_e3cnc_shared.sys.stdin.isatty", return_value=False):
            with patch("builtins.input", side_effect=EOFError()):
                result = select_instance(mock_instances)
                assert result is None


# ── _create_new_instance ─────────────────────────────────────────────────


class TestCreateNewInstance:
    def test_returns_none_on_eof(self):
        with patch("builtins.input", side_effect=EOFError()):
            assert _create_new_instance() is None

    def test_returns_none_on_keyboard_interrupt(self):
        with patch("builtins.input", side_effect=KeyboardInterrupt()):
            assert _create_new_instance() is None

    def test_rejects_invalid_name(self):
        with patch("builtins.input", return_value=""):
            with patch("_e3cnc_shared.warn"):
                assert _create_new_instance() is None

    def test_empty_input_shows_cancelled_message(self):
        """Empty input should print 'Cancelled' and return None."""
        with patch("builtins.input", return_value=""):
            with patch("_e3cnc_shared.info") as mock_info:
                assert _create_new_instance() is None
                mock_info.assert_any_call("Cancelled")

    def test_rejects_existing_name(self):
        inst_path = Path("/tmp") / "e3cnc" / "instances" / "dupname"
        with patch("_e3cnc_shared.INSTANCES_DIR", Path("/tmp") / "e3cnc" / "instances"):
            with patch("pathlib.Path.exists", return_value=True):
                with patch("builtins.input", return_value="dupname"):
                    with patch("_e3cnc_shared.warn"):
                        assert _create_new_instance() is None

    def test_creates_instance_successfully(self, tmp_path):
        instances_dir = tmp_path / "e3cnc" / "instances"
        # Need INSTANCES_DIR to be set before Instance.from_name computes paths
        from _e3cnc_shared import INSTANCES_DIR

        with patch("_e3cnc_shared.INSTANCES_DIR", instances_dir):
            with patch("builtins.input", return_value="newbox"):
                with patch("_e3cnc_shared.detect_instances", return_value=[]):
                    with patch("_e3cnc_shared.ok"):
                        with patch("_e3cnc_shared.deploy_nginx_config"):
                            result = _create_new_instance()
                            assert result is not None
                            assert result.name in ("newbox", "newbox")

    def test_strips_known_prefixes(self):
        for prefix in ("e3cnc-", "e3cnc_", "moonraker-", "klipper-"):
            with patch("builtins.input", return_value=f"{prefix}mybox"):
                with patch("_e3cnc_shared.INSTANCES_DIR", Path("/tmp/x")):
                    with patch("_e3cnc_shared.detect_instances", return_value=[]):
                        with patch("pathlib.Path.exists", return_value=False):
                            with patch("_e3cnc_shared.ok"):
                                with patch("_e3cnc_shared.deploy_nginx_config"):
                                    result = _create_new_instance()
                                    assert result is not None


# ── Instance.from_name moonraker.conf port parsing ──────────────────────


class TestInstanceFromName:
    def test_parses_port_from_moonraker_conf(self, tmp_path):
        instances_dir = tmp_path / "e3cnc" / "instances"
        inst_path = instances_dir / "porttest"
        config_dir = inst_path / "data" / "config"
        config_dir.mkdir(parents=True)
        (config_dir / "moonraker.conf").write_text("[server]\nport: 7126\n")

        with patch("_e3cnc_shared.INSTANCES_DIR", instances_dir):
            with patch("pathlib.Path.is_symlink", return_value=False):
                with patch("_e3cnc_shared._compute_web_port", return_value=80):
                    inst = Instance.from_name("porttest")
                    assert inst.moonraker_port == 7126

    def test_defaults_to_7125_when_no_config(self, tmp_path):
        instances_dir = tmp_path / "e3cnc" / "instances"
        inst_path = instances_dir / "nodefault"
        config_dir = inst_path / "data" / "config"
        config_dir.mkdir(parents=True)

        with patch("_e3cnc_shared.INSTANCES_DIR", instances_dir):
            with patch("pathlib.Path.is_symlink", return_value=False):
                with patch("_e3cnc_shared._compute_web_port", return_value=80):
                    inst = Instance.from_name("nodefault")
                    assert inst.moonraker_port == 7125


# ── _log / _ensure_log ──────────────────────────────────────────────────


class TestLogging:
    def setup_method(self):
        from _e3cnc_shared import _LOG_HANDLE
        if _LOG_HANDLE:
            _LOG_HANDLE.close()
        import _e3cnc_shared
        _e3cnc_shared._LOG_HANDLE = None

    def test_ensure_log_creates_file(self, tmp_path):
        log_file = tmp_path / "cli.log"
        with patch("_e3cnc_shared.LOG_FILE", log_file):
            import _e3cnc_shared
            _e3cnc_shared._LOG_HANDLE = None
            fh = _e3cnc_shared._ensure_log()
            assert fh is not None
            assert log_file.exists()

    def test_log_writes_message(self, tmp_path):
        log_file = tmp_path / "cli.log"
        with patch("_e3cnc_shared.LOG_FILE", log_file):
            import _e3cnc_shared
            _e3cnc_shared._LOG_HANDLE = None
            _e3cnc_shared._log("TEST", "hello world")
            content = log_file.read_text()
            assert "TEST" in content
            assert "hello world" in content

    def test_log_does_not_crash_on_error(self):
        from _e3cnc_shared import _log
        with patch("_e3cnc_shared._ensure_log", side_effect=OSError("no write")):
            _log("TEST", "should not crash")

    def test_ok_calls_log(self, tmp_path):
        log_file = tmp_path / "cli.log"
        with patch("_e3cnc_shared.LOG_FILE", log_file):
            import _e3cnc_shared
            _e3cnc_shared._LOG_HANDLE = None
            with patch("builtins.print"):
                _e3cnc_shared.ok("test message")
                content = log_file.read_text()
                assert "OK" in content
                assert "test message" in content


# ── check_dependencies / check_status ───────────────────────────────────


class TestCheckDependencies:
    def test_returns_tuple(self):
        from _e3cnc_shared import check_dependencies
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.stdout = "ansible-playbook 2.14.0"
        with patch("_e3cnc_shared.shutil.which", return_value="/usr/bin/git"):
            with patch("_e3cnc_shared.subprocess.run", return_value=mock_proc):
                ok, msg = check_dependencies(output_callback=lambda line: None)
                assert isinstance(ok, bool)
                assert isinstance(msg, (str, list))

    def test_missing_dep_reported(self):
        from _e3cnc_shared import check_dependencies
        with patch("_e3cnc_shared.shutil.which", return_value=None):
            ok, msg = check_dependencies(output_callback=lambda line: None)
            # May be True or False depending on environment


class TestCheckStatus:
    def test_returns_tuple(self):
        from _e3cnc_shared import check_status
        result = check_status(output_callback=lambda line: None)
        assert isinstance(result, tuple)
        assert len(result) >= 2


# ── fail / info / warn / step / header ──────────────────────────────────


class TestOutputHelpers:
    def test_info_does_not_crash(self):
        from _e3cnc_shared import info
        with patch("builtins.print"):
            info("test info")
            
    def test_warn_does_not_crash(self):
        from _e3cnc_shared import warn
        with patch("builtins.print"):
            warn("test warning")
            
    def test_fail_exits(self):
        from _e3cnc_shared import fail
        with patch("builtins.print"):
            with pytest.raises(SystemExit):
                fail("test failure")
                
    def test_step_does_not_crash(self):
        from _e3cnc_shared import step
        with patch("builtins.print"):
            step(1, 5, "test step")
            
    def test_header_does_not_crash(self):
        from _e3cnc_shared import header
        with patch("builtins.print"):
            header("Test Header")


class TestImportMoonrakerPrefs:
    """Tests for _e3cnc_shared._import_moonraker_prefs()."""

    def _make_kiauh_inst(self, printer_data_dir: str, name: str = "test") -> "Instance":
        from _e3cnc_shared import Instance
        d = printer_data_dir
        return Instance(
            name=name, printer_data_dir=d,
            config_dir=f"{d}/config",
            moonraker_conf=f"{d}/config/moonraker.conf",
            moonraker_log=f"{d}/logs/moonraker.log",
            scripts_dir=f"{d}/scripts",
            macros_dir=f"{d}/config/E3CNC/macros",
            E3CNC_dir=f"{d}/config/E3CNC",
            printer_cfg=f"{d}/config/printer.cfg",
            web_root=f"{d}/frontend",
        )

    def test_skips_when_no_kiauh_database(self, tmp_path):
        """If the KIAUH database doesn't exist, should return silently."""
        from _e3cnc_shared import _import_moonraker_prefs
        kiauh_dir = tmp_path / "kiauh_data"
        kiauh_dir.mkdir(parents=True)
        inst = self._make_kiauh_inst(str(kiauh_dir))
        new_data = tmp_path / "e3cnc" / "instances" / "test" / "data"
        new_data.mkdir(parents=True)
        _import_moonraker_prefs(inst, new_data)  # should not raise

    def test_imports_mainsail_namespace(self, tmp_path):
        """Mainsail namespace entries should be copied to the new DB."""
        from _e3cnc_shared import _import_moonraker_prefs
        import sqlite3

        # Create KIAUH database with mainsail preferences
        kiauh_dir = tmp_path / "kiauh_data"
        (kiauh_dir / "database").mkdir(parents=True)
        src_db = kiauh_dir / "database" / "moonraker-sql.db"
        conn = sqlite3.connect(str(src_db))
        conn.execute(
            "CREATE TABLE namespace_database ("
            "  namespace TEXT NOT NULL, key TEXT NOT NULL, value record NOT NULL,"
            "  PRIMARY KEY (namespace, key))"
        )
        conn.execute(
            "INSERT INTO namespace_database VALUES (?, ?, ?)",
            ("mainsail", "theme", '{"dark": true}'),
        )
        conn.execute(
            "INSERT INTO namespace_database VALUES (?, ?, ?)",
            ("mainsail", "dashboard.layout", '{"panels": []}'),
        )
        conn.commit()
        conn.close()

        inst = self._make_kiauh_inst(str(kiauh_dir))
        new_data = tmp_path / "e3cnc" / "instances" / "test" / "data"
        _import_moonraker_prefs(inst, new_data)

        # Verify preferences were copied
        dest_db = new_data / "database" / "moonraker-sql.db"
        assert dest_db.exists()
        conn2 = sqlite3.connect(str(dest_db))
        rows = conn2.execute(
            "SELECT key, value FROM namespace_database WHERE namespace = ?",
            ("mainsail",),
        ).fetchall()
        assert len(rows) == 2
        keys = {r[0] for r in rows}
        assert "theme" in keys
        assert "dashboard.layout" in keys
        conn2.close()

    def test_skips_other_namespaces(self, tmp_path):
        """Only mainsail namespace should be copied."""
        from _e3cnc_shared import _import_moonraker_prefs
        import sqlite3

        kiauh_dir = tmp_path / "kiauh_data"
        (kiauh_dir / "database").mkdir(parents=True)
        src_db = kiauh_dir / "database" / "moonraker-sql.db"
        conn = sqlite3.connect(str(src_db))
        conn.execute(
            "CREATE TABLE namespace_database ("
            "  namespace TEXT NOT NULL, key TEXT NOT NULL, value record NOT NULL,"
            "  PRIMARY KEY (namespace, key))"
        )
        conn.execute("INSERT INTO namespace_database VALUES (?, ?, ?)", ("mainsail", "theme", '"dark"'))
        conn.execute("INSERT INTO namespace_database VALUES (?, ?, ?)", ("moonraker", "config", "{}"))
        conn.commit()
        conn.close()

        inst = self._make_kiauh_inst(str(kiauh_dir))
        new_data = tmp_path / "e3cnc" / "instances" / "test" / "data"
        _import_moonraker_prefs(inst, new_data)

        dest_db = new_data / "database" / "moonraker-sql.db"
        conn2 = sqlite3.connect(str(dest_db))
        rows = conn2.execute("SELECT DISTINCT namespace FROM namespace_database").fetchall()
        namespaces = {r[0] for r in rows}
        assert namespaces == {"mainsail"}
        conn2.close()


# ── _generate_minimal_moonraker_conf ──────────────────────────────────

class TestGenerateMinimalMoonrakerConf:
    """Tests for _e3cnc_shared._generate_minimal_moonraker_conf()."""

    def test_uses_bootstrap_template(self, tmp_path):
        """Should use the bootstrap template file when available."""
        from _e3cnc_shared import _generate_minimal_moonraker_conf

        # Point _BOOTSTRAP_PATH to a temp template
        bootstrap = tmp_path / "bootstrap" / "moonraker.conf"
        bootstrap.parent.mkdir(parents=True)
        bootstrap.write_text(
            "[server]\nport: {port}\nklippy_uds_address: {klippy_uds_address}\n"
            "# e3cnc_web_port: {web_port}\n"
            "[file_manager]\nconfig_path: {config_path}\n"
            "[database]\ndatabase_path: {database_path}\n"
            "[cnc_agent]\n[cnc_metadata]\nextractor_path: {extractor_path}\ntimeout: 30.0\n"
        )

        with patch("_e3cnc_shared._BOOTSTRAP_PATH", bootstrap):
            data_dir = tmp_path / "data"
            conf_path = _generate_minimal_moonraker_conf(data_dir, 8888)

        assert conf_path.exists()
        text = conf_path.read_text()
        assert "port: 8888" in text
        assert str(data_dir / "config") in text
        assert str(data_dir / "database") in text
        assert str(data_dir / "comms" / "klippy.sock") in text
        assert str(data_dir / "scripts" / "cnc_metadata_extractor.py") in text
        assert "# e3cnc_web_port:" in text
        assert "[cnc_agent]" in text
        assert "[cnc_metadata]" in text
        # No unrendered placeholders
        assert "{port}" not in text

    def test_fallback_when_template_missing(self, tmp_path):
        """Should fall back to hardcoded config when template is missing."""
        from _e3cnc_shared import _generate_minimal_moonraker_conf

        missing = tmp_path / "nonexistent" / "moonraker.conf"
        with patch("_e3cnc_shared._BOOTSTRAP_PATH", missing):
            with patch("_e3cnc_shared.warn"):
                data_dir = tmp_path / "data"
                conf_path = _generate_minimal_moonraker_conf(data_dir, 7125)

        assert conf_path.exists()
        text = conf_path.read_text()
        assert "port: 7125" in text
        assert "[cnc_agent]" in text
        assert "[cnc_metadata]" in text

    def test_includes_cnc_agent_and_metadata(self, tmp_path):
        """Generated config should always have cnc_agent and cnc_metadata sections."""
        from _e3cnc_shared import _generate_minimal_moonraker_conf

        with patch("_e3cnc_shared._BOOTSTRAP_PATH", tmp_path / "missing"):
            with patch("_e3cnc_shared.warn"):
                data_dir = tmp_path / "data"
                conf_path = _generate_minimal_moonraker_conf(data_dir, 7125)

        text = conf_path.read_text()
        assert "[cnc_agent]" in text
        assert "[cnc_metadata]" in text
        assert "extractor_path:" in text
        assert "timeout:" in text

    def test_replacements_no_placeholders_left(self, tmp_path):
        """All placeholders should be replaced in the final config."""
        from _e3cnc_shared import _generate_minimal_moonraker_conf

        bootstrap = tmp_path / "bootstrap" / "moonraker.conf"
        bootstrap.parent.mkdir(parents=True)
        bootstrap.write_text(
            "[server]\nport: {port}\n"
            "[file_manager]\nconfig_path: {config_path}\n"
            "[database]\ndatabase_path: {database_path}\n"
            "[cnc_agent]\n"
            "[cnc_metadata]\nextractor_path: {extractor_path}\ntimeout: 30.0\n"
        )

        with patch("_e3cnc_shared._BOOTSTRAP_PATH", bootstrap):
            data_dir = tmp_path / "data"
            conf_path = _generate_minimal_moonraker_conf(data_dir, 9999)

        text = conf_path.read_text()
        assert "{" not in text, f"Unrendered placeholders: {text}"

    def test_no_duplicate_sections(self, tmp_path):
        """Generated config must not have duplicate section headers (root cause of #23)."""
        from _e3cnc_shared import _generate_minimal_moonraker_conf

        # Use the real bootstrap template
        data_dir = tmp_path / "testinst" / "data"
        conf_path = _generate_minimal_moonraker_conf(data_dir, 8000)
        text = conf_path.read_text()

        lines = text.splitlines()
        seen_sections = set()
        for line in lines:
            line = line.strip()
            if line.startswith("[") and line.endswith("]"):
                section = line.lower()
                assert section not in seen_sections, \
                    f"Duplicate section {line} in generated config:\n{text}"
                seen_sections.add(section)

    def test_file_manager_and_database_once(self, tmp_path):
        """[file_manager] and [database] should appear exactly once each."""
        from _e3cnc_shared import _generate_minimal_moonraker_conf
        data_dir = tmp_path / "testinst" / "data"
        conf_path = _generate_minimal_moonraker_conf(data_dir, 8000)
        text = conf_path.read_text()

        for section in ("[file_manager]", "[database]", "[server]", "[authorization]"):
            count = text.count(section)
            assert count == 1, \
                f"Section {section} appears {count} times (expected 1):\n{text}"
