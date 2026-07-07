# Contributing

## Git Workflow

Submit PRs against `main` branch.

Sign off commits with DCO:

```
Signed-off-by: Your Name <your.email@example.com>
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

Format: `type(scope): message`

Scope is optional but recommended for clarity (e.g., `fix(webcam): ...`, `feat(console): ...`).

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `style` - Formatting changes
- `test` - Adding tests
- `chore` - Maintenance

## Before Submitting

```bash
# Using bun (default)
bun run format
bun run lint:fix
bun run test:unit

# Using npm (alternative on 32-bit ARM or non-macOS hosts)
npm run format
npm run lint:fix
npm run test:unit
```
