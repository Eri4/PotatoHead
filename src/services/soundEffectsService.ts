import * as fs from 'fs-extra';
import * as path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import config from '../config/config';
import logger from '../utils/logger';

// Set FFmpeg path from ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegPath as string);

export class SoundEffectsService {
    private soundsPath: string;

    constructor() {
        // Path to sound effects directory
        this.soundsPath = path.join(config.assetPaths.audio || './assets/audio');

        // Ensure the directory exists
        fs.ensureDirSync(this.soundsPath);
    }

    /**
     * Add sound effects to a video using fluent-ffmpeg
     */
    async addSoundEffectsToVideo(
        videoPath: string,
        isShortFormat: boolean = false
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Adding sound effects to video: ${videoPath}`);

                // Check if we have sound effects available
                const introSoundPath = this.getSoundPath('intro');
                const transitionSoundPath = this.getSoundPath('transition');
                const outroSoundPath = this.getSoundPath('outro');

                // If no sound effects, return original video
                if (!introSoundPath && !transitionSoundPath && !outroSoundPath) {
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
                if (introSoundPath) command = command.input(introSoundPath);
                if (transitionSoundPath) command = command.input(transitionSoundPath);
                if (outroSoundPath) command = command.input(outroSoundPath);

                // Create complex filter for mixing audio
                const filters = [];

                // Base index for additional audio streams
                let audioIndex = 1; // 0 is the video's original audio

                // Create audio mix with appropriate settings
                let filterComplex = '';

                if (introSoundPath) {
                    // Mix intro at start with volume adjustment
                    filterComplex += `[0:a][${audioIndex}:a]amix=inputs=2:duration=first:weights=3 1[aout0];`;
                    audioIndex++;
                }

                if (transitionSoundPath) {
                    // Add transition sound at 30% mark
                    const baseAudio = introSoundPath ? '[aout0]' : '[0:a]';
                    filterComplex += `${baseAudio}[${audioIndex}:a]adelay=30000|30000,volume=0.7[adelayed];`;
                    filterComplex += `${baseAudio}[adelayed]amix=inputs=2:duration=first[aout1];`;
                    audioIndex++;
                }

                if (outroSoundPath) {
                    // Add outro sound near the end
                    const baseAudio = transitionSoundPath ? '[aout1]' : (introSoundPath ? '[aout0]' : '[0:a]');
                    filterComplex += `${baseAudio}[${audioIndex}:a]adelay=60000|60000,volume=0.7[bdelayed];`;
                    filterComplex += `${baseAudio}[bdelayed]amix=inputs=2:duration=first[aout2];`;
                }

                // Final output stream name
                const finalAudioOutput = outroSoundPath ? 'aout2' : (transitionSoundPath ? 'aout1' : (introSoundPath ? 'aout0' : '0:a'));

                // If we have complex filters, apply them
                if (filterComplex) {
                    command = command.complexFilter(filterComplex);

                    // Map streams
                    command = command.outputOptions([
                        '-map 0:v',
                        `-map [${finalAudioOutput}]`
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
            } catch (error) {
                logger.error(`Failed to add sound effects to video: ${error}`);
                // Return original video if there's an error
                resolve(videoPath);
            }
        });
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