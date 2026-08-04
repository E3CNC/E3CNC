# Version Source of Truth

Git tag (`v1.2.3`) is the single source of truth. CI normalizes it once; everything else derives from that normalized value. No other manifest is assumed to own the version.

## Why

Current version flow is implicit:

- Git tag is authoritative in CI already
- Go binary derives version from ldflags built from the tag
- Frontend derives version from `package.json`
- Stack artifact manifest derives from CI `VERSION`

That means `package.json` is a second truth today, which is fragile for a full-stack release.

## Scope

**In scope:**
- Replace `package.json`-driven frontend version injection with CI tag derivation
- Remove dependency on `vite-plugin-package-version` for release versioning
- Add an explicit normalized `VERSION` step in CI to document the deterministic rule
- Align manifest/artifact version writing to the same normalized version
- Add a code path in the updater to surface the version in one place, not grind through three

**Out of scope:**
- Changing the existing tag format
- Changing release artifact structure
- Changing user-visible `e3cnc-tui --version` behavior

## Acceptance

- One GitHub Actions workflow step clearly states “source of truth” for version
- Frontend release version comes from CI, not `package.json`
- Stack artifact manifest and filename both use the same normalized version
- Local dev builds still work with fallback `0.0.0-dev`
- Release note includes explicit statement of which path owns version
