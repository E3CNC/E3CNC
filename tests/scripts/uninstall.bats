setup() {
    load '/tmp/bats-support/load'
    load '/tmp/bats-assert/load'
}

@test "awk filter removes [cnc_agent] section" {
    input='[server]
host: 0.0.0.0

[cnc_agent]
verbose: true

[authorization]
trusted_clients: 127.0.0.1'

    expected='[server]
host: 0.0.0.0

[authorization]
trusted_clients: 127.0.0.1'

    run bash -c "
        echo '$input' | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        '
    "
    assert_success
    assert_output "$expected"
}

@test "awk filter removes [cnc_metadata] section" {
    input='[server]

[cnc_metadata]
extractor_path: /home/pi/printer_data/scripts/cnc_metadata_extractor.py
timeout: 30.0

[authorization]'

    expected='[server]

[authorization]'

    run bash -c "
        echo '$input' | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        '
    "
    assert_success
    assert_output "$expected"
}

@test "awk filter removes [update_manager E3CNC] section" {
    input='[server]

[update_manager E3CNC]
type: git_repo
channel: dev
path: ~/E3CNC

[authorization]'

    expected='[server]

[authorization]'

    run bash -c "
        echo '$input' | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        '
    "
    assert_success
    assert_output "$expected"
}

@test "awk filter removes all three sections together" {
    input='[server]
host: 0.0.0.0

[cnc_agent]
verbose: true

[cnc_metadata]
enabled: yes

[update_manager E3CNC]
path: ~/E3CNC

[authorization]
trusted_clients: 127.0.0.1'

    expected='[server]
host: 0.0.0.0

[authorization]
trusted_clients: 127.0.0.1'

    run bash -c "
        echo '$input' | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        '
    "
    assert_success
    assert_output "$expected"
}

@test "awk filter is idempotent — running twice produces same result" {
    input='[server]
[cnc_agent]
key = val
[authorization]'

    run bash -c "
        filtered=\$(echo '$input' | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        ')
        echo \"\$filtered\" | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        '
    "
    assert_success
    assert_output '[server]
[authorization]'
}

@test "awk filter leaves unrelated sections alone" {
    input='[server]
host: 0.0.0.0

[authorization]
trusted_clients: 127.0.0.1'

    run bash -c "
        echo '$input' | awk '
            /^\[/ { in_section = 0 }
            /^\[cnc_agent\]/ { in_section = 1; next }
            /^\[cnc_metadata\]/ { in_section = 1; next }
            /^\[update_manager E3CNC\]/ { in_section = 1; next }
            !in_section
        '
    "
    assert_success
    assert_output "$input"
}
