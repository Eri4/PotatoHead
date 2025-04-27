import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import logger from './logger';

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