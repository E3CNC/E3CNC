import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _e3cnc_deploy import _remove_legacy_update_manager_block


def test_remove_legacy_update_manager_block(tmp_path):
    conf = tmp_path / 'moonraker.conf'
    conf.write_text(
        '[server]\n'
        'host: 0.0.0.0\n\n'
        '[update_manager E3CNC]\n'
        'type: git_repo\n'
        'path: ~/E3CNC\n\n'
        '[authorization]\n'
        'trusted_clients: 127.0.0.1\n'
    )

    assert _remove_legacy_update_manager_block(conf) is True
    assert conf.read_text() == (
        '[server]\n'
        'host: 0.0.0.0\n\n'
        '[authorization]\n'
        'trusted_clients: 127.0.0.1\n'
    )


def test_remove_legacy_update_manager_block_dry_run(tmp_path):
    conf = tmp_path / 'moonraker.conf'
    original = (
        '[server]\n\n'
        '[update_manager E3CNC]\n'
        'type: git_repo\n'
        'path: ~/E3CNC\n'
    )
    conf.write_text(original)

    assert _remove_legacy_update_manager_block(conf, dry_run=True) is True
    assert conf.read_text() == original
