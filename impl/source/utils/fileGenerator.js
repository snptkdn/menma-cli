import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { recordAccess } from './accessTracker.js';

/**
 * Generate a filename based on title and timestamp
 * @param {string} title - File title
 * @param {string} extension - File extension
 * @returns {string} Generated filename
 */
function generateFilename(title, extension) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const sanitizedTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
	return `${timestamp}_${sanitizedTitle}.${extension}`;
}

/**
 * Generate file path based on config and project
 * @param {import('../types.js').Config} config - Configuration
 * @param {string} project - Project name
 * @param {string} filename - Generated filename
 * @returns {string} Full file path
 */
function generateFilePath(config, project, filename) {
	const sanitizedProject = project.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
	return path.join(config.baseDir, sanitizedProject, filename);
}

/**
 * Render template with data
 * @param {string} template - Template string with placeholders
 * @param {import('../types.js').FileData} data - Data to substitute
 * @returns {string} Rendered content
 */
function renderTemplate(template, data) {
	const tagsString = data.tags.length > 0 ? data.tags.join(', ') : 'なし';
	
	return template
		.replace(/\{\{title\}\}/g, data.title)
		.replace(/\{\{project\}\}/g, data.project)
		.replace(/\{\{tags\}\}/g, tagsString)
		.replace(/\{\{date\}\}/g, data.date);
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
	try {
		await fs.mkdir(dirPath, { recursive: true });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}
}

/**
 * Generate and write file
 * @param {import('../types.js').FileData} fileData - File data
 * @param {import('../types.js').Config} config - Configuration
 * @returns {Promise<string>} Generated file path
 */
export async function generateFile(fileData, config) {
	const filename = generateFilename(fileData.title, fileData.format.extension);
	const filePath = generateFilePath(config, fileData.project, filename);
	const content = renderTemplate(fileData.format.template, fileData);
	
	// Ensure directory exists
	const dirPath = path.dirname(filePath);
	await ensureDirectory(dirPath);
	
	// Write file
	await fs.writeFile(filePath, content, 'utf-8');
	
	return filePath;
}

/**
 * Get appropriate editor command for file extension
 * @param {string} filePath - Path to file
 * @param {string|Array} editorCommand - Editor command(s) from config
 * @returns {string} Appropriate editor command
 */
function getEditorCommand(filePath, editorCommand) {
	// If legacy string format, return as-is
	if (typeof editorCommand === 'string') {
		return editorCommand;
	}
	
	// New array format - find matching extension
	const fileExt = path.extname(filePath).slice(1); // Remove the dot
	
	// First try to find exact extension match
	for (const editorConfig of editorCommand) {
		if (editorConfig.ext === fileExt) {
			return editorConfig.command;
		}
	}
	
	// Fall back to wildcard match
	for (const editorConfig of editorCommand) {
		if (editorConfig.ext === '*') {
			return editorConfig.command;
		}
	}
	
	// Ultimate fallback (shouldn't happen with proper config)
	return 'open {{filePath}}';
}

/**
 * Open file with configured editor
 * @param {string} filePath - Path to file to open
 * @param {string|Array} editorCommand - Editor command template or array of commands
 * @returns {Promise<void>}
 */
export async function openFile(filePath, editorCommand) {
	// Record access before opening
	await recordAccess(filePath);
	
	const selectedCommand = getEditorCommand(filePath, editorCommand);
	const command = selectedCommand.replace(/\{\{filePath\}\}/g, filePath);
	
	try {
		// Execute command synchronously with stdio inheritance for proper terminal interaction
		execSync(command, { 
			stdio: 'inherit',
			shell: true 
		});
	} catch (error) {
		// Only throw error if command actually failed (non-zero exit code)
		// Some editors like vim may exit with non-zero codes in certain situations
		if (error.status !== 0 && error.signal === null) {
			throw new Error(`Failed to open file with command "${command}": ${error.message}`);
		}
	}
}