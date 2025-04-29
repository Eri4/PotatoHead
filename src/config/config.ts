import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

// Load environment variables
dotenv.config();

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
    news: path.join(storagePath, 'news'),
    content: path.join(storagePath, 'content'),
    audio: path.join(storagePath, 'audio'),
    frames: path.join(storagePath, 'frames'),
    videos: path.join(storagePath, 'videos'),
    temp: path.join(storagePath, 'temp') // Added temp directory for images and other temporary files
};

// Ensure storage directories exist
Object.values(paths).forEach(dir => {
    fs.ensureDirSync(dir);
});

// Assets paths
const assetsPath = './assets';
const assetPaths = {
    character: {
        body: path.join(assetsPath, 'character', 'body'),
        eyes: path.join(assetsPath, 'character', 'eyes'),
        mouth: path.join(assetsPath, 'character', 'mouth'),
        accessories: path.join(assetsPath, 'character', 'accessories')
    },
    studio: {
        backgrounds: path.join(assetsPath, 'studio', 'backgrounds'),
        props: path.join(assetsPath, 'studio', 'props'),
        overlays: path.join(assetsPath, 'studio', 'overlays')
    },
    audio: {
        soundEffects: path.join(assetsPath, 'audio', 'sound_effects'),
        music: path.join(assetsPath, 'audio', 'music')
    },
    misc: {
        fallbackImages: path.join(assetsPath, 'misc', 'fallback_images')
    }
};

// Api configurations
const apis = {
    news: {
        url: process.env.NEWS_API_URL || 'https://newsapi.org/v2',
        key: process.env.NEWS_API_KEY,
        category: process.env.NEWS_CATEGORY || 'entertainment',
        itemsPerFetch: parseInt(process.env.NEWS_ITEMS_PER_FETCH || '10', 10),
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
    },
    imageSearch: {
        // Provider can be 'unsplash', 'pixabay', 'pexels', or null to disable
        provider: process.env.IMAGE_SEARCH_PROVIDER,
        // API keys for different image search providers
        unsplash: {
            key: process.env.UNSPLASH_API_KEY
        },
        pixabay: {
            key: process.env.PIXABAY_API_KEY
        },
        pexels: {
            key: process.env.PEXELS_API_KEY
        },
        // Google Custom Search API information
        googleCustomSearch: {
            key: process.env.GOOGLE_SEARCH_API_KEY,
            cx: process.env.GOOGLE_SEARCH_ENGINE_ID  // Custom Search Engine ID
        },
        // Max images to keep in temp storage before cleanup
        maxStoredImages: parseInt(process.env.MAX_STORED_IMAGES || '100', 10),
        // How old images need to be (in hours) before cleanup
        cleanupAge: parseInt(process.env.IMAGE_CLEANUP_AGE || '24', 10)
    }
};

// Video configurations - Updated for TikTok vertical format
const video = {
    // Default to TikTok vertical format (9:16 aspect ratio)
    width: parseInt(process.env.VIDEO_WIDTH || '720', 10),
    height: parseInt(process.env.VIDEO_HEIGHT || '1280', 10),
    frameRate: parseInt(process.env.FRAME_RATE || '30', 10),
    quality: parseInt(process.env.VIDEO_QUALITY || '23', 10),
    // Set to true to use vertical format, false for horizontal
    verticalFormat: process.env.VERTICAL_FORMAT !== 'false',
    // Horizontal format dimensions (if needed)
    horizontal: {
        width: parseInt(process.env.HORIZONTAL_WIDTH || '1920', 10),
        height: parseInt(process.env.HORIZONTAL_HEIGHT || '1080', 10)
    }
};

// TikTok-specific settings
const tiktok = {
    maxDuration: parseInt(process.env.TIKTOK_MAX_DURATION || '60', 10), // Updated to 60 seconds for longer form
    minDuration: parseInt(process.env.TIKTOK_MIN_DURATION || '15', 10), // in seconds
    shortFormat: parseInt(process.env.TIKTOK_SHORT_FORMAT || '15', 10), // threshold for short format
    // Section heights for vertical layout (as percentages)
    verticalLayout: {
        topSection: parseInt(process.env.TIKTOK_TOP_SECTION || '20', 10),    // Top 20% for header
        middleSection: parseInt(process.env.TIKTOK_MIDDLE_SECTION || '50', 10), // Middle 50% for character
        bottomSection: parseInt(process.env.TIKTOK_BOTTOM_SECTION || '30', 10)  // Bottom 30% for image
    }
};

// System settings
const system = {
    logLevel: process.env.LOG_LEVEL || 'info',
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '86400000', 10), // 24 hours by default
    maxStorageAge: {
        frames: parseInt(process.env.MAX_FRAMES_AGE || '24', 10),  // in hours
        temp: parseInt(process.env.MAX_TEMP_AGE || '24', 10)       // in hours
    }
};

export default {
    paths,
    assetPaths,
    apis,
    video,
    system,
    tiktok
};