from pathlib import Path


def test_vendored_moonraker_snapshot_exists():
    root = Path(__file__).resolve().parent.parent
    moonraker_entry = root / 'vendor' / 'moonraker' / 'moonraker' / 'moonraker.py'
    provenance = root / 'vendor' / 'moonraker' / 'E3CNC_UPSTREAM.txt'

    assert moonraker_entry.exists()
    assert provenance.exists()
    text = provenance.read_text()
    assert 'Upstream: https://github.com/Arksine/moonraker.git' in text
    assert 'Commit:' in text

    # E3CNC custom components integrated into the vendored snapshot
    cnc_agent = root / 'vendor' / 'moonraker' / 'moonraker' / 'components' / 'cnc_agent' / 'cnc_agent.py'
    cnc_metadata = root / 'vendor' / 'moonraker' / 'moonraker' / 'components' / 'cnc_metadata' / 'cnc_metadata.py'
    mcp_server = root / 'vendor' / 'moonraker' / 'mcp' / 'mcp_server.py'
    assert cnc_agent.exists(), f'cnc_agent component not found in vendored Moonraker: {cnc_agent}'
    assert cnc_metadata.exists(), f'cnc_metadata component not found in vendored Moonraker: {cnc_metadata}'
    assert mcp_server.exists(), f'MCP server not found in vendored Moonraker: {mcp_server}'
