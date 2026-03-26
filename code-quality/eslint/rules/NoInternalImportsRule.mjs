// Dependencies - Node
import NodePath from 'path';
import NodeProcess from 'process';

// ESLint rule to prevent importing from internal folders when not appropriate
// This protect a file from being imported when it is not intended to be used outside of specific folders
const NoInternalImportsRule = {
    meta: {
        type: 'problem',
        schema: [],
    },
    create(context) {
        return {
            ImportDeclaration(node) {
                const importPath = node.source.value;
                const importingFile = context.filename;

                if(!importPath.includes('internal')) return;

                // Aliased or absolute: block immediately
                if(!importPath.startsWith('.')) {
                    context.report({
                        node,
                        message: `Aliased imports must not include 'internal': '${importPath}'`,
                    });
                    return;
                }

                // Resolve the imported file path
                const resolvedImport = NodePath.resolve(
                    NodePath.dirname(importingFile),
                    importPath,
                );

                const relativeImportPath = NodePath.relative(
                    NodeProcess.cwd(),
                    resolvedImport,
                );
                const relativeImporterPath = NodePath.relative(
                    NodeProcess.cwd(),
                    importingFile,
                );

                const importParts = relativeImportPath.split(NodePath.sep);
                const importerParts = relativeImporterPath.split(NodePath.sep);

                // 🔥 Find the LAST occurrence of "internal"
                const internalIndex = importParts.lastIndexOf('internal');
                if(internalIndex <= 0) {
                    return;
                }

                // Get the "owning folder" — the folder directly above the last `internal`
                const owningFolderParts = importParts.slice(0, internalIndex);
                const owningFolderPath = owningFolderParts.join(NodePath.sep);

                const importingFilePath = importerParts.join(NodePath.sep);

                // Check if importing file path starts with the owning folder
                if(
                    !importingFilePath.startsWith(owningFolderPath + NodePath.sep)
                ) {
                    context.report({
                        node,
                        message: `Only files within '${owningFolderPath}' can import from its internal folder.`,
                    });
                }
            },
        };
    },
};

// Export - Default
export default NoInternalImportsRule;
