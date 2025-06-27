import fs from 'fs/promises';
import path from 'path';

/**
 * @typedef {Object} FileInfo
 * @property {string} filePath - Full path to the file
 * @property {string} fileName - File name only
 * @property {string} title - Extracted title
 * @property {string} project - Project name
 * @property {string[]} tags - Array of tags
 * @property {string} date - Creation date string
 * @property {Date} createdAt - File creation date
 * @property {string} extension - File extension
 */

/**
 * Extract project from directory structure
 * @param {string} filePath - Full file path
 * @param {string} baseDir - Base directory
 * @returns {string} Project name
 */
function extractProjectFromPath(filePath, baseDir) {
	const relativePath = path.relative(baseDir, filePath);
	const pathParts = relativePath.split(path.sep);
	
	// If file is directly in baseDir, use 'default' as project
	if (pathParts.length === 1) {
		return 'default';
	}
	
	// Use the first directory as project name
	return pathParts[0];
}

/**
 * Extract tags from filename
 * @param {string} fileName - File name
 * @returns {string[]} Array of tags
 */
function extractTagsFromFileName(fileName) {
	const nameWithoutExt = path.basename(fileName, path.extname(fileName));
	
	// Remove timestamp prefix if present
	const cleanName = nameWithoutExt.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/, '');
	
	// Extract tags using # delimiter
	const tagMatches = cleanName.match(/#([^#]+)/g);
	if (!tagMatches) {
		return [];
	}
	
	return tagMatches.map(match => match.substring(1).trim()).filter(tag => tag);
}

/**
 * Extract metadata from file content and path
 * @param {string} content - File content
 * @param {string} filePath - File path for fallback info
 * @param {string} baseDir - Base directory
 * @returns {Object} Extracted metadata
 */
function extractMetadata(content, filePath, baseDir) {
	const lines = content.split('\n').slice(0, 20); // Only check first 20 lines
	const metadata = {
		title: '',
		project: extractProjectFromPath(filePath, baseDir),
		tags: extractTagsFromFileName(filePath),
		date: ''
	};

	for (const line of lines) {
		const trimmed = line.trim();
		
		// Extract title from markdown heading
		if (trimmed.startsWith('# ') && !metadata.title) {
			metadata.title = trimmed.substring(2).trim();
		}
		
		// Extract date
		const dateMatch = trimmed.match(/(?:Date|作成日|報告日):\s*(.+)/i);
		if (dateMatch) {
			metadata.date = dateMatch[1].trim();
		}
		
		// Extract title from JS comments
		const jsTitleMatch = trimmed.match(/\/\/\s*Title:\s*(.+)/i);
		if (jsTitleMatch && !metadata.title) {
			metadata.title = jsTitleMatch[1].trim();
		}
	}

	// Fallback title from filename if not found
	if (!metadata.title) {
		const basename = path.basename(filePath, path.extname(filePath));
		// Remove timestamp prefix and tags if present
		let cleanTitle = basename.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/, '');
		cleanTitle = cleanTitle.replace(/#[^#]*#?/g, '').trim();
		metadata.title = cleanTitle || 'Untitled';
	}

	return metadata;
}

/**
 * Recursively scan directory for files
 * @param {string} dirPath - Directory path to scan
 * @param {string[]} extensions - File extensions to include
 * @returns {Promise<string[]>} Array of file paths
 */
async function scanDirectory(dirPath, extensions = ['.md', '.js', '.txt']) {
	const files = [];
	
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		
		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			
			if (entry.isDirectory()) {
				// Recursively scan subdirectories
				const subFiles = await scanDirectory(fullPath, extensions);
				files.push(...subFiles);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (extensions.includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	} catch (error) {
		// Directory doesn't exist or can't be read
		console.warn(`Warning: Cannot read directory ${dirPath}: ${error.message}`);
	}
	
	return files;
}

/**
 * Get file information with metadata
 * @param {string} filePath - Path to file
 * @param {string} baseDir - Base directory for project extraction
 * @returns {Promise<FileInfo|null>} File information or null if error
 */
async function getFileInfo(filePath, baseDir) {
	try {
		const stats = await fs.stat(filePath);
		const content = await fs.readFile(filePath, 'utf-8');
		const metadata = extractMetadata(content, filePath, baseDir);
		
		return {
			filePath,
			fileName: path.basename(filePath),
			title: metadata.title,
			project: metadata.project,
			tags: metadata.tags,
			date: metadata.date,
			createdAt: stats.birthtime,
			extension: path.extname(filePath)
		};
	} catch (error) {
		console.warn(`Warning: Cannot read file ${filePath}: ${error.message}`);
		return null;
	}
}

/**
 * Apply filters to file list
 * @param {FileInfo[]} files - Array of file info
 * @param {Object} filters - Filter options
 * @param {string} [filters.project] - Project name filter
 * @param {string} [filters.tag] - Tag filter
 * @param {string} [filters.search] - Search keyword
 * @returns {FileInfo[]} Filtered file list
 */
function applyFilters(files, filters = {}) {
	let filteredFiles = files;
	
	// Filter by project
	if (filters.project) {
		const projectLower = filters.project.toLowerCase();
		filteredFiles = filteredFiles.filter(file => 
			file.project.toLowerCase().includes(projectLower)
		);
	}
	
	// Filter by tag
	if (filters.tag) {
		const tagLower = filters.tag.toLowerCase();
		filteredFiles = filteredFiles.filter(file =>
			file.tags.some(tag => tag.toLowerCase().includes(tagLower))
		);
	}
	
	// Filter by search keyword
	if (filters.search) {
		const searchLower = filters.search.toLowerCase();
		filteredFiles = filteredFiles.filter(file =>
			file.title.toLowerCase().includes(searchLower) ||
			file.project.toLowerCase().includes(searchLower) ||
			file.tags.some(tag => tag.toLowerCase().includes(searchLower))
		);
	}
	
	return filteredFiles;
}

/**
 * Scan and list files with optional filtering
 * @param {string} baseDir - Base directory to scan
 * @param {Object} filters - Filter options
 * @returns {Promise<FileInfo[]>} Array of file information
 */
export async function listFiles(baseDir, filters = {}) {
	try {
		// baseDir should already be absolute from configLoader
		const absoluteBaseDir = path.isAbsolute(baseDir) ? baseDir : path.resolve(baseDir);
		
		// Check if directory exists
		try {
			await fs.access(absoluteBaseDir);
		} catch (error) {
			return [];
		}
		
		// Scan for files
		const filePaths = await scanDirectory(absoluteBaseDir);
		
		// Get file information for each file
		const fileInfoPromises = filePaths.map(filePath => getFileInfo(filePath, absoluteBaseDir));
		const fileInfos = await Promise.all(fileInfoPromises);
		
		// Filter out null results (files that couldn't be read)
		const validFiles = fileInfos.filter(info => info !== null);
		
		// Apply filters
		const filteredFiles = applyFilters(validFiles, filters);
		
		// Sort by creation date (newest first)
		filteredFiles.sort((a, b) => b.createdAt - a.createdAt);
		
		return filteredFiles;
	} catch (error) {
		throw new Error(`Failed to list files: ${error.message}`);
	}
}