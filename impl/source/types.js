// Type definitions for menma-cli

/**
 * @typedef {Object} Format
 * @property {string} name - The format name (e.g., "議事録", "メモ")
 * @property {string} extension - File extension (e.g., "md", "js")
 * @property {string} template - Template content with placeholders
 */

/**
 * @typedef {Object} Config
 * @property {string} baseDir - Base directory for generated files
 * @property {Format[]} formats - Available file formats
 * @property {string} editorCommand - Command to open files
 */

/**
 * @typedef {Object} FileData
 * @property {string} title - File title
 * @property {string} project - Project name
 * @property {string[]} tags - Array of tags
 * @property {string} date - Creation date
 * @property {Format} format - Selected format
 */

export {};