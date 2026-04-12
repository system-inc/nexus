# @system-inc/nexus

Shared ESLint rules and code quality tools for System, Inc. projects.

## Installation

```bash
pnpm add @system-inc/nexus
```

## ESLint Rules

### `nexus/boundary-no-internal-import`

Prevents importing from `internal/` folders outside of the owning directory. Only files within the parent of an `internal/` directory may import from it.

### `nexus/boundary-no-nexus-outside-import`

Disallows imports using `@project`, `@structure`, or `@base` aliases from files within `libraries/nexus/`. Keeps Nexus self-contained and portable.

### `nexus/localization-no-untranslated-value`

Enforces that locale translation files contain actual translations. Flags empty strings when English has content, and untranslated values identical to English (4+ characters).

## Usage

```typescript
import {
    nexusJavaScriptAndTypeScriptPlugins,
    nexusJavaScriptAndTypeScriptRules,
} from '@system-inc/nexus/code-quality/eslint/NexusEsLintConfiguration';

export default [
    {
        plugins: {
            ...nexusJavaScriptAndTypeScriptPlugins,
        },
        rules: {
            ...nexusJavaScriptAndTypeScriptRules,
        },
    },
];
```

## Peer Dependencies

This package expects the consuming project to provide:

- `eslint` ^10.0.0
- `@typescript-eslint/parser` ^8.0.0
- `@typescript-eslint/utils` ^8.0.0
