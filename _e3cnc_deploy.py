"""
Single-deploy stack infrastructure for E3CNC CLI.

Provides staged runtime activation, artifact management, health checks,
rollback, and release GC. Designed to be imported by both e3cnc-cli and
the future e3cnc-tui.

This module replaces the old multi-copy Ansible deployment model with a
single-artifact, single-apply-step model.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from urllib.request import urlopen, Request
from urllib.error import URLError

from _e3cnc_shared import (
    Style, ok, info, warn, fail, step, header, TOOL_NAME, VERSION,
    Instance, get_active_instance, detect_instances,
)

# ── Paths ───────────────────────────────────────────────────────────────────

E3CNC_DIR = Path.home() / "e3cnc"
RELEASES_DIR = E3CNC_DIR / "releases"
CURRENT_SYMLINK = E3CNC_DIR / "current"
JOURNAL_PATH = E3CNC_DIR / "journal.json"
BACKUPS_DIR = E3CNC_DIR / "backups"
STOCK_BACKUP_DIR = E3CNC_DIR / "stock-backup"

GITHUB_REPO = "E3CNC/E3CNC"
GITHUB_API = f"https://api.github.com/repos/{GITHUB_REPO}"
GITHUB_RELEASES = f"https://github.com/{GITHUB_REPO}/releases"

# ── Constants ───────────────────────────────────────────────────────────────

DEFAULT_KEEP_RELEASES = 3
HEALTH_CHECK_RETRIES = 3
HEALTH_CHECK_BACKOFF = 5  # seconds


# ── Data classes ────────────────────────────────────────────────────────────

@dataclass
class Release:
    """A single installed release."""
    version: str
    path: Path
    manifest: Dict[str, Any] = field(default_factory=dict)
    size_bytes: int = 0
    created_at: Optional[str] = None

    @property
    def is_active(self) -> bool:
        return CURRENT_SYMLINK.exists() and CURRENT_SYMLINK.resolve() == self.path

    @classmethod
    def from_dir(cls, path: Path) -> "Release":
        manifest = {}
        manifest_path = path / "manifest.json"
        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text())
            except (json.JSONDecodeError, OSError):
                pass
        size = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
        created = None
        try:
            st = path.stat()
            created = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
        except OSError:
            pass
        return cls(
            version=manifest.get("e3cnc_version", path.name),
            path=path,
            manifest=manifest,
            size_bytes=size,
            created_at=created,
        )


@dataclass
class Journal:
    """Deployment journal — tracks active release state."""
    current: str = ""
    previous: str = ""
    last_known_good: str = ""
    applied_at: str = ""
    config_schema: int = 1
    config_schema_previous: int = 1
    state_backup_path: str = ""

    def save(self) -> None:
        JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "current": self.current,
            "previous": self.previous,
            "last_known_good": self.last_known_good,
            "applied_at": self.applied_at or datetime.now(timezone.utc).isoformat(),
            "config_schema": self.config_schema,
            "config_schema_previous": self.config_schema_previous,
            "state_backup_path": self.state_backup_path,
        }
        JOURNAL_PATH.write_text(json.dumps(data, indent=2) + "\n")

    @classmethod
    def load(cls) -> "Journal":
        if JOURNAL_PATH.exists():
            try:
                data = json.loads(JOURNAL_PATH.read_text())
                return cls(**{k: data.get(k, v) for k, v in cls.__annotations__.items() if k != "save" and k != "load"})
            except (json.JSONDecodeError, OSError, TypeError):
                pass
        return cls()


# ── Release management ──────────────────────────────────────────────────────

def get_releases() -> List[Release]:
    """Scan RELEASES_DIR and return sorted list (newest first)."""
    if not RELEASES_DIR.is_dir():
        return []
    releases = []
    for item in sorted(RELEASES_DIR.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            releases.append(Release.from_dir(item))
    releases.sort(key=lambda r: r.version, reverse=True)
    return releases


def get_current_release() -> Optional[Release]:
    """Return the currently active release, or None."""
    if not CURRENT_SYMLINK.exists():
        return None
    try:
        target = CURRENT_SYMLINK.resolve()
        if target.is_dir():
            return Release.from_dir(target)
    except OSError:
        pass
    return None


def get_active_release_version() -> str:
    """Return the version string of the active release."""
    release = get_current_release()
    if release:
        return release.version
    journal = Journal.load()
    if journal.current:
        return journal.current
    return "unknown"


# ── Artifact management ─────────────────────────────────────────────────────

def _github_api_request(endpoint: str) -> Optional[Dict[str, Any]]:
    """Make a request to the GitHub API. Returns parsed JSON or None."""
    url = f"{GITHUB_API}/{endpoint}"
    req = Request(url, headers={"Accept": "application/vnd.github+json"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except (URLError, OSError, json.JSONDecodeError) as e:
        warn(f"GitHub API request failed: {e}")
        return None


def get_latest_release_assets() -> Optional[List[Dict[str, Any]]]:
    """Get assets from the latest GitHub release."""
    data = _github_api_request("releases/latest")
    if data and "assets" in data:
        return data["assets"]
    return None


def find_stack_artifact_asset(version: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Find the e3cnc-stack-*.tar.zst asset from GitHub releases."""
    if version:
        data = _github_api_request(f"releases/tags/{version}")
        assets = data.get("assets", []) if data else []
    else:
        assets = get_latest_release_assets()
    if not assets:
        return None
    for asset in assets:
        name = asset.get("name", "")
        if name.startswith("e3cnc-stack-") and name.endswith(".tar.zst"):
            return asset
    return None


def download_artifact(asset: Dict[str, Any], dest_dir: Path) -> Optional[Path]:
    """Download a release artifact to dest_dir. Returns the path to the downloaded file."""
    url = asset.get("browser_download_url", "")
    name = asset.get("name", "artifact")
    if not url:
        warn(f"No download URL for {name}")
        return None

    dest_dir.mkdir(parents=True, exist_ok=True)
    part_path = dest_dir / f"{name}.part"
    final_path = dest_dir / name

    info(f"Downloading {name}...")
    try:
        req = Request(url, headers={"Accept": "application/octet-stream"})
        with urlopen(req, timeout=120) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            with open(part_path, "wb") as f:
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

        # Atomic rename
        part_path.rename(final_path)
        size_mb = downloaded / (1024 * 1024)
        info(f"Downloaded {name} ({size_mb:.1f} MB)")
        return final_path
    except (URLError, OSError) as e:
        if part_path.exists():
            part_path.unlink()
        warn(f"Download failed: {e}")
        return None


def verify_checksum(artifact_path: Path) -> bool:
    """Verify artifact checksum against its .sha256 sidecar."""
    checksum_path = artifact_path.with_suffix(artifact_path.suffix + ".sha256")
    if not checksum_path.exists():
        warn(f"No checksum file found at {checksum_path}")
        return False

    expected = checksum_path.read_text().strip().split()[0]
    if not expected:
        warn(f"Empty checksum in {checksum_path}")
        return False

    import hashlib
    h = hashlib.sha256()
    with open(artifact_path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    actual = h.hexdigest()

    if actual == expected:
        ok("Checksum verified")
        return True
    warn(f"Checksum mismatch: expected {expected}, got {actual}")
    return False


def extract_artifact(artifact_path: Path, releases_dir: Path, version: str) -> Optional[Path]:
    """Extract a .tar.zst artifact into releases_dir. Returns the release directory path."""
    release_dir = releases_dir / version
    if release_dir.exists():
        info(f"Release {version} already exists — removing for re-extract")
        shutil.rmtree(release_dir)

    info(f"Extracting {artifact_path.name}...")
    try:
        # Use tar with zstd support
        result = subprocess.run(
            ["tar", "--zstd", "-xf", str(artifact_path), "-C", str(releases_dir)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            warn(f"Extraction failed: {result.stderr}")
            return None

        # The artifact extracts to e3cnc-stack-<version>/ — rename to just <version>
        extracted = releases_dir / f"e3cnc-stack-{version}"
        if extracted.exists() and extracted.is_dir():
            extracted.rename(release_dir)
        elif not release_dir.exists():
            warn(f"Unexpected extraction layout — expected {release_dir} or {extracted}")
            return None

        ok(f"Extracted to {release_dir}")
        return release_dir
    except (subprocess.CalledProcessError, OSError, ValueError) as e:
        warn(f"Extraction failed: {e}")
        return None


def run_pre_flight_checks(manifest: Dict[str, Any]) -> bool:
    """Run compatibility checks before activation. Returns True if all pass."""
    all_ok = True

    # Python version check
    py_required = manifest.get("python_requires", "")
    if py_required:
        py_current = f"{sys.version_info.major}.{sys.version_info.minor}"
        # Simple version check — supports >=X.Y
        match = re.match(r">=(\d+\.\d+)", py_required)
        if match:
            required = tuple(int(x) for x in match.group(1).split("."))
            current = (sys.version_info.major, sys.version_info.minor)
            if current < required:
                warn(f"Python {py_current} < required {py_required}")
                all_ok = False
            else:
                ok(f"Python {py_current} satisfies {py_required}")

    # Disk space check
    try:
        st = os.statvfs(str(RELEASES_DIR.parent))
        free_gb = (st.f_frsize * st.f_bavail) / (1024**3)
        if free_gb < 0.5:
            warn(f"Low disk space: {free_gb:.1f} GB free — need at least 0.5 GB")
            all_ok = False
        else:
            ok(f"Disk space: {free_gb:.1f} GB free")
    except OSError:
        pass

    return all_ok


# ── Activation ──────────────────────────────────────────────────────────────

def activate_release(version: str, release_dir: Path, journal: Journal) -> bool:
    """Activate a release by updating the current symlink. Returns True on success."""
    current_new = E3CNC_DIR / "current.new"
    try:
        # Atomic symlink switch
        current_new.symlink_to(release_dir)
        current_new.rename(CURRENT_SYMLINK)

        journal.previous = journal.current
        journal.current = version
        journal.applied_at = datetime.now(timezone.utc).isoformat()
        journal.save()

        ok(f"Activated release {version}")
        return True
    except OSError as e:
        warn(f"Activation failed: {e}")
        if current_new.exists() and not CURRENT_SYMLINK.exists():
            current_new.unlink()
        return False


def deactivate_release() -> bool:
    """Remove the current symlink without activating a new one."""
    try:
        if CURRENT_SYMLINK.exists():
            CURRENT_SYMLINK.unlink()
        return True
    except OSError:
        return False


# ── Health checks ───────────────────────────────────────────────────────────

@dataclass
class HealthCheckResult:
    """Result of a single health check."""
    name: str
    passed: bool
    detail: str = ""
    timeout: int = 10


def run_health_checks(inst: Optional[Instance] = None) -> List[HealthCheckResult]:
    """Run all health checks. Returns list of results."""
    results: List[HealthCheckResult] = []
    active_inst = inst or get_active_instance()
    if not active_inst:
        results.append(HealthCheckResult(
            name="Instance detection",
            passed=False,
            detail="No Klipper/Moonraker instance detected",
        ))
        return results

    moonraker_service = active_inst.moonraker_service
    klipper_service = active_inst.klipper_service
    moonraker_port = active_inst.moonraker_port
    web_root = active_inst.web_root

    # 1. Moonraker process
    r = _check_service(moonraker_service)
    results.append(r)

    # 2. Moonraker HTTP API
    r = _check_http_api(moonraker_port)
    results.append(r)

    # 3. Klippy connected
    r = _check_klippy_connected(moonraker_port)
    results.append(r)

    # 4. E3CNC component loaded
    r = _check_cnc_agent(moonraker_port)
    results.append(r)

    # 5. Frontend
    r = _check_frontend(web_root)
    results.append(r)

    # 6. Journal consistency
    r = _check_journal()
    results.append(r)

    # 7. Klipper process
    r = _check_service(klipper_service)
    results.append(r)

    return results


def _check_service(service_name: str) -> HealthCheckResult:
    """Check if a systemd service is active."""
    for attempt in range(HEALTH_CHECK_RETRIES):
        result = subprocess.run(
            ["systemctl", "is-active", service_name],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and "active" in result.stdout:
            return HealthCheckResult(
                name=f"Service {service_name}",
                passed=True,
                detail="active",
            )
        if attempt < HEALTH_CHECK_RETRIES - 1:
            time.sleep(HEALTH_CHECK_BACKOFF)
    return HealthCheckResult(
        name=f"Service {service_name}",
        passed=False,
        detail=f"not active after {HEALTH_CHECK_RETRIES} attempts (systemctl is-active returned {result.returncode})",
    )


def _check_http_api(port: int) -> HealthCheckResult:
    """Check if Moonraker HTTP API responds."""
    import urllib.request as urllib_req
    for attempt in range(HEALTH_CHECK_RETRIES):
        try:
            with urllib_req.urlopen(f"http://localhost:{port}/server/info", timeout=5) as resp:
                if resp.status == 200:
                    return HealthCheckResult(
                        name="Moonraker HTTP API",
                        passed=True,
                        detail=f"responded on port {port}",
                    )
        except (URLError, OSError):
            pass
        if attempt < HEALTH_CHECK_RETRIES - 1:
            time.sleep(HEALTH_CHECK_BACKOFF)
    return HealthCheckResult(
        name="Moonraker HTTP API",
        passed=False,
        detail=f"no response on port {port} after {HEALTH_CHECK_RETRIES} attempts",
    )


def _check_klippy_connected(port: int) -> HealthCheckResult:
    """Check if Moonraker reports klippy_connected."""
    import urllib.request as urllib_req
    try:
        with urllib_req.urlopen(f"http://localhost:{port}/server/info", timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if data.get("result", {}).get("klippy_connected"):
                return HealthCheckResult(
                    name="Klippy connection",
                    passed=True,
                    detail="klippy_connected=true",
                )
            return HealthCheckResult(
                name="Klippy connection",
                passed=False,
                detail="klippy_connected=false",
            )
    except (URLError, OSError, json.JSONDecodeError) as e:
        return HealthCheckResult(
            name="Klippy connection",
            passed=False,
            detail=str(e),
        )


def _check_cnc_agent(port: int) -> HealthCheckResult:
    """Check if E3CNC cnc_agent component is loaded."""
    import urllib.request as urllib_req
    try:
        with urllib_req.urlopen(f"http://localhost:{port}/machine/cnc_agent/info", timeout=5) as resp:
            if resp.status == 200:
                return HealthCheckResult(
                    name="E3CNC cnc_agent component",
                    passed=True,
                    detail="component loaded",
                )
            return HealthCheckResult(
                name="E3CNC cnc_agent component",
                passed=False,
                detail=f"HTTP {resp.status}",
            )
    except (URLError, OSError) as e:
        return HealthCheckResult(
            name="E3CNC cnc_agent component",
            passed=False,
            detail=str(e),
        )


def _check_frontend(web_root: str) -> HealthCheckResult:
    """Check if frontend index.html exists."""
    index = Path(web_root) / "index.html"
    if index.is_file():
        return HealthCheckResult(
            name="Frontend",
            passed=True,
            detail=f"index.html found at {web_root}",
        )
    return HealthCheckResult(
        name="Frontend",
        passed=False,
        detail=f"index.html not found at {web_root}",
    )


def _check_journal() -> HealthCheckResult:
    """Check journal consistency."""
    journal = Journal.load()
    if not journal.current:
        return HealthCheckResult(
            name="Deployment journal",
            passed=False,
            detail="journal is empty or missing",
        )
    release = get_current_release()
    if release and release.version == journal.current:
        return HealthCheckResult(
            name="Deployment journal",
            passed=True,
            detail=f"current={journal.current}, symlink matches",
        )
    return HealthCheckResult(
        name="Deployment journal",
        passed=False,
        detail=f"mismatch: journal says {journal.current}, symlink points to {release.version if release else 'broken'}",
    )


# ── Rollback ────────────────────────────────────────────────────────────────

def rollback_to(version: str) -> bool:
    """Roll back to a specific installed release."""
    releases = {r.version: r for r in get_releases()}
    if version not in releases:
        warn(f"Release {version} is not installed")
        return False

    journal = Journal.load()
    release_dir = releases[version].path

    if not activate_release(version, release_dir, journal):
        return False

    ok(f"Rolled back to {version}")
    return True


def rollback_previous() -> bool:
    """Roll back to the previously active release."""
    journal = Journal.load()
    if not journal.previous:
        warn("No previous release recorded in journal")
        return False
    return rollback_to(journal.previous)


def auto_rollback(journal: Journal) -> bool:
    """Automatically roll back to the previous release. Returns True on success."""
    if not journal.previous:
        warn("Cannot auto-rollback: no previous release recorded")
        return False
    prev = journal.previous
    warn(f"Auto-rolling back to {prev}...")
    releases = {r.version: r for r in get_releases()}
    if prev not in releases:
        warn(f"Previous release {prev} is not installed on disk")
        return False

    # Re-run activation for the previous release
    success = activate_release(prev, releases[prev].path, journal)
    if success:
        journal.last_known_good = prev
        journal.save()
        ok(f"Rolled back to {prev}")
    return success


# ── Release GC ──────────────────────────────────────────────────────────────

def prune_releases(keep: int = DEFAULT_KEEP_RELEASES, dry_run: bool = False) -> List[str]:
    """Remove old releases, keeping the N most recent. Returns list of pruned versions."""
    releases = get_releases()
    if len(releases) <= keep:
        return []

    journal = Journal.load()
    preserve = set()
    # Always keep the N most recent
    for r in releases[:keep]:
        preserve.add(r.version)
    # Always keep previous and last_known_good
    preserve.add(journal.previous)
    preserve.add(journal.last_known_good)

    pruned: List[str] = []
    for r in releases:
        if r.version not in preserve:
            if dry_run:
                info(f"Would prune {r.version} ({_format_size(r.size_bytes)})")
            else:
                shutil.rmtree(r.path)
                info(f"Pruned {r.version} ({_format_size(r.size_bytes)})")
            pruned.append(r.version)

    if not dry_run and pruned:
        ok(f"Pruned {len(pruned)} old release(s)")
    elif not pruned:
        info("No releases to prune")
    return pruned


# ── Migration from old layout ──────────────────────────────────────────────

def detect_old_layout() -> bool:
    """Detect if the current installation uses the old (pre-single-deploy) layout."""
    return not E3CNC_DIR.exists() and (Path.home() / "E3CNC").exists()


def migrate_layout(inst: Optional[Instance] = None, version: Optional[str] = None) -> bool:
    """Migrate from old layout to new single-deploy layout."""
    if E3CNC_DIR.exists():
        info("Already using new layout")
        return True

    active_inst = inst or get_active_instance()
    if not active_inst:
        warn("No instance detected — cannot migrate")
        return False

    step(1, 5, "Downloading latest stack artifact")
    # Find the latest release
    if version:
        asset = find_stack_artifact_asset(version)
    else:
        asset = find_stack_artifact_asset()
    if not asset:
        warn("No stack artifact found. Create a release on GitHub first.")
        return False

    artifact_ver = asset.get("name", "").replace("e3cnc-stack-", "").replace(".tar.zst", "")

    # Download
    artifact_path = download_artifact(asset, Path("/tmp") / "e3cnc-download")
    if not artifact_path:
        return False

    step(2, 5, "Verifying checksum")
    if not verify_checksum(artifact_path):
        return False

    step(3, 5, "Creating runtime layout")
    E3CNC_DIR.mkdir(parents=True, exist_ok=True)

    step(4, 5, "Extracting release")
    release_dir = extract_artifact(artifact_path, RELEASES_DIR, artifact_ver)
    if not release_dir:
        return False

    step(5, 5, "Activating")
    journal = Journal.load()
    if not activate_release(artifact_ver, release_dir, journal):
        return False

    journal.last_known_good = artifact_ver
    journal.save()

    ok("Migration complete — new layout active")
    return True


# ── State backup ────────────────────────────────────────────────────────────

def backup_deployment_state(inst: Optional[Instance] = None) -> Optional[Path]:
    """Back up mutable deployment state before an update. Returns backup path or None."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUPS_DIR / f"pre-update-{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    active_inst = inst or get_active_instance()

    # Config files
    if active_inst:
        for key, path_str in [("moonraker.conf", active_inst.moonraker_conf),
                               ("printer.cfg", active_inst.printer_cfg)]:
            p = Path(path_str)
            if p.exists():
                shutil.copy2(p, backup_dir / key)

        # Moonraker DB namespaces (via API export)
        import urllib.request as urllib_req
        try:
            port = active_inst.moonraker_port
            with urllib_req.urlopen(f"http://localhost:{port}/server/database/export", timeout=10) as resp:
                db_data = json.loads(resp.read().decode())
                (backup_dir / "moonraker_db.json").write_text(json.dumps(db_data, indent=2))
        except (URLError, OSError, json.JSONDecodeError):
            pass

    # Journal
    if JOURNAL_PATH.exists():
        shutil.copy2(JOURNAL_PATH, backup_dir / "journal.json")

    # WCS offsets
    wcs = Path.home() / "wcs_offsets.json"
    if wcs.exists():
        shutil.copy2(wcs, backup_dir / "wcs_offsets.json")

    info(f"State backed up to {backup_dir}")
    return backup_dir


# ── Helpers ─────────────────────────────────────────────────────────────────

def _format_size(bytes_val: int) -> str:
    if bytes_val < 1024:
        return f"{bytes_val} B"
    elif bytes_val < 1024 ** 2:
        return f"{bytes_val / 1024:.1f} KB"
    elif bytes_val < 1024 ** 3:
        return f"{bytes_val / (1024 ** 2):.1f} MB"
    return f"{bytes_val / (1024 ** 3):.1f} GB"


def format_release_list(releases: List[Release]) -> str:
    """Format a list of releases for display."""
    lines: List[str] = []
    lines.append(f"  {Style.BOLD}Installed releases{Style.RESET}")
    lines.append(f"  {'─' * 60}")
    for r in releases:
        active = " ◀ active" if r.is_active else ""
        ver = r.version.ljust(20)
        size = _format_size(r.size_bytes).rjust(10)
        created = (r.created_at or "unknown")[:19]
        lines.append(f"  {ver} {size}  {created}{active}")
    lines.append(f"  {'─' * 60}")
    # Disk usage
    total = sum(r.size_bytes for r in releases)
    lines.append(f"  Total: {_format_size(total)}")
    try:
        st = os.statvfs(str(RELEASES_DIR))
        free_gb = (st.f_frsize * st.f_bavail) / (1024**3)
        lines.append(f"  Free disk: {free_gb:.1f} GB")
    except OSError:
        pass
    return "\n".join(lines)


# ── Runtime file sync ───────────────────────────────────────────────────────

def sync_runtime_files(inst: Optional[Instance] = None, dry_run: bool = False) -> bool:
    """Sync runtime files from ~/e3cnc/current/ to live system paths.

    Deploys: Moonraker components, Klipper extras, macros, scripts, frontend.
    Returns True if all syncs succeeded.
    """
    current = get_current_release()
    if not current:
        warn("No active release — cannot sync runtime files")
        return False

    active_inst = inst or get_active_instance()
    if not active_inst:
        warn("No instance detected — cannot sync runtime files")
        return False

    release_root = current.path
    all_ok = True

    # 1. Moonraker components (cnc_agent, cnc_metadata)
    components = ["cnc_agent", "cnc_metadata"]
    for comp in components:
        src = release_root / "moonraker" / comp
        dest = Path(active_inst.moonraker_dir) / "moonraker" / "components" / comp
        if src.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
            for f in src.iterdir():
                if f.is_file():
                    if dry_run:
                        info(f"Would copy {f} -> {dest / f.name}")
                    else:
                        shutil.copy2(f, dest / f.name)
            info(f"Synced Moonraker component: {comp}")
        else:
            warn(f"Moonraker component source not found: {src}")
            all_ok = False

    # 2. MCP server
    mcp_src = release_root / "moonraker" / "mcp"
    mcp_dest = Path(active_inst.moonraker_dir) / "moonraker" / "components" / "mcp"
    if mcp_src.is_dir():
        mcp_dest.mkdir(parents=True, exist_ok=True)
        for f in mcp_src.iterdir():
            if f.is_file() and f.suffix == ".py":
                if dry_run:
                    info(f"Would copy {f} -> {mcp_dest / f.name}")
                else:
                    shutil.copy2(f, mcp_dest / f.name)
        info("Synced MCP server")

    # 3. Klipper extras
    extras_src = release_root / "klipper" / "extras"
    extras_dest = Path(active_inst.klipper_dir) / "klippy" / "extras"
    if extras_src.is_dir():
        extras_dest.mkdir(parents=True, exist_ok=True)
        for f in extras_src.iterdir():
            if f.is_file():
                if dry_run:
                    info(f"Would copy {f} -> {extras_dest / f.name}")
                else:
                    shutil.copy2(f, extras_dest / f.name)
        info("Synced Klipper extras")
    else:
        warn(f"Klipper extras source not found: {extras_src}")
        all_ok = False

    # 4. Macros
    macros_src = release_root / "config" / "macros"
    macros_dest = Path(active_inst.E3CNC_dir) / "macros"
    if macros_src.is_dir():
        macros_dest.mkdir(parents=True, exist_ok=True)
        for f in macros_src.iterdir():
            if f.is_file():
                if dry_run:
                    info(f"Would copy {f} -> {macros_dest / f.name}")
                else:
                    shutil.copy2(f, macros_dest / f.name)
        info("Synced macros")

    # 5. Metadata extractor script
    script_src = release_root / "scripts" / "cnc_metadata_extractor.py"
    if script_src.is_file():
        script_dest = Path(active_inst.scripts_dir) / "cnc_metadata_extractor.py"
        if dry_run:
            info(f"Would copy {script_src} -> {script_dest}")
        else:
            shutil.copy2(script_src, script_dest)
            script_dest.chmod(0o755)
        info("Synced metadata extractor")

    # 6. Frontend (sync to web root)
    fe_src = release_root / "frontend"
    fe_dest = Path(active_inst.web_root)
    if fe_src.is_dir():
        fe_dest.mkdir(parents=True, exist_ok=True)
        if dry_run:
            info(f"Would sync frontend {fe_src} -> {fe_dest}")
        else:
            # rsync-style: copy all files, overwrite existing
            for f in fe_src.rglob("*"):
                if f.is_file():
                    rel = f.relative_to(fe_src)
                    target = fe_dest / rel
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, target)
        info("Synced frontend")

    if all_ok:
        ok("Runtime files synced")
    else:
        warn("Some runtime files could not be synced")
    return all_ok


# ── Systemd management ───────────────────────────────────────────────────────

def update_systemd_paths(inst: Optional[Instance] = None, dry_run: bool = False) -> bool:
    """Update systemd drop-ins to point to the current release."""
    current = get_current_release()
    if not current:
        warn("No active release — cannot update systemd paths")
        return False

    active_inst = inst or get_active_instance()
    if not active_inst:
        warn("No instance detected")
        return False

    current_path = str(current.path)
    all_ok = True

    # Create systemd drop-in directory
    services = {
        active_inst.moonraker_service: {
            "WorkingDirectory": current_path / "moonraker",
        },
    }
    # Only update Klipper if extras are present in the release
    klipper_extras = current.path / "klipper" / "extras"
    if klipper_extras.is_dir():
        services[active_inst.klipper_service] = {}

    for service_name, overrides in services.items():
        dropin_dir = Path("/etc/systemd/system") / f"{service_name}.service.d"
        dropin_path = dropin_dir / "e3cnc-override.conf"

        if not shutil.which("systemctl"):
            info(f"systemctl not available — skipping systemd update for {service_name}")
            continue

        if dry_run:
            info(f"Would create systemd drop-in: {dropin_path}")
            continue

        try:
            dropin_dir.mkdir(parents=True, exist_ok=True)
            lines = ["[Service]"]
            for key, val in overrides.items():
                lines.append(f"{key}={val}")
            dropin_path.write_text("\n".join(lines) + "\n")
            info(f"Updated systemd drop-in: {service_name}")
        except PermissionError:
            warn(f"Permission denied: {dropin_path} — try running with sudo")
            all_ok = False
        except OSError as e:
            warn(f"Failed to update systemd for {service_name}: {e}")
            all_ok = False

    # Reload systemd to pick up drop-in changes
    if all_ok and not dry_run and shutil.which("systemctl"):
        try:
            subprocess.run(["sudo", "systemctl", "daemon-reload"], capture_output=True, timeout=15)
            info("Systemd daemon reloaded")
        except (OSError, subprocess.CalledProcessError, ValueError) as e:
            warn(f"Failed to reload systemd: {e}")

    return all_ok


def restart_services(inst: Optional[Instance] = None, dry_run: bool = False) -> bool:
    """Restart services in the correct order: Moonraker first, then Klipper."""
    active_inst = inst or get_active_instance()
    if not active_inst:
        warn("No instance detected — cannot restart services")
        return False

    if not shutil.which("systemctl"):
        warn("systemctl not available — cannot restart services")
        return False

    # Ensure sudo access before attempting restarts
    from _e3cnc_shared import _ensure_local_sudo_access
    _ensure_local_sudo_access("restarting Moonraker and Klipper services")

    order = [active_inst.moonraker_service, active_inst.klipper_service]
    all_ok = True

    for svc in order:
        if dry_run:
            info(f"Would restart {svc}")
            continue
        info(f"Restarting {svc}...")
        try:
            result = subprocess.run(
                ["sudo", "systemctl", "restart", svc],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                ok(f"{svc} restarted")
                time.sleep(2)  # Brief cooldown between services
            else:
                warn(f"{svc} restart failed: {result.stderr.strip()}")
                all_ok = False
        except (subprocess.CalledProcessError, OSError, ValueError) as e:
            warn(f"Failed to restart {svc}: {e}")
            all_ok = False

    return all_ok


# ── Pip dependency installation ─────────────────────────────────────────────

def install_pip_deps(release_dir: Optional[Path] = None, dry_run: bool = False) -> bool:
    """Install pip dependencies from vendored wheels in the release."""
    rdir = release_dir or (get_current_release().path if get_current_release() else None)
    if not rdir:
        warn("No release to install pip deps from")
        return False

    wheels_dir = rdir / "moonraker" / "wheels"
    req_file = rdir / "moonraker" / "requirements.txt"

    if not req_file.exists():
        info("No requirements.txt found — skipping pip install")
        return True

    if dry_run:
        info(f"Would pip install from {req_file}")
        return True

    cmd = [sys.executable, "-m", "pip", "install"]
    if wheels_dir.is_dir():
        cmd.extend(["--no-index", "--find-links", str(wheels_dir)])
    cmd.extend(["-r", str(req_file)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            ok("Pip dependencies installed")
            return True
        else:
            warn(f"Pip install failed: {result.stderr.strip()}")
            return False
    except (subprocess.CalledProcessError, OSError, ValueError) as e:
        warn(f"Pip install error: {e}")
        return False


# ── Config/schema migrations ────────────────────────────────────────────────

def run_migrations(release_dir: Optional[Path] = None, direction: str = "up", dry_run: bool = False) -> bool:
    """Run config/schema migrations from the release's migrations/ directory.

    Args:
        release_dir: Path to the release directory (default: current release)
        direction: 'up' for forward migrations, 'down' for reverse
        dry_run: If True, only log what would be done

    Returns True if all migrations succeeded.
    """
    rdir = release_dir or (get_current_release().path if get_current_release() else None)
    if not rdir:
        warn("No release to run migrations from")
        return False

    migrations_dir = rdir / "migrations"
    if not migrations_dir.is_dir():
        info("No migrations directory — skipping")
        return True

    journal = Journal.load()
    current_schema = journal.config_schema

    # Find migration scripts
    migration_files = sorted(migrations_dir.glob("[0-9]*.py"))
    if not migration_files:
        info("No migration scripts found")
        return True

    all_ok = True
    for mf in migration_files:
        try:
            # Parse schema version from filename
            name_match = re.match(r"(\d+)_", mf.name)
            if not name_match:
                continue
            schema_version = int(name_match.group(1))

            if direction == "up" and schema_version <= current_schema:
                continue  # Already applied
            if direction == "down" and schema_version > current_schema:
                continue  # Not applicable when going down

            if dry_run:
                info(f"Would run migration {direction}: {mf.name}")
                continue

            # Execute migration script
            result = subprocess.run(
                [sys.executable, str(mf), direction],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                ok(f"Migration {mf.name} ({direction})")
                if direction == "up":
                    journal.config_schema_previous = current_schema
                    journal.config_schema = schema_version
                else:
                    journal.config_schema = journal.config_schema_previous
                journal.save()
            else:
                warn(f"Migration {mf.name} failed: {result.stderr.strip()}")
                all_ok = False
        except (OSError, ValueError, subprocess.CalledProcessError) as e:
            warn(f"Migration error {mf.name}: {e}")
            all_ok = False

    return all_ok
