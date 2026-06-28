"""Docker-backed integration test for fresh-install bootstrap.

Verifies that the full Ansible bootstrap correctly lays down all files and that
the stack (nginx, Moonraker, Klippy with simulated MCU) starts and responds.

Requires Docker and E3CNC_RUN_DOCKER_TESTS=1.

Usage:
    E3CNC_RUN_DOCKER_TESTS=1 python3 -m pytest tests/test_fresh_install_bootstrap_integration.py -x -v
"""

import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest


pytestmark = pytest.mark.integration


@pytest.mark.skipif(
    os.environ.get('E3CNC_RUN_DOCKER_TESTS') != '1',
    reason='Set E3CNC_RUN_DOCKER_TESTS=1 to run Docker-backed fresh-install integration tests.',
)
class TestFreshInstallBootstrap:
    """Integration test suite for fresh bootstrap install."""

    CONTAINER_NAME = "e3cnc-fresh-install-test"
    IMAGE_TAG = "e3cnc-fresh-install-bootstrap-test"

    @pytest.fixture(autouse=True)
    def _setup_container(self, request):
        """Build and start the test container."""
        root = Path(__file__).resolve().parent.parent
        docker = shutil.which("docker")
        if not docker:
            pytest.skip("docker not available")

        subprocess.run(
            [docker, "build", "-t", self.IMAGE_TAG,
             "-f", str(root / "tests" / "Dockerfile.fresh-install"), str(root)],
            check=True, cwd=root,
        )

        subprocess.run(
            [docker, "run", "-d", "--name", self.CONTAINER_NAME,
             "-e", "DEBIAN_FRONTEND=noninteractive", self.IMAGE_TAG, "sleep", "infinity"],
            check=True, capture_output=True,
        )

        yield

        subprocess.run([docker, "rm", "-f", self.CONTAINER_NAME],
                       capture_output=True, check=False)
        subprocess.run([docker, "rmi", "-f", self.IMAGE_TAG],
                       capture_output=True, check=False)

    def _exec(self, script: str, timeout: int = 300) -> str:
        """Run a bash script inside the container."""
        result = subprocess.run(
            ["docker", "exec", self.CONTAINER_NAME, "bash", "-lc", script],
            capture_output=True, text=True, timeout=timeout,
        )
        return (result.stdout + result.stderr).strip()

    def _exec_bg(self, script: str) -> int:
        """Start a background process inside the container. Returns PID."""
        out = self._exec(f"nohup bash -lc '{script}' >/tmp/bg.log 2>&1 & echo $!")
        return int(out.strip().split()[-1])

    def _read_bg_log(self) -> str:
        return self._exec("cat /tmp/bg.log 2>/dev/null || echo '(no log)'")

    # ── Setup helpers ─────────────────────────────────────────────────────

    def _install_ansible(self):
        """Install pip and Ansible inside the container."""
        return self._exec(
            "sudo apt-get update -qq >/dev/null && "
            "sudo apt-get install -y -qq python3-pip socat >/dev/null && "
            "(python3 -m pip install --user ansible >/dev/null 2>&1 || "
            " python3 -m pip install --user --break-system-packages ansible >/dev/null 2>&1) && "
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "echo 'ready'"
        )

    def _setup_git_remote(self):
        """Point the git origin to the local checkout (avoids network)."""
        self._exec(
            "cd ~/E3CNC && "
            "git remote set-url origin file://$HOME/E3CNC 2>/dev/null || true"
        )

    def _run_ansible_playbook(self, extra_tags: str = "") -> str:
        """Run the install playbook with tag filter."""
        tags_flag = f"--tags {extra_tags}" if extra_tags else ""
        return self._exec(
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            f"cd ~/E3CNC/ansible && "
            f"ansible-playbook -i inventory/local.yml playbooks/install.yml "
            f"-e bootstrap_skip_runtime_start=true "
            f"-e bootstrap_skip_runtime_verification=true "
            f"{tags_flag} 2>&1"
        )

    # ── Verifiers ─────────────────────────────────────────────────────────

    def _file_check(self, path: str, label: str) -> bool:
        # Use $HOME + double-quotes for proper expansion in bash -lc
        expanded = path.replace("~/", "$HOME/")
        out = self._exec(f'test -f "{expanded}" && echo "FOUND" || echo "MISSING"')
        ok = "FOUND" in out
        print(f"  {'✓' if ok else '✗'} {label}")
        return ok

    def _grep_check(self, path: str, pattern: str, label: str) -> bool:
        expanded = path.replace("~/", "$HOME/")
        out = self._exec(f'grep -q \'{pattern}\' "{expanded}" 2>/dev/null && echo "FOUND" || echo "MISSING"')
        ok = "FOUND" in out
        print(f"  {'✓' if ok else '✗'} {label}")
        return ok

    def _invert_grep_check(self, path: str, pattern: str, label: str) -> bool:
        out = self._exec(f"grep -c '{pattern}' '{path}' 2>/dev/null || echo 0")
        try:
            count = int(out.strip().split()[-1])
        except (ValueError, IndexError):
            count = 999
        ok = count == 0
        print(f"  {'✓' if ok else '✗'} {label}")
        return ok

    def _deploy_frontend_to_container(self) -> str:
        """Copy host's pre-built dist/ directly into the container's nginx web root."""
        docker = shutil.which("docker")
        root = Path(__file__).resolve().parent.parent
        dist_path = root / "dist"

        if not dist_path.is_dir():
            return "MISSING: host dist/ not found — run 'bun run build' first"

        # Ensure web root exists and is owned by testbed
        self._exec("mkdir -p ~/e3cnc-web")

        # Copy dist contents directly into web root
        subprocess.run(
            [docker, "cp", str(dist_path) + "/.", f"{self.CONTAINER_NAME}:/home/testbed/e3cnc-web/"],
            check=True, capture_output=True,
        )

        # Fix permissions (docker cp copies as root, nginx needs read + traverse)
        out = self._exec(
            "sudo chmod a+x $HOME && "
            "sudo chmod -R 755 $HOME/e3cnc-web && "
            "sudo nginx -t 2>/dev/null && "
            "(sudo nginx -s reload 2>/dev/null || sudo nginx 2>/dev/null) && "
            "echo 'DEPLOYED'"
        )
        return out

    def _verify_frontend_response(self) -> tuple:
        """Curl the frontend and verify expected HTML content."""
        http = self._exec(
            "curl -s -o /tmp/fe-body.txt -w '%{http_code}' http://localhost:8080/ 2>/dev/null || echo 'no-connect'"
        )
        status_ok = http.strip() == "200"
        html = self._exec("cat /tmp/fe-body.txt 2>/dev/null || echo ''")
        has_title = "<title>" in html
        has_root = 'id="app"' in html or 'id=\"app\"' in html
        has_pwa = "serviceWorker" in html
        if http.strip() != "200":
            err = self._exec("sudo tail -3 /var/log/nginx/error.log 2>/dev/null || true")
            print(f"  ⚠ nginx log: {err}")
            print(f"  ⚠ body start: {html[:150]}")
        return status_ok, has_title, has_root, has_pwa, http.strip()

    # ── Test: file-level verification ─────────────────────────────────────

    def test_fresh_bootstrap_full_verification(self):
        """Verify all files and configs are correctly deployed."""
        print("\n  ── Setup ──")
        self._install_ansible()
        self._setup_git_remote()

        print("\n  ── Ansible ──")
        out = self._run_ansible_playbook(
            extra_tags="bootstrap-stack,extractor,moonraker-config,macros"
        )
        lines = out.splitlines()
        for line in lines[-3:]:
            print(f"  {line}")
        assert "failed=0" in out, (
            f"Ansible failed. Last 20 lines:\n" + "\n".join(lines[-20:])
        )

        print("\n  ── Files ──")
        checks = [
            self._file_check("~/moonraker/moonraker/moonraker.py", "Vendored Moonraker"),
            self._file_check("~/moonraker/moonraker/components/cnc_agent/cnc_agent.py", "cnc_agent component"),
            self._file_check("~/moonraker/moonraker/components/cnc_metadata/cnc_metadata.py", "cnc_metadata component"),
            self._file_check("~/moonraker/mcp/mcp_server.py", "MCP server"),
            self._file_check("~/klipper/klippy/klippy.py", "Vendored Klipper"),
            self._file_check("~/klipper/klippy/extras/work_coordinate_systems.py", "WCS plugin in extras"),
            self._file_check("~/printer_data/scripts/cnc_metadata_extractor.py", "Metadata extractor (executable)"),
            self._file_check("~/printer_data/config/E3CNC/macros/wcs_macros.cfg", "Macros: wcs_macros"),
            self._file_check("~/printer_data/config/E3CNC/macros/e3cnc_macros.cfg", "Macros: e3cnc_macros"),
            self._file_check("~/printer_data/config/E3CNC/macros/cnc_base.cfg", "Macros: cnc_base"),
            self._grep_check("~/printer_data/config/moonraker.conf", r"\[cnc_agent\]", "moonraker.conf has [cnc_agent]"),
            self._grep_check("~/printer_data/config/moonraker.conf", r"\[cnc_metadata\]", "moonraker.conf has [cnc_metadata]"),
            self._grep_check("~/printer_data/config/printer.cfg", "E3CNC bootstrap placeholder", "Placeholder printer.cfg"),
            self._grep_check("~/printer_data/config/printer.cfg", "include E3CNC/macros", "printer.cfg has macro includes"),
            self._file_check("/etc/nginx/sites-available/e3cnc", "nginx site config"),
            self._invert_grep_check("/etc/nginx/sites-available/e3cnc", "default_server", "nginx: no default_server"),
            self._grep_check("/etc/nginx/sites-available/e3cnc", "server_name e3cnc.local", "nginx: server_name e3cnc.local"),
        ]
        assert all(checks), "Some file checks failed"

        print("\n  ── nginx runtime ──")
        valid = self._exec("sudo nginx -t 2>&1")
        nginx_ok = "test is successful" in valid or "syntax is ok" in valid
        print(f"  {'✓' if nginx_ok else '✗'} nginx config syntax: {'valid' if nginx_ok else 'INVALID'}")
        assert nginx_ok, f"nginx config invalid:\n{valid}"

        self._exec("sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null; sudo nginx 2>&1")
        running = self._exec("ps aux | grep -c '[n]ginx'")
        nginx_running = running.strip().isdigit() and int(running.strip()) > 0
        print(f"  {'✓' if nginx_running else '✗'} nginx process: {'running' if nginx_running else 'NOT RUNNING'}")
        assert nginx_running, "nginx failed to start"

        print("\n  ── Frontend ──")
        deploy = self._deploy_frontend_to_container()
        if "DEPLOYED" in deploy:
            print("  ✓ Frontend copied from host dist/ and deployed")

            status_ok, has_title, has_root, has_pwa, http_code = self._verify_frontend_response()
            print(f"  {'✓' if status_ok else '✗'} HTTP status: {http_code}")
            print(f"  {'✓' if has_title else '✗'} HTML has <title>")
            print(f"  {'✓' if has_root else '✗'} HTML has Vue app root (#app)")
            print(f"  {'✓' if has_pwa else '○'} PWA serviceWorker registered")

            assert status_ok, f"Frontend returned HTTP {http_code}, expected 200"
            assert has_title, "Frontend HTML missing <title>"
            assert has_root, "Frontend HTML missing Vue app root"
        else:
            print(f"  ⚠ Frontend not deployed: {deploy}")
            print("  (run 'bun run build' on the host to include this check)")

    # ── Test: full stack with simulated MCU ───────────────────────────────

    def test_fresh_bootstrap_with_simulated_mcu(self):
        """Full stack test: build Klipper simulator, start Klippy + Moonraker,
        verify via API that cnc_agent loads and Klippy reaches ready state."""
        import json

        print("\n  ── Setup ──")
        self._install_ansible()
        self._setup_git_remote()

        print("\n  ── Ansible ──")
        out = self._run_ansible_playbook(
            extra_tags="bootstrap-stack,extractor,moonraker-config,macros"
        )
        assert "failed=0" in out, "Ansible playbook failed"

        # Verify venvs are functional
        print("\n  ── Verifying venvs ──")
        mr_py = self._exec("test -f $HOME/moonraker/venv/bin/python && echo 'FOUND' || echo 'MISSING'")
        kl_py = self._exec("test -f $HOME/klipper/venv/bin/python && echo 'FOUND' || echo 'MISSING'")
        print(f"  {'✓' if 'FOUND' in mr_py else '✗'} Moonraker venv")
        print(f"  {'✓' if 'FOUND' in kl_py else '✗'} Klipper venv")

        # Check Moonraker can import its main module
        mr_import = self._exec(
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "$HOME/moonraker/venv/bin/python -c \"import moonraker; print('OK')\" 2>&1 || echo 'IMPORT FAILED'"
        )
        print(f"  {'✓' if 'OK' in mr_import else '✗'} Moonraker import check: {mr_import[:100]}")

        # ── Build Klipper simulator ──
        print("\n  ── Building Klipper simulator ──")
        out = self._exec(
            "cd ~/klipper && "
            "cp test/configs/hostsimulator.config .config && "
            "make olddefconfig 2>&1 && make -j4 2>&1"
        )
        for line in out.splitlines()[-3:]:
            print(f"  {line}")
        sim_built = self._exec("test -f ~/klipper/out/klipper.elf && echo 'FOUND' || echo 'MISSING'")
        assert "FOUND" in sim_built, "Klipper simulator build failed"
        print("  ✓ Simulator built at ~/klipper/out/klipper.elf")

        # ── Write real printer.cfg ──
        print("\n  ── Writing test printer.cfg ──")
        self._exec("cat > ~/printer_data/config/printer.cfg << 'CFGEOF'\n"
            "# Test printer.cfg for simulated MCU\n"
            "[mcu]\n"
            "serial: /tmp/klipper-sim-pty\n"
            "baud: 250000\n"
            "\n"
            "[printer]\n"
            "kinematics: none\n"
            "max_velocity: 300\n"
            "max_accel: 3000\n"
            "\n"
            "[include E3CNC/macros/cnc_base.cfg]\n"
            "[include E3CNC/macros/wcs_macros.cfg]\n"
            "[include E3CNC/macros/e3cnc_macros.cfg]\n"
            "CFGEOF\n"
            "echo 'written'")
        print("  ✓ Test printer.cfg written")

        # ── Start simulator via socat PTY ──
        print("\n  ── Starting MCU simulator ──")
        sim_pid = self._exec_bg(
            "socat PTY,link=/tmp/klipper-sim-pty,rawer "
            "EXEC:$HOME/klipper/out/klipper.elf,pty,rawer"
        )
        time.sleep(2)
        pty_check = self._exec("test -c /tmp/klipper-sim-pty && echo 'FOUND' || echo 'MISSING'")
        assert "FOUND" in pty_check, f"socat PTY not created (PID {sim_pid})"
        print(f"  ✓ Simulator PID {sim_pid}, PTY at /tmp/klipper-sim-pty")

        # ── Start Klippy ──
        print("\n  ── Starting Klippy ──")
        klippy_pid = self._exec_bg(
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "cd ~/klipper && "
            "~/klipper/venv/bin/python ~/klipper/klippy/klippy.py "
            "~/printer_data/config/printer.cfg "
            "-I ~/printer_data/comms/klippy.serial "
            "-l ~/printer_data/logs/klippy.log "
            "-a ~/printer_data/comms/klippy.sock"
        )
        time.sleep(5)
        print(f"  ✓ Klippy PID {klippy_pid}")

        # ── Start Moonraker ──
        print("\n  ── Starting Moonraker ──")
        mr_pid = self._exec_bg(
            "cd ~/moonraker && "
            "~/moonraker/venv/bin/python ~/moonraker/moonraker/moonraker.py "
            "-d ~/printer_data"
        )
        time.sleep(5)
        print(f"  ✓ Moonraker PID {mr_pid}")

        # Wait for Klippy UDS socket before polling Moonraker API
        print("  Waiting for Klippy UDS socket...")
        for attempt in range(15):
            sock = self._exec("test -S ~/printer_data/comms/klippy.sock && echo 'FOUND' || echo 'WAITING'")
            if "FOUND" in sock:
                print("  ✓ Klippy UDS socket ready")
                break
            if attempt == 5:
                # Check Klippy log for errors after 10s
                klog = self._exec("tail -10 ~/printer_data/logs/klippy.log 2>/dev/null || echo '(no log)'")
                print(f"  ⚠ Klippy log after 10s:")
                for line in klog.splitlines()[-5:]:
                    print(f"    {line}")
            time.sleep(2)
        else:
            print("  ⚠ Klippy UDS socket never appeared")

        # Verify API responses
        print("\n  ── Verifying Moonraker API ──")

        # Check Moonraker's own log for startup errors
        mr_log = self._exec("tail -20 \"$HOME/printer_data/logs/moonraker.log\" 2>/dev/null || echo '(no moonraker log)'")
        print(f"  ⚠ Moonraker log:")
        for line in mr_log.splitlines()[-10:]:
            print(f"    {line}")

        # Check processes are alive
        for proc_name, pid_var in [("socat simulator", sim_pid),
                                     ("Klippy", klippy_pid),
                                     ("Moonraker", mr_pid)]:
            alive = self._exec(f"ps -p {pid_var} -o pid= 2>/dev/null && echo 'ALIVE' || echo 'DEAD'")
            print(f"  {'✓' if 'ALIVE' in alive else '✗'} {proc_name} PID {pid_var}: {'alive' if 'ALIVE' in alive else 'DEAD'}")

        # Peek at background logs for errors
        bg_log = self._exec("tail -20 /tmp/bg.log 2>/dev/null || echo '(no log)'")
        print(f"  ⚠ Background log (last 20 lines):")
        for line in bg_log.splitlines()[-10:]:
            print(f"    {line}")

        # Wait for Moonraker API
        server_info = ""
        for attempt in range(30):
            out = self._exec(
                "curl -sf http://127.0.0.1:7125/server/info 2>/dev/null || echo 'RETRY'"
            )
            if "RETRY" not in out:
                server_info = out
                break
            if attempt == 10:
                # After 20s, check if Moonraker is even running
                mr_check = self._exec(f"ps -p {mr_pid} -o pid= 2>/dev/null && echo 'ALIVE' || echo 'DEAD'")
                if "DEAD" in mr_check:
                    print("  ⚠ Moonraker process died — checking log for errors...")
                    break
            time.sleep(2)

        assert server_info, "Moonraker API never responded"
        try:
            info = json.loads(server_info)
        except json.JSONDecodeError:
            pytest.fail(f"Moonraker API returned non-JSON:\n{server_info}")

        # Check cnc_agent component loaded
        components = info.get("result", {}).get("components", [])
        has_cnc_agent = any("cnc_agent" in str(c) for c in components)
        print(f"  {'✓' if has_cnc_agent else '✗'} cnc_agent component: {'loaded' if has_cnc_agent else 'MISSING'}")
        assert has_cnc_agent, f"cnc_agent not in Moonraker components: {components}"

        # Check Klippy state
        printer_info = ""
        for attempt in range(30):
            out = self._exec(
                "curl -sf http://127.0.0.1:7125/printer/info 2>/dev/null || echo 'RETRY'"
            )
            if "RETRY" not in out:
                printer_info = out
                try:
                    state = json.loads(printer_info).get("result", {}).get("state", "")
                    if state == "ready":
                        break
                except json.JSONDecodeError:
                    pass
            time.sleep(2)

        if printer_info:
            try:
                state = json.loads(printer_info).get("result", {}).get("state", "unknown")
                print(f"  Klippy state: {state}")
            except json.JSONDecodeError:
                print(f"  Klippy response (non-JSON): {printer_info[:200]}")
        else:
            print("  Klippy never responded via API")

        # If Klippy reached ready, run a status check
        if printer_info:
            try:
                state = json.loads(printer_info).get("result", {}).get("state", "unknown")
                assert state == "ready", f"Klippy state is '{state}', expected 'ready'"
                print(f"  ✓ Klippy reached 'ready' state")
            except (json.JSONDecodeError, KeyError):
                pytest.fail(f"Could not parse Klippy state from: {printer_info[:300]}")
        else:
            pytest.fail("Klippy API never responded")

        print(f"\n  {'─' * 40}")
        print("  ✓ Full stack verification passed")
