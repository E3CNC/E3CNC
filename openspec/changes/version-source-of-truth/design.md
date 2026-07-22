# Design

## Current flow

```
git tag v0.9.18
  ↓ CI strips v → VERSION=0.9.18
  ↓ Go ldflags injects version
  ↓ package.json still says 0.9.17
  ↓ Vite reads package.json → release_info.json version drifts
```

## Target flow

```
git tag v0.9.18
  ↓ CI resolves tag → VERSION=0.9.18
  ↓ Go ldflags: -X main.version=0.9.18
  ↓ Frontend build: VITE_APP_VERSION=0.9.18
  ↓ release_info.json: { version: "v0.9.18" }
  ↓ manifest.json: { e3cnc_version: "0.9.18" }
  ↓ e3cnc-stack-0.9.18.tar.zst
```

## Steps

1. Add an explicit `Resolve version` step in CI that writes `VERSION` to `GITHUB_OUTPUT` from the tag
2. Use `env.VERSION` everywhere in `build-frontend.yml`
3. Stop deriving frontend version from `package.json` during builds
4. Remove `vite-plugin-package-version` from `devDependencies`
5. Update `src/plugins/build-release_info.ts` to use env or injector instead of `package.json`
6. Add a manifest guard in CI to fail if `e3cnc_version` includes a `v` prefix

## Risk

- Local dev builds without CI env will still get `0.0.0-dev` fallback, which is expected
