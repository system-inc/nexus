// Boundary — No Internal Import
// Prevents importing from internal folders when not appropriate.
// Only files within the owning folder (the directory directly above `internal/`)
// may import from that internal directory.

// Dependencies - Node
import NodePath from 'path';
import NodeProcess from 'process';

// Dependencies - Types
import type { TSESLint as TypeScriptEsLintType } from '@typescript-eslint/utils';

// Rule
const BoundaryNoInternalImportRule: TypeScriptEsLintType.RuleModule<'aliasedInternal' | 'outsideInternal'> = {
    meta: {
        type: 'problem',
        messages: {
            aliasedInternal: "Aliased imports must not include 'internal': '{{importPath}}'",
            outsideInternal: "Only files within '{{owningFolder}}' can import from its internal folder.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        return {
            ImportDeclaration(node) {
                const importPath = node.source.value;
                const importingFile = context.filename;

                if(typeof importPath !== 'string' || !importPath.includes('internal')) return;

                // Aliased or absolute: block immediately
                if(!importPath.startsWith('.')) {
                    context.report({
                        node,
                        messageId: 'aliasedInternal',
                        data: { importPath },
                    });
                    return;
                }

                // Resolve the imported file path
                const resolvedImport = NodePath.resolve(NodePath.dirname(importingFile), importPath);

                const relativeImportPath = NodePath.relative(NodeProcess.cwd(), resolvedImport);
                const relativeImporterPath = NodePath.relative(NodeProcess.cwd(), importingFile);

                const importParts = relativeImportPath.split(NodePath.sep);
                const importerParts = relativeImporterPath.split(NodePath.sep);

                // Find the LAST occurrence of "internal"
                const internalIndex = importParts.lastIndexOf('internal');
                if(internalIndex <= 0) {
                    return;
                }

                // Get the "owning folder" — the folder directly above the last `internal`
                const owningFolderParts = importParts.slice(0, internalIndex);
                const owningFolderPath = owningFolderParts.join(NodePath.sep);

                const importingFilePath = importerParts.join(NodePath.sep);

                // Check if importing file path starts with the owning folder
                if(!importingFilePath.startsWith(owningFolderPath + NodePath.sep)) {
                    context.report({
                        node,
                        messageId: 'outsideInternal',
                        data: { owningFolder: owningFolderPath },
                    });
                }
            },
        };
    },
};

// Export - Default
export default BoundaryNoInternalImportRule;
