# Tasks

- [x] 1.1 Add explicit `Resolve version` step in `.github/workflows/build-frontend.yml`
- [x] 1.2 Replace `VERSION` derivation in CI with the normalized single step
- [x] 1.3 Ensure all build steps consume `env.VERSION`
- [x] 2.1 Remove `vite-plugin-package-version` from `devDependencies`
- [x] 2.2 Update `src/plugins/build-release_info.ts` to use `VITE_APP_VERSION` or build-time env
- [x] 2.3 Verify local frontend build still works without CI env
- [ ] 3.1 Add manifest guard in CI checking normalized version without `v` prefix
- [ ] 3.2 Update release notes to document version source of truth
- [ ] 4.1 Run `bun run build` and `go build ./...` locally
- [ ] 4.2 Verify release workflow with manual dispatch test
