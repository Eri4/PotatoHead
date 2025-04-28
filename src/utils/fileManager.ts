import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import logger from './logger';
import { NewsItem, GeneratedContent } from '../types';

export function generateId(): string {
    return crypto.randomBytes(8).toString('hex');
}

export function saveJsonToFile<T>(data: T, directory: string, filename: string): string {
    try {
        const filePath = path.join(directory, filename);
        fs.writeJsonSync(filePath, data, { spaces: 2 });
        return filePath;
    } catch (error) {
        logger.error(`Failed to save JSON to file: ${error}`);
        throw new Error(`Failed to save JSON to file: ${error}`);
    }
}

export function loadJsonFromFile<T>(filePath: string): T {
    try {
        return fs.readJsonSync(filePath);
    } catch (error) {
        logger.error(`Failed to load JSON from file: ${error}`);
        throw new Error(`Failed to load JSON from file: ${error}`);
    }
}

export function cleanDirectory(directory: string, ageInHours: number = 24): void {
    try {
        const files = fs.readdirSync(directory);
        const now = Date.now();

        files.forEach(file => {
            const filePath = path.join(directory, file);
            const stats = fs.statSync(filePath);
            const fileAgeHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

            if (fileAgeHours > ageInHours) {
                fs.removeSync(filePath);
                logger.info(`Removed old file: ${filePath}`);
            }
        });
    } catch (error) {
        logger.error(`Failed to clean directory: ${error}`);
    }
}

/**
 * Generates a properly formatted filename for videos
 * Format: date_title_category.mp4
 */
export function formatVideoFilename(newsItem: NewsItem, content: GeneratedContent): string {
    // Get current date in YYYY-MM-DD format
    const date = new Date().toISOString().split('T')[0];

    // Sanitize the title: lowercase, replace spaces with underscores, remove special chars
    const sanitizedTitle = newsItem.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')  // Remove special chars
        .replace(/\s+/g, '_')     // Replace spaces with underscores
        .substring(0, 40);        // Limit length to 40 chars

    // Determine category based on content sentiment
    // Default to content category if sentiment not available
    const category = content.sentiment || newsItem.category || 'news';

    // Assemble filename: date_title_category.mp4
    return `${date}_${sanitizedTitle}_${category}.mp4`;
}