import * as fs from 'fs-extra';
import * as path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import {GeneratedContent, AudioResult} from '../types';
import config from '../config/config';
import logger from '../utils/logger';

// Set FFmpeg path from ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegPath as string);

export class SubtitleService {
    /**
     * Create an SRT subtitle file from generated content
     */
    async createSubtitles(
        content: GeneratedContent,
        audioResult: AudioResult,
        outputDir: string,
        isShortFormat: boolean = false
    ): Promise<string> {
        try {
            logger.info(`Creating subtitles for content: ${content.id}`);

            // Create SRT filename
            const srtFilename = `subtitles_${content.id}.srt`;
            const srtPath = path.join(outputDir, srtFilename);

            // Generate SRT content
            const srtContent = this.generateSRT(content.rawText, audioResult.duration);

            // Write SRT file
            fs.writeFileSync(srtPath, srtContent);

            logger.info(`Subtitle file created at: ${srtPath}`);
            return srtPath;
        } catch (error) {
            logger.error(`Failed to create subtitles: ${error}`);
            throw new Error(`Failed to create subtitles: ${error}`);
        }
    }

    /**
     * Add subtitles to a video file using fluent-ffmpeg
     */
    async addSubtitlesToVideo(
        videoPath: string,
        subtitlePath: string
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Adding subtitles to video: ${videoPath}`);

                // Create output filename for subtitled video
                const videoDir = path.dirname(videoPath);
                const videoFilename = path.basename(videoPath);
                const outputFilename = `subtitled_${videoFilename}`;
                const outputPath = path.join(videoDir, outputFilename);

                // Fix path format for ffmpeg filtering (replace backslashes with forward slashes)
                const normalizedSubtitlePath = subtitlePath.replace(/\\/g, '/');

                // Use fluent-ffmpeg to add subtitles
                ffmpeg(videoPath)
                    .videoFilters(`subtitles=${normalizedSubtitlePath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1'`)
                    .output(outputPath)
                    .on('start', (commandLine) => {
                        logger.debug(`FFmpeg command: ${commandLine}`);
                    })
                    .on('progress', (progress) => {
                        logger.debug(`Processing: ${progress.percent}% done`);
                    })
                    .on('end', () => {
                        logger.info(`Subtitled video created at: ${outputPath}`);
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        logger.error(`FFmpeg error: ${err.message}`);
                        reject(new Error(`Failed to add subtitles: ${err.message}`));
                    })
                    .run();
            } catch (error) {
                logger.error(`Failed to add subtitles to video: ${error}`);
                reject(new Error(`Failed to add subtitles to video: ${error}`));
            }
        });
    }

    /**
     * Generate SRT subtitle content from text with better timing
     */
    private generateSRT(text: string, totalDurationSeconds: number, isShortFormat: boolean = false): string {
        // For shorter videos, use smaller chunks with better timing
        const maxWordsPerChunk = isShortFormat ? 5 : 8;

        // Split text into sentences first
        const sentences = this.splitIntoSentences(text);

        // Then split into smaller chunks for better readability
        const chunks: string[] = [];
        sentences.forEach(sentence => {
            const words = sentence.split(' ');

            for (let i = 0; i < words.length; i += maxWordsPerChunk) {
                const chunk = words.slice(i, i + maxWordsPerChunk).join(' ');
                chunks.push(chunk);
            }
        });

        // Calculate timing
        const totalCharCount = text.length;
        const durationPerChar = totalDurationSeconds / totalCharCount;

        let srtContent = '';
        let startTime = 0;
        let currentPosition = 0;

        chunks.forEach((chunk, index) => {
            // Calculate duration based on character count with a minimum
            const duration = Math.max(1.0, chunk.length * durationPerChar);
            const endTime = startTime + duration;

            srtContent += `${index + 1}\n`;
            srtContent += `${this.formatSrtTime(startTime)} --> ${this.formatSrtTime(endTime)}\n`;
            srtContent += `${chunk.trim()}\n\n`;

            // Add a very small pause between chunks
            startTime = endTime + 0.1; // 100ms pause
            currentPosition += chunk.length;
        });

        return srtContent;
    }

    /**
     * Split text into sentences
     */
    private splitIntoSentences(text: string): string[] {
        // Split on period, question mark, or exclamation mark followed by a space or end of string
        const sentences = text.split(/(?<=[.!?])\s+|(?<=[.!?])$/);

        // Filter out empty sentences and trim each sentence
        return sentences
            .filter(sentence => sentence.trim().length > 0)
            .map(sentence => sentence.trim());
    }

    /**
     * Format time in SRT format (00:00:00,000)
     */
    private formatSrtTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }
}