// Dependencies - Local Components
import BoundaryNoInternalImportRule from './rules/BoundaryNoInternalImportRule.ts';
import BoundaryNoNexusOutsideImportRule from './rules/BoundaryNoNexusOutsideImportRule.ts';
import LocalizationNoUntranslatedValueRule from './rules/LocalizationNoUntranslatedValueRule.ts';

// Dependencies - Types
import type { TSESLint as TsEsLintType } from '@typescript-eslint/utils';

// Nexus plugin rules map
const nexusPluginRules: Record<string, TsEsLintType.RuleModule<string>> = {
    'boundary-no-internal-import': BoundaryNoInternalImportRule,
    'boundary-no-nexus-outside-import': BoundaryNoNexusOutsideImportRule,
    'localization-no-untranslated-value': LocalizationNoUntranslatedValueRule,
};

// ESLint JavaScript and TypeScript plugins
export const nexusJavaScriptAndTypeScriptPlugins = {
    nexus: {
        rules: nexusPluginRules,
    },
};

// ESLint JavaScript and TypeScript rules
export const nexusJavaScriptAndTypeScriptRules: Record<string, string> = {
    'nexus/boundary-no-internal-import': 'error',
    'nexus/boundary-no-nexus-outside-import': 'error',
    'nexus/localization-no-untranslated-value': 'warn',
};
