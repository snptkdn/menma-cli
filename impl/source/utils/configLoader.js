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
		editorCommand: [
			{
				ext: 'md',
				command: 'code {{filePath}}'
			},
			{
				ext: '*',
				command: 'open {{filePath}}'
			}
		]
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
 * Load template content from file or return inline template
 * @param {string} templatePath - Template path or inline template
 * @param {string} baseDir - Base directory for template resolution
 * @returns {Promise<string>} Template content
 */
async function loadTemplate(templatePath, baseDir) {
	// If template starts with common template markers, treat as inline
	if (templatePath.includes('{{') || templatePath.startsWith('#') || templatePath.startsWith('//')) {
		return templatePath;
	}
	
	// Try to load as file path relative to baseDir
	let fullPath;
	if (path.isAbsolute(templatePath)) {
		fullPath = templatePath;
	} else {
		fullPath = path.resolve(baseDir, templatePath);
	}
	
	try {
		return await fs.readFile(fullPath, 'utf-8');
	} catch (error) {
		// If file not found, return the path as inline template
		console.warn(`Template file not found: ${fullPath}, using as inline template`);
		return templatePath;
	}
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
					try {
						config = JSON.parse(content);
					} catch (parseError) {
						console.warn(`⚠️  設定ファイルの読み込みエラー: ${configPath}`);
						console.warn(`   JSON構文エラー: ${parseError.message}`);
						continue;
					}
				} else if (configPath.endsWith('.js')) {
					const { default: importedConfig } = await import(configPath);
					config = importedConfig;
				}
				
				if (config) {
					const mergedConfig = { ...defaultConfig, ...config };
					// Resolve baseDir to absolute path
					mergedConfig.baseDir = resolveBaseDir(mergedConfig.baseDir, path.dirname(configPath));
					
					// Load template files for formats (relative to baseDir)
					for (const format of mergedConfig.formats) {
						format.template = await loadTemplate(format.template, mergedConfig.baseDir);
					}
					
					console.log(`✅ 設定ファイルを読み込みました: ${configPath}`);
					return mergedConfig;
				}
			}
		} catch (error) {
			// Only ignore file not found errors, log other errors
			if (error.code === 'ENOENT') {
				continue;
			} else {
				console.warn(`⚠️  設定ファイルの読み込みエラー: ${configPath}`);
				console.warn(`   エラー: ${error.message}`);
				continue;
			}
		}
	}
	
	// Warn and return default config if no config file found
	console.warn('⚠️  設定ファイルが見つかりません。デフォルト設定を使用します。');
	console.warn('   設定ファイルを作成するには以下のパスのいずれかに menma.config.json を配置してください:');
	configPaths.slice(0, 3).forEach(path => {
		console.warn(`   - ${path}`);
	});
	console.warn('');
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
	
	// Validate editorCommand (can be string or array)
	if (!config.editorCommand) return false;
	if (typeof config.editorCommand === 'string') {
		// Legacy format - still supported
	} else if (Array.isArray(config.editorCommand)) {
		// New array format
		for (const editorConfig of config.editorCommand) {
			if (!editorConfig.ext || typeof editorConfig.ext !== 'string') return false;
			if (!editorConfig.command || typeof editorConfig.command !== 'string') return false;
		}
	} else {
		return false;
	}
	
	// Validate each format
	for (const format of config.formats) {
		if (!format.name || typeof format.name !== 'string') return false;
		if (!format.extension || typeof format.extension !== 'string') return false;
		if (!format.template || typeof format.template !== 'string') return false;
	}
	
	return true;
}

/**
 * Create a sample configuration file
 * @param {string} configPath - Path where to create the config file
 * @returns {Promise<void>}
 */
export async function createSampleConfig(configPath) {
	const sampleConfig = {
		"baseDir": "menma-files",
		"formats": [
			{
				"name": "議事録",
				"extension": "md",
				"template": "template/gizi.md"
			},
			{
				"name": "メモ",
				"extension": "md", 
				"template": "template/memo.md"
			}
		],
		"editorCommand": [
			{
				"ext": "md",
				"command": "code {{filePath}}"
			},
			{
				"ext": "*",
				"command": "open {{filePath}}"
			}
		]
	};

	// Ensure directory exists
	const configDir = path.dirname(configPath);
	try {
		await fs.mkdir(configDir, { recursive: true });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}

	// Write config file
	await fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
	console.log(`✅ サンプル設定ファイルを作成しました: ${configPath}`);
}