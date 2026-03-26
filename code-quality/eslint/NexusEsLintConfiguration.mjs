// Dependencies - Local Components
import LocalizationUntranslatedValueRule from './rules/LocalizationUntranslatedValueRule.mjs';
import NoInternalImportsRule from './rules/NoInternalImportsRule.mjs';
import NoNexusOutsideImportsRule from './rules/NoNexusOutsideImportsRule.mjs';

// ESLint JavaScript and TypeScript plugins
export const nexusJavaScriptAndTypeScriptPlugins = {
    nexus: {
        rules: {
            'localization-untranslated-value-rule': LocalizationUntranslatedValueRule,
            'no-internal-imports-rule': NoInternalImportsRule,
            'no-nexus-outside-imports-rule': NoNexusOutsideImportsRule,
        },
    },
};

// ESLint JavaScript and TypeScript rules
export const nexusJavaScriptAndTypeScriptRules = {
    'nexus/localization-untranslated-value-rule': 'warn',
    'nexus/no-internal-imports-rule': 'error',
    'nexus/no-nexus-outside-imports-rule': 'error',
};
