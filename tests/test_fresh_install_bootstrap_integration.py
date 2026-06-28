import os
import shutil
import subprocess
from pathlib import Path

import pytest


pytestmark = pytest.mark.integration


@pytest.mark.skipif(
    os.environ.get('E3CNC_RUN_DOCKER_TESTS') != '1',
    reason='Set E3CNC_RUN_DOCKER_TESTS=1 to run Docker-backed fresh-install integration tests.',
)
def test_fresh_install_bootstrap_from_vendored_sources():
    docker = shutil.which('docker')
    if not docker:
        pytest.skip('docker not available')

    root = Path(__file__).resolve().parent.parent
    tag = 'e3cnc-fresh-install-bootstrap-test'

    subprocess.run(
        [docker, 'build', '-t', tag, '-f', str(root / 'tests' / 'Dockerfile.fresh-install'), str(root)],
        check=True,
        cwd=root,
    )

    try:
        run = subprocess.run(
            [
                docker,
                'run',
                '--rm',
                '-e',
                'DEBIAN_FRONTEND=noninteractive',
                '-e',
                'E3CNC_RUN_DOCKER_TESTS=1',
                tag,
                'bash',
                '-lc',
                (
                    'cd ~/E3CNC && '
                    'sudo apt-get update -qq >/dev/null && '
                    'sudo apt-get install -y -qq python3-pip >/dev/null && '
                    'python3 -m pip install --user ansible >/dev/null 2>&1 || '
                    'python3 -m pip install --user --break-system-packages ansible >/dev/null 2>&1 && '
                    'export PATH="$HOME/.local/bin:$PATH" && '
                    'cd ansible && '
                    "ansible-playbook -i inventory/local.yml playbooks/install.yml -e bootstrap_skip_runtime_start=true -e bootstrap_skip_runtime_verification=true"
                ),
            ],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
            timeout=1800,
        )

        output = run.stdout + run.stderr
        assert 'Vendored Moonraker snapshot not found' not in output
        assert 'Vendored Klipper snapshot not found' not in output
        assert 'Bootstrap laid down files and service units' in output or 'Fresh software stack bootstrap completed.' in output
    finally:
        subprocess.run([docker, 'rmi', '-f', tag], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
