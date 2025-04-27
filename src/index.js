"use strict";
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
const config_1 = __importDefault(require("./config/config"));
const newsService_1 = require("./services/newsService");
const aiService_1 = require("./services/aiService");
const voiceService_1 = require("./services/voiceService");
const videoService_1 = require("./services/videoService");
const fileManager_1 = require("./utils/fileManager");
const logger_1 = __importDefault(require("./utils/logger"));
// Main processing function
function processNewsItem() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.info('Starting news processing cycle');
            // 1. Fetch news
            const newsService = new newsService_1.NewsService();
            const newsItems = yield newsService.fetchEntertainmentNews();
            if (newsItems.length === 0) {
                logger_1.default.warn('No news items found');
                return;
            }
            // 2. Initialize other services
            const aiService = new aiService_1.AIService();
            const voiceService = new voiceService_1.VoiceService();
            const videoService = new videoService_1.VideoService();
            // 3. Process each news item
            for (const newsItem of newsItems) {
                try {
                    // Generate sarcastic content
                    const content = yield aiService.generateSarcasticContent(newsItem);
                    // Convert to speech
                    const audioResult = yield voiceService.generateSpeech(content);
                    // Create video with PotatoHead animation
                    const videoResult = yield videoService.createVideoForContent(content, audioResult);
                    // Update content with video URL
                    content.videoUrl = videoResult.url;
                    logger_1.default.info(`Successfully processed news item: ${newsItem.title}`);
                    logger_1.default.info(`Video available at: ${videoResult.path}`);
                }
                catch (error) {
                    logger_1.default.error(`Failed to process news item ${newsItem.id}: ${error}`);
                }
            }
            // 4. Clean up old files
            (0, fileManager_1.cleanDirectory)(config_1.default.paths.frames, 24); // Remove frame directories older than 24 hours
            logger_1.default.info('News processing cycle completed');
        }
        catch (error) {
            logger_1.default.error(`Error in news processing cycle: ${error}`);
        }
    });
}
// Main application function
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.info('PotatoHead News Announcer starting up');
        // Process news immediately on startup
        yield processNewsItem();
        // Set up interval for regular processing
        const interval = config_1.default.apis.news.fetchInterval;
        logger_1.default.info(`Setting up news fetch interval: ${interval}ms`);
        setInterval(processNewsItem, interval);
    });
}
// Start the application
main().catch(error => {
    logger_1.default.error(`Application failed to start: ${error}`);
    process.exit(1);
});
