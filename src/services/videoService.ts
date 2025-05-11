import * as path from 'path';
import { GeneratedContent, AudioResult, VideoResult, NewsItem } from '../types';
import { SubtitleService } from './subtitleService';
import { SoundEffectsService } from './soundEffectsService';
import logger from '../utils/logger';
import config from '../config/config';
import { formatVideoFilename } from "../utils/fileManager";
import { VideoProcessor } from "../animation/videoProcessor";
import { ImageService } from "./ImageService";

export class VideoService {
    private videoProcessor: VideoProcessor;
    private imageService: ImageService;
    private subtitleService: SubtitleService;
    private soundEffectsService: SoundEffectsService;
    private initialized: boolean = false;

    constructor() {
        this.videoProcessor = new VideoProcessor();
        this.imageService = new ImageService();
        this.subtitleService = new SubtitleService();
        this.soundEffectsService = new SoundEffectsService();
    }

    /**
     * Initialize the service and its dependencies
     * This pre-renders character frames for faster video generation
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        logger.info('Initializing VideoService...');

        // Initialize VideoProcessor which will pre-render character frames
        await this.videoProcessor.initialize();

        this.initialized = true;
        logger.info('VideoService initialized successfully');
    }

    /**
     * Create a complete video for content with all enhancements
     */
    async createVideoForContent(
        content: GeneratedContent,
        audioResult: AudioResult,
        newsItem?: NewsItem // Optional newsItem parameter for filename formatting
    ): Promise<VideoResult> {
        try {
            // Make sure the service is initialized
            if (!this.initialized) {
                // Only initialize if not done yet (startup)
                await this.initialize();
            }

            logger.info(`Creating enhanced video for content: ${content.id}`);

            // Determine if this should be a short-format video
            const isShortFormat = audioResult.duration <= (config.tiktok?.shortFormat || 15);

            // Fetch relevant image for the news story if we have a news item
            let newsImagePath;
            if (newsItem) {
                try {
                    newsImagePath = await this.imageService.fetchNewsImage(newsItem, content);
                    logger.info(`Fetched news image: ${newsImagePath}`);
                } catch (error) {
                    logger.warn(`Failed to fetch news image: ${error}, continuing without image`);
                }
            }

            // Track performance timing
            const startTime = Date.now();

            // Generate animation frames with improved lip sync and vertical layout
            // This now uses pre-rendered character frames for faster generation
            const frameSequence = await this.videoProcessor.generateFrameSequence(
                audioResult.duration,
                audioResult.path,
                content.rawText,
                isShortFormat,
                newsItem?.title,    // Pass the news title
                newsImagePath       // Pass the image path
            );

            const framesGenerationTime = (Date.now() - startTime) / 1000;
            logger.info(`Frame generation completed in ${framesGenerationTime.toFixed(1)} seconds`);

            // Generate custom filename if newsItem is provided
            let customFilename;
            if (newsItem) {
                customFilename = formatVideoFilename(newsItem, content);
                logger.info(`Using formatted filename: ${customFilename}`);
            }

            // Combine frames and audio into base video
            const baseVideoResult = await this.videoProcessor.createVideo(
                frameSequence.directory,
                audioResult.path,
                audioResult.duration,
                customFilename // Pass the custom filename
            );

            // Create subtitles with smaller chunks for better timing
            const subtitlePath = await this.subtitleService.createSubtitles(
                content,
                audioResult,
                path.dirname(baseVideoResult.path),
                isShortFormat
            );

            // Add subtitles to video
            const subtitledVideoPath = await this.subtitleService.addSubtitlesToVideo(
                baseVideoResult.path,
                subtitlePath,
                isShortFormat,
                true // Use default style (not compact) - change to true for more minimal subtitles
            );

            // Add sound effects
            const finalVideoPath = await this.soundEffectsService.addSoundEffectsToVideo(
                subtitledVideoPath,
                isShortFormat,
                content  // Pass content for sentiment-based sound effects
            );

            // Create result object with updated path
            const finalResult: VideoResult = {
                ...baseVideoResult,
                path: finalVideoPath,
                url: `/videos/${path.basename(finalVideoPath)}`
            };

            // Calculate and log total processing time
            const totalProcessingTime = (Date.now() - startTime) / 1000;
            logger.info(`Total video creation time: ${totalProcessingTime.toFixed(1)} seconds`);

            // Clean up old images periodically (only 10% of the time)
            if (Math.random() < 0.1) {
                this.imageService.cleanupOldImages(config.apis.imageSearch?.cleanupAge || 24);
            }

            logger.info(`Enhanced video creation complete: ${finalVideoPath}, format: ${isShortFormat ? 'short' : 'standard'}`);
            return finalResult;
        } catch (error) {
            logger.error(`Failed to create enhanced video for content: ${error}`);
            throw new Error(`Failed to create enhanced video for content: ${error}`);
        }
    }

    /**
     * Create multiple videos in batch for efficiency, maybe it can be used if i continue this project
     */
    async createVideoBatch(
        contentItems: {
            content: GeneratedContent;
            audioResult: AudioResult;
            newsItem?: NewsItem
        }[]
    ): Promise<VideoResult[]> {
        // Make sure the service is initialized
        if (!this.initialized) {
            await this.initialize();
        }

        logger.info(`Starting batch creation of ${contentItems.length} videos`);
        const startTime = Date.now();

        // Process videos sequentially (could be made parallel if needed)
        const results: VideoResult[] = [];

        for (let i = 0; i < contentItems.length; i++) {
            const { content, audioResult, newsItem } = contentItems[i];
            logger.info(`Processing batch video ${i+1}/${contentItems.length}`);

            try {
                const result = await this.createVideoForContent(content, audioResult, newsItem);
                results.push(result);
            } catch (error) {
                logger.error(`Failed to create video ${i+1} in batch: ${error}`);
                // Continue with next video instead of failing the whole batch
            }
        }

        const totalTime = (Date.now() - startTime) / 1000;
        const avgTimePerVideo = totalTime / contentItems.length;

        logger.info(`Batch processing complete: ${results.length}/${contentItems.length} videos created`);
        logger.info(`Total batch time: ${totalTime.toFixed(1)}s, Average per video: ${avgTimePerVideo.toFixed(1)}s`);

        return results;
    }
}