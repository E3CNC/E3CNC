"""Single-deploy stack infrastructure for E3CNC CLI.

Provides staged runtime activation, artifact management, health checks,
rollback, and release GC. Designed to be imported by the e3cnc-cli Python
frontend and called as a subprocess by the e3cnc-tui Go TUI.

When called as a subprocess by the Go TUI (e3cnc-tui), error codes are
emitted as structured JSON on stderr with the prefix "E3CNC_ERROR:" so
the TUI can parse and display context-aware recovery suggestions.
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
    Instance, get_active_instance, detect_instances, INSTANCES_DIR,
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
DEFAULT_KEEP_BACKUPS = 5
HEALTH_CHECK_RETRIES = 6
HEALTH_CHECK_BACKOFF = 5  # seconds


# -- Error codes (machine-readable, consumed by Go TUI) ---------------------

E3CNC_ERROR_PREFIX = "E3CNC_ERROR:"

E3CNC_ERROR_CODES = {
    "PYTHON_VERSION": "Python version below minimum requirement",
    "GIT_NOT_FOUND": "git is not installed",
    "CURL_NOT_FOUND": "curl is not installed",
    "UNZIP_NOT_FOUND": "unzip is not installed",
    "ZSTD_NOT_FOUND": "zstd is not installed",
    "DISK_FULL": "Insufficient disk space",
    "NETWORK_UNAVAILABLE": "GitHub API is unreachable",
    "GITHUB_RATE_LIMIT": "GitHub API rate limit exceeded",
    "DOWNLOAD_FAILED": "Artifact download failed",
    "CHECKSUM_MISMATCH": "Artifact checksum verification failed",
    "EXTRACT_FAILED": "Artifact extraction failed",
    "ACTIVATION_FAILED": "Release activation (symlink swap) failed",
    "SERVICE_RESTART_FAILED": "Service failed to restart after update",
    "MOONRAKER_API_DOWN": "Moonraker API is not responding",
    "KLIPPY_NOT_READY": "Klippy is not connected (optional check)",
    "CNC_AGENT_MISSING": "E3CNC cnc_agent component did not load",
    "FRONTEND_NOT_FOUND": "Frontend web root is missing index.html",
    "PERMISSION_DENIED": "Permission denied writing to path",
    "SUDO_REQUIRED": "Sudo access is required for this operation",
    "PORT_CONFLICT": "Port is already in use by another instance",
}


def emit_error(code: str, detail: str = "", phase: int = 0) -> None:
    """Emit a structured error code to stderr for the Go TUI to parse.

    The Go runner captures stderr separately and scans for lines matching
    E3CNC_ERROR: prefix. The parsed error code maps to a human-readable
    suggestion in the Go TUI error recovery screen.

    Args:
        code: One of the keys in E3CNC_ERROR_CODES.
        detail: Human-readable detail about the failure.
        phase: The install phase number (1-9) where the error occurred.
    """
    import json as _json
    payload = _json.dumps({
        "code": code,
        "detail": detail,
        "phase": phase,
    })
    print(f"{E3CNC_ERROR_PREFIX}{payload}", file=sys.stderr)


# -- Data classes ------------------------------------------------------------

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
    """Get assets from the latest GitHub release that has a stack artifact.

    Iterates through releases (newest first) until one with assets is found
    or the list is exhausted. This handles the case where the latest release
    tag was created without running the CI build.
    """
    data = _github_api_request("releases/latest")
    if data and "assets" in data:
        assets = data["assets"]
        # Fast path: latest release has assets
        if any(a.get("name", "").startswith("e3cnc-stack-") and a["name"].endswith(".tar.zst") for a in assets):
            return assets
    # Slow path: iterate recent releases to find one with a stack artifact
    all_releases_data = _github_api_request("releases?per_page=10")
    all_releases = all_releases_data if isinstance(all_releases_data, list) else []
    for release in all_releases:
        if not isinstance(release, dict):
            continue
        if release.get("draft") or release.get("prerelease"):
            continue  # Skip nightlies and drafts
        assets = release.get("assets", [])
        if isinstance(assets, list) and any(
            isinstance(a, dict) and (n := a.get("name", ""), n.startswith("e3cnc-stack-") and n.endswith(".tar.zst"))[1]
            for a in assets
        ):
            return assets
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
    """Download a release artifact to dest_dir. Also downloads .sha256 if available.
    Returns the path to the downloaded file."""
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

        # Also download checksum file if it exists alongside the artifact
        checksum_name = f"{name}.sha256"
        checksum_url = f"{url}.sha256"
        try:
            req_checksum = Request(checksum_url, headers={"Accept": "application/octet-stream"})
            with urlopen(req_checksum, timeout=30) as resp_checksum:
                checksum_data = resp_checksum.read()
                (dest_dir / checksum_name).write_bytes(checksum_data)
        except (URLError, OSError):
            pass  # Checksum may not exist

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

    parts = checksum_path.read_text().strip().split()
    if not parts:
        warn(f"Empty checksum in {checksum_path}")
        return False
    expected = parts[0]

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

    if not shutil.which("zstd"):
        warn("zstd not found — install it with: apt install zstd (or equivalent)")
        return None

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

    # zstd check — required for extracting .tar.zst artifacts
    if not shutil.which("zstd"):
        warn("zstd not found — install it with: apt install zstd (or equivalent)")
        all_ok = False
    else:
        ok("zstd found")

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
    optional: bool = False
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

    # 1. Moonraker HTTP API (primary — proves Moonraker is running)
    api_check = _check_http_api(moonraker_port)
    results.append(api_check)

    # 2. Moonraker service (skip if API already confirmed Moonraker is up)
    if not api_check.passed:
        r = _check_service(moonraker_service)
        results.append(r)

    # 3. Klippy connected (optional — may not be running on bootstrap)
    r = _check_klippy_connected(moonraker_port)
    r.optional = True
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

    # 7. Klipper process (optional — may not have a valid printer.cfg yet)
    r = _check_service(klipper_service)
    r.optional = True
    results.append(r)

    return results


def _check_service(service_name: str) -> HealthCheckResult:
    """Check if a service is active (supervisor first, then systemd)."""
    for attempt in range(HEALTH_CHECK_RETRIES):
        # Try supervisor first (needs sudo for the unix socket)
        if shutil.which("supervisorctl"):
            result = subprocess.run(
                ["sudo", "supervisorctl", "status", service_name],
                capture_output=True, text=True, timeout=5,
            )
            if "RUNNING" in result.stdout:
                return HealthCheckResult(
                    name=f"Service {service_name}",
                    passed=True,
                    detail="running (supervisor)",
                )
        # Fallback: systemd
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
        with urllib_req.urlopen(f"http://localhost:{port}/server/cnc/state", timeout=5) as resp:
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


def prune_backups(keep: int = DEFAULT_KEEP_BACKUPS, dry_run: bool = False) -> List[str]:
    """Remove old backups, keeping the N most recent. Returns list of pruned backup names."""
    if not BACKUPS_DIR.is_dir():
        return []

    # Sort backups by directory name (timestamps sort lexicographically)
    backups = sorted(
        [d for d in BACKUPS_DIR.iterdir() if d.is_dir()],
        key=lambda p: p.name,
        reverse=True,
    )

    if len(backups) <= keep:
        return []

    pruned: List[str] = []
    for b in backups[keep:]:
        size = sum(f.stat().st_size for f in b.rglob("*") if f.is_file()) if b.is_dir() else 0
        if dry_run:
            info(f"Would prune {b.name} ({_format_size(size)})")
        else:
            shutil.rmtree(b)
            info(f"Pruned {b.name} ({_format_size(size)})")
        pruned.append(b.name)

    if not dry_run and pruned:
        ok(f"Pruned {len(pruned)} old backup(s)")
    elif not pruned:
        info("No backups to prune")
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
        warn("No stack artifact found in any recent GitHub release.")
        info("To create a release with artifacts, run:")
        info("  gh workflow run build-frontend.yml -f version_tag=<tag>")
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


# ── Instance layout migration ─────────────────────────────────────────────

def migrate_instances(auto_yes: bool = False) -> int:
    """Migrate KIAUH-layout instances to new ~/e3cnc/instances/{name} layout.

    Returns count of migrated instances. Returns 0 if nothing to migrate.
    """
    from _e3cnc_shared import _scan_kiauh_instances

    old_instances = _scan_kiauh_instances()
    if not old_instances:
        info("No KIAUH-layout instances found — nothing to migrate")
        return 0

    info(f"Found {len(old_instances)} KIAUH-layout instance(s) to migrate")
    print()

    migrated = 0
    for inst in old_instances:
        name = inst.name
        # Map legacy names to new convention
        if name == "cnc":
            name = "default"
        elif name.startswith("cnc_"):
            name = name[4:]  # cnc_test1 -> test1

        new_base = INSTANCES_DIR / name
        new_data = new_base / "data"
        new_config = new_data / "config"
        new_frontend = new_base / "frontend"

        if new_base.exists():
            if not auto_yes:
                reply = input(
                    f"  {Style.YELLOW}Instance '{name}' already exists at {new_base}. Overwrite? [y/N] {Style.RESET}"
                ).strip().lower()
                if reply != "y":
                    info(f"Skipping {name}")
                    continue
            else:
                info(f"Instance '{name}' already exists — overwriting")

        ok(f"Migrating: ~/{Path(inst.printer_data_dir).name} -> {name}")

        # Create new directory structure
        for subdir in ["config", "config/E3CNC/macros", "logs", "database", "comms", "scripts", "gcodes"]:
            (new_data / subdir).mkdir(parents=True, exist_ok=True)
        new_frontend.mkdir(parents=True, exist_ok=True)

        # Move config files
        old_config = Path(inst.config_dir)
        if old_config.is_dir():
            for item in old_config.iterdir():
                dest = new_config / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                else:
                    shutil.copy2(item, dest)
            shutil.rmtree(old_config)
        else:
            warn(f"Config dir not found: {old_config}")

        # Move logs
        old_logs = Path(inst.printer_data_dir) / "logs"
        if old_logs.is_dir():
            for f in old_logs.iterdir():
                shutil.copy2(f, new_data / "logs" / f.name)
            shutil.rmtree(old_logs)

        # Move database
        old_db = Path(inst.printer_data_dir) / "database"
        if old_db.is_dir():
            shutil.copytree(old_db, new_data / "database", dirs_exist_ok=True)
            shutil.rmtree(old_db)

        # Move comms
        old_comms = Path(inst.printer_data_dir) / "comms"
        if old_comms.is_dir():
            shutil.copytree(old_comms, new_data / "comms", dirs_exist_ok=True)
            shutil.rmtree(old_comms)

        # Move scripts
        old_scripts = Path(inst.scripts_dir)
        if old_scripts.is_dir():
            shutil.copytree(old_scripts, new_data / "scripts", dirs_exist_ok=True)
            shutil.rmtree(old_scripts)

        # Move gcodes
        old_gcodes = Path(inst.printer_data_dir) / "gcodes"
        if old_gcodes.is_dir():
            shutil.copytree(old_gcodes, new_data / "gcodes", dirs_exist_ok=True)
            shutil.rmtree(old_gcodes)

        # Move frontend
        old_frontend = Path(inst.web_root)
        if old_frontend.is_dir():
            shutil.copytree(old_frontend, new_frontend, dirs_exist_ok=True)
            shutil.rmtree(old_frontend)

        # Update moonraker.conf paths
        conf_file = new_config / "moonraker.conf"
        if conf_file.exists():
            text = conf_file.read_text()
            # Update database path
            text = re.sub(
                r"database_path:\s*.+",
                f"database_path: {new_data / 'database'}",
                text,
            )
            # Update klippy_uds_address
            text = re.sub(
                r"klippy_uds_address:\s*.+",
                f"klippy_uds_address: {new_data / 'comms' / 'klippy.sock'}",
                text,
            )
            conf_file.write_text(text)
            ok(f"Updated moonraker.conf paths for {name}")

        # Remove old printer_data base dir
        old_base = Path(inst.printer_data_dir)
        if old_base.is_dir() and old_base.name.startswith("printer_"):
            try:
                shutil.rmtree(old_base)
                info(f"Removed old {old_base.name}")
            except OSError as e:
                warn(f"Could not remove {old_base.name}: {e}")

        migrated += 1
        print()

    if migrated:
        ok(f"Migrated {migrated} instance(s) to ~/e3cnc/instances/{{name}}/")
        info("Old systemd units and nginx sites still exist with old names.")
        info("Run 'e3cnc-cli update' to refresh runtime files and restart services.")
        info("Then manually remove old systemd units and nginx sites:")
        info("  sudo systemctl disable --now <old-service-name>")
        info("  sudo rm /etc/systemd/system/<old-service-name>.service")
        info("  sudo rm /etc/nginx/sites-available/<old-site> /etc/nginx/sites-enabled/<old-site>")
        info("  sudo systemctl daemon-reload")
    else:
        info("No instances migrated")

    return migrated


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

        # Raw Moonraker SQLite database (works even when Moonraker is down)
        db_dir = Path(active_inst.printer_data_dir) / "database"
        for db_file in db_dir.glob("*"):
            if db_file.is_file() and db_file.suffix in (".sqlite", ".db", ".sqlite3"):
                shutil.copy2(db_file, backup_dir / db_file.name)

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

    # 1. Moonraker components (cnc_agent, cnc_metadata) — from vendor tree
    components = ["cnc_agent", "cnc_metadata"]
    for comp in components:
        src = release_root / "vendor" / "moonraker" / "moonraker" / "components" / comp
        dest = Path(active_inst.moonraker_dir) / "moonraker" / "components" / comp
        if src.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
            for f in src.iterdir():
                if f.is_file():
                    if dry_run:
                        info(f"Would copy {f} -> {dest / f.name}")
                    else:
                        try:
                            shutil.copy2(f, dest / f.name)
                        except shutil.SameFileError:
                            pass
            info(f"Synced Moonraker component: {comp}")
        else:
            warn(f"Moonraker component source not found: {src}")
            all_ok = False

    # 2. MCP server — from vendor tree
    mcp_src = release_root / "vendor" / "moonraker" / "mcp"
    mcp_dest = Path(active_inst.moonraker_dir) / "moonraker" / "components" / "mcp"
    if mcp_src.is_dir():
        mcp_dest.mkdir(parents=True, exist_ok=True)
        for f in mcp_src.iterdir():
            if f.is_file() and f.suffix == ".py":
                if dry_run:
                    info(f"Would copy {f} -> {mcp_dest / f.name}")
                else:
                    try:
                        shutil.copy2(f, mcp_dest / f.name)
                    except shutil.SameFileError:
                        pass
        info("Synced MCP server")

    # 3. Klipper extras — from vendor tree
    extras_src = release_root / "vendor" / "klipper" / "klippy" / "extras"
    extras_dest = Path(active_inst.klipper_dir) / "klippy" / "extras"
    if extras_src.is_dir():
        extras_dest.mkdir(parents=True, exist_ok=True)
        for f in extras_src.iterdir():
            if f.is_file():
                if dry_run:
                    info(f"Would copy {f} -> {extras_dest / f.name}")
                else:
                    try:
                        shutil.copy2(f, extras_dest / f.name)
                    except shutil.SameFileError:
                        pass
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
            script_dest.parent.mkdir(parents=True, exist_ok=True)
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

    current_path = current.path
    all_ok = True

    # Ensure sudo access before modifying systemd
    from _e3cnc_shared import _ensure_local_sudo_access
    sudo_ok = _ensure_local_sudo_access("updating systemd service paths")

    # Create systemd drop-in directory
    services = {
        active_inst.moonraker_service: {
            "WorkingDirectory": current_path / "vendor" / "moonraker",
        },
    }
    # Only update Klipper if extras are present in the release
    klipper_extras = current.path / "vendor" / "klipper" / "klippy" / "extras"
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


# ── Moonraker config fixer ──────────────────────────────────────────────────

def fix_moonraker_config(conf_path: str, dry_run: bool = False) -> bool:
    """Merge duplicate [section] entries in moonraker.conf into one.

    Moonraker's config parser rejects duplicate sections. If the config file
    has the same section header twice (e.g. two [file_manager] blocks), this
    merges all key=value pairs into the first occurrence and removes the
    duplicate headers. Non-section lines (empty, comments) between duplicates
    are preserved.
    """
    path = Path(conf_path)
    if not path.exists():
        warn(f"moonraker.conf not found at {path}")
        return False

    raw = path.read_text()
    lines = raw.split("\n")

    # Find section boundaries
    sections: "list[tuple[int, int, str]]" = []
    current_start: Optional[int] = None
    current_name: Optional[str] = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            if current_start is not None and current_name is not None:
                sections.append((current_start, i, current_name))
            current_start = i
            current_name = stripped
    if current_start is not None and current_name is not None:
        sections.append((current_start, len(lines), current_name))

    # Find duplicates
    seen: dict[str, list[tuple[int, int]]] = {}
    for start, end, name in sections:
        seen.setdefault(name, []).append((start, end))

    dups = {name: ranges for name, ranges in seen.items() if len(ranges) > 1}
    if not dups:
        return True  # nothing to fix

    if dry_run:
        for name, ranges in dups.items():
            info(f"Would merge {len(ranges)} duplicate [{name}] sections (lines {ranges[0][0]+1}–{ranges[-1][1]})")
        return True

    # Build new content: keep first occurrence, merge key=values from duplicates
    result_lines: list[str] = []
    skip_until = -1
    merged_count = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if i < skip_until:
            continue

        is_section = stripped.startswith("[") and stripped.endswith("]")
        if is_section and stripped in dups:
            ranges = dups[stripped]
            seen_keys: set[str] = set()
            merged_lines: list[str] = []

            # Scan from line after first header up to the last duplicate's end
            for j in range(ranges[0][0] + 1, ranges[-1][1]):
                l = lines[j]
                ls = l.strip()
                # Skip duplicate section headers (but keep other sections)
                if ls.startswith("[") and ls.endswith("]") and ls == stripped:
                    continue
                if ls.startswith("#") or ls.startswith(";") or ls == "":
                    merged_lines.append(l)
                elif "=" in ls or ":" in ls:
                    key = ls.split("=", 1)[0].split(":", 1)[0].strip()
                    if key not in seen_keys:
                        seen_keys.add(key)
                        merged_lines.append(l)
                else:
                    merged_lines.append(l)

            result_lines.append(line)
            result_lines.extend(merged_lines)
            merged_count += len(ranges) - 1
            # Skip every line up to and including the last duplicate's end
            skip_until = ranges[-1][1]
        else:
            if i < skip_until:
                continue
            result_lines.append(line)

    new_content = "\n".join(result_lines)
    if new_content != raw:
        path.write_text(new_content)
        ok(f"Merged {merged_count} duplicate section(s) in {path.name}")
    return True


# ── Sudoers configuration ──────────────────────────────────────────────────

SUDOERS_PATH = "/etc/sudoers.d/e3cnc"

SUDOERS_CONTENT = """# E3CNC — passwordless sudo for process management
# Installed by e3cnc-cli. Do not edit manually.
#
# Allows the owning user to manage E3CNC services without a password prompt.
# These are the minimum required commands for CLI update/install/restart.

{user} ALL=(root) NOPASSWD: /usr/bin/systemctl restart e3cnc-*
{user} ALL=(root) NOPASSWD: /usr/bin/systemctl daemon-reload
{user} ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx
{user} ALL=(root) NOPASSWD: /usr/bin/supervisorctl *
{user} ALL=(root) NOPASSWD: /usr/bin/tee /etc/supervisor/conf.d/e3cnc-*.conf
{user} ALL=(root) NOPASSWD: /bin/ln -sf /etc/nginx/sites-* /etc/nginx/sites-enabled/*
{user} ALL=(root) NOPASSWD: /bin/rm /etc/supervisor/conf.d/e3cnc-*.conf
"""


def ensure_sudoers(dry_run: bool = False) -> bool:
    """Install the E3CNC sudoers drop-in for passwordless process management.

    Checks if the file already exists and is valid. Creates or updates it
    if needed. Safe to call repeatedly — no-op if already configured.
    """
    user = os.environ.get("USER", "")
    if not user:
        warn("Could not determine current user — cannot configure sudoers")
        return False

    content = SUDOERS_CONTENT.format(user=user)
    path = Path(SUDOERS_PATH)

    if path.exists():
        try:
            existing = path.read_text()
            if existing.strip() == content.strip():
                return True  # already up to date
            info(f"Updating {SUDOERS_PATH}...")
        except PermissionError:
            # File exists but owned by root — assume it's correct, skip
            return True

    if dry_run:
        info(f"Would install sudoers drop-in at {SUDOERS_PATH} for user '{user}'")
        return True

    # Write via a temp file with visudo validation
    import tempfile
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".e3cnc-sudoers", delete=False, dir="/tmp")
    try:
        tmp.write(content)
        tmp.close()

        # Validate with visudo
        result = subprocess.run(
            ["sudo", "visudo", "-c", "-f", tmp.name],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            warn(f"sudoers syntax check failed: {result.stderr.strip()}")
            return False

        # Install
        result = subprocess.run(
            ["sudo", "cp", tmp.name, str(path)],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            warn(f"Failed to install sudoers: {result.stderr.strip()}")
            return False

        subprocess.run(["sudo", "chmod", "0440", str(path)], capture_output=True, timeout=10)
        ok(f"Sudoers configured for user '{user}' — passwordless E3CNC service management enabled")
        return True
    except (OSError, subprocess.SubprocessError) as e:
        warn(f"Failed to configure sudoers: {e}")
        return False
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# ── Service management ─────────────────────────────────────────────────────

def restart_services(inst: Optional[Instance] = None, dry_run: bool = False) -> bool:
    """Restart services in the correct order: Moonraker first, then Klipper.

    Before restarting, merges duplicate sections in moonraker.conf (if any)
    to prevent Moonraker config validation errors on stricter versions.
    """
    active_inst = inst or get_active_instance()
    if not active_inst:
        warn("No instance detected — cannot restart services")
        return False

    if not shutil.which("systemctl"):
        warn("systemctl not available — cannot restart services")
        return False

    # Pre-flight: merge duplicate sections in moonraker.conf
    fix_moonraker_config(active_inst.moonraker_conf, dry_run=dry_run)

    # Pre-flight: ensure sudoers is configured for passwordless process mgmt
    ensure_sudoers(dry_run=dry_run)

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

    wheels_dir = rdir / "vendor" / "moonraker" / "wheels"
    req_file = rdir / "vendor" / "moonraker" / "requirements.txt"

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


# ── Admin page ──────────────────────────────────────────────────────────

ADMIN_PAGE_DIR = E3CNC_DIR / "admin"


def generate_admin_page() -> None:
    """Generate a static admin page at ~/e3cnc/admin/index.html with instance info."""
    from _e3cnc_shared import detect_instances, VERSION
    import socket, platform

    ADMIN_PAGE_DIR.mkdir(parents=True, exist_ok=True)

    instances = detect_instances()
    # Get local IP address (reliable, works even if hostname resolves to 127.0.0.1)
    ip = _get_local_ip()
    current = get_current_release()

    cards = ""
    for inst in instances:
        dot = "&#9679;" if inst.is_running else "&#9678;"
        color = "#22c55e" if inst.is_running else "#6b7280"
        bg = "rgba(34,197,94,0.05)" if inst.is_running else "rgba(100,116,139,0.05)"
        border = "1px solid rgba(34,197,94,0.2)" if inst.is_running else "1px solid rgba(100,116,139,0.15)"
        web_port = "" if inst.web_port == 80 else f":{inst.web_port}"
        cards += f"""<div class="card" style="border: {border}; background: {bg};">
      <div class="card-header">
        <span class="status-dot" style="color:{color}">{dot}</span>
        <strong class="instance-name">{inst.name}</strong>
        <span class="release-badge">{current.version if current else '—'}</span>
      </div>
      <div class="card-body">
        <a class="url-link" href="http://{ip}{web_port}/" target="_blank">http://{ip}{web_port}/ ↗</a>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">API</span>
            <span class="value mono"><a href="http://{ip}:{inst.moonraker_port}/server/info" target="_blank">{ip}:{inst.moonraker_port}</a></span>
          </div>
          <div class="info-item">
            <span class="label">Admin</span>
            <span class="value mono"><a href="/admin" target="_blank">admin</a></span>
          </div>
          <div class="info-item">
            <span class="label">Moonraker</span>
            <span class="value mono">{inst.moonraker_service}</span>
          </div>
          <div class="info-item">
            <span class="label">Klipper</span>
            <span class="value mono">{inst.klipper_service}</span>
          </div>
          <div class="info-item full">
            <span class="label">Config</span>
            <span class="value mono">{inst.config_dir}</span>
          </div>
          <div class="info-item full">
            <span class="label">Web Root</span>
            <span class="value mono">{inst.web_root}</span>
          </div>
          <div class="info-item full">
            <span class="label">Data</span>
            <span class="value mono">{inst.printer_data_dir}</span>
          </div>
        </div>
      </div>
    </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>E3CNC Admin</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }}
  h1 {{ font-size: 1.5rem; color: #38bdf8; margin-bottom: 0.25rem; }}
  .subtitle {{ color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }}
  .cards {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 1rem; }}
  .card {{ border-radius: 0.75rem; padding: 1.25rem; }}
  .card-header {{ display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }}
  .status-dot {{ font-size: 1.25rem; }}
  .instance-name {{ font-size: 1.125rem; }}
  .release-badge {{ margin-left: auto; font-size: 0.7rem; background: rgba(56,189,248,0.15); color: #38bdf8; padding: 0.15rem 0.5rem; border-radius: 999px; }}
  .url-link {{ display: block; font-size: 0.9rem; color: #38bdf8; text-decoration: none; padding: 0.5rem 0.75rem; background: rgba(56,189,248,0.08); border-radius: 0.5rem; margin-bottom: 1rem; }}
  .url-link:hover {{ background: rgba(56,189,248,0.15); }}
  .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }}
  .info-item.full {{ grid-column: 1 / -1; }}
  .label {{ display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.15rem; }}
  .value {{ font-size: 0.85rem; }}
  .mono {{ font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 0.75rem; }}
  .mono a {{ color: #94a3b8; text-decoration: none; }}
  .mono a:hover {{ color: #e2e8f0; text-decoration: underline; }}
  .footer {{ margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #1e293b; color: #64748b; font-size: 0.75rem; }}
  @media (prefers-color-scheme: light) {{
    body {{ background: #f8fafc; color: #1e293b; }}
    h1 {{ color: #0284c7; }}
    .card {{ background: #ffffff !important; border-color: #e2e8f0 !important; }}
    .subtitle, .footer {{ color: #94a3b8; }}
    .release-badge {{ background: rgba(2,132,199,0.1); color: #0284c7; }}
    .url-link {{ background: rgba(2,132,199,0.06); color: #0284c7; }}
    .mono a {{ color: #64748b; }}
    .mono a:hover {{ color: #1e293b; }}
  }}
</style>
</head>
<body>
  <h1>E3CNC Admin</h1>
  <p class="subtitle">{ip} &mdash; v{VERSION}</p>
  <div class="cards">
    {cards}
  </div>
  <div class="footer">
    Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}
  </div>
</body>
</html>"""

    (ADMIN_PAGE_DIR / "index.html").write_text(html)
    ok("Admin page generated")


def _get_local_ip() -> str:
    """Get the primary local network IP address.

    Uses a UDP socket to 8.8.8.8 to determine the default interface IP.
    This is reliable even when gethostbyname(hostname) returns 127.0.0.1.
    """
    import socket as _socket
    try:
        s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
        s.settimeout(3)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"
