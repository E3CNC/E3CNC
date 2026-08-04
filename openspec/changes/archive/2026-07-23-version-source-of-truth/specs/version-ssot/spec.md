# Version SSOT Spec

## 1. Single source of truth

The canonical version for every release is the Git tag. CI derives all other versions from it.

## 2. Normalization rule

Tag: `v0.9.18` → normalized: `0.9.18` (strip leading `v` once).

## 3. Frontend version requirement

Frontend `release_info.json` must use `v{normalized}` (`v0.9.18`).

Frontend build must not read `package.json` for release versioning.

## 4. CLI version requirement

`-ldflags` must inject `{normalized}` into `main.version`.

`e3cnc-tui --version` must print `e3cnc-tui v{normalized}`.

## 5. Manifest requirement

`manifest.json` inside the stack artifact must contain `e3cnc_version` with the normalized version without `v`.

CI must fail if `manifest.json` is missing or has a `v`-prefixed version.

## 6. Failure modes

- Missing Git tag during manual dispatch → use `package.json` as local fallback only
- Local build without CI env → Go binary keeps `0.0.0-dev` fallback
