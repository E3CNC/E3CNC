import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.comment_mainsail_update_manager import comment_out_mainsail_update_manager


def test_comments_out_mainsail_update_manager_block(tmp_path):
    conf = tmp_path / "moonraker.conf"
    conf.write_text(
        "[update_manager mainsail]\n"
        "type: web\n"
        "path: /home/user/mainsail\n"
        "\n"
        "[server]\n"
        "port: 7125\n"
    )

    changed = comment_out_mainsail_update_manager(conf)

    assert changed is True
    assert conf.read_text() == (
        "# [update_manager mainsail]\n"
        "# type: web\n"
        "# path: /home/user/mainsail\n"
        "\n"
        "[server]\n"
        "port: 7125\n"
    )


def test_does_not_change_when_block_absent(tmp_path):
    conf = tmp_path / "moonraker.conf"
    original = "[server]\nport: 7125\n"
    conf.write_text(original)

    changed = comment_out_mainsail_update_manager(conf)

    assert changed is False
    assert conf.read_text() == original


def test_does_not_recomment_already_commented_block(tmp_path):
    conf = tmp_path / "moonraker.conf"
    original = (
        "# [update_manager mainsail]\n"
        "# type: web\n"
        "# path: /home/user/mainsail\n"
        "\n"
        "[server]\n"
        "port: 7125\n"
    )
    conf.write_text(original)

    changed = comment_out_mainsail_update_manager(conf)

    assert changed is False
    assert conf.read_text() == original


def test_only_comments_target_section_and_stops_at_next_section(tmp_path):
    conf = tmp_path / "moonraker.conf"
    conf.write_text(
        "[update_manager mainsail]\n"
        "type: web\n"
        "path: /home/user/mainsail\n"
        "[update_manager E3CNC]\n"
        "type: git_repo\n"
    )

    changed = comment_out_mainsail_update_manager(conf)
    text = conf.read_text()

    assert changed is True
    assert "# [update_manager mainsail]" in text
    assert "# type: web" in text
    assert "# path: /home/user/mainsail" in text
    assert "[update_manager E3CNC]" in text
    assert "# [update_manager E3CNC]" not in text
