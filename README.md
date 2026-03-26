# @system-inc/nexus

Shared ESLint rules and code quality tools for System, Inc. projects.

## Installation

```bash
npm install @system-inc/nexus
```

## ESLint Rules

### `nexus/localization-untranslated-value-rule`

Enforces that locale translation files contain actual translations — no empty strings when English has content, and no untranslated values identical to English.

### `nexus/no-internal-imports-rule`

Prevents importing from `internal/` folders outside of the owning directory.

### `nexus/no-nexus-outside-imports-rule`

Disallows imports using `@project`, `@structure`, or `@base` aliases from files within `libraries/nexus/`.

## Usage

```javascript
import {
    nexusJavaScriptAndTypeScriptPlugins,
    nexusJavaScriptAndTypeScriptRules,
} from '@system-inc/nexus/code-quality/eslint/NexusEsLintConfiguration.mjs';

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
