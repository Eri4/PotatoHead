"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.saveJsonToFile = saveJsonToFile;
exports.loadJsonFromFile = loadJsonFromFile;
exports.cleanDirectory = cleanDirectory;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("./logger"));
function generateId() {
    return crypto_1.default.randomBytes(8).toString('hex');
}
function saveJsonToFile(data, directory, filename) {
    try {
        const filePath = path_1.default.join(directory, filename);
        fs_extra_1.default.writeJsonSync(filePath, data, { spaces: 2 });
        return filePath;
    }
    catch (error) {
        logger_1.default.error(`Failed to save JSON to file: ${error}`);
        throw new Error(`Failed to save JSON to file: ${error}`);
    }
}
function loadJsonFromFile(filePath) {
    try {
        return fs_extra_1.default.readJsonSync(filePath);
    }
    catch (error) {
        logger_1.default.error(`Failed to load JSON from file: ${error}`);
        throw new Error(`Failed to load JSON from file: ${error}`);
    }
}
function cleanDirectory(directory, ageInHours = 24) {
    try {
        const files = fs_extra_1.default.readdirSync(directory);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path_1.default.join(directory, file);
            const stats = fs_extra_1.default.statSync(filePath);
            const fileAgeHours = (now - stats.mtimeMs) / (1000 * 60 * 60);
            if (fileAgeHours > ageInHours) {
                fs_extra_1.default.removeSync(filePath);
                logger_1.default.info(`Removed old file: ${filePath}`);
            }
        });
    }
    catch (error) {
        logger_1.default.error(`Failed to clean directory: ${error}`);
    }
}
