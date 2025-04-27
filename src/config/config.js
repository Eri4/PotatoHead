"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// Load environment variables
dotenv_1.default.config();
// Ensure required environment variables are set
const requiredEnvVars = [
    'NEWS_API_KEY',
    'OPENAI_API_KEY',
    'ELEVEN_LABS_API_KEY',
    'POTATO_HEAD_VOICE_ID'
];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Error: Required environment variable ${varName} is not set.`);
        process.exit(1);
    }
});
// Storage paths
const storagePath = process.env.STORAGE_PATH || './storage';
const paths = {
    news: path_1.default.join(storagePath, 'news'),
    content: path_1.default.join(storagePath, 'content'),
    audio: path_1.default.join(storagePath, 'audio'),
    frames: path_1.default.join(storagePath, 'frames'),
    videos: path_1.default.join(storagePath, 'videos')
};
// Ensure storage directories exist
Object.values(paths).forEach(dir => {
    fs_extra_1.default.ensureDirSync(dir);
});
// Assets paths
const assetsPath = './assets';
const assetPaths = {
    character: {
        body: path_1.default.join(assetsPath, 'character', 'body'),
        eyes: path_1.default.join(assetsPath, 'character', 'eyes'),
        mouth: path_1.default.join(assetsPath, 'character', 'mouth'),
        accessories: path_1.default.join(assetsPath, 'character', 'accessories')
    },
    studio: {
        backgrounds: path_1.default.join(assetsPath, 'studio', 'backgrounds'),
        props: path_1.default.join(assetsPath, 'studio', 'props'),
        overlays: path_1.default.join(assetsPath, 'studio', 'overlays')
    }
};
// Api configurations
const apis = {
    news: {
        url: process.env.NEWS_API_URL || 'https://newsapi.org/v2',
        key: process.env.NEWS_API_KEY,
        category: process.env.NEWS_CATEGORY || 'entertainment',
        itemsPerFetch: parseInt(process.env.NEWS_ITEMS_PER_FETCH || '5', 10),
        fetchInterval: parseInt(process.env.NEWS_FETCH_INTERVAL || '900000', 10) // Default 15 minutes
    },
    openai: {
        url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
        key: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    elevenlabs: {
        url: process.env.ELEVEN_LABS_API_URL || 'https://api.elevenlabs.io/v1',
        key: process.env.ELEVEN_LABS_API_KEY,
        voiceId: process.env.POTATO_HEAD_VOICE_ID,
        stability: parseFloat(process.env.VOICE_STABILITY || '0.5'),
        similarityBoost: parseFloat(process.env.VOICE_SIMILARITY_BOOST || '0.75')
    }
};
// Video configurations
const video = {
    width: parseInt(process.env.VIDEO_WIDTH || '1920', 10),
    height: parseInt(process.env.VIDEO_HEIGHT || '1080', 10),
    frameRate: parseInt(process.env.FRAME_RATE || '30', 10),
    quality: parseInt(process.env.VIDEO_QUALITY || '23', 10)
};
// System settings
const system = {
    logLevel: process.env.LOG_LEVEL || 'info'
};
exports.default = {
    paths,
    assetPaths,
    apis,
    video,
    system
};
