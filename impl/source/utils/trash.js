import fs from 'fs/promises';
import path from 'path';

/**
 * Move file to trash directory
 * @param {string} filePath - Path to file to trash
 * @param {string} baseDir - Base directory containing .trash folder
 * @returns {Promise<string>} Path where file was moved
 */
export async function moveToTrash(filePath, baseDir) {
	const trashDir = path.join(baseDir, '.trash');
	
	// Ensure trash directory exists
	try {
		await fs.mkdir(trashDir, { recursive: true });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}
	
	const fileName = path.basename(filePath);
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const trashedFileName = `${timestamp}_${fileName}`;
	const trashedPath = path.join(trashDir, trashedFileName);
	
	// Move file to trash
	await fs.rename(filePath, trashedPath);
	
	return trashedPath;
}

/**
 * Check if a directory path should be excluded from scanning
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} True if directory should be excluded
 */
export function shouldExcludeDirectory(dirPath) {
	const dirName = path.basename(dirPath);
	return dirName === '.trash' || dirName.startsWith('.');
}