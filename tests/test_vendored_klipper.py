from pathlib import Path


def test_vendored_klipper_snapshot_exists():
    root = Path(__file__).resolve().parent.parent
    klipper_entry = root / 'vendor' / 'klipper' / 'klippy' / 'klippy.py'
    provenance = root / 'vendor' / 'klipper' / 'E3CNC_UPSTREAM.txt'

    assert klipper_entry.exists()
    assert provenance.exists()
    text = provenance.read_text()
    assert 'Upstream: https://github.com/Klipper3d/klipper.git' in text
    assert 'Commit:' in text

    # E3CNC custom extra integrated into the vendored snapshot
    wcs_plugin = root / 'vendor' / 'klipper' / 'klippy' / 'extras' / 'work_coordinate_systems.py'
    assert wcs_plugin.exists(), f'WCS plugin not found in vendored Klipper: {wcs_plugin}'
