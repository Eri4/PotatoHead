import * as path from 'path';
import { GeneratedContent, AudioResult, VideoResult, NewsItem } from '../types';
import { VideoProcessor } from '../animation/videoProcessor';
import { SubtitleService } from './subtitleService';
import { SoundEffectsService } from './soundEffectsService';
import logger from '../utils/logger';
import config from '../config/config';
import {formatVideoFilename} from "../utils/fileManager";

export class VideoService {
    private videoProcessor: VideoProcessor;
    private subtitleService: SubtitleService;
    private soundEffectsService: SoundEffectsService;

    constructor() {
        this.videoProcessor = new VideoProcessor();
        this.subtitleService = new SubtitleService();
        this.soundEffectsService = new SoundEffectsService();
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
            logger.info(`Creating enhanced video for content: ${content.id}`);

            // Determine if this should be a short-format video
            const isShortFormat = audioResult.duration <= (config.tiktok?.shortFormat || 15);

            // Determine content type for labeling
            const contentType = this.determineContentType(content.rawText);

            // Generate animation frames with improved lip sync
            const frameSequence = await this.videoProcessor.generateFrameSequence(
                audioResult.duration,
                audioResult.path,
                content.rawText,
                isShortFormat
            );

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
                subtitlePath
            );

            // Add sound effects
            const finalVideoPath = await this.soundEffectsService.addSoundEffectsToVideo(
                subtitledVideoPath,
                isShortFormat
            );

            // Create result object with updated path
            const finalResult: VideoResult = {
                ...baseVideoResult,
                path: finalVideoPath,
                url: `/videos/${path.basename(finalVideoPath)}`
            };

            logger.info(`Enhanced video creation complete: ${finalVideoPath}, format: ${isShortFormat ? 'short' : 'standard'}`);
            return finalResult;
        } catch (error) {
            logger.error(`Failed to create enhanced video for content: ${error}`);
            throw new Error(`Failed to create enhanced video for content: ${error}`);
        }
    }

    private determineContentType(text: string): string {
        const lowerText = text.toLowerCase();
        const weirdWords = ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar'];
        const funnyWords = ['funny', 'hilarious', 'laugh', 'comedy', 'ridiculous', 'absurd'];

        let weirdCount = 0;
        let funnyCount = 0;

        weirdWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) weirdCount += matches.length;
        });

        funnyWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) funnyCount += matches.length;
        });

        return weirdCount >= funnyCount ? "WEIRD" : "FUNNY";
    }
}