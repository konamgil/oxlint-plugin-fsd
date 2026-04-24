# @mandujs/oxlint-plugin-fsd

Oxlint JS plugin project for Feature-Sliced Design rules.

This package currently ships these rules:

- `fsd/no-cross-slice-dependency`
- `fsd/forbidden-imports`
- `fsd/no-global-store-imports`
- `fsd/ordered-imports`
- `fsd/no-public-api-sidestep`
- `fsd/no-relative-imports`
- `fsd/no-ui-in-business-logic`
- `fsd/backend-boundaries`

This project now mirrors the original `eslint-plugin-fsd-lint` rule set with
an Oxlint-first implementation.

Quality gates in this package:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `pnpm test:smoke`
- `pnpm bench`

## Install

```bash
pnpm add -D @mandujs/oxlint-plugin-fsd
```

## Oxlint usage

```json
{
  "jsPlugins": [
    {
      "name": "fsd",
      "specifier": "@mandujs/oxlint-plugin-fsd"
    }
  ],
  "rules": {
    "fsd/no-relative-imports": "error"
  }
}
```

## Rule behavior

`fsd/no-relative-imports` blocks relative imports that cross slice boundaries.

`fsd/forbidden-imports` enforces FSD layer direction for absolute imports.

`fsd/no-public-api-sidestep` blocks deep imports into internal files and forces
slice-root or segment-root public APIs.

`fsd/no-cross-slice-dependency` blocks imports from one slice to another inside
the same layer.

`fsd/no-global-store-imports` blocks direct imports of global stores such as
`app/store`, Redux stores, or Zustand roots.

`fsd/ordered-imports` keeps FSD imports grouped by layer order and supports
autofix.

`fsd/no-ui-in-business-logic` blocks `ui` imports from business-logic segments
such as `model`, `api`, and `lib`.

`fsd/backend-boundaries` enforces nested backend module boundaries such as
`src/modules/<module>/{api,application,domain,infra}`, `src/core`, and
`src/shared`. It also blocks cross-module deep imports unless the target is a
configured public API such as `application/index.ts`, `infra/index.ts`, or a
module root file.

Allowed by default:

- Relative imports within the same slice
- Relative imports inside `app`
- Relative imports inside `shared`

Blocked by default:

- `features/foo/...` importing `../bar/...`
- `entities/user/...` importing `../workspace/...`
- `features/foo/...` importing `@/widgets/bar`
- `entities/user/...` importing `@/features/workspace`
- `@/entities/user/model/internal`
- `@/features/auth/model/session/private`
- `@/features/projects/model` from `@/features/tasks/...`
- `../../projects/model/state` from another `features/tasks/...` file
- `@/app/store`
- `@/shared/store`
- `../ui/Button` from `model` or `lib`
- `@/entities/user/ui/Card` from `model` or `api`
- `shared` imports placed above `features`
- `modules/foo/application/commands/internal` from another backend module
- `modules/foo/infra/prisma/repository` from backend `application`

## Options

```json
{
  "rules": {
    "fsd/no-relative-imports": [
      "error",
      {
        "allowSameSlice": true,
        "allowTypeImports": false,
        "testFilesPatterns": ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"]
      }
    ]
  }
}
```

Backend usage:

```json
{
  "rules": {
    "fsd/backend-boundaries": [
      "error",
      {
        "alias": {
          "value": "@",
          "withSlash": true
        },
        "sourceRootPattern": "/src/",
        "modulesDir": "modules"
      }
    ]
  }
}
```

Default backend layer policy:

- `module-api` can import `module-application`, `core`, and `shared`.
- `module-application` can import `module-domain`, `core`, and `shared`.
- `module-domain` can import `module-domain` and `shared`.
- `module-infra` can import `module-application`, `module-domain`, `core`,
  and `shared`.
- `core` can import `core` and `shared`.
- `shared` can import `shared` only.

Default backend public API patterns for cross-module imports:

- `application` and `application/index.ts`
- `infra` and `infra/index.ts`
- module root `*.module.ts`
- module root `*.service.ts`

Useful backend options:

- `enforceCrossModulePublicApi: false` disables cross-module public API checks
  while keeping layer direction checks.
- `allowSameModuleSameLayer: false` reports same-module same-layer imports
  instead of allowing local layer internals.
- `allowTypeImports: true` skips type-only imports.
- `publicApiPatterns` replaces the default public API regex list.

## Presets

- `configs.base`
- `configs.recommended`
- `configs.strict`
- `configs.backend`

## Local development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm test:smoke
```

`pnpm test` runs the Vitest parity suite.

`pnpm test:smoke` runs the built plugin against the fixture manifest with real
Oxlint subprocesses.

`pnpm bench` measures fixture execution time across the full manifest.

Implementation note:

- `createOnce` rules must read `context.options` inside `before()` or later
  hooks. Oxlint initializes the rule first and attaches per-file options after
  that. This package treats option-sensitive logic as per-file setup.

## Semantic coverage

The fixture suite covers:

- layer direction checks including direct higher-layer root files
- same-layer cross-slice imports
- valid and invalid `@x` public APIs
- `@x/index` public APIs
- referenced `tsconfig` path aliases
- shared `lib` and shared `ui` public API behavior
- ordered-import autofix and comment preservation
- backend nested layer direction and cross-module public API checks

## CI

GitHub Actions runs `typecheck`, `lint`, `build`, `test`, and `test:smoke` on
every push and pull request.
