import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * @typedef {Object} AccessRecord
 * @property {string} filePath - Full path to the file
 * @property {number} accessCount - Number of times accessed
 * @property {string} lastAccessed - Last access timestamp (ISO string)
 * @property {string} firstAccessed - First access timestamp (ISO string)
 */

/**
 * Get access history file path
 * @returns {string} Path to access history file
 */
function getAccessHistoryPath() {
	const homeDir = os.homedir();
	return path.join(homeDir, '.config', 'menma-access-history.json');
}

/**
 * Load access history from file
 * @returns {Promise<Map<string, AccessRecord>>} Access history map
 */
async function loadAccessHistory() {
	const historyPath = getAccessHistoryPath();
	
	try {
		const content = await fs.readFile(historyPath, 'utf-8');
		const data = JSON.parse(content);
		return new Map(Object.entries(data));
	} catch (error) {
		// File doesn't exist or is corrupted, return empty map
		return new Map();
	}
}

/**
 * Save access history to file
 * @param {Map<string, AccessRecord>} history - Access history map
 */
async function saveAccessHistory(history) {
	const historyPath = getAccessHistoryPath();
	const data = Object.fromEntries(history);
	
	try {
		// Ensure directory exists
		await fs.mkdir(path.dirname(historyPath), { recursive: true });
		await fs.writeFile(historyPath, JSON.stringify(data, null, 2));
	} catch (error) {
		console.warn(`Warning: Could not save access history: ${error.message}`);
	}
}

/**
 * Record file access
 * @param {string} filePath - Path to accessed file
 */
export async function recordAccess(filePath) {
	const history = await loadAccessHistory();
	const now = new Date().toISOString();
	
	if (history.has(filePath)) {
		const record = history.get(filePath);
		record.accessCount++;
		record.lastAccessed = now;
	} else {
		history.set(filePath, {
			filePath,
			accessCount: 1,
			lastAccessed: now,
			firstAccessed: now
		});
	}
	
	await saveAccessHistory(history);
}

/**
 * Calculate smart score for a file
 * @param {AccessRecord} record - Access record
 * @param {Date} now - Current time
 * @returns {number} Smart score (higher = more likely to be wanted)
 */
function calculateSmartScore(record, now) {
	const lastAccessed = new Date(record.lastAccessed);
	const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
	
	// Frequency score: logarithmic scale to prevent over-weighting heavily used files
	const frequencyScore = Math.log(record.accessCount + 1) * 10;
	
	// Recency score: exponential decay (heavily favor recent access)
	const recencyScore = Math.exp(-daysSinceAccess / 7) * 20; // 7-day half-life
	
	// Consistency score: how regularly the file is accessed
	const firstAccessed = new Date(record.firstAccessed);
	const totalDays = Math.max(1, (now - firstAccessed) / (1000 * 60 * 60 * 24));
	const accessRate = record.accessCount / totalDays;
	const consistencyScore = Math.min(accessRate * 50, 10); // Cap at 10 points
	
	return frequencyScore + recencyScore + consistencyScore;
}

/**
 * Get smart file suggestions based on access history
 * @param {import('./fileScanner.js').FileInfo[]} availableFiles - Available files to score
 * @param {number} [limit=10] - Maximum number of suggestions
 * @returns {Promise<Array<{file: import('./fileScanner.js').FileInfo, score: number, accessCount: number, daysSinceAccess: number}>>}
 */
export async function getSmartSuggestions(availableFiles, limit = 10) {
	const history = await loadAccessHistory();
	const now = new Date();
	const suggestions = [];
	
	for (const file of availableFiles) {
		const record = history.get(file.filePath);
		if (record && record.accessCount > 0) {
			const score = calculateSmartScore(record, now);
			const lastAccessed = new Date(record.lastAccessed);
			const daysSinceAccess = Math.floor((now - lastAccessed) / (1000 * 60 * 60 * 24));
			
			suggestions.push({
				file,
				score,
				accessCount: record.accessCount,
				daysSinceAccess
			});
		}
	}
	
	// Sort by score (highest first) and limit results
	suggestions.sort((a, b) => b.score - a.score);
	return suggestions.slice(0, limit);
}

/**
 * Get access statistics
 * @returns {Promise<{totalFiles: number, totalAccesses: number, mostAccessed: AccessRecord|null}>}
 */
export async function getAccessStats() {
	const history = await loadAccessHistory();
	const records = Array.from(history.values());
	
	const totalFiles = records.length;
	const totalAccesses = records.reduce((sum, record) => sum + record.accessCount, 0);
	
	let mostAccessed = null;
	if (records.length > 0) {
		mostAccessed = records.reduce((max, record) => 
			record.accessCount > max.accessCount ? record : max
		);
	}
	
	return {
		totalFiles,
		totalAccesses,
		mostAccessed
	};
}