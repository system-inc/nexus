// Localization Untranslated Value Rule
// Enforces that locale translation files contain actual translations:
// 1. No empty string values when English has content
// 2. No untranslated values (identical to English)
//
// Supports arbitrarily nested translation objects (2-level, 3-level, etc.)
//
// Only applies to files inside _translations/ or translations/ directories
// that are NOT en.ts, index.ts, locales.ts, or *Translations.ts files.
// Reads the sibling en.ts file via the TypeScript AST parser to compare values.
//
// To suppress the identical-to-English check for a specific value, use:
//   // eslint-disable-next-line nexus/localization-untranslated-value-rule

// Dependencies - Node
import * as fs from 'fs';
import * as path from 'path';

// Dependencies - Third-party
import { parse as parseTypeScript } from '@typescript-eslint/parser';

// Cache for parsed English translation values (keyed by directory path)
// Each entry maps dot-separated key paths to their English string values
const englishValuesCache = new Map();

// Minimum string length to flag as untranslated (short strings like "on", "is" are often the same)
const minimumLengthToFlag = 4;

// Extract the key name from an AST property key node
function getKeyName(keyNode) {
    if(keyNode.type === 'Identifier') return keyNode.name;
    if(keyNode.type === 'Literal') return String(keyNode.value);
    return null;
}

// Recursively extract all string literal values from an ObjectExpression AST node.
// Returns entries as [dotSeparatedKeyPath, stringValue] pairs.
function extractStringValues(objectExpression, prefix) {
    const values = [];

    for(const prop of objectExpression.properties) {
        if(prop.type !== 'Property') continue;

        const keyName = getKeyName(prop.key);
        if(!keyName) continue;

        const fullKey = prefix ? `${prefix}.${keyName}` : keyName;

        if(prop.value.type === 'Literal' && typeof prop.value.value === 'string') {
            values.push([fullKey, prop.value.value]);
        } else if(prop.value.type === 'ObjectExpression') {
            // Recurse into nested objects
            values.push(...extractStringValues(prop.value, fullKey));
        }
    }

    return values;
}

// Parse a translation .ts file using the TypeScript AST parser and extract all string values
// as a flat map of dot-separated paths (e.g., "Namespace.SubKey.field" -> "value")
function parseTranslationFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const ast = parseTypeScript(content, { jsx: true });

        // Find the ExportDefaultDeclaration
        const exportDefault = ast.body.find(function (node) {
            return node.type === 'ExportDefaultDeclaration';
        });
        if(!exportDefault) return null;

        // Unwrap TSSatisfiesExpression: export default { ... } satisfies Type
        let objectExpression = exportDefault.declaration;
        if(objectExpression.type === 'TSSatisfiesExpression') {
            objectExpression = objectExpression.expression;
        }
        if(objectExpression.type !== 'ObjectExpression') return null;

        const entries = extractStringValues(objectExpression, '');
        return new Map(entries);
    } catch {
        return null;
    }
}

// Get English translation values for a given translations directory (cached)
function getEnglishValues(translationsDirectory) {
    if(englishValuesCache.has(translationsDirectory)) {
        return englishValuesCache.get(translationsDirectory);
    }

    const enFilePath = path.join(translationsDirectory, 'en.ts');
    const values = parseTranslationFile(enFilePath);
    englishValuesCache.set(translationsDirectory, values);
    return values;
}

// Check if a file is a locale translation file that should be validated
function getTranslationFileInfo(filePath) {
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
    // e.g., translations/agents/fr.ts or _translations/fr.ts
    const directory = path.dirname(normalizedPath);
    const pathParts = directory.split('/');
    const isInTranslationsDir = pathParts.some(
        (part) => part === '_translations' || part === 'translations',
    );
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
function visitProperties(objectExpression, prefix, context, englishValues, localeCode) {
    for(const prop of objectExpression.properties) {
        if(prop.type !== 'Property') continue;

        const keyName = getKeyName(prop.key);
        if(!keyName) continue;

        const fullKey = prefix ? `${prefix}.${keyName}` : keyName;

        if(prop.value.type === 'Literal' && typeof prop.value.value === 'string') {
            const localeValue = prop.value.value;
            const englishValue = englishValues.get(fullKey);

            // Skip if no English value to compare against
            if(englishValue === undefined) continue;

            // Check for empty values
            if(localeValue.trim().length === 0 && englishValue.trim().length > 0) {
                context.report({
                    node: prop.value,
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
                    node: prop.value,
                    messageId: 'identicalToSource',
                    data: {
                        key: fullKey,
                        locale: localeCode,
                        value: englishValue.length > 40 ? englishValue.substring(0, 40) + '...' : englishValue,
                    },
                });
            }
        } else if(prop.value.type === 'ObjectExpression') {
            // Recurse into nested objects
            visitProperties(prop.value, fullKey, context, englishValues, localeCode);
        }
    }
}

// ESLint Rule
export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Enforce that locale translation files contain actual translations, not empty or copy-pasted English strings.',
            category: 'Internationalization',
            recommended: true,
        },
        messages: {
            missingTranslation: "Translation for '{{key}}' is empty. Provide a '{{locale}}' translation.",
            identicalToSource:
                "Translation for '{{key}}' is identical to English (\"{{value}}\"). Translate it for the '{{locale}}' locale.",
        },
        schema: [],
    },
    create(context) {
        const filePath = context.filename;
        const fileInfo = getTranslationFileInfo(filePath);

        // Only apply to locale translation files
        if(!fileInfo) return {};

        // Load English values for comparison
        const englishValues = getEnglishValues(fileInfo.translationsDirectory);
        if(!englishValues) return {};

        return {
            // Visit the default export: export default { ... }
            ExportDefaultDeclaration(node) {
                const declaration = node.declaration;

                // Handle: export default { ... } satisfies Type
                let objectExpression = declaration;
                if(declaration.type === 'TSSatisfiesExpression') {
                    objectExpression = declaration.expression;
                }

                if(objectExpression.type !== 'ObjectExpression') return;

                // Recursively visit all properties
                visitProperties(objectExpression, '', context, englishValues, fileInfo.localeCode);
            },
        };
    },
};
