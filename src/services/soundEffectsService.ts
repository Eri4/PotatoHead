import * as fs from 'fs-extra';
import * as path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import config from '../config/config';
import logger from '../utils/logger';
import { GeneratedContent } from '../types';

// Set FFmpeg path from ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegPath as string);

export class SoundEffectsService {
    private soundsPath: string;

    constructor() {
        // Path to sound effects directory
        this.soundsPath = typeof config.assetPaths.audio === 'string'
            ? config.assetPaths.audio
            : path.join(config.assetPaths.audio?.soundEffects || './assets/audio');

        // Ensure the directories exist
        fs.ensureDirSync(this.soundsPath);
        fs.ensureDirSync(path.join(this.soundsPath, 'categories'));

    }

    /**
     * Add sound effects to a video using fluent-ffmpeg
     */
    async addSoundEffectsToVideo(
        videoPath: string,
        isShortFormat: boolean = false,
        content?: GeneratedContent
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Adding sound effects to video: ${videoPath}`);

                // Determine what category of sound effects to use based on content
                const category = content?.sentiment || 'neutral';

                // Get sound effects based on content category and format
                const soundEffects = this.getSoundEffectsForContent(category, isShortFormat);

                // If no sound effects, return original video
                if (Object.keys(soundEffects).length === 0) {
                    logger.warn('No sound effect files found, skipping sound effects');
                    resolve(videoPath);
                    return;
                }

                // Create output filename
                const videoDir = path.dirname(videoPath);
                const videoFilename = path.basename(videoPath);
                const outputFilename = `withsfx_${videoFilename}`;
                const outputPath = path.join(videoDir, outputFilename);

                // Start with base video
                let command = ffmpeg(videoPath);

                // Add inputs for sound effects
                Object.values(soundEffects).forEach(soundPath => {
                    if (soundPath) command = command.input(soundPath);
                });

                // Create audio mix with appropriate settings
                let filterComplex = '';
                let currentOutput = '0:a'; // Start with original audio
                let inputIndex = 1;

                // Get video duration for timing calculations
                ffmpeg.ffprobe(videoPath, (err, metadata) => {
                    if (err) {
                        logger.error(`Error getting video duration: ${err}`);
                        resolve(videoPath); // Return original video if error
                        return;
                    }

                    const duration = metadata.format.duration || 10; // Default to 10 seconds if not found

                    // Calculate timing for effects based on video duration
                    const timings = this.calculateEffectTimings(duration, isShortFormat);

                    // Process intro sound if available
                    if (soundEffects.intro) {
                        filterComplex += `[${currentOutput}][${inputIndex}:a]amix=inputs=2:duration=first:weights=3 1[aout${inputIndex}];`;
                        currentOutput = `aout${inputIndex}`;
                        inputIndex++;
                    }

                    // Process transition sound if available
                    if (soundEffects.transition) {
                        const delayMs = Math.round(timings.transitionTime * 1000);
                        filterComplex += `[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=0.7[adelayed${inputIndex}];`;
                        filterComplex += `[${currentOutput}][adelayed${inputIndex}]amix=inputs=2:duration=first[aout${inputIndex}];`;
                        currentOutput = `aout${inputIndex}`;
                        inputIndex++;
                    }

                    // Process category-specific sound if available
                    if (soundEffects.category) {
                        const delayMs = Math.round(timings.categoryTime * 1000);
                        filterComplex += `[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=0.6[adelayed${inputIndex}];`;
                        filterComplex += `[${currentOutput}][adelayed${inputIndex}]amix=inputs=2:duration=first[aout${inputIndex}];`;
                        currentOutput = `aout${inputIndex}`;
                        inputIndex++;
                    }

                    // Process outro sound if available
                    if (soundEffects.outro) {
                        const delayMs = Math.round(timings.outroTime * 1000);
                        filterComplex += `[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=0.7[adelayed${inputIndex}];`;
                        filterComplex += `[${currentOutput}][adelayed${inputIndex}]amix=inputs=2:duration=first[aout${inputIndex}];`;
                        currentOutput = `aout${inputIndex}`;
                        inputIndex++;
                    }

                    // If we have complex filters, apply them
                    if (filterComplex) {
                        command = command.complexFilter(filterComplex);

                        // Map streams
                        command = command.outputOptions([
                            '-map 0:v',
                            `-map [${currentOutput}]`
                        ]);
                    }

                    // Set output file and run
                    command
                        .output(outputPath)
                        .on('start', (commandLine) => {
                            logger.debug(`FFmpeg command: ${commandLine}`);
                        })
                        .on('progress', (progress) => {
                            logger.debug(`Processing: ${progress.percent}% done`);
                        })
                        .on('end', () => {
                            logger.info(`Video with sound effects created at: ${outputPath}`);
                            resolve(outputPath);
                        })
                        .on('error', (err) => {
                            logger.error(`FFmpeg error: ${err.message}`);
                            // Return original video if there's an error
                            logger.warn('Falling back to original video without sound effects');
                            resolve(videoPath);
                        })
                        .run();
                });
            } catch (error) {
                logger.error(`Failed to add sound effects to video: ${error}`);
                // Return original video if there's an error
                resolve(videoPath);
            }
        });
    }

    /**
     * Calculate timings for sound effects based on video duration
     */
    private calculateEffectTimings(duration: number, isShortFormat: boolean): {
        transitionTime: number;
        categoryTime: number;
        outroTime: number;
    } {
        if (isShortFormat) {
            // For short videos, compress timing
            return {
                transitionTime: Math.min(duration * 0.3, 2),  // 30% in or 2 seconds, whichever is shorter
                categoryTime: Math.min(duration * 0.5, 3),   // 50% in or 3 seconds
                outroTime: Math.max(duration - 1, 0)         // 1 second before end
            };
        } else {
            // For longer videos, more spaced out
            return {
                transitionTime: Math.min(duration * 0.25, 8),  // 25% in or 8 seconds
                categoryTime: Math.min(duration * 0.4, 12),   // 40% in or 12 seconds
                outroTime: Math.max(duration - 3, 0)          // 3 seconds before end
            };
        }
    }

    /**
     * Get appropriate sound effects for content type
     */
    private getSoundEffectsForContent(category: string, isShortFormat: boolean): Record<string, string | null> {
        const effects: Record<string, string | null> = {
            intro: null,
            transition: null,
            category: null,
            outro: null
        };

        // Get the intro sound effect
        effects.intro = this.getSoundPath('intro');

        // If short format and we have intro, that might be enough
        if (isShortFormat) {
            // For short videos, keep it minimal
            effects.category = this.getCategorySoundPath(category);
            return effects;
        }

        // For longer videos, get more sound effects
        effects.transition = this.getSoundPath('transition');
        effects.category = this.getCategorySoundPath(category);
        effects.outro = this.getSoundPath('outro');

        return effects;
    }

    /**
     * Get path to a sound effect file
     */
    private getSoundPath(type: string): string | null {
        // Look for sound files with specific naming pattern
        const soundFile = `${type}.mp3`;
        const soundPath = path.join(this.soundsPath, soundFile);

        if (fs.existsSync(soundPath)) {
            return soundPath;
        }

        // Alternative extensions
        const altExtensions = ['.wav', '.aac', '.m4a'];
        for (const ext of altExtensions) {
            const altPath = path.join(this.soundsPath, `${type}${ext}`);
            if (fs.existsSync(altPath)) {
                return altPath;
            }
        }

        return null;
    }

    /**
     * Get category-specific sound effect
     */
    private getCategorySoundPath(category: string): string | null {
        // Map content types to sound effect categories
        const categoryMap: Record<string, string> = {
            'mystery': 'mystery',
            'weird': 'weird',
            'unexplained': 'mystery',
            'funny': 'comedy',
            'neutral': 'general'
        };

        const effectCategory = categoryMap[category] || 'general';
        const categoryPath = path.join(this.soundsPath, 'categories', effectCategory);

        // If category folder exists, get a random sound from it
        if (fs.existsSync(categoryPath)) {
            const files = fs.readdirSync(categoryPath).filter(file =>
                file.endsWith('.mp3') || file.endsWith('.wav') ||
                file.endsWith('.aac') || file.endsWith('.m4a')
            );

            if (files.length > 0) {
                const randomFile = files[Math.floor(Math.random() * files.length)];
                return path.join(categoryPath, randomFile);
            }
        }

        // Try to find a specifically named category file
        return this.getSoundPath(effectCategory);
    }

    /**
     * Check if we have sound effects available
     */
    hasSoundEffects(): boolean {
        return (
            this.getSoundPath('intro') !== null ||
            this.getSoundPath('transition') !== null ||
            this.getSoundPath('outro') !== null
        );
    }
}