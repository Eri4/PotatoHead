import {createCanvas, loadImage, Canvas, Image} from 'canvas';
import * as fs from 'fs-extra';
import * as path from 'path';
import {spawn} from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import config from '../config/config';
import logger from '../utils/logger';
import {FrameSequence, VideoResult} from '../types';
import {generateId} from '../utils/fileManager';
import {FrameLibraryService} from "../services/frameLibraryService";


// Cache asset loading to prevent reloading the same images
const assetCache = new Map();

export class VideoProcessor {
    private readonly width: number;
    private readonly height: number;
    private readonly frameRate: number;
    private readonly quality: number;
    private readonly tikTokShortThreshold: number;
    private frameLibrary: FrameLibraryService;
    private frameLibraryInitialized: boolean = false;

    constructor() {
        // Vertical dimensions for TikTok (9:16 aspect ratio)
        this.width = config.video.width || 720;
        this.height = config.video.height || 1280;
        this.frameRate = config.video.frameRate;
        this.quality = config.video.quality;
        this.tikTokShortThreshold = config.tiktok?.shortFormat || 15; // Default to 15 seconds
        this.frameLibrary = new FrameLibraryService();
    }

    /**
     * Initialize the processor - pre-render character frames with more variations
     */
    async initialize(): Promise<void> {
        if (this.frameLibraryInitialized) return;

        logger.info('Initializing VideoProcessor...');

        // Preload assets
        const assets = await this.loadAssets();

        // Initialize frame library with loaded assets
        // NOTE: Use more rotation values for smoother animation
        await this.frameLibrary.initialize(assets, true); // Pass true to use more rotation values

        this.frameLibraryInitialized = true;
        logger.info('VideoProcessor initialized with pre-rendered frames');
    }

    /**
     * Core method - generates animation frames based on audio using pre-rendered character frames
     */
    async generateFrameSequence(
        audioDuration: number,
        audioPath: string,
        contentText?: string,
        isShortFormat: boolean = false,
        newsTitle?: string,
        newsImagePath?: string
    ): Promise<FrameSequence> {
        try {
            // Make sure we're initialized
            if (!this.frameLibraryInitialized) {
                await this.initialize();
            }

            logger.info(`Generating animation frame sequence for ${audioDuration} seconds of audio`);

            // Analyze audio for better lip sync
            const {amplitudes, duration} = await this.analyzeAudio(audioPath);

            // Determine if this is a short format video
            const isShort = audioDuration <= this.tikTokShortThreshold;
            logger.info(`Video format: ${isShort ? 'SHORT' : 'STANDARD'} (${audioDuration}s)`);

            // Determine content type if text is provided
            const contentType = contentText ? this.determineContentType(contentText) : 'WEIRD';

            // Create output directory
            const outputDir = path.join(config.paths.frames, `seq_${Date.now()}`);
            fs.ensureDirSync(outputDir);

            // Load assets for background, desk, etc.
            const assets = await this.loadAssets();

            // Load the news image if provided
            let newsImage = null;
            if (newsImagePath && fs.existsSync(newsImagePath)) {
                try {
                    newsImage = await loadImage(newsImagePath);
                    logger.info(`Loaded news image: ${newsImagePath}`);
                } catch (err) {
                    logger.warn(`Failed to load news image: ${err}`);
                }
            }

            // Calculate number of frames needed
            const totalFrames = Math.ceil(duration * this.frameRate);
            const frames: string[] = [];

            logger.info(`Generating ${totalFrames} frames at ${this.frameRate} FPS`);

            // Create a reusable canvas for the full frame
            const canvas = createCanvas(this.width, this.height);
            const ctx = canvas.getContext('2d');

            // Create a background+studio scene canvas (for reuse)
            const sceneCanvas = createCanvas(this.width, this.height);
            const sceneCtx = sceneCanvas.getContext('2d');

            // Pre-draw static background and studio elements
            this.drawTopSection(sceneCtx, newsTitle || contentType);

            // Studio background
            sceneCtx.drawImage(
                assets.background,
                0, this.height * 0.2,      // Position at 20% height
                this.width, this.height * 0.5  // Take up 50% of height
            );

            // Desk
            sceneCtx.drawImage(
                assets.desk,
                0, this.height * 0.55,     // Position just above bottom section
                this.width, this.height * 0.15
            );

            // Props
            if (assets.props.monitor) {
                sceneCtx.drawImage(
                    assets.props.monitor,
                    this.width * 0.7, this.height * 0.4,
                    this.width * 0.15, this.height * 0.08
                );
            }

            if (assets.props.mug) {
                sceneCtx.drawImage(
                    assets.props.mug,
                    this.width * 0.2, this.height * 0.55,
                    this.width * 0.06, this.height * 0.03
                );
            }

            // Draw bottom section with news image
            this.drawBottomSection(sceneCtx, newsImage, contentType);

            // Keep track of previous amplitude for smoother animation
            let prevAmplitude = 0;
            let prevMouthState = 'closed';
            let prevEyeState = 'neutral';
            let prevHeadRotation = 0;

            // For performance tracking
            const startTime = Date.now();

            // Generate each frame using pre-rendered character frames
            for (let i = 0; i < totalFrames; i++) {
                // Calculate current time position in the audio
                const timePosition = i / this.frameRate;
                const amplitude = amplitudes[i] || 0;

                // Determine character state for this frame
                const mouthState = this.determineMouthState(amplitude, prevAmplitude, timePosition);
                const eyeState = this.determineEyeState(timePosition, amplitude);

                // CHANGE: Allow for more continuous head movement rather than discrete angles
                const exactHeadRotation = this.calculateHeadMovement(timePosition, amplitude);

                // REMOVED: Frame skipping - ensure animation is always smooth
                // We'll let the video codec handle frame optimization instead

                // Clear the canvas
                ctx.clearRect(0, 0, this.width, this.height);

                // Draw the pre-rendered background scene
                ctx.drawImage(sceneCanvas, 0, 0);

                // Get pre-rendered character frame
                const characterBuffer = this.frameLibrary.getFrame(mouthState, eyeState, exactHeadRotation);

                if (characterBuffer) {
                    // Convert buffer to Image
                    const characterImage = new Image();
                    characterImage.src = characterBuffer;

                    // Position character in the scene
                    const characterX = this.width / 2 - 200; // Center horizontally
                    const characterY = this.height * 0.37;    // Position vertically

                    // Draw character image
                    ctx.drawImage(
                        characterImage,
                        characterX,
                        characterY,
                        400, // Width
                        500  // Height
                    );
                } else {
                    // Fallback to direct rendering if pre-rendered frame not available
                    this.drawCharacterDirectly(ctx, assets, mouthState, eyeState, exactHeadRotation);
                }

                // Save the frame
                const framePath = this.saveFrame(canvas, i, outputDir);
                frames.push(framePath);

                // Update previous state for next frame
                prevAmplitude = amplitude;
                prevMouthState = mouthState;
                prevEyeState = eyeState;
                prevHeadRotation = exactHeadRotation;

                // Log progress occasionally
                if (i % 30 === 0 || i === totalFrames - 1) {
                    const percentComplete = Math.round((i / totalFrames) * 100);
                    logger.info(`Generated ${i}/${totalFrames} frames (${percentComplete}%)`);
                }
            }

            // Calculate and log performance stats
            const endTime = Date.now();
            const elapsedSeconds = (endTime - startTime) / 1000;
            const framesPerSecond = totalFrames / elapsedSeconds;

            logger.info(`Frame generation complete: ${frames.length} frames in ${elapsedSeconds.toFixed(1)}s (${framesPerSecond.toFixed(1)} fps)`);

            return {
                directory: outputDir,
                frames,
                frameCount: frames.length,
                frameRate: this.frameRate,
                isShortFormat: isShort
            };
        } catch (error) {
            logger.error(`Failed to generate frame sequence: ${error}`);
            throw new Error(`Failed to generate frame sequence: ${error}`);
        }
    }

    /**
     * Fallback method to draw character directly if pre-rendered frame isn't available
     */
    private drawCharacterDirectly(
        ctx: any,
        assets: any,
        mouthState: string,
        eyeState: string,
        headRotation: number
    ): void {
        // Character position
        const characterCenterX = this.width * 0.5;
        const characterCenterY = this.height * 0.5;

        // Save context for rotation
        ctx.save();
        ctx.translate(characterCenterX, characterCenterY);
        ctx.rotate(headRotation * Math.PI / 180);

        // Draw body
        ctx.drawImage(assets.body, -150, -150, 300, 360);

        // Get eye image
        let eyeImage;
        switch (eyeState) {
            case 'squint': eyeImage = assets.eyes.squint; break;
            case 'wide': eyeImage = assets.eyes.wide; break;
            case 'rolling': eyeImage = assets.eyes.rolling; break;
            case 'wink': eyeImage = assets.eyes.wink; break;
            default: eyeImage = assets.eyes.neutral;
        }

        // Draw eyes
        ctx.drawImage(eyeImage, -100, -70, 200, 80);

        // Get mouth image
        let mouthImage;
        switch (mouthState) {
            case 'halfOpen': mouthImage = assets.mouths.halfOpen; break;
            case 'open': mouthImage = assets.mouths.open; break;
            default: mouthImage = assets.mouths.closed;
        }

        // Draw mouth
        ctx.drawImage(mouthImage, -60, 30, 120, 60);

        // Draw accessories
        if (assets.accessories.microphone) {
            ctx.drawImage(assets.accessories.microphone, -100, 40, 40, 60);
        }

        if (assets.accessories.glasses) {
            ctx.drawImage(assets.accessories.glasses, -90, -70, 180, 60);
        }

        // Restore context
        ctx.restore();
    }

    /**
     * Combine audio with animation frames to create a video
     */
    async createVideo(
        framesDir: string,
        audioPath: string,
        duration: number,
        customFilename?: string
    ): Promise<VideoResult> {
        return new Promise((resolve, reject) => {
            try {
                logger.info('Creating video from frames and audio...');

                if (this.width > this.height) {
                    logger.warn(`Warning: Video dimensions appear to be landscape (${this.width}x${this.height}), should be portrait`);
                }

                // Create output filename and path
                // Use custom filename if provided, otherwise generate a random ID
                const outputFilename = customFilename || `video_${generateId()}.mp4`;
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
                    '-vf', 'scale=720:1280,setdar=9/16',
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
                            url: `/videos/${outputFilename}`,
                            isShortFormat: true
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
     * Draw the top section with network banner and headline
     */
    private drawTopSection(ctx: any, title: string): void {
        // Background
        ctx.fillStyle = '#1a2633';
        ctx.fillRect(0, 0, this.width, this.height * 0.2);

        // Network banner
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(20, 20, this.width - 40, 60);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('POTATO NEWS', 40, 60);

        // Headline banner
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(0, this.height * 0.15, this.width, 50);

        // Headline text (truncate if needed)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';

        // Truncate long headlines
        let displayTitle = title;
        if (ctx.measureText(displayTitle).width > this.width - 40) {
            // Truncate to fit
            while (ctx.measureText(displayTitle + '...').width > this.width - 40 && displayTitle.length > 0) {
                displayTitle = displayTitle.substring(0, displayTitle.length - 1);
            }
            displayTitle += '...';
        }

        ctx.fillText(displayTitle, 20, this.height * 0.15 + 28);
    }

    /**
     * Draw the bottom section with the news image
     */
    private drawBottomSection(ctx: any, newsImage: any, contentType: string): void {
        // Divider bar
        ctx.fillStyle = '#3498db';
        ctx.fillRect(0, this.height * 0.7, this.width, 5);

        // Image section background - darker blue like in screenshot
        ctx.fillStyle = '#1a2633';
        ctx.fillRect(0, this.height * 0.7 + 5, this.width, this.height * 0.3 - 5);

        // Draw image with proper sizing
        if (newsImage) {
            // Container dimensions
            const containerWidth = this.width * 0.85;  // 85% of width
            const containerHeight = this.height * 0.22; // 22% of height

            // Center horizontally
            const x = (this.width - containerWidth) / 2;
            // Position in the middle of the bottom section
            const y = this.height * 0.74; // Adjusted to center within bottom section

            // Draw container with beige background
            ctx.fillStyle = '#e8d8b7'; // Beige background
            ctx.fillRect(x, y, containerWidth, containerHeight);
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, containerWidth, containerHeight);

            // Calculate image and container aspect ratios
            const imageRatio = newsImage.width / newsImage.height;
            const containerRatio = containerWidth / containerHeight;

            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

            // Modified to FIT rather than COVER to prevent clipping
            if (imageRatio > containerRatio) {
                // Image is wider than container - scale to fit width
                drawWidth = containerWidth;
                drawHeight = drawWidth / imageRatio;
                offsetX = 0;
                offsetY = (containerHeight - drawHeight) / 2; // Center vertically
            } else {
                // Image is taller than container - scale to fit height
                drawHeight = containerHeight;
                drawWidth = drawHeight * imageRatio;
                offsetX = (containerWidth - drawWidth) / 2; // Center horizontally
                offsetY = 0;
            }

            // Draw the image to fit within container boundaries without clipping
            ctx.drawImage(
                newsImage,
                x + offsetX,
                y + offsetY,
                drawWidth,
                drawHeight
            );

            // Add light overlay text for attribution if needed
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = 'italic 12px Arial';
            ctx.fillText('NEWS IMAGE', x + 10, y + containerHeight - 10);
        } else {
            // Placeholder - modified to match your style
            ctx.fillStyle = '#7f8c8d';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('RELATED CONTENT', this.width / 2, this.height * 0.8);
            ctx.textAlign = 'left';
        }

        // // Bottom banner for "BREAKING NEWS" like in screenshot
        // ctx.fillStyle = '#e74c3c'; // Bright red
        // ctx.fillRect(0, this.height - 40, this.width, 40);
        //
        // // Banner text
        // ctx.fillStyle = '#ffffff';
        // ctx.font = 'bold 22px Arial';
        // ctx.fillText('BREAKING NEWS', 20, this.height - 15);
    }

    /**
     * Analyze audio file to get amplitude data for better lip sync
     */
    async analyzeAudio(audioPath: string): Promise<{ amplitudes: number[], duration: number }> {
        try {
            logger.info(`Analyzing audio file for lip sync: ${audioPath}`);

            // Get audio duration using FFmpeg - simple approach
            const durationOutput = await this.getAudioDuration(audioPath);
            const duration = parseFloat(durationOutput) || this.estimateDurationFromFileSize(audioPath);

            // Generate synthetic amplitudes - reliable and simple
            const amplitudes = this.generateSyntheticAmplitudes(duration);

            return {amplitudes, duration};
        } catch (error) {
            logger.warn(`Audio analysis failed, using fallback: ${error}`);
            const defaultDuration = 30;
            return {
                amplitudes: this.generateSyntheticAmplitudes(defaultDuration),
                duration: defaultDuration
            };
        }
    }

    private async getAudioDuration(audioPath: string): Promise<string> {
        return new Promise((resolve) => {
            const durationArgs = [
                '-i', audioPath,
                '-show_entries', 'format=duration',
                '-v', 'quiet',
                '-of', 'csv=p=0',
            ];

            const process = spawn(ffmpegPath as string, durationArgs);
            let output = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                resolve(code === 0 ? output.trim() : '');
            });

            process.on('error', () => resolve(''));
        });
    }

    private estimateDurationFromFileSize(audioPath: string): number {
        // Simple fallback estimation from file size
        const stats = fs.statSync(audioPath);
        return Math.ceil(stats.size / (128 * 1024 / 8));
    }

    /**
     * Generate synthetic amplitude data when audio analysis fails
     */
    private generateSyntheticAmplitudes(duration: number): number[] {
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
     * Save a single frame to disk
     */
    private saveFrame(canvas: Canvas, frameNumber: number, outputDir: string): string {
        const paddedNum = frameNumber.toString().padStart(5, '0');
        const framePath = path.join(outputDir, `frame_${paddedNum}.png`);

        // Convert canvas to PNG and save
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(framePath, buffer);

        return framePath;
    }

    /**
     * Determine content type based on text
     */
    private determineContentType(text: string): 'WEIRD' | 'FUNNY' {
        const lowerText = text.toLowerCase();

        const weirdWords = ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar',
            'mysterious', 'unexplained'];

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

        return (funnyCount > weirdCount) ? 'FUNNY' : 'WEIRD';
    }

    /**
     * Load and cache all required assets
     */
    private async loadAssets() {
        // Check if assets are already loaded
        if (assetCache.size > 0) {
            return Object.fromEntries(assetCache);
        }

        async function loadAsset(assetPath: string) {
            try {
                if (fs.existsSync(assetPath)) {
                    return await loadImage(assetPath);
                }
            } catch (err) {
                logger.warn(`Failed to load asset: ${assetPath}`);
            }
            return null;
        }

        // Load background
        const background = await loadAsset(path.join(config.assetPaths.studio.backgrounds, 'background_0.png')) ||
            this.createDefaultBackground();
        assetCache.set('background', background);

        // Load desk
        const desk = await loadAsset(path.join(config.assetPaths.studio.props, 'desk_0.png')) ||
            this.createDefaultDesk();
        assetCache.set('desk', desk);

        // Load character body
        const body = await loadAsset(path.join(config.assetPaths.character.body, 'body.png')) ||
            this.createDefaultBody();
        assetCache.set('body', body);

        // Load mouths
        const mouthClosed = await loadAsset(path.join(config.assetPaths.character.mouth, 'closed.png')) ||
            this.createDefaultMouth('closed');
        const mouthHalfOpen = await loadAsset(path.join(config.assetPaths.character.mouth, 'halfOpen.png')) ||
            this.createDefaultMouth('halfOpen');
        const mouthOpen = await loadAsset(path.join(config.assetPaths.character.mouth, 'open.png')) ||
            this.createDefaultMouth('open');

        assetCache.set('mouths', {
            closed: mouthClosed,
            halfOpen: mouthHalfOpen,
            open: mouthOpen
        });

        // Load eyes
        const eyeNeutral = await loadAsset(path.join(config.assetPaths.character.eyes, 'neutral.png')) ||
            this.createDefaultEyes('neutral');
        const eyeSquint = await loadAsset(path.join(config.assetPaths.character.eyes, 'squint.png')) ||
            this.createDefaultEyes('squint');
        const eyeWide = await loadAsset(path.join(config.assetPaths.character.eyes, 'wide.png')) ||
            this.createDefaultEyes('wide');
        const eyeRolling = await loadAsset(path.join(config.assetPaths.character.eyes, 'rolling.png')) ||
            this.createDefaultEyes('rolling');
        const eyeWink = await loadAsset(path.join(config.assetPaths.character.eyes, 'wink.png')) ||
            this.createDefaultEyes('wink');

        assetCache.set('eyes', {
            neutral: eyeNeutral,
            squint: eyeSquint,
            wide: eyeWide,
            rolling: eyeRolling,
            wink: eyeWink
        });

        // Load props
        // const monitor = await loadAsset(path.join(config.assetPaths.studio.props, 'prop_0.png'));
        const mug = await loadAsset(path.join(config.assetPaths.studio.props, 'prop_1.png'));
        const papers = await loadAsset(path.join(config.assetPaths.studio.props, 'prop_2.png'));

        assetCache.set('props', {
            // monitor,
            mug,
            papers
        });

        // Load accessories
        const microphone = await loadAsset(path.join(config.assetPaths.character.accessories, 'accessory_0.png'));
        const glasses = await loadAsset(path.join(config.assetPaths.character.accessories, 'accessory_1.png'));

        assetCache.set('accessories', {
            microphone,
            glasses
        });

        return Object.fromEntries(assetCache);
    }

    // Default element creation methods (same as your existing implementation)
    private createDefaultBackground() {
        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');

        // Simple gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(1, '#1a242f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        return canvas;
    }

    private createDefaultDesk() {
        const canvas = createCanvas(this.width, this.height * 0.4);
        const ctx = canvas.getContext('2d');

        // Simple desk
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(0, 0, this.width, this.height * 0.3);

        // Desk top
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(0, 0, this.width, this.height * 0.05);

        return canvas;
    }

    private createDefaultBody() {
        const canvas = createCanvas(300, 360);
        const ctx = canvas.getContext('2d');

        // Simple potato body
        ctx.fillStyle = '#cd853f';
        ctx.beginPath();
        ctx.ellipse(150, 180, 150, 180, 0, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    }

    private createDefaultMouth(state: string) {
        const canvas = createCanvas(120, 60);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#8b0000';

        if (state === 'closed') {
            ctx.beginPath();
            ctx.moveTo(0, 30);
            ctx.lineTo(120, 30);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
        } else if (state === 'halfOpen') {
            ctx.beginPath();
            ctx.ellipse(60, 30, 60, 20, 0, 0, Math.PI, false);
            ctx.fill();
        } else { // open
            ctx.beginPath();
            ctx.ellipse(60, 30, 60, 30, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(60, 30, 40, 20, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        return canvas;
    }

    private createDefaultEyes(state: string) {
        const canvas = createCanvas(200, 80);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';

        // Left eye
        ctx.beginPath();
        ctx.ellipse(50, 40, 30, state === 'squint' ? 5 : 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Right eye
        if (state !== 'wink') {
            ctx.beginPath();
            ctx.ellipse(150, 40, 30, state === 'squint' ? 5 : 30, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(120, 40);
            ctx.lineTo(180, 40);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
        }

        // Pupils
        ctx.fillStyle = '#000000';
        let pupilY = 40;

        if (state === 'rolling') {
            pupilY -= 15;
        }

        if (state === 'wide') {
            ctx.beginPath();
            ctx.arc(50, pupilY, 15, 0, Math.PI * 2);
            ctx.fill();

            // @ts-ignore
            if (state !== 'wink') {
                ctx.beginPath();
                ctx.arc(150, pupilY, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.beginPath();
            ctx.arc(50, pupilY, 10, 0, Math.PI * 2);
            ctx.fill();

            if (state !== 'wink') {
                ctx.beginPath();
                ctx.arc(150, pupilY, 10, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        return canvas;
    }

    /**
     * Improved mouth animation with smoother transitions
     */
    private determineMouthState(amplitude: number, prevAmplitude: number, timePosition: number): string {
        // Implement hysteresis to prevent rapid flickering between states
        // Only change state if the amplitude has changed significantly
        const threshold = 0.1;

        // Base decision on current amplitude but include some inertia
        const smoothedAmplitude = amplitude * 0.7 + prevAmplitude * 0.3;

        // Add occasional "emphasis" by forcing mouth wide open based on time
        const forcedEmphasis = Math.sin(timePosition * 1.5) > 0.95 && amplitude > 0.4;

        if (forcedEmphasis) {
            return 'open';
        } else if (smoothedAmplitude < 0.2 - threshold) {
            return 'closed';
        } else if (smoothedAmplitude < 0.6 - threshold) {
            return 'halfOpen';
        } else {
            return 'open';
        }
    }

    /**
     * Enhanced eye blinks with more natural pattern
     */
    private determineEyeState(timePosition: number, amplitude: number): string {
        // People typically blink every 3-8 seconds
        // Create semi-random but natural-looking pattern
        const blinkCycle = (timePosition + Math.sin(timePosition * 0.3) * 2) % 5;

        // Blink for about 0.1 seconds (3 frames at 30fps)
        if (blinkCycle > 4.9) {
            return 'squint';
        }

        // Occasional expressions based on speech
        // When talking loudly (high amplitude), occasionally make eyes wide
        if (amplitude > 0.7 && Math.sin(timePosition * 3) > 0.9) {
            return 'wide';
        }

        // Every ~15 seconds, add a special expression
        const expressionCycle = timePosition % 15;
        if (expressionCycle > 14.7) {
            // Alternate between different expressions
            const expressionIndex = Math.floor(timePosition / 15) % 3;
            if (expressionIndex === 0) return 'wide';
            if (expressionIndex === 1) return 'rolling';
            return 'wink';
        }

        // Default eye state
        return 'neutral';
    }

    /**
     * Improved head movement with more natural motion
     * Enhanced for smoother animation
     */
    private calculateHeadMovement(timePosition: number, amplitude: number): number {
        // Base movement (slow side-to-side) - INCREASED amplitude slightly
        const baseMovement = Math.sin(timePosition * 0.5) * 4;

        // Add micro-movements based on talking - INCREASED sensitivity
        const microMovement = amplitude * 3 * Math.sin(timePosition * 8);

        // Add occasional head tilt for emphasis - INCREASED frequency and amplitude
        const emphasisTilt = (Math.sin(timePosition * 0.3) > 0.7) ? Math.sin(timePosition * 2) * 5 : 0;

        return baseMovement + microMovement + emphasisTilt;
    }
}