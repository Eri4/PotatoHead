import config from './config/config';
import { NewsService } from './services/newsService';
import { AIService } from './services/aiService';
import { VoiceService } from './services/voiceService';
import { VideoService } from './services/videoService';
import { cleanDirectory } from './utils/fileManager';
import logger from './utils/logger';

// Main processing function
async function processNewsItem() {
    try {
        logger.info('Starting news processing cycle');

        // 1. Fetch weird news
        const newsService = new NewsService();
        const newsItems = await newsService.fetchNews(); // Using the new method for weird news

        if (newsItems.length === 0) {
            logger.warn('No news items found');
            return;
        }

        // 2. Initialize other services
        const aiService = new AIService();
        const voiceService = new VoiceService();
        const videoService = new VideoService();

        // 3. Process each news item
        for (const newsItem of newsItems) {
            try {
                // Generate sarcastic content
                const content = await aiService.generateSarcasticContent(newsItem);

                // Convert to speech
                const audioResult = await voiceService.generateSpeech(content);

                // Create video with PotatoHead animation, subtitles, and sound effects
                // Pass the newsItem to use for filename formatting
                const videoResult = await videoService.createVideoForContent(
                    content,
                    audioResult,
                    newsItem  // Pass the newsItem for filename formatting
                );

                // Update content with video URL
                content.videoUrl = videoResult.url;

                logger.info(`Successfully processed news item: ${newsItem.title}`);
                logger.info(`Video available at: ${videoResult.path}`);
            } catch (error) {
                logger.error(`Failed to process news item ${newsItem.id}: ${error}`);
            }
        }

        // 4. Clean up old files
        cleanDirectory(config.paths.frames, 24); // Remove frame directories older than 24 hours

        logger.info('News processing cycle completed');
    } catch (error) {
        logger.error(`Error in news processing cycle: ${error}`);
    }
}

// Main application function
async function main() {
    logger.info('PotatoHead News Announcer starting up');

    // Process news immediately on startup
    await processNewsItem();

    // Set up interval for regular processing
    const interval = config.apis.news.fetchInterval;
    logger.info(`Setting up news fetch interval: ${interval}ms`);

    setInterval(processNewsItem, interval);
}

// Start the application
main().catch(error => {
    logger.error(`Application failed to start: ${error}`);
    process.exit(1);
});