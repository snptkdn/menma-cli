import stringWidth from 'string-width';

/**
 * Calculate the display width of a string, accounting for full-width characters
 * @param {string} str - String to measure
 * @returns {number} Display width in terminal columns
 */
export function getStringWidth(str) {
	return stringWidth(str);
}

/**
 * Pad string to specified width, accounting for full-width characters
 * @param {string} str - String to pad
 * @param {number} targetWidth - Target display width
 * @param {string} [padChar=' '] - Character to use for padding
 * @returns {string} Padded string
 */
export function padString(str, targetWidth, padChar = ' ') {
	const currentWidth = getStringWidth(str);
	const paddingNeeded = targetWidth - currentWidth;
	
	if (paddingNeeded <= 0) {
		return str;
	}
	
	return str + padChar.repeat(paddingNeeded);
}

/**
 * Truncate string to fit within specified width, accounting for full-width characters
 * @param {string} str - String to truncate
 * @param {number} maxWidth - Maximum display width
 * @param {string} [suffix='...'] - Suffix to add when truncating
 * @returns {string} Truncated string
 */
export function truncateString(str, maxWidth, suffix = '...') {
	const currentWidth = getStringWidth(str);
	
	if (currentWidth <= maxWidth) {
		return str;
	}
	
	const suffixWidth = getStringWidth(suffix);
	const targetWidth = maxWidth - suffixWidth;
	
	if (targetWidth <= 0) {
		return suffix.substring(0, maxWidth);
	}
	
	// Binary search to find the longest substring that fits
	let left = 0;
	let right = str.length;
	let result = '';
	
	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const substring = str.substring(0, mid);
		const substringWidth = getStringWidth(substring);
		
		if (substringWidth <= targetWidth) {
			result = substring;
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}
	
	return result + suffix;
}