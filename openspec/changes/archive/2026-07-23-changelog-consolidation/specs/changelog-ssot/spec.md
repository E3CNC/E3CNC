# CHANGELOG Auto-generation Spec

## 1. Tool: git-cliff

A single static Rust binary. Installed via `brew install git-cliff` (macOS dev) or `cargo install git-cliff` (CI). No runtime dependencies.

## 2. Config: cliff.toml

Defined at repo root. Maps conventional commit types to changelog sections. Template outputs markdown matching the existing format (`## vX.Y.Z (YYYY-MM-DD)`).

Key settings:
- `changelog.header`: brief project intro
- `changelog.trim`: true (remove empty sections)
- `git.conventional_commits`: true
- `git.filter_unconventional`: true (skip commits without valid prefix)
- `git.tag_pattern`: `v[0-9]*`

## 3. Conventional commit types

| Prefix     | CHANGELOG section     | Included |
|------------|-----------------------|----------|
| `feat:`    | 🚀 Features           | yes      |
| `fix:`     | 🐛 Bug Fixes          | yes      |
| `refactor:`| 🔧 Refactoring        | yes      |
| `perf:`    | ⚡ Performance        | yes      |
| `docs:`    | 📖 Documentation      | yes      |
| `test:`    | ✅ Tests              | yes      |
| `chore:`   | 📦 Chores             | yes      |
| `ci:`      | 👷 CI/CD              | yes      |
| `style:`   | —                     | skipped  |
| `merge:`   | —                     | skipped  |
| `binary:`  | —                     | skipped  |

## 4. Redirect format

Stale files at `docs/CHANGELOG.md` and `docs/wiki/Changelog.md` are replaced with:

```markdown
# Changelog

The canonical changelog lives at [`../../CHANGELOG.md`](../CHANGELOG.md).
Auto-generated from conventional commit history.
```

## 5. CI integration

Steps added to Create Release workflow (`build-frontend.yml`), gated by `steps.trigger.outputs.TYPE == 'release'`:

1. Install git-cliff
2. `git-cliff --bump --output CHANGELOG.md`
3. Commit and push updated CHANGELOG.md
4. `gh release edit "..." --notes-file <(git-cliff --unreleased --strip header)`

## 6. One-time seeding

- Write `cliff.toml` at repo root
- `git-cliff --bump --tag v0.9.17 --output CHANGELOG.md` — fills current entry and regenerates existing ones
- `git-cliff --bump --unreleased --prepend CHANGELOG.md` — append v0.9.19 entry
- Verify output matches existing entries for v0.9.9–v0.9.18

## 7. Non-goals

- Do not rewrite history of existing versions. Run `--bump`, not `--init`, so existing entries are preserved.
- Do not change the format of existing entries — only new auto-generated entries use the template.
- Do not require developers to use conventional commits for non-release work. `filter_unconventional: true` skips non-conventional commits.