## Health Stack

- typecheck: npx vue-tsc --noEmit
- lint: npx eslint src
- test-unit: go test ./cli/go/... -short -count=1
- test-ui: bun run test:unit
- format: bun run format:check
