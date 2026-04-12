// Boundary — No Nexus Outside Import
// Disallows imports using project aliases (@project, @structure, @base)
// from files within libraries/nexus. Nexus must remain self-contained.

// Dependencies - Types
import type { TSESLint as TypeScriptEsLintType } from '@typescript-eslint/utils';

// Rule
const BoundaryNoNexusOutsideImportRule: TypeScriptEsLintType.RuleModule<'forbiddenImport'> = {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Disallow imports using the aliases '@project' or '@structure' or '@base' from files within 'libraries/nexus'.",
        },
        messages: {
            forbiddenImport:
                "Importing from '@project' or '@structure' or '@base' is not allowed within 'libraries/nexus'.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const filePath = context.filename;

        // Normalize file path to always use forward slashes
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Check if the file is within the 'libraries/nexus' directory
        const isInNexusLibrary = normalizedPath.includes('/libraries/nexus/');

        function isForbiddenSource(source: string): boolean {
            return source.startsWith('@project') || source.startsWith('@structure') || source.startsWith('@base');
        }

        return {
            ImportDeclaration(node) {
                if(!isInNexusLibrary) return;

                const importSource = node.source.value;
                if(typeof importSource === 'string' && isForbiddenSource(importSource)) {
                    context.report({
                        node,
                        messageId: 'forbiddenImport',
                    });
                }
            },
            CallExpression(node) {
                if(!isInNexusLibrary) return;

                if(node.callee.type === 'Identifier' && node.callee.name === 'require') {
                    const argument = node.arguments[0];
                    if(
                        argument &&
                        argument.type === 'Literal' &&
                        typeof argument.value === 'string' &&
                        isForbiddenSource(argument.value)
                    ) {
                        context.report({
                            node,
                            messageId: 'forbiddenImport',
                        });
                    }
                }
            },
            ImportExpression(node) {
                if(!isInNexusLibrary) return;

                const argument = node.source;
                if(
                    argument &&
                    argument.type === 'Literal' &&
                    typeof argument.value === 'string' &&
                    isForbiddenSource(argument.value)
                ) {
                    context.report({
                        node,
                        messageId: 'forbiddenImport',
                    });
                }
            },
        };
    },
};

// Export - Default
export default BoundaryNoNexusOutsideImportRule;
