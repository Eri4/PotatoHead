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
exports.VideoService = void 0;
const path = __importStar(require("path"));
const subtitleService_1 = require("./subtitleService");
const soundEffectsService_1 = require("./soundEffectsService");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = __importDefault(require("../config/config"));
const fileManager_1 = require("../utils/fileManager");
const videoProcessor_1 = require("../animation/videoProcessor");
const ImageService_1 = require("./ImageService");
class VideoService {
    constructor() {
        this.initialized = false;
        this.videoProcessor = new videoProcessor_1.VideoProcessor();
        this.imageService = new ImageService_1.ImageService();
        this.subtitleService = new subtitleService_1.SubtitleService();
        this.soundEffectsService = new soundEffectsService_1.SoundEffectsService();
    }
    /**
     * Initialize the service and its dependencies
     * This pre-renders character frames for faster video generation
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initialized)
                return;
            logger_1.default.info('Initializing VideoService...');
            // Initialize VideoProcessor which will pre-render character frames
            yield this.videoProcessor.initialize();
            this.initialized = true;
            logger_1.default.info('VideoService initialized successfully');
        });
    }
    /**
     * Create a complete video for content with all enhancements
     */
    createVideoForContent(content, audioResult, newsItem // Optional newsItem parameter for filename formatting
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Make sure the service is initialized
                if (!this.initialized) {
                    // Only initialize if not done yet (startup)
                    yield this.initialize();
                }
                logger_1.default.info(`Creating enhanced video for content: ${content.id}`);
                // Determine if this should be a short-format video
                const isShortFormat = audioResult.duration <= (((_a = config_1.default.tiktok) === null || _a === void 0 ? void 0 : _a.shortFormat) || 15);
                // Fetch relevant image for the news story if we have a news item
                let newsImagePath;
                if (newsItem) {
                    try {
                        newsImagePath = yield this.imageService.fetchNewsImage(newsItem, content);
                        logger_1.default.info(`Fetched news image: ${newsImagePath}`);
                    }
                    catch (error) {
                        logger_1.default.warn(`Failed to fetch news image: ${error}, continuing without image`);
                    }
                }
                // Track performance timing
                const startTime = Date.now();
                // Generate animation frames with improved lip sync and vertical layout
                // This now uses pre-rendered character frames for faster generation
                const frameSequence = yield this.videoProcessor.generateFrameSequence(audioResult.duration, audioResult.path, content.rawText, isShortFormat, newsItem === null || newsItem === void 0 ? void 0 : newsItem.title, // Pass the news title
                newsImagePath // Pass the image path
                );
                const framesGenerationTime = (Date.now() - startTime) / 1000;
                logger_1.default.info(`Frame generation completed in ${framesGenerationTime.toFixed(1)} seconds`);
                // Generate custom filename if newsItem is provided
                let customFilename;
                if (newsItem) {
                    customFilename = (0, fileManager_1.formatVideoFilename)(newsItem, content);
                    logger_1.default.info(`Using formatted filename: ${customFilename}`);
                }
                // Combine frames and audio into base video
                const baseVideoResult = yield this.videoProcessor.createVideo(frameSequence.directory, audioResult.path, audioResult.duration, customFilename // Pass the custom filename
                );
                // Create subtitles with smaller chunks for better timing
                const subtitlePath = yield this.subtitleService.createSubtitles(content, audioResult, path.dirname(baseVideoResult.path), isShortFormat);
                // Add subtitles to video
                const subtitledVideoPath = yield this.subtitleService.addSubtitlesToVideo(baseVideoResult.path, subtitlePath, isShortFormat, false // Use default style (not compact) - change to true for more minimal subtitles
                );
                // Add sound effects
                const finalVideoPath = yield this.soundEffectsService.addSoundEffectsToVideo(subtitledVideoPath, isShortFormat, content // Pass content for sentiment-based sound effects
                );
                // Create result object with updated path
                const finalResult = Object.assign(Object.assign({}, baseVideoResult), { path: finalVideoPath, url: `/videos/${path.basename(finalVideoPath)}` });
                // Calculate and log total processing time
                const totalProcessingTime = (Date.now() - startTime) / 1000;
                logger_1.default.info(`Total video creation time: ${totalProcessingTime.toFixed(1)} seconds`);
                // Clean up old images periodically (only 10% of the time)
                if (Math.random() < 0.1) {
                    this.imageService.cleanupOldImages(((_b = config_1.default.apis.imageSearch) === null || _b === void 0 ? void 0 : _b.cleanupAge) || 24);
                }
                logger_1.default.info(`Enhanced video creation complete: ${finalVideoPath}, format: ${isShortFormat ? 'short' : 'standard'}`);
                return finalResult;
            }
            catch (error) {
                logger_1.default.error(`Failed to create enhanced video for content: ${error}`);
                throw new Error(`Failed to create enhanced video for content: ${error}`);
            }
        });
    }
    /**
     * Create multiple videos in batch for efficiency
     */
    createVideoBatch(contentItems) {
        return __awaiter(this, void 0, void 0, function* () {
            // Make sure the service is initialized
            if (!this.initialized) {
                yield this.initialize();
            }
            logger_1.default.info(`Starting batch creation of ${contentItems.length} videos`);
            const startTime = Date.now();
            // Process videos sequentially (could be made parallel if needed)
            const results = [];
            for (let i = 0; i < contentItems.length; i++) {
                const { content, audioResult, newsItem } = contentItems[i];
                logger_1.default.info(`Processing batch video ${i + 1}/${contentItems.length}`);
                try {
                    const result = yield this.createVideoForContent(content, audioResult, newsItem);
                    results.push(result);
                }
                catch (error) {
                    logger_1.default.error(`Failed to create video ${i + 1} in batch: ${error}`);
                    // Continue with next video instead of failing the whole batch
                }
            }
            const totalTime = (Date.now() - startTime) / 1000;
            const avgTimePerVideo = totalTime / contentItems.length;
            logger_1.default.info(`Batch processing complete: ${results.length}/${contentItems.length} videos created`);
            logger_1.default.info(`Total batch time: ${totalTime.toFixed(1)}s, Average per video: ${avgTimePerVideo.toFixed(1)}s`);
            return results;
        });
    }
}
exports.VideoService = VideoService;
