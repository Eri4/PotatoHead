"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageService = void 0;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const sharp_1 = __importDefault(require("sharp"));
class ImageService {
    constructor() {
        var _a, _b, _c, _d;
        // Focus only on Google Custom Search
        this.googleApiKey = ((_b = (_a = config_1.default.apis.imageSearch) === null || _a === void 0 ? void 0 : _a.googleCustomSearch) === null || _b === void 0 ? void 0 : _b.key) || '';
        this.googleCx = ((_d = (_c = config_1.default.apis.imageSearch) === null || _c === void 0 ? void 0 : _c.googleCustomSearch) === null || _d === void 0 ? void 0 : _d.cx) || '';
        this.tempDir = config_1.default.paths.temp || 'temp';
        this.fallbackImagesDir = typeof config_1.default.assetPaths.misc === 'string'
            ? path.join(config_1.default.assetPaths.misc, 'fallback_images')
            : path.join('assets/misc', 'fallback_images');
        // Ensure temp directory exists
        fs.ensureDirSync(this.tempDir);
        // Initialize cache
        this.imageCache = new Map();
    }
    /**
     * Fetch news image with improved Google search strategy
     */
    fetchNewsImage(newsItem, generatedContent) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                logger_1.default.info(`Fetching image for news story: ${newsItem.id} - ${newsItem.title}`);
                // Create a simpler cache key
                const cacheKey = `${newsItem.id}_${newsItem.category}`;
                // Check if we already have an image for this news item
                if (this.imageCache.has(cacheKey)) {
                    logger_1.default.info(`Using cached image: ${this.imageCache.get(cacheKey)}`);
                    return this.imageCache.get(cacheKey);
                }
                // Multi-stage approach for better results
                let imagePath = null;
                // STAGE 1: Try with AI-generated search terms (highest quality)
                if (((_a = generatedContent === null || generatedContent === void 0 ? void 0 : generatedContent.imageSearchTerms) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    logger_1.default.info(`STAGE 1: Trying AI-generated image search terms`);
                    const aiTerms = generatedContent.imageSearchTerms;
                    imagePath = yield this.tryFetchImageWithTerms(aiTerms, newsItem.category, false);
                    if (imagePath) {
                        logger_1.default.info(`Successfully found image using AI-generated terms`);
                    }
                }
                // STAGE 2: Try with relaxed rights filter if no results
                if (!imagePath && ((_b = generatedContent === null || generatedContent === void 0 ? void 0 : generatedContent.imageSearchTerms) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                    logger_1.default.info(`STAGE 2: Trying AI-generated terms with relaxed rights filter`);
                    const aiTerms = generatedContent.imageSearchTerms;
                    imagePath = yield this.tryFetchImageWithTerms(aiTerms, newsItem.category, true);
                    if (imagePath) {
                        logger_1.default.info(`Found image with relaxed rights filter`);
                    }
                }
                // STAGE 3: Try with extracted keywords if still no results
                if (!imagePath) {
                    logger_1.default.info(`STAGE 3: Trying extracted keywords from content`);
                    const extractedKeywords = this.extractEnhancedKeywords(newsItem);
                    imagePath = yield this.tryFetchImageWithTerms(extractedKeywords, newsItem.category, true);
                    if (imagePath) {
                        logger_1.default.info(`Found image using extracted keywords`);
                    }
                }
                // STAGE 4: Try with permutations of terms if still nothing
                if (!imagePath) {
                    logger_1.default.info(`STAGE 4: Trying keyword permutations and simplifications`);
                    // Get a mix of terms from different sources
                    const allTerms = [
                        ...((generatedContent === null || generatedContent === void 0 ? void 0 : generatedContent.imageSearchTerms) || []),
                        ...this.extractEnhancedKeywords(newsItem),
                        ...this.getContentTypeTerms((generatedContent === null || generatedContent === void 0 ? void 0 : generatedContent.sentiment) || 'neutral'),
                        ...this.getCategoryTerms(newsItem.category)
                    ];
                    // Try pairs of terms (more specific)
                    for (let i = 0; i < allTerms.length - 1; i++) {
                        for (let j = i + 1; j < allTerms.length; j++) {
                            const pairTerms = [allTerms[i], allTerms[j]];
                            imagePath = yield this.tryFetchImageWithTerms(pairTerms, null, true);
                            if (imagePath) {
                                logger_1.default.info(`Found image using term pair: ${pairTerms.join(', ')}`);
                                break;
                            }
                        }
                        if (imagePath)
                            break;
                    }
                }
                // STAGE 5: Try with broader category-based terms
                if (!imagePath) {
                    logger_1.default.info(`STAGE 5: Trying broader category-based terms`);
                    // Get category and content type terms
                    const categoryTerms = this.getCategoryTerms(newsItem.category);
                    const contentTypeTerms = this.getContentTypeTerms((generatedContent === null || generatedContent === void 0 ? void 0 : generatedContent.sentiment) || 'neutral');
                    // Try category terms with content type
                    const broadTerms = [...categoryTerms, ...contentTypeTerms];
                    imagePath = yield this.tryFetchImageWithTerms(broadTerms, null, true);
                    if (imagePath) {
                        logger_1.default.info(`Found image using broader category terms`);
                    }
                }
                // STAGE 6: Last resort - just use the category alone
                if (!imagePath) {
                    logger_1.default.info(`STAGE 6: Trying just category alone`);
                    const singleCategoryTerm = [newsItem.category.replace('-', ' ')];
                    imagePath = yield this.tryFetchImageWithTerms(singleCategoryTerm, null, true);
                    if (imagePath) {
                        logger_1.default.info(`Found image using category alone`);
                    }
                }
                // FINAL FALLBACK: If still no image, use fallback system
                if (!imagePath) {
                    logger_1.default.warn(`All Google search attempts failed. Using fallback image.`);
                    imagePath = this.getFallbackImage(newsItem.category, generatedContent === null || generatedContent === void 0 ? void 0 : generatedContent.sentiment);
                    // Process fallback image too for consistency
                    if (imagePath) {
                        imagePath = (yield this.processImage(imagePath)) || imagePath;
                    }
                }
                // Cache the result
                if (imagePath) {
                    this.imageCache.set(cacheKey, imagePath);
                    // Clean up old cache entries (keep last 30)
                    if (this.imageCache.size > 30) {
                        const oldestKey = Array.from(this.imageCache.keys())[0];
                        this.imageCache.delete(oldestKey);
                    }
                }
                return imagePath;
            }
            catch (error) {
                logger_1.default.error(`Error fetching news image: ${error}`);
                return this.getFallbackImage(newsItem.category);
            }
        });
    }
    /**
     * Try to fetch image with given terms - helper method to reduce repetition
     */
    tryFetchImageWithTerms(terms, category, relaxRights) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get image URLs from Google
                const imageUrls = yield this.fetchGoogleImageUrls(terms, category, relaxRights);
                // If we found some, try to download and process them
                if (imageUrls.length > 0) {
                    for (const url of imageUrls) {
                        try {
                            const downloadedPath = yield this.downloadImage(url, 'google');
                            const processedPath = yield this.processImage(downloadedPath);
                            if (processedPath) {
                                return processedPath;
                            }
                        }
                        catch (err) {
                            logger_1.default.warn(`Failed to process image from ${url}: ${err}`);
                            // Continue to next URL
                        }
                    }
                }
                // If we get here, no usable images were found
                return null;
            }
            catch (error) {
                logger_1.default.warn(`Search attempt failed: ${error}`);
                return null;
            }
        });
    }
    /**
     * Extract enhanced keywords for better image search results
     */
    extractEnhancedKeywords(newsItem) {
        // Extract key elements from the title
        const title = newsItem.title;
        const content = newsItem.content.substring(0, 250); // Use a bit more content
        // Create base keywords from title words (excluding common words)
        const commonWords = ['the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'is', 'are', 'was', 'were', 'will', 'be'];
        // Look for proper nouns (capitalized words) in title - they're often important subjects
        const properNouns = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
        // Extract key phrases that might be descriptive
        const keyPhrases = [];
        const phrasePatterns = [
            /(?:mysterious|strange|unusual|weird|bizarre) ([a-z]+ [a-z]+)/i,
            /(?:discovered|found|spotted|identified) ([a-z]+ [a-z]+)/i
        ];
        for (const pattern of phrasePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                keyPhrases.push(match[1]);
            }
        }
        // Extract important words from title
        const titleWords = title.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));
        // Combine with priority to named entities and key phrases
        const keywords = [
            ...properNouns,
            ...keyPhrases,
            ...titleWords.slice(0, 3)
        ];
        // Remove duplicates and limit length
        const uniqueKeywords = Array.from(new Set(keywords));
        // Add category if not already present
        if (newsItem.category && !uniqueKeywords.some(k => k.includes(newsItem.category.replace('-', ' ')))) {
            uniqueKeywords.push(newsItem.category.replace('-', ' '));
        }
        return uniqueKeywords.slice(0, 5);
    }
    /**
     * Get terms related to a content type/sentiment
     */
    getContentTypeTerms(contentType) {
        const contentTypeMap = {
            'mystery': ['mysterious', 'mystery', 'enigmatic', 'unknown'],
            'weird': ['weird', 'strange', 'bizarre', 'unusual', 'odd'],
            'unexplained': ['unexplained', 'baffling', 'puzzling', 'mysterious phenomenon'],
            'cryptid': ['cryptid', 'monster', 'creature', 'mysterious animal'],
            'paranormal': ['paranormal', 'supernatural', 'ghostly', 'eerie'],
            'funny': ['funny', 'amusing', 'comical', 'humorous'],
            'neutral': ['interesting', 'notable', 'remarkable']
        };
        return contentTypeMap[contentType] || contentTypeMap.neutral;
    }
    /**
     * Get terms related to a category
     */
    getCategoryTerms(category) {
        const categoryMap = {
            'mystery': ['mystery', 'unsolved', 'enigma', 'hidden'],
            'weird-science': ['science', 'experiment', 'laboratory', 'research', 'scientific'],
            'cryptid': ['cryptid', 'monster', 'creature', 'beast', 'sighting'],
            'paranormal': ['paranormal', 'supernatural', 'ghost', 'haunted', 'spirit'],
            'archaeology': ['archaeology', 'ancient', 'discovery', 'ruins', 'artifact'],
            'bizarre': ['bizarre', 'strange', 'unusual', 'odd', 'peculiar'],
            'simulation': ['simulation', 'glitch', 'matrix', 'virtual', 'reality'],
            'coincidence': ['coincidence', 'synchronicity', 'chance', 'unlikely'],
            'ufo': ['ufo', 'alien', 'spacecraft', 'flying saucer', 'extraterrestrial'],
            'natural-mystery': ['natural', 'phenomenon', 'earth', 'nature', 'environmental'],
            'weird-news': ['news', 'weird', 'headline', 'story', 'report']
        };
        return categoryMap[category] || ['weird', 'unusual', 'strange', 'interesting'];
    }
    /**
     * Fetch image URLs from Google Custom Search with enhanced options
     */
    fetchGoogleImageUrls(keywords_1, category_1) {
        return __awaiter(this, arguments, void 0, function* (keywords, category, relaxRights = false) {
            try {
                if (!this.googleApiKey || !this.googleCx) {
                    logger_1.default.error('Google Custom Search API key or CX not configured');
                    return [];
                }
                // Build the query
                let query = keywords.join(' ');
                // Add category if provided and not already in the query
                if (category && !query.toLowerCase().includes(category.toLowerCase().replace('-', ' '))) {
                    query += ` ${category.replace('-', ' ')}`;
                }
                const encodedQuery = encodeURIComponent(query);
                logger_1.default.info(`Searching Google for image: "${query}"`);
                // Build the request URL with appropriate options
                let requestUrl = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCx}&q=${encodedQuery}&searchType=image&num=10&imgType=photo&safe=active`;
                // Only apply rights filter in strict mode
                if (!relaxRights) {
                    requestUrl += '&rights=cc_publicdomain,cc_attribute,cc_sharealike';
                }
                // Request with increased timeout
                const response = yield axios_1.default.get(requestUrl, { timeout: 10000 });
                const urls = [];
                if (response.data.items && response.data.items.length > 0) {
                    // Accept more images with relaxed quality checks
                    response.data.items.forEach((item) => {
                        // In relaxed mode, accept almost any image that's not tiny
                        const minWidth = relaxRights ? 300 : 500;
                        const minHeight = relaxRights ? 200 : 400;
                        if (item.image && item.image.width >= minWidth && item.image.height >= minHeight) {
                            urls.push(item.link);
                        }
                    });
                }
                logger_1.default.info(`Found ${urls.length} potential images from Google`);
                return urls;
            }
            catch (error) {
                logger_1.default.error(`Google image search error: ${error}`);
                return [];
            }
        });
    }
    /**
     * Process image to improve quality and ensure proper size
     */
    processImage(imagePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!fs.existsSync(imagePath)) {
                    logger_1.default.warn(`Image doesn't exist: ${imagePath}`);
                    return null;
                }
                // Check if the image is already processed (has _processed in filename)
                if (imagePath.includes('_processed')) {
                    return imagePath;
                }
                // Create processed image filename
                const dir = path.dirname(imagePath);
                const ext = path.extname(imagePath);
                const base = path.basename(imagePath, ext);
                const processedPath = path.join(dir, `${base}_processed${ext}`);
                // Check image metadata first
                try {
                    const metadata = yield (0, sharp_1.default)(imagePath).metadata();
                    // Skip processing if image is too corrupt
                    if (!metadata) {
                        logger_1.default.warn(`Image too corrupt: ${imagePath}`);
                        return null;
                    }
                    // Process with sharp for better quality
                    yield (0, sharp_1.default)(imagePath)
                        // Resize to fit container well (16:9 aspect ratio)
                        .resize({
                        width: 1280,
                        height: 720,
                        fit: 'cover',
                        position: 'center'
                    })
                        // Adjust quality
                        .sharpen()
                        .modulate({
                        brightness: 1.05, // Slightly brighter
                        saturation: 1.2 // More colorful
                    })
                        // Save as high-quality JPEG
                        .jpeg({ quality: 90 })
                        .toFile(processedPath);
                    logger_1.default.info(`Processed image: ${processedPath}`);
                    return processedPath;
                }
                catch (sharpError) {
                    logger_1.default.error(`Sharp processing error: ${sharpError}`);
                    return null;
                }
            }
            catch (error) {
                logger_1.default.error(`Error processing image: ${error}`);
                return null;
            }
        });
    }
    /**
     * Get a fallback image based on news category and sentiment
     */
    getFallbackImage(category, sentiment) {
        // Try sentiment+category specific fallback first
        if (sentiment) {
            const sentimentCategoryDir = path.join(this.fallbackImagesDir, `${category}_${sentiment}`);
            if (fs.existsSync(sentimentCategoryDir)) {
                const images = fs.readdirSync(sentimentCategoryDir).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
                if (images.length > 0) {
                    const randomImage = images[Math.floor(Math.random() * images.length)];
                    return path.join(sentimentCategoryDir, randomImage);
                }
            }
        }
        // Try category-specific fallback
        const categoryFallbackDir = path.join(this.fallbackImagesDir, category);
        if (fs.existsSync(categoryFallbackDir)) {
            const images = fs.readdirSync(categoryFallbackDir).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
            if (images.length > 0) {
                const randomImage = images[Math.floor(Math.random() * images.length)];
                return path.join(categoryFallbackDir, randomImage);
            }
        }
        // Try sentiment-specific fallback
        if (sentiment) {
            const sentimentDir = path.join(this.fallbackImagesDir, sentiment);
            if (fs.existsSync(sentimentDir)) {
                const images = fs.readdirSync(sentimentDir).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
                if (images.length > 0) {
                    const randomImage = images[Math.floor(Math.random() * images.length)];
                    return path.join(sentimentDir, randomImage);
                }
            }
        }
        // Try general fallback
        if (fs.existsSync(this.fallbackImagesDir)) {
            const images = fs.readdirSync(this.fallbackImagesDir).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
            if (images.length > 0) {
                const randomImage = images[Math.floor(Math.random() * images.length)];
                return path.join(this.fallbackImagesDir, randomImage);
            }
        }
        // Last resort - create a placeholder
        return this.createPlaceholderImage(category, sentiment) ||
            path.join(this.fallbackImagesDir, 'default.jpg');
    }
    /**
     * Download an image from a URL with improved error handling
     */
    downloadImage(url, source) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a unique filename to prevent duplicates
                const urlHash = this.simpleHash(url);
                const filename = `${source}_${urlHash}.jpg`;
                const imagePath = path.join(this.tempDir, filename);
                // Check if we already downloaded this exact URL
                if (fs.existsSync(imagePath)) {
                    logger_1.default.info(`Using previously downloaded image: ${imagePath}`);
                    return imagePath;
                }
                // Download with more robust settings
                const response = yield axios_1.default.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 10000, // Longer timeout
                    maxRedirects: 5, // Handle redirects
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    },
                    // Less strict validation to handle more image sources
                    validateStatus: (status) => status < 500
                });
                // Check if we got actual image data
                if (!response.data || response.data.length < 1000) {
                    throw new Error('Downloaded file too small or empty');
                }
                // Save the image
                fs.writeFileSync(imagePath, response.data);
                logger_1.default.info(`Downloaded image: ${imagePath} (${Math.round(response.data.length / 1024)} KB)`);
                return imagePath;
            }
            catch (error) {
                logger_1.default.error(`Failed to download image from ${url}: ${error}`);
                throw error;
            }
        });
    }
    /**
     * Create a placeholder image with category and sentiment
     */
    createPlaceholderImage(category, sentiment) {
        try {
            const { createCanvas } = require('canvas');
            const canvas = createCanvas(1280, 720);
            const ctx = canvas.getContext('2d');
            // Select colors based on category and sentiment
            const categoryColors = {
                'mystery': '#3a0088',
                'weird-science': '#006699',
                'cryptid': '#336600',
                'paranormal': '#660033',
                'archaeology': '#996633',
                'bizarre': '#663399',
                'simulation': '#009999',
                'coincidence': '#cc6600',
                'ufo': '#660066',
                'natural-mystery': '#006633',
                'weird-news': '#333399',
                'default': '#2c3e50'
            };
            const sentimentColors = {
                'mystery': '#4400aa',
                'weird': '#7700cc',
                'unexplained': '#0077cc',
                'cryptid': '#447700',
                'paranormal': '#990044',
                'funny': '#ff6600',
                'neutral': '#555555'
            };
            // Select background colors
            const bgColor1 = categoryColors[category] || categoryColors.default;
            const bgColor2 = sentiment ? (sentimentColors[sentiment] || '#000000') : '#000000';
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
            gradient.addColorStop(0, bgColor1);
            gradient.addColorStop(1, bgColor2);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1280, 720);
            // Add logo text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PNN', 640, 300);
            // Draw category with glow effect
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 15;
            ctx.font = 'bold 48px Arial';
            ctx.fillText(category.toUpperCase().replace('-', ' '), 640, 400);
            // Add sentiment if provided
            if (sentiment) {
                ctx.font = 'bold 36px Arial';
                ctx.fillText(sentiment.toUpperCase(), 640, 480);
            }
            ctx.shadowBlur = 0;
            // Save to file
            const sentimentSuffix = sentiment ? `_${sentiment}` : '';
            const filename = `placeholder_${category}${sentimentSuffix}_${Date.now()}.jpg`;
            const imagePath = path.join(this.tempDir, filename);
            fs.writeFileSync(imagePath, canvas.toBuffer('image/jpeg'));
            return imagePath;
        }
        catch (error) {
            logger_1.default.error(`Failed to create placeholder image: ${error}`);
            return null;
        }
    }
    /**
     * Clean up old downloaded images to save disk space
     */
    cleanupOldImages(maxAgeHours = 24) {
        try {
            logger_1.default.info(`Cleaning up images older than ${maxAgeHours} hours`);
            const files = fs.readdirSync(this.tempDir);
            const now = Date.now();
            let deletedCount = 0;
            for (const file of files) {
                if (file.match(/\.(jpg|png)$/)) {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);
                    if (ageHours > maxAgeHours) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            }
            logger_1.default.info(`Deleted ${deletedCount} old images`);
        }
        catch (error) {
            logger_1.default.error(`Error cleaning up old images: ${error}`);
        }
    }
    /**
     * Simple string hashing function
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
}
exports.ImageService = ImageService;
