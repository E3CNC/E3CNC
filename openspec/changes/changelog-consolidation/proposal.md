# CHANGELOG Consolidation + Auto-generation

Eliminate three diverged CHANGELOG files by consolidating to root `CHANGELOG.md` and auto-generating entries from conventional commit history using **git-cliff**.

**Motivation:**
- Three CHANGELOG files with different content for the same versions
- 27 unreleased commits with no entry anywhere
- Manual maintenance drifts over time

**Approach:**
1. Install git-cliff as a dev tooling dependency (single Rust binary, no runtime deps)
2. Define a `cliff.toml` config that maps conventional commit prefixes to changelog sections
3. Seed the CHANGELOG by running `git-cliff --bump --unreleased` to generate the v0.9.19 entry from existing commits
4. Replace stale `docs/` copies with redirect stubs pointing to root
5. CI integration: `git-cliff --bump` runs on tag pushes to auto-update CHANGELOG.md