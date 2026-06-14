# Mainsail-CNC Merge Readiness Plan

> **For Hermes:** Use this plan task-by-task, keep commits small, and do not merge until the repo is clean and the verification commands pass.

**Goal:** Get the `vue3-migration` branch into a low-risk state for merging into `develop`.

**Architecture:**
This branch is already feature-complete in the areas touched recently: Vue 3.5 / Vuetify 3 migration cleanup, CNC panel polish, scroll/state persistence fixes, Moonraker CNC agent updates, and the new Moonraker MCP server inside `moonraker-cnc-agent/`.
The remaining work is merge hygiene: verify the branch against `develop`, confirm the build and tests still pass after any final conflict resolution, refresh docs so they match the code, and keep the working tree clean.

**Tech Stack:**
Vue 3.5, Vuetify 3, Vite, Vitest, Bun, Python package in `moonraker-cnc-agent/`, Moonraker, Klipper.

---

## Current State Snapshot

- Frontend build passes with `bun run build`.
- `moonraker-cnc-agent` tests pass with `PYTHONPATH=src python -m pytest`.
- Root docs already mention the recent CNC feature set and the MCP server.
- The last commit on the branch is `645694be` (`docs: sync CNC features and add Moonraker MCP server`).

This plan assumes no new feature work unless a merge conflict or verification failure forces it.

---

### Task 1: Reconcile branch with `develop`

**Objective:** Bring the branch up to date with `develop` and resolve any merge/rebase conflicts before doing more verification.

**Files:**
- Potentially affected across the repo, especially:
  - `README.md`
  - `docs/*.md`
  - `src/components/**`
  - `src/store/**`
  - `moonraker-cnc-agent/**`

**Steps:**
1. Fetch the latest remote refs:
   ```bash
   git fetch origin
   ```
2. Rebase onto `origin/develop` or merge it, depending on repo policy:
   ```bash
   git rebase origin/develop
   # or
   git merge origin/develop
   ```
3. Resolve conflicts immediately, keeping the branch’s CNC-specific docs and code intact.
4. Re-run `git status --short` until the tree is clean except for intended changes.

**Verification:**
- `git status --short` shows only expected changes during the conflict-resolution phase.
- No unresolved conflict markers remain in any file.

**Commit:**
- If conflict resolution requires edits, commit them as a dedicated hygiene commit.

---

### Task 2: Run the merge gate checks again

**Objective:** Confirm the branch still builds and the agent package still tests cleanly after any history sync or conflict resolution.

**Files:**
- No code changes expected unless a check fails.

**Steps:**
1. Run the frontend build:
   ```bash
   bun run build
   ```
2. Run the Moonraker agent tests:
   ```bash
   cd moonraker-cnc-agent
   PYTHONPATH=src python -m pytest
   ```
3. If you touched any TypeScript-heavy UI areas, consider a targeted Vitest subset first before a full pass.

**Verification:**
- `bun run build` exits with code 0.
- `PYTHONPATH=src python -m pytest` exits with code 0.
- If either command fails, fix the cause before moving on.

**Commit:**
- No commit unless fixes were required.

---

### Task 3: Re-check docs for recent feature drift

**Objective:** Make sure the README and docs still describe the current code accurately after the latest changes.

**Files:**
- `README.md`
- `docs/INSTALLATION.md`
- `docs/architecture.md`
- `src/components/panels/Cnc/README.md`
- `moonraker-cnc-agent/README.md`

**Steps:**
1. Verify the docs still mention the features that actually landed:
   - `OffsetPreview`
   - dashboard scroll / grid-snap / settings-menu persistence
   - Moonraker MCP server and `moonraker-cnc-mcp`
   - the CNC agent endpoints and WCS behavior
2. Search for stale wording that sounds like “planned”, “placeholder”, or old architecture.
3. Update the docs only if they drift from the code.

**Verification:**
- `search_files()` or manual review finds no stale feature claims in the touched docs.
- The docs match the current repo state, not the pre-migration state.

**Commit:**
- If any doc edits are made, commit them separately so the merge review stays easy.

---

### Task 4: Check the CNC agent package still ships cleanly

**Objective:** Ensure the new Moonraker MCP server stays packaged and documented as part of `moonraker-cnc-agent`.

**Files:**
- `moonraker-cnc-agent/pyproject.toml`
- `moonraker-cnc-agent/src/moonraker_cnc_agent/mcp_server.py`
- `moonraker-cnc-agent/tests/test_mcp_server.py`
- `moonraker-cnc-agent/src/moonraker_cnc_agent/__init__.py`
- `moonraker-cnc-agent/README.md`

**Steps:**
1. Confirm the console script exists:
   ```bash
   python - <<'PY'
   import asyncio
   from moonraker_cnc_agent import mcp_server

   async def main():
       tools = await mcp_server.mcp.list_tools()
       print([tool.name for tool in tools])

   asyncio.run(main())
   PY
   ```
2. Confirm the README still tells the truth about how to run/install the MCP server.
3. Keep the package import lightweight; do not reintroduce eager imports into `__init__.py`.

**Verification:**
- Tool list includes the Moonraker MCP tools.
- The package README and root docs agree on the run/install commands.

**Commit:**
- Only if packaging or docs need correction.

---

### Task 5: Final merge hygiene pass

**Objective:** Finish with a clean tree, a clear branch summary, and no lingering surprises for the merge.

**Files:**
- Whole repo as needed, but ideally none.

**Steps:**
1. Check for uncommitted changes:
   ```bash
   git status --short
   ```
2. Check the branch divergence against `develop`:
   ```bash
   git log --oneline --decorate --graph origin/develop..HEAD
   ```
3. Sanity-check the recent commit history to make sure the branch reads cleanly.
4. If there are any leftovers, either fix them or remove them before merge.

**Verification:**
- Working tree is clean.
- Build and tests are green.
- Branch history is understandable and narrowly scoped.

**Commit:**
- None if the tree is already clean.

---

## Merge Criteria

The branch is ready to merge when all of the following are true:

- `git status --short` is empty.
- `bun run build` passes.
- `moonraker-cnc-agent` tests pass.
- Docs match the current codebase.
- No unresolved merge conflicts remain.
- The branch contains no obvious experimental leftovers.

## Suggested merge message

If everything stays green, merge with a message like:

```text
Merge vue3-migration: CNC UI polish, OffsetPreview, persistence fixes, and Moonraker MCP server
```
