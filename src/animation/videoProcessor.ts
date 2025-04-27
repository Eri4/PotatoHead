import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { FrameSequence, VideoResult } from '../types';
import config from '../config/config';
import logger from '../utils/logger';
import { generateId } from '../utils/fileManager';

export class VideoProcessor {
    private width: number;
    private height: number;
    private frameRate: number;
    private quality: number;

    constructor() {
        this.width = config.video.width;
        this.height = config.video.height;
        this.frameRate = config.video.frameRate;
        this.quality = config.video.quality;
    }

    /**
     * Combine audio with animation frames to create a video
     */
    async createVideo(
        framesDir: string,
        audioPath: string,
        duration: number
    ): Promise<VideoResult> {
        return new Promise((resolve, reject) => {
            try {
                logger.info('Creating video from frames and audio...');

                // Create output filename and path
                const videoId = generateId();
                const outputFilename = `video_${videoId}.mp4`;
                const outputPath = path.join(config.paths.videos, outputFilename);

                // Ensure the videos directory exists
                fs.ensureDirSync(config.paths.videos);

                // Build FFmpeg command arguments
                const ffmpegArgs = [
                    '-y',                         // Overwrite output file if it exists
                    '-framerate', `${this.frameRate}`,  // Input frame rate
                    '-i', path.join(framesDir, 'frame_%05d.png'), // Input frame pattern
                    '-i', audioPath,              // Audio input
                    '-c:v', 'libx264',            // Video codec
                    '-profile:v', 'main',         // H.264 profile
                    '-preset', 'medium',          // Encoding speed/compression trade-off
                    '-crf', `${this.quality}`,    // Constant Rate Factor (quality, lower = better)
                    '-pix_fmt', 'yuv420p',        // Pixel format
                    '-c:a', 'aac',                // Audio codec
                    '-b:a', '128k',               // Audio bitrate
                    '-r', `${this.frameRate}`,    // Ensure output framerate matches input
                    outputPath                    // Output file
                ];

                logger.debug(`FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

                // Spawn FFmpeg process
                const ffmpeg = spawn(ffmpegPath as string, ffmpegArgs);

                let ffmpegLogs = '';

                ffmpeg.stdout.on('data', (data) => {
                    ffmpegLogs += data.toString();
                });

                ffmpeg.stderr.on('data', (data) => {
                    ffmpegLogs += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        logger.info(`Video created successfully: ${outputPath}`);

                        const result: VideoResult = {
                            path: outputPath,
                            duration: duration,
                            width: this.width,
                            height: this.height,
                            url: `/videos/${outputFilename}`
                        };

                        resolve(result);
                    } else {
                        logger.error(`FFmpeg process exited with code ${code}`);
                        logger.error(`FFmpeg logs: ${ffmpegLogs}`);
                        reject(new Error(`Failed to create video, FFmpeg exited with code ${code}`));
                    }
                });

                ffmpeg.on('error', (err) => {
                    logger.error(`FFmpeg process error: ${err}`);
                    reject(new Error(`FFmpeg process error: ${err}`));
                });
            } catch (error) {
                logger.error(`Failed to create video: ${error}`);
                reject(new Error(`Failed to create video: ${error}`));
            }
        });
    }

    /**
     * Analyze audio file to get amplitude data for better lip sync
     */
    async analyzeAudio(audioPath: string): Promise<{amplitudes: number[], duration: number}> {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Analyzing audio file for lip sync: ${audioPath}`);

                // Get audio duration first
                const durationArgs = [
                    '-i', audioPath,
                    '-show_entries', 'format=duration',
                    '-v', 'quiet',
                    '-of', 'csv=p=0',
                ];

                const durationProcess = spawn(ffmpegPath as string, durationArgs);
                let durationOutput = '';

                durationProcess.stdout.on('data', (data) => {
                    durationOutput += data.toString();
                });

                durationProcess.on('close', async (code) => {
                    if (code !== 0) {
                        logger.warn(`Failed to get audio duration, using estimate`);
                        // Fallback to file size based estimate (1MB ~ 60 seconds of audio at 128kbps)
                        const stats = fs.statSync(audioPath);
                        const estimatedDuration = Math.ceil(stats.size / (128 * 1024 / 8));

                        const amplitudes = await this.generateSyntheticAmplitudes(estimatedDuration);
                        resolve({ amplitudes, duration: estimatedDuration });
                        return;
                    }

                    const duration = parseFloat(durationOutput.trim());

                    // Now extract audio levels using ffmpeg
                    const totalFrames = Math.ceil(duration * this.frameRate);
                    const sampleInterval = 1 / this.frameRate;

                    // Use FFmpeg to extract audio volume levels at regular intervals
                    const amplitudeArgs = [
                        '-i', audioPath,
                        '-af', `astats=metadata=1:reset=1,asetnsamples=n=${Math.ceil(sampleInterval * 48000)}`,
                        '-f', 'null',
                        '-'
                    ];

                    const amplitudeProcess = spawn(ffmpegPath as string, amplitudeArgs);
                    let amplitudeOutput = '';

                    amplitudeProcess.stderr.on('data', (data) => {
                        amplitudeOutput += data.toString();
                    });

                    amplitudeProcess.on('close', async (code) => {
                        if (code !== 0) {
                            logger.warn(`Audio analysis failed, using synthetic data`);
                            const amplitudes = await this.generateSyntheticAmplitudes(duration);
                            resolve({ amplitudes, duration });
                            return;
                        }

                        // Extract RMS volume levels from the output
                        const amplitudes: number[] = [];
                        const lines = amplitudeOutput.split('\n');

                        for (const line of lines) {
                            if (line.includes('RMS level dB')) {
                                const match = line.match(/RMS level dB:\s+([-\d.]+)/);
                                if (match && match[1]) {
                                    // Convert dB to 0-1 range (simplified)
                                    const dbValue = parseFloat(match[1]);
                                    // dB scale is logarithmic, -40dB is approx silent
                                    const normalizedValue = Math.max(0, Math.min(1, (dbValue + 40) / 40));
                                    amplitudes.push(normalizedValue);
                                }
                            }
                        }

                        if (amplitudes.length < totalFrames) {
                            // Extend the amplitudes array to match frame count
                            logger.info(`Extending amplitude data from ${amplitudes.length} to ${totalFrames} frames`);

                            // Interpolate the available data to get enough amplitude values
                            const extendedAmplitudes = this.interpolateAmplitudes(amplitudes, totalFrames);
                            resolve({ amplitudes: extendedAmplitudes, duration });
                        } else if (amplitudes.length > totalFrames) {
                            // Downsample if we have too many values
                            const downsampledAmplitudes = this.downsampleAmplitudes(amplitudes, totalFrames);
                            resolve({ amplitudes: downsampledAmplitudes, duration });
                        } else {
                            resolve({ amplitudes, duration });
                        }
                    });

                    amplitudeProcess.on('error', async (err) => {
                        logger.error(`Audio analysis error: ${err}`);
                        const amplitudes = await this.generateSyntheticAmplitudes(duration);
                        resolve({ amplitudes, duration });
                    });
                });

                durationProcess.on('error', async (err) => {
                    logger.error(`Audio duration analysis error: ${err}`);
                    const estimatedDuration = 30; // Default to 30 seconds
                    const amplitudes = await this.generateSyntheticAmplitudes(estimatedDuration);
                    resolve({ amplitudes, duration: estimatedDuration });
                });

            } catch (error) {
                logger.error(`Failed to analyze audio: ${error}`);
                const defaultDuration = 30;
                const amplitudes = Array(defaultDuration * this.frameRate).fill(0).map(() => Math.random() * 0.7 + 0.3);
                resolve({ amplitudes, duration: defaultDuration });
            }
        });
    }

    /**
     * Generate synthetic amplitude data when audio analysis fails
     */
    private async generateSyntheticAmplitudes(duration: number): Promise<number[]> {
        const totalFrames = Math.ceil(duration * this.frameRate);
        const amplitudes: number[] = [];

        // Create a more natural speech pattern with alternating amplitudes
        for (let i = 0; i < totalFrames; i++) {
            // Pattern: talking for 2 seconds, pause for 0.5 seconds
            const cyclePosition = (i % Math.floor(this.frameRate * 2.5)) / this.frameRate;

            if (cyclePosition < 2) {
                // Speech segment - fluctuating amplitudes
                const speechPhase = (i % 10) / 10; // 0-1 range for a single speech wave
                const baseLevel = 0.5 + 0.3 * Math.sin(speechPhase * Math.PI * 2);
                const jitter = (Math.random() * 0.2) - 0.1;
                amplitudes.push(Math.max(0, Math.min(1, baseLevel + jitter)));
            } else {
                // Pause segment - low amplitude
                amplitudes.push(Math.random() * 0.2);
            }
        }

        return amplitudes;
    }

    /**
     * Interpolate amplitude values to get the desired number of frames
     */
    private interpolateAmplitudes(amplitudes: number[], targetCount: number): number[] {
        const result: number[] = [];
        const factor = amplitudes.length / targetCount;

        for (let i = 0; i < targetCount; i++) {
            const pos = i * factor;
            const index = Math.floor(pos);
            const nextIndex = Math.min(index + 1, amplitudes.length - 1);
            const fraction = pos - index;

            // Linear interpolation between two adjacent values
            const value = amplitudes[index] * (1 - fraction) + amplitudes[nextIndex] * fraction;
            result.push(value);
        }

        return result;
    }

    /**
     * Downsample amplitude values to get the desired number of frames
     */
    private downsampleAmplitudes(amplitudes: number[], targetCount: number): number[] {
        const result: number[] = [];
        const factor = amplitudes.length / targetCount;

        for (let i = 0; i < targetCount; i++) {
            const index = Math.floor(i * factor);
            result.push(amplitudes[index]);
        }

        return result;
    }

    /**
     * Generate a sequence of frames for animation based on audio
     */
    async generateFrameSequence(
        audioDuration: number,
        audioPath: string
    ): Promise<FrameSequence> {
        try {
            logger.info(`Generating animation frame sequence for ${audioDuration} seconds of audio`);

            // Analyze audio for better lip sync
            const { amplitudes, duration } = await this.analyzeAudio(audioPath);

            // Create a CharacterRenderer instance
            const { CharacterRenderer } = require('./characterRenderer');
            const renderer = new CharacterRenderer();

            // Calculate number of frames needed
            const totalFrames = Math.ceil(duration * this.frameRate);
            const frames: string[] = [];

            logger.info(`Generating ${totalFrames} frames at ${this.frameRate} FPS`);

            // Track silent periods to determine when talking has ended
            let silentFrameCount = 0;
            const silentThreshold = 0.2; // amplitude below this is considered silent
            const maxSilentFrames = this.frameRate * 2; // 2 seconds of silence ends the video
            let endingVideo = false;

            // Generate each frame
            for (let i = 0; i < totalFrames; i++) {
                // Calculate current time position in the audio
                const timePosition = i / this.frameRate;

                // Get amplitude for this frame
                const amplitude = amplitudes[i] || 0;

                // Track silence to end the video when talking stops
                if (amplitude < silentThreshold) {
                    silentFrameCount++;
                    // If there's been enough silence and we're past 80% of the audio,
                    // start ending the video
                    if (silentFrameCount > maxSilentFrames && i > (totalFrames * 0.8)) {
                        endingVideo = true;
                    }
                } else {
                    silentFrameCount = 0;
                    endingVideo = false;
                }

                // If we're ending the video and have shown the ending for 3 seconds, stop
                if (endingVideo && silentFrameCount > this.frameRate * 3) {
                    break;
                }

                // Determine mouth state based on audio amplitude
                const mouthState = this.determineMouthState(amplitude);

                // Determine eye state (occasional blinks and expressions)
                const eyeState = this.determineEyeState(timePosition);

                // Determine head rotation (subtle movements)
                const headRotation = Math.sin(timePosition * 0.5) * 5; // -5 to 5 degrees

                // Create animation and studio state
                const animationState = {
                    eyeState,
                    mouthState,
                    headRotation,
                    accessoryIndices: [0, 1] // Microphone and glasses
                };

                // Set overlay text based on video section
                let overlayText: string | undefined;

                if (i < this.frameRate * 3) {
                    // First 3 seconds: "BREAKING NEWS"
                    overlayText = 'BREAKING NEWS';
                } else if (endingVideo || i > totalFrames - (this.frameRate * 3)) {
                    // Last 3 seconds or ending sequence: "LIKE AND SUBSCRIBE!"
                    overlayText = 'LIKE AND SUBSCRIBE!';
                } else if (i % (this.frameRate * 8) === 0) {
                    // Show "POTATO NEWS NETWORK" briefly every 8 seconds
                    overlayText = 'POTATO NEWS NETWORK';
                }

                const studioState = {
                    backgroundIndex: 0,
                    deskIndex: 0,
                    propIndices: [0, 1, 2], // Monitor, coffee mug, papers
                    overlayText
                };

                // Render the frame
                const framePath = await renderer.renderFrame(animationState, studioState, i);
                frames.push(framePath);

                // Log progress occasionally
                if (i % 30 === 0) {
                    logger.info(`Generated ${i}/${totalFrames} frames`);
                }
            }

            const outputDir = renderer.getOutputDirectory();

            logger.info(`Completed frame sequence generation: ${frames.length} frames created`);

            return {
                directory: outputDir,
                frames,
                frameCount: frames.length,
                frameRate: this.frameRate
            };
        } catch (error) {
            logger.error(`Failed to generate frame sequence: ${error}`);
            throw new Error(`Failed to generate frame sequence: ${error}`);
        }
    }

    /**
     * Determine mouth state based on audio amplitude
     */
    private determineMouthState(
        amplitude: number
    ): 'closed' | 'halfOpen' | 'open' {
        // Map amplitude to mouth state
        if (amplitude < 0.2) {
            return 'closed';
        } else if (amplitude < 0.5) {
            return 'halfOpen';
        } else {
            return 'open';
        }
    }

    /**
     * Determine eye state based on time position
     */
    private determineEyeState(
        timePosition: number
    ): 'neutral' | 'squint' | 'wide' | 'rolling' | 'wink' {
        // Create more realistic blinking pattern
        // People blink approximately every 4-6 seconds
        const blinkCycle = timePosition % 5; // 5-second cycle

        // Blink for ~0.1 seconds (3 frames at 30fps)
        if (blinkCycle > 4.9) {
            return 'squint';
        }

        // Occasional other expressions based on time position
        // Every 15 seconds, show an expression for ~0.3 seconds
        const expressionCycle = timePosition % 15;
        if (expressionCycle > 14.7) {
            // Choose expression based on time to ensure variety
            const expressionIndex = Math.floor(timePosition / 15) % 3;
            const expressions: ('wide' | 'rolling' | 'wink')[] = ['wide', 'rolling', 'wink'];
            return expressions[expressionIndex];
        }

        // Default eye state
        return 'neutral';
    }
}