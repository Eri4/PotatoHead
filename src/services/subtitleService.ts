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
    // Constants for subtitle appearance and timing
    private readonly SUBTITLE_STYLES = {
        // TikTok-optimized style with less intrusive display
        default: {
            fontName: 'Arial',
            fontSize: 8,            // Slightly smaller to take up less space
            primaryColor: '&H00FFFFFF', // White text
            bold: 1,
            alignment: 2,           // Bottom-center alignment
            marginV: 16,            // Smaller bottom margin - places subtitles higher
            marginL: 20,            // Left margin
            spacing: 0.2,           // Letter spacing
            lineSpacing: 0.5        // Tighter line spacing
        },
        // Short video style - optimized for minimal intrusion
        short: {
            fontName: 'Arial',
            fontSize: 8,           // Still readable but smaller
            primaryColor: '&H00FFFFFF',
            bold: 1,
            alignment: 2,
            marginV: 14,            // Even smaller margin
            marginL: 20,
            spacing: 0.2
        },
        // Emphasized style for important/shocking parts
        emphasis: {
            fontName: 'Arial',
            fontSize: 10,
            primaryColor: '&H00F0F0FF', // Slightly blue-tinted white for emphasis
            bold: 1,
            alignment: 2,
            marginV: 16,
            marginL: 20,
            spacing: 0.5
        },
        // Compact style for overlapping with other UI elements
        compact: {
            fontName: 'Arial',
            fontSize: 8,           // Smaller text
            primaryColor: '&H00FFFFFF',
            bold: 1,
            alignment: 8,           // Top-center alignment to avoid bottom UI
            marginV: 5,             // Minimal margin
            marginL: 20,
            spacing: 0.2
        }
    };

    // Timing parameters
    private readonly MIN_SUBTITLE_DURATION = 1.2;
    private readonly MAX_SUBTITLE_DURATION = 3.0;
    private readonly INTER_SUBTITLE_PAUSE = 0.05;
    private readonly BASE_READING_SPEED = 0.06;
    private readonly EMPHASIZED_WORD_PATTERN = /\b[A-Z]{2,}\b/g;

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

            // Generate SRT content with improved timing
            const srtContent = this.generateSRT(content.rawText, audioResult.duration, isShortFormat);

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
     * Add subtitles to a video file using fluent-ffmpeg with optimized styling
     */
    async addSubtitlesToVideo(
        videoPath: string,
        subtitlePath: string,
        isShortFormat: boolean = false,
        useCompactStyle: boolean = false // Option to use compact style
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

                // Select appropriate style based on video format and user preference
                let styleKey: keyof typeof this.SUBTITLE_STYLES = 'default';

                if (useCompactStyle) {
                    styleKey = 'compact';
                } else if (isShortFormat) {
                    styleKey = 'short';
                }

                const style = this.SUBTITLE_STYLES[styleKey];
                const styleString = this.buildStyleString(style);

                ffmpeg(videoPath)
                    .videoFilters(`subtitles=${normalizedSubtitlePath}:force_style='${styleString}'`)
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
     * Create a version of the video with different subtitle styles for comparison
     */
    async createSubtitleTestVersions(
        videoPath: string,
        subtitlePath: string
    ): Promise<string[]> {
        const outputs: string[] = [];
        const styles = Object.keys(this.SUBTITLE_STYLES) as Array<keyof typeof this.SUBTITLE_STYLES>;

        // Create a version with each style
        for (const styleKey of styles) {
            try {
                const videoDir = path.dirname(videoPath);
                const videoFilename = path.basename(videoPath);
                const outputFilename = `subtitled_${styleKey}_${videoFilename}`;
                const outputPath = path.join(videoDir, outputFilename);

                const normalizedSubtitlePath = subtitlePath.replace(/\\/g, '/');
                const style = this.SUBTITLE_STYLES[styleKey];
                const styleString = this.buildStyleString(style);

                await new Promise<void>((resolve, reject) => {
                    ffmpeg(videoPath)
                        .videoFilters(`subtitles=${normalizedSubtitlePath}:force_style='${styleString}'`)
                        .output(outputPath)
                        .on('end', () => {
                            outputs.push(outputPath);
                            resolve();
                        })
                        .on('error', reject)
                        .run();
                });
            } catch (error) {
                logger.error(`Failed to create ${styleKey} style version: ${error}`);
            }
        }

        return outputs;
    }

    /**
     * Generate SRT subtitle content
     */
    private generateSRT(text: string, totalDurationSeconds: number, isShortFormat: boolean = false): string {
        // Adjust reading speed based on video format
        const readingSpeed = isShortFormat
            ? this.BASE_READING_SPEED * 0.9  // Slightly faster for short videos
            : this.BASE_READING_SPEED;

        // Create shorter chunks for less screen space usage
        const targetWordsPerChunk = isShortFormat ? 4 : 6; // Reduced from 5/7 to 4/6
        const chunks = this.createOptimalSubtitleChunks(text, isShortFormat, targetWordsPerChunk);

        let srtContent = '';
        let startTime = 0;

        // Distribute timing
        const timeDistribution = this.calculateTimeDistribution(
            chunks,
            totalDurationSeconds,
            readingSpeed
        );

        chunks.forEach((chunk, index) => {
            const duration = timeDistribution[index];
            const endTime = startTime + duration;

            srtContent += `${index + 1}\n`;
            srtContent += `${this.formatSrtTime(startTime)} --> ${this.formatSrtTime(endTime)}\n`;

            // Keep the formatted chunk short to take up less screen space
            let formattedChunk = chunk.trim();

            // Add styling for emphasized words if needed
            if (this.EMPHASIZED_WORD_PATTERN.test(formattedChunk)) {
                // In standard SRT, we can't do fancy formatting, but we can in ASS/SSA
                // For now, we'll just keep the text as is
            }

            srtContent += `${formattedChunk}\n\n`;
            startTime = endTime + this.INTER_SUBTITLE_PAUSE;
        });

        return srtContent;
    }

    /**
     * Create optimal subtitle chunks based on natural language structure
     * With adjusted parameters for shorter chunks
     */
    private createOptimalSubtitleChunks(
        text: string,
        isShortFormat: boolean,
        targetWordsPerChunk: number = 6
    ): string[] {
        // Define preferred chunk size - now with customizable target
        const maxWordsPerChunk = targetWordsPerChunk + 2; // Just a bit larger than target

        // Split into sentences first
        const sentences = this.splitIntoSentences(text);
        const chunks: string[] = [];

        sentences.forEach(sentence => {
            // Skip empty sentences
            if (sentence.trim().length === 0) return;

            const words = sentence.split(' ');

            // Short sentence - keep it as is
            if (words.length <= maxWordsPerChunk) {
                chunks.push(sentence);
                return;
            }

            // Longer sentence - split intelligently
            let currentChunk: string[] = [];
            let currentWordCount = 0;

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                currentChunk.push(word);
                currentWordCount++;

                // Check if we should end the current chunk
                const isEndOfSentence = i === words.length - 1;
                const reachedTargetSize = currentWordCount >= targetWordsPerChunk;
                const atNaturalBreak = this.isNaturalBreakpoint(word, words[i + 1]);

                if (isEndOfSentence || (reachedTargetSize && (atNaturalBreak || currentWordCount >= maxWordsPerChunk))) {
                    chunks.push(currentChunk.join(' '));
                    currentChunk = [];
                    currentWordCount = 0;
                }
            }

            // Add any remaining words
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join(' '));
            }
        });

        return chunks;
    }

    /**
     * Check if a word is a natural breakpoint for subtitle chunking
     */
    private isNaturalBreakpoint(currentWord: string, nextWord?: string): boolean {
        if (!nextWord) return true;

        // End with punctuation
        if (/[,.;:!?]$/.test(currentWord)) return true;

        // Break after conjunctions
        const conjunctions = ['and', 'but', 'or', 'nor', 'so', 'yet'];
        if (conjunctions.includes(currentWord.toLowerCase())) return true;

        // Break before relative pronouns
        const relativePronouns = ['who', 'whom', 'whose', 'which', 'that'];
        if (relativePronouns.includes(nextWord.toLowerCase())) return true;

        return false;
    }

    /**
     * Calculate optimal time distribution for subtitle chunks
     */
    private calculateTimeDistribution(
        chunks: string[],
        totalDuration: number,
        readingSpeed: number
    ): number[] {
        const distribution: number[] = [];

        // Calculate raw durations based on chunk length
        let totalRawDuration = 0;
        const rawDurations: number[] = chunks.map(chunk => {
            // Base duration on character count with special handling for emphasis
            const duration = chunk.length * readingSpeed;

            // Check for emphasized words (ALL CAPS)
            const emphasisCount = (chunk.match(this.EMPHASIZED_WORD_PATTERN) || []).length;
            const emphasisBonus = emphasisCount * 0.2; // Add 200ms per emphasized word

            // Check for dramatic pauses
            const pauseCount = (chunk.match(/\.\.\./g) || []).length;
            const pauseBonus = pauseCount * 0.3; // Add 300ms per pause

            // Apply minimum and maximum constraints
            const adjustedDuration = Math.max(
                this.MIN_SUBTITLE_DURATION,
                Math.min(this.MAX_SUBTITLE_DURATION, duration + emphasisBonus + pauseBonus)
            );

            totalRawDuration += adjustedDuration;
            return adjustedDuration;
        });

        // Scale to fit the total duration
        const scaleFactor = totalDuration / (totalRawDuration + (chunks.length - 1) * this.INTER_SUBTITLE_PAUSE);

        chunks.forEach((_, i) => {
            distribution.push(rawDurations[i] * scaleFactor);
        });

        return distribution;
    }

    /**
     * Split text into sentences with improved handling of special cases
     */
    private splitIntoSentences(text: string): string[] {
        // Handle ellipses and other special punctuation
        const processed = text
            .replace(/\.{3,}/g, "<ELLIPSIS>") // Preserve ellipses
            .replace(/\s*([.!?])\s*/g, "$1\n"); // Add newlines after sentence-ending punctuation

        // Split on newlines
        const rawSentences = processed.split("\n");

        // Post-process to restore special punctuation and handle edge cases
        return rawSentences
            .map(s => s.replace(/<ELLIPSIS>/g, "...").trim())
            .filter(s => s.length > 0);
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

    /**
     * Build FFmpeg style string from style object
     */
    private buildStyleString(style: any): string {
        return Object.entries(style)
            .map(([key, value]) => {
                // Convert camelCase to FFmpeg style names
                const styleName = key
                    .replace(/([A-Z])/g, (match) => match.toLowerCase())
                    .replace(/^(.)/, (match) => match.toUpperCase());

                return `${styleName}=${value}`;
            })
            .join(',');
    }
}