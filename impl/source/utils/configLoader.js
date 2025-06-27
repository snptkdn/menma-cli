import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Get default configuration with resolved paths
 * @returns {import('../types.js').Config} Default configuration
 */
function getDefaultConfig() {
	const homeDir = os.homedir();
	return {
		baseDir: path.join(homeDir, 'menma-files'),
		formats: [
			{
				name: '議事録',
				extension: 'md',
				template: '# {{title}}\n\nProject: {{project}}\nTags: {{tags}}\nDate: {{date}}\n\n---\n\n'
			},
			{
				name: 'メモ',
				extension: 'md',
				template: '# {{title}}\n\n**Project:** {{project}}  \n**Tags:** {{tags}}  \n**Date:** {{date}}\n\n'
			},
			{
				name: 'コードメモ',
				extension: 'js',
				template: '// Title: {{title}}\n// Project: {{project}}\n// Tags: {{tags}}\n// Date: {{date}}\n\n'
			}
		],
		editorCommand: 'code {{filePath}}'
	};
}

/**
 * Get possible config file paths
 * @returns {string[]} Array of possible config file paths
 */
function getConfigPaths() {
	const homeDir = os.homedir();
	const cwd = process.cwd();
	
	// Get the directory of the CLI script for fallback config
	const scriptDir = path.dirname(new URL(import.meta.url).pathname);
	const cliRootDir = path.resolve(scriptDir, '..');
	
	return [
		// User-specific configs (highest priority)
		path.join(homeDir, '.config', 'menma.config.json'),
		path.join(homeDir, '.config', 'menma.config.js'), 
		path.join(homeDir, '.menma.config.json'),
		
		// Current directory configs
		path.join(cwd, 'menma.config.json'),
		path.join(cwd, 'menma.config.js'),
		
		// CLI installation directory config (fallback)
		path.join(cliRootDir, 'menma.config.json'),
		path.join(cliRootDir, 'menma.config.js')
	];
}

/**
 * Resolve baseDir to absolute path
 * @param {string} baseDir - Base directory (may be relative)
 * @param {string} configDir - Directory containing the config file (for relative path resolution)
 * @returns {string} Absolute path
 */
function resolveBaseDir(baseDir, configDir) {
	if (path.isAbsolute(baseDir)) {
		return baseDir;
	}
	
	// If relative path, resolve relative to config file directory
	// If no config file found, resolve relative to home directory
	return path.resolve(configDir || os.homedir(), baseDir);
}

/**
 * Load configuration from file
 * @returns {Promise<import('../types.js').Config>} Configuration object
 */
export async function loadConfig() {
	const configPaths = getConfigPaths();
	const defaultConfig = getDefaultConfig();
	
	for (const configPath of configPaths) {
		try {
			const stat = await fs.stat(configPath);
			if (stat.isFile()) {
				let config;
				if (configPath.endsWith('.json')) {
					const content = await fs.readFile(configPath, 'utf-8');
					config = JSON.parse(content);
				} else if (configPath.endsWith('.js')) {
					const { default: importedConfig } = await import(configPath);
					config = importedConfig;
				}
				
				if (config) {
					const mergedConfig = { ...defaultConfig, ...config };
					// Resolve baseDir to absolute path
					mergedConfig.baseDir = resolveBaseDir(mergedConfig.baseDir, path.dirname(configPath));
					return mergedConfig;
				}
			}
		} catch (error) {
			// Ignore file not found errors, continue searching
			continue;
		}
	}
	
	// Return default config if no config file found
	return defaultConfig;
}

/**
 * Validate configuration object
 * @param {any} config - Configuration to validate
 * @returns {boolean} True if valid
 */
export function validateConfig(config) {
	if (!config || typeof config !== 'object') return false;
	if (!config.baseDir || typeof config.baseDir !== 'string') return false;
	if (!Array.isArray(config.formats) || config.formats.length === 0) return false;
	if (!config.editorCommand || typeof config.editorCommand !== 'string') return false;
	
	// Validate each format
	for (const format of config.formats) {
		if (!format.name || typeof format.name !== 'string') return false;
		if (!format.extension || typeof format.extension !== 'string') return false;
		if (!format.template || typeof format.template !== 'string') return false;
	}
	
	return true;
}