// Localization — No Untranslated Value
// Enforces that locale translation files contain actual translations:
// 1. No empty string values when English has content
// 2. No untranslated values (identical to English)
//
// Supports arbitrarily nested translation objects (2-level, 3-level, etc.)
//
// Only applies to files inside _translations/ or translations/ directories
// that are NOT en.ts, index.ts, locales.ts, or *Translations.ts files.
// Reads the sibling en.ts file via the TypeScript AST parser to compare values.

// Dependencies - Node
import * as fs from 'fs';
import * as path from 'path';

// Dependencies - Third-party
import { parse as parseTypeScript } from '@typescript-eslint/parser';
import type { TSESLint as TypeScriptEsLintType, TSESTree as TypeScriptEsTreeType } from '@typescript-eslint/utils';

// Types
interface TranslationFileInterface {
    localeCode: string;
    translationsDirectory: string;
}

// Cache for parsed English translation values (keyed by directory path)
// Each entry maps dot-separated key paths to their English string values
const englishValuesCache = new Map<string, Map<string, string> | null>();

// Minimum string length to flag as untranslated (short strings like "on", "is" are often the same)
const minimumLengthToFlag = 4;

// Extract the key name from an AST property key node
function getKeyName(keyNode: TypeScriptEsTreeType.Node): string | null {
    if(keyNode.type === 'Identifier') return keyNode.name;
    if(keyNode.type === 'Literal') return String(keyNode.value);
    return null;
}

// Recursively extract all string literal values from an ObjectExpression AST node.
// Returns entries as [dotSeparatedKeyPath, stringValue] pairs.
function extractStringValues(
    objectExpression: TypeScriptEsTreeType.ObjectExpression,
    prefix: string,
): [string, string][] {
    const values: [string, string][] = [];

    for(const property of objectExpression.properties) {
        if(property.type !== 'Property') continue;

        const keyName = getKeyName(property.key);
        if(!keyName) continue;

        const fullKey = prefix ? `${prefix}.${keyName}` : keyName;

        if(property.value.type === 'Literal' && typeof property.value.value === 'string') {
            values.push([fullKey, property.value.value]);
        }
        else if(property.value.type === 'ObjectExpression') {
            values.push(...extractStringValues(property.value, fullKey));
        }
    }

    return values;
}

// Resolve an `export default ...` expression to its underlying
// ObjectExpression, supporting four shapes:
//   1. `export default { ... }`
//   2. `export default { ... } satisfies Type`
//   3. `export default { ... } as Type`
//   4. `export default Identifier` / `export default Identifier as Type`
//      where `Identifier` is a `const` declared earlier in the same
//      file. Used by some translation files when the locale data needs
//      its literal-string types preserved through an intermediate
//      `as const` binding (so a slot-validator helper can compare
//      placeholders against the contract) before the final widening
//      assertion at export.
//
// Returns the resolved ObjectExpression, or null if the export shape
// isn't one we recognize. The `programBody` argument is the AST's
// top-level statement list, used to follow identifier references.
function resolveExportedObjectExpression(
    declaration: TypeScriptEsTreeType.Node,
    programBody: TypeScriptEsTreeType.ProgramStatement[],
): TypeScriptEsTreeType.ObjectExpression | null {
    let current: TypeScriptEsTreeType.Node = declaration;

    // Unwrap `... satisfies Type` and `... as Type` — both are
    // type-only assertions that wrap an expression.
    if(current.type === 'TSSatisfiesExpression' || current.type === 'TSAsExpression') {
        current = current.expression;
    }

    if(current.type === 'ObjectExpression') {
        return current;
    }

    // Identifier reference — look up the matching `const Name = { ... }`
    // (with optional `as const` / `satisfies` / `as Type` wrapping) in
    // the same file's top-level statements.
    if(current.type === 'Identifier') {
        const identifierName = current.name;
        for(const statement of programBody) {
            if(statement.type !== 'VariableDeclaration') continue;
            for(const declarator of statement.declarations) {
                if(
                    declarator.type !== 'VariableDeclarator' ||
                    declarator.id.type !== 'Identifier' ||
                    declarator.id.name !== identifierName ||
                    !declarator.init
                ) {
                    continue;
                }
                let initializer: TypeScriptEsTreeType.Node = declarator.init;
                if(
                    initializer.type === 'TSSatisfiesExpression' ||
                    initializer.type === 'TSAsExpression'
                ) {
                    initializer = initializer.expression;
                }
                if(initializer.type === 'ObjectExpression') {
                    return initializer;
                }
            }
        }
    }

    return null;
}

// Parse a translation .ts file using the TypeScript AST parser and extract all string values
// as a flat map of dot-separated paths (e.g., "Namespace.SubKey.field" -> "value")
function parseTranslationFile(filePath: string): Map<string, string> | null {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const ast = parseTypeScript(content, { jsx: true });

        // Find the ExportDefaultDeclaration
        const exportDefault = ast.body.find(function (node) {
            return node.type === 'ExportDefaultDeclaration';
        }) as TypeScriptEsTreeType.ExportDefaultDeclaration | undefined;
        if(!exportDefault) return null;

        const objectExpression = resolveExportedObjectExpression(exportDefault.declaration, ast.body);
        if(!objectExpression) return null;

        const entries = extractStringValues(objectExpression, '');
        return new Map(entries);
    } catch {
        return null;
    }
}

// Get English translation values for a given translations directory (cached)
function getEnglishValues(translationsDirectory: string): Map<string, string> | null {
    if(englishValuesCache.has(translationsDirectory)) {
        return englishValuesCache.get(translationsDirectory) ?? null;
    }

    const enFilePath = path.join(translationsDirectory, 'en.ts');
    const values = parseTranslationFile(enFilePath);
    englishValuesCache.set(translationsDirectory, values);
    return values;
}

// Check if a file is a locale translation file that should be validated
function getTranslationFileInfo(filePath: string): TranslationFileInterface | null {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = path.basename(filePath);

    // Must be a .ts file
    if(!fileName.endsWith('.ts')) return null;

    // Must NOT be en.ts, index.ts, locales.ts, or a type definition file
    if(
        fileName === 'en.ts' ||
        fileName === 'index.ts' ||
        fileName === 'locales.ts' ||
        fileName.endsWith('Translations.ts') ||
        fileName.endsWith('TranslationsType.ts') ||
        fileName.endsWith('Interface.ts')
    ) {
        return null;
    }

    // Must be inside a _translations/ or translations/ directory (at any depth)
    const directory = path.dirname(normalizedPath);
    const pathParts = directory.split('/');
    const isInTranslationsDir = pathParts.some(function (part) {
        return part === '_translations' || part === 'translations';
    });
    if(!isInTranslationsDir) return null;

    // The en.ts sibling must exist in the same directory
    const enFilePath = path.join(directory, 'en.ts');
    if(!fs.existsSync(enFilePath)) return null;

    // Extract locale code from filename (e.g., "ar" from "ar.ts")
    const localeCode = fileName.replace('.ts', '');

    return {
        localeCode,
        translationsDirectory: path.dirname(filePath),
    };
}

// Recursively visit all string literal properties in an ObjectExpression,
// building dot-separated key paths and reporting violations.
function visitProperties(
    objectExpression: TypeScriptEsTreeType.ObjectExpression,
    prefix: string,
    context: TypeScriptEsLintType.RuleContext<'missingTranslation' | 'identicalToSource', []>,
    englishValues: Map<string, string>,
    localeCode: string,
): void {
    for(const property of objectExpression.properties) {
        if(property.type !== 'Property') continue;

        const keyName = getKeyName(property.key);
        if(!keyName) continue;

        const fullKey = prefix ? `${prefix}.${keyName}` : keyName;

        if(property.value.type === 'Literal' && typeof property.value.value === 'string') {
            const localeValue = property.value.value;
            const englishValue = englishValues.get(fullKey);

            // Skip if no English value to compare against
            if(englishValue === undefined) continue;

            // Check for empty values
            if(localeValue.trim().length === 0 && englishValue.trim().length > 0) {
                context.report({
                    node: property.value,
                    messageId: 'missingTranslation',
                    data: {
                        key: fullKey,
                        locale: localeCode,
                    },
                });
                continue;
            }

            // Check for untranslated values (identical to English)
            if(localeValue === englishValue && englishValue.length >= minimumLengthToFlag) {
                context.report({
                    node: property.value,
                    messageId: 'identicalToSource',
                    data: {
                        key: fullKey,
                        locale: localeCode,
                        value: englishValue.length > 40 ? englishValue.substring(0, 40) + '...' : englishValue,
                    },
                });
            }
        }
        else if(property.value.type === 'ObjectExpression') {
            visitProperties(property.value, fullKey, context, englishValues, localeCode);
        }
    }
}

// Rule
const LocalizationNoUntranslatedValueRule: TypeScriptEsLintType.RuleModule<'missingTranslation' | 'identicalToSource'> =
    {
        meta: {
            type: 'problem',
            docs: {
                description:
                    'Enforce that locale translation files contain actual translations, not empty or copy-pasted English strings.',
            },
            messages: {
                missingTranslation: "Translation for '{{key}}' is empty. Provide a '{{locale}}' translation.",
                identicalToSource:
                    "Translation for '{{key}}' is identical to English (\"{{value}}\"). Translate it for the '{{locale}}' locale.",
            },
            schema: [],
        },
        defaultOptions: [],
        create(context) {
            const filePath = context.filename;
            const fileInfo = getTranslationFileInfo(filePath);

            // Only apply to locale translation files
            if(!fileInfo) return {};

            // Load English values for comparison
            const englishValues = getEnglishValues(fileInfo.translationsDirectory);
            if(!englishValues) return {};

            return {
                ExportDefaultDeclaration(node) {
                    // Resolve the export shape — supports inline objects,
                    // `satisfies` / `as` assertions, and identifier
                    // references back to a local `const Foo = { ... }`.
                    const program = (node.parent ?? node) as TypeScriptEsTreeType.Program;
                    const programBody = program.type === 'Program' ? program.body : [];
                    const objectExpression = resolveExportedObjectExpression(node.declaration, programBody);
                    if(!objectExpression) return;

                    visitProperties(objectExpression, '', context, englishValues, fileInfo.localeCode);
                },
            };
        },
    };

// Export - Default
export default LocalizationNoUntranslatedValueRule;
