"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.VideoProcessor = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const fileManager_1 = require("../utils/fileManager");
class VideoProcessor {
    constructor() {
        var _a;
        this.width = config_1.default.video.width;
        this.height = config_1.default.video.height;
        this.frameRate = config_1.default.video.frameRate;
        this.quality = config_1.default.video.quality;
        this.tikTokShortThreshold = ((_a = config_1.default.tiktok) === null || _a === void 0 ? void 0 : _a.shortFormat) || 15; // Default to 15 seconds
    }
    /**
     * Combine audio with animation frames to create a video
     */
    createVideo(framesDir, audioPath, duration, customFilename) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    logger_1.default.info('Creating video from frames and audio...');
                    // Create output filename and path
                    // Use custom filename if provided, otherwise generate a random ID
                    const outputFilename = customFilename || `video_${(0, fileManager_1.generateId)()}.mp4`;
                    const outputPath = path.join(config_1.default.paths.videos, outputFilename);
                    // Ensure the videos directory exists
                    fs.ensureDirSync(config_1.default.paths.videos);
                    // Build FFmpeg command arguments
                    const ffmpegArgs = [
                        '-y', // Overwrite output file if it exists
                        '-framerate', `${this.frameRate}`, // Input frame rate
                        '-i', path.join(framesDir, 'frame_%05d.png'), // Input frame pattern
                        '-i', audioPath, // Audio input
                        '-c:v', 'libx264', // Video codec
                        '-profile:v', 'main', // H.264 profile
                        '-preset', 'medium', // Encoding speed/compression trade-off
                        '-crf', `${this.quality}`, // Constant Rate Factor (quality, lower = better)
                        '-pix_fmt', 'yuv420p', // Pixel format
                        '-c:a', 'aac', // Audio codec
                        '-b:a', '128k', // Audio bitrate
                        '-r', `${this.frameRate}`, // Ensure output framerate matches input
                        outputPath // Output file
                    ];
                    logger_1.default.debug(`FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
                    // Spawn FFmpeg process
                    const ffmpeg = (0, child_process_1.spawn)(ffmpeg_static_1.default, ffmpegArgs);
                    let ffmpegLogs = '';
                    ffmpeg.stdout.on('data', (data) => {
                        ffmpegLogs += data.toString();
                    });
                    ffmpeg.stderr.on('data', (data) => {
                        ffmpegLogs += data.toString();
                    });
                    ffmpeg.on('close', (code) => {
                        if (code === 0) {
                            logger_1.default.info(`Video created successfully: ${outputPath}`);
                            const result = {
                                path: outputPath,
                                duration: duration,
                                width: this.width,
                                height: this.height,
                                url: `/videos/${outputFilename}`,
                                isShortFormat: true
                            };
                            resolve(result);
                        }
                        else {
                            logger_1.default.error(`FFmpeg process exited with code ${code}`);
                            logger_1.default.error(`FFmpeg logs: ${ffmpegLogs}`);
                            reject(new Error(`Failed to create video, FFmpeg exited with code ${code}`));
                        }
                    });
                    ffmpeg.on('error', (err) => {
                        logger_1.default.error(`FFmpeg process error: ${err}`);
                        reject(new Error(`FFmpeg process error: ${err}`));
                    });
                }
                catch (error) {
                    logger_1.default.error(`Failed to create video: ${error}`);
                    reject(new Error(`Failed to create video: ${error}`));
                }
            });
        });
    }
    /**
     * Analyze audio file to get amplitude data for better lip sync
     */
    analyzeAudio(audioPath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    logger_1.default.info(`Analyzing audio file for lip sync: ${audioPath}`);
                    // Get audio duration first
                    const durationArgs = [
                        '-i', audioPath,
                        '-show_entries', 'format=duration',
                        '-v', 'quiet',
                        '-of', 'csv=p=0',
                    ];
                    const durationProcess = (0, child_process_1.spawn)(ffmpeg_static_1.default, durationArgs);
                    let durationOutput = '';
                    durationProcess.stdout.on('data', (data) => {
                        durationOutput += data.toString();
                    });
                    durationProcess.on('close', (code) => __awaiter(this, void 0, void 0, function* () {
                        if (code !== 0) {
                            logger_1.default.warn(`Failed to get audio duration, using estimate`);
                            // Fallback to file size based estimate (1MB ~ 60 seconds of audio at 128kbps)
                            const stats = fs.statSync(audioPath);
                            const estimatedDuration = Math.ceil(stats.size / (128 * 1024 / 8));
                            const amplitudes = yield this.generateSyntheticAmplitudes(estimatedDuration);
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
                        const amplitudeProcess = (0, child_process_1.spawn)(ffmpeg_static_1.default, amplitudeArgs);
                        let amplitudeOutput = '';
                        amplitudeProcess.stderr.on('data', (data) => {
                            amplitudeOutput += data.toString();
                        });
                        amplitudeProcess.on('close', (code) => __awaiter(this, void 0, void 0, function* () {
                            if (code !== 0) {
                                logger_1.default.warn(`Audio analysis failed, using synthetic data`);
                                const amplitudes = yield this.generateSyntheticAmplitudes(duration);
                                resolve({ amplitudes, duration });
                                return;
                            }
                            // Extract RMS volume levels from the output
                            const amplitudes = [];
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
                                logger_1.default.info(`Extending amplitude data from ${amplitudes.length} to ${totalFrames} frames`);
                                // Interpolate the available data to get enough amplitude values
                                const extendedAmplitudes = this.interpolateAmplitudes(amplitudes, totalFrames);
                                resolve({ amplitudes: extendedAmplitudes, duration });
                            }
                            else if (amplitudes.length > totalFrames) {
                                // Downsample if we have too many values
                                const downsampledAmplitudes = this.downsampleAmplitudes(amplitudes, totalFrames);
                                resolve({ amplitudes: downsampledAmplitudes, duration });
                            }
                            else {
                                resolve({ amplitudes, duration });
                            }
                        }));
                        amplitudeProcess.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                            logger_1.default.error(`Audio analysis error: ${err}`);
                            const amplitudes = yield this.generateSyntheticAmplitudes(duration);
                            resolve({ amplitudes, duration });
                        }));
                    }));
                    durationProcess.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                        logger_1.default.error(`Audio duration analysis error: ${err}`);
                        const estimatedDuration = 30; // Default to 30 seconds
                        const amplitudes = yield this.generateSyntheticAmplitudes(estimatedDuration);
                        resolve({ amplitudes, duration: estimatedDuration });
                    }));
                }
                catch (error) {
                    logger_1.default.error(`Failed to analyze audio: ${error}`);
                    const defaultDuration = 30;
                    const amplitudes = Array(defaultDuration * this.frameRate).fill(0).map(() => Math.random() * 0.7 + 0.3);
                    resolve({ amplitudes, duration: defaultDuration });
                }
            });
        });
    }
    /**
     * Generate synthetic amplitude data when audio analysis fails
     */
    generateSyntheticAmplitudes(duration) {
        return __awaiter(this, void 0, void 0, function* () {
            const totalFrames = Math.ceil(duration * this.frameRate);
            const amplitudes = [];
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
                }
                else {
                    // Pause segment - low amplitude
                    amplitudes.push(Math.random() * 0.2);
                }
            }
            return amplitudes;
        });
    }
    /**
     * Interpolate amplitude values to get the desired number of frames
     */
    interpolateAmplitudes(amplitudes, targetCount) {
        const result = [];
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
    downsampleAmplitudes(amplitudes, targetCount) {
        const result = [];
        const factor = amplitudes.length / targetCount;
        for (let i = 0; i < targetCount; i++) {
            const index = Math.floor(i * factor);
            result.push(amplitudes[index]);
        }
        return result;
    }
    /**
     * Determine content type based on text analysis
     */
    determineContentType(text) {
        const lowerText = text.toLowerCase();
        // Words that indicate the content is weird
        const weirdWords = ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar',
            'unexpected', 'mysterious', 'unexplained', 'curious'];
        // Words that indicate the content is funny
        const funnyWords = ['funny', 'hilarious', 'laugh', 'comedy', 'ridiculous', 'absurd',
            'humorous', 'joke', 'punchline', 'amusing'];
        let weirdCount = 0;
        let funnyCount = 0;
        // Count how many "weird" indicators are in the text
        weirdWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches)
                weirdCount += matches.length;
        });
        // Count how many "funny" indicators are in the text
        funnyWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches)
                funnyCount += matches.length;
        });
        // Default to WEIRD if tied or more weird indicators
        return (funnyCount > weirdCount) ? 'FUNNY' : 'WEIRD';
    }
    /**
     * Generate a sequence of frames for animation based on audio
     */
    generateFrameSequence(audioDuration_1, audioPath_1, contentText_1) {
        return __awaiter(this, arguments, void 0, function* (audioDuration, audioPath, contentText, isShortFormat = false) {
            try {
                logger_1.default.info(`Generating animation frame sequence for ${audioDuration} seconds of audio`);
                // Determine if this is a short format video
                const isShortFormat = audioDuration <= this.tikTokShortThreshold;
                logger_1.default.info(`Video format: ${isShortFormat ? 'SHORT' : 'STANDARD'} (${audioDuration}s)`);
                // Determine content type if text is provided
                const contentType = contentText ? this.determineContentType(contentText) : 'WEIRD';
                logger_1.default.info(`Content type determined: ${contentType}`);
                // Analyze audio for better lip sync
                const { amplitudes, duration } = yield this.analyzeAudio(audioPath);
                // Create a CharacterRenderer instance
                const { CharacterRenderer } = require('./characterRenderer');
                const renderer = new CharacterRenderer();
                // Calculate number of frames needed
                const totalFrames = Math.ceil(duration * this.frameRate);
                const frames = [];
                logger_1.default.info(`Generating ${totalFrames} frames at ${this.frameRate} FPS`);
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
                    }
                    else {
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
                    // Set overlay text based on video section and format
                    let overlayText;
                    if (isShortFormat) {
                        // For short videos, just show content type throughout
                        overlayText = `${contentType} NEWS`;
                    }
                    else {
                        // For standard videos, use more varied texts
                        if (i < this.frameRate * 3) {
                            // First 3 seconds: "BREAKING NEWS"
                            overlayText = 'BREAKING NEWS';
                        }
                        else if (endingVideo || i > totalFrames - (this.frameRate * 3)) {
                            // Last 3 seconds or ending sequence: "LIKE AND SUBSCRIBE!"
                            overlayText = 'LIKE AND SUBSCRIBE!';
                        }
                        else if (i % (this.frameRate * 8) === 0) {
                            // Show "POTATO NEWS NETWORK" briefly every 8 seconds
                            overlayText = 'POTATO NEWS NETWORK';
                        }
                        else if (i % (this.frameRate * 4) === 0) {
                            // Show content type briefly every 4 seconds
                            overlayText = `${contentType} NEWS`;
                        }
                    }
                    const studioState = {
                        backgroundIndex: 0,
                        deskIndex: 0,
                        propIndices: [0, 1, 2], // Monitor, coffee mug, papers
                        overlayText
                    };
                    // Render the frame - pass isShortFormat parameter
                    const framePath = yield renderer.renderFrame(animationState, studioState, i, isShortFormat);
                    frames.push(framePath);
                    // Log progress occasionally
                    if (i % 30 === 0) {
                        logger_1.default.info(`Generated ${i}/${totalFrames} frames`);
                    }
                }
                const outputDir = renderer.getOutputDirectory();
                logger_1.default.info(`Completed frame sequence generation: ${frames.length} frames created`);
                return {
                    directory: outputDir,
                    frames,
                    frameCount: frames.length,
                    frameRate: this.frameRate,
                    isShortFormat: isShortFormat
                };
            }
            catch (error) {
                logger_1.default.error(`Failed to generate frame sequence: ${error}`);
                throw new Error(`Failed to generate frame sequence: ${error}`);
            }
        });
    }
    /**
     * Determine mouth state based on audio amplitude
     */
    determineMouthState(amplitude) {
        // Map amplitude to mouth state
        if (amplitude < 0.2) {
            return 'closed';
        }
        else if (amplitude < 0.5) {
            return 'halfOpen';
        }
        else {
            return 'open';
        }
    }
    /**
     * Determine eye state based on time position
     */
    determineEyeState(timePosition) {
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
            const expressions = ['wide', 'rolling', 'wink'];
            return expressions[expressionIndex];
        }
        // Default eye state
        return 'neutral';
    }
}
exports.VideoProcessor = VideoProcessor;
