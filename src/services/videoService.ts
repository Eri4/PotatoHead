import path from 'path';
import { GeneratedContent, AudioResult, VideoResult } from '../types';
import { VideoProcessor } from '../animation/videoProcessor';
import logger from '../utils/logger';

export class VideoService {
    private videoProcessor: VideoProcessor;

    constructor() {
        this.videoProcessor = new VideoProcessor();
    }

    async createVideoForContent(
        content: GeneratedContent,
        audioResult: AudioResult
    ): Promise<VideoResult> {
        try {
            logger.info(`Creating video for content: ${content.id}`);

            // 1. Generate animation frames based on audio
            const frameSequence = await this.videoProcessor.generateFrameSequence(
                audioResult.duration,
                audioResult.path
            );

            // 2. Combine frames and audio into video
            const videoResult = await this.videoProcessor.createVideo(
                frameSequence.directory,
                audioResult.path,
                audioResult.duration
            );

            logger.info(`Video created successfully: ${videoResult.path}`);
            return videoResult;
        } catch (error) {
            logger.error(`Failed to create video for content: ${error}`);
            throw new Error(`Failed to create video for content: ${error}`);
        }
    }
}