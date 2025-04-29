import { createCanvas, loadImage, Canvas, Image } from 'canvas';
import * as fs from 'fs-extra';
import * as path from 'path';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Service that pre-renders and manages character frames for faster video generation
 */
export class FrameLibraryService {
    private frameLibrary: Map<string, Buffer> = new Map();
    private initialized: boolean = false;
    private readonly cachePath: string;
    private assets: any = null;

    constructor() {
        this.cachePath = path.join(config.paths.temp || 'temp', 'frame_library');
        fs.ensureDirSync(this.cachePath);
    }

    /**
     * Modified initialize method with support for more rotation values
     * This creates more pre-rendered frames for smoother animation
     */
    async initialize(assets?: any, useMoreRotations: boolean = false): Promise<void> {
        if (this.initialized) return;

        logger.info('Initializing frame library...');

        // Store assets if provided
        if (assets) {
            this.assets = assets;
        }

        try {
            // Define all possible character state combinations
            const mouthStates = ['closed', 'halfOpen', 'open'];
            const eyeStates = ['neutral', 'squint', 'wide', 'rolling', 'wink'];

            // Use more rotation values for smoother animation when requested
            // This creates more pre-rendered frames for smoother head movement
            const headRotations = useMoreRotations
                ? [-8, -6, -4, -2, 0, 2, 4, 6, 8] // More granular rotation values
                : [-4, -2, 0, 2, 4]; // Default fewer rotation values

            // Load assets if not provided
            if (!this.assets) {
                this.assets = await this.loadAssets();
            }

            let totalCombinations = mouthStates.length * eyeStates.length * headRotations.length;
            let renderedCount = 0;

            logger.info(`Pre-rendering ${totalCombinations} character state combinations...`);

            // Create all possible combinations
            for (const mouthState of mouthStates) {
                for (const eyeState of eyeStates) {
                    for (const headRotation of headRotations) {
                        const frameKey = this.getFrameKey(mouthState, eyeState, headRotation);
                        const framePath = path.join(this.cachePath, `${frameKey}.png`);

                        // Check if frame already exists in cache
                        if (fs.existsSync(framePath)) {
                            // Load from cache
                            const buffer = fs.readFileSync(framePath);
                            this.frameLibrary.set(frameKey, buffer);
                        } else {
                            // Generate and save to cache
                            const buffer = await this.renderCharacterFrame(mouthState, eyeState, headRotation);
                            fs.writeFileSync(framePath, buffer);
                            this.frameLibrary.set(frameKey, buffer);
                        }

                        renderedCount++;

                        // Log progress periodically
                        if (renderedCount % 10 === 0 || renderedCount === totalCombinations) {
                            logger.info(`Pre-rendered ${renderedCount}/${totalCombinations} character states`);
                        }
                    }
                }
            }

            logger.info(`Frame library initialized with ${this.frameLibrary.size} pre-rendered states`);
            this.initialized = true;
        } catch (error) {
            logger.error(`Failed to initialize frame library: ${error}`);
            throw error;
        }
    }

    /**
     * Improved getFrame method that handles continuous rotation values
     * This ensures smoother animation by finding the closest pre-rendered rotation
     */
    getFrame(mouthState: string, eyeState: string, headRotation: number): Buffer | null {
        if (!this.initialized) {
            logger.warn('Attempting to get frame from uninitialized library');
            return null;
        }

        // Determine available rotation values (change based on initialization)
        // We need to dynamically determine this based on what's in the library
        const rotationValues = [...new Set(
            [...this.frameLibrary.keys()]
                .map(key => {
                    const match = key.match(/rot(-?\d+)/);
                    return match ? parseInt(match[1]) : null;
                })
                .filter(val => val !== null)
        )].sort((a, b) => a - b);

        // Find the closest matching head rotation
        const closestRotation = rotationValues.reduce((prev, curr) =>
            Math.abs(curr - headRotation) < Math.abs(prev - headRotation) ? curr : prev
        );

        const frameKey = this.getFrameKey(mouthState, eyeState, closestRotation);

        if (!this.frameLibrary.has(frameKey)) {
            logger.warn(`Frame not found in library: ${frameKey}`);
            return null;
        }

        return this.frameLibrary.get(frameKey)!;
    }

    /**
     * Clear frame library to free up memory
     */
    clearMemory(): void {
        this.frameLibrary.clear();
        this.initialized = false;
        logger.info('Frame library memory cleared');
    }

    /**
     * Generate a consistent key for the frame library
     */
    private getFrameKey(mouthState: string, eyeState: string, headRotation: number): string {
        return `character_${mouthState}_${eyeState}_rot${headRotation}`;
    }

    /**
     * Enhanced rendering with improved rotation handling
     */
    private async renderCharacterFrame(mouthState: string, eyeState: string, headRotation: number): Promise<Buffer> {
        // Create a canvas just for the character
        const width = 400;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Ensure we have assets
        if (!this.assets) {
            throw new Error('Assets not loaded for frame rendering');
        }

        // Clear canvas with transparent background
        ctx.clearRect(0, 0, width, height);

        // Center for character
        const centerX = width / 2;
        const centerY = height / 2;

        // Draw with rotation
        ctx.save();
        ctx.translate(centerX, centerY);

        // Apply exact rotation from parameter
        ctx.rotate(headRotation * Math.PI / 180);

        // Draw body
        ctx.drawImage(this.assets.body, -150, -150, 300, 360);

        // Get eye image
        let eyeImage;
        switch (eyeState) {
            case 'squint': eyeImage = this.assets.eyes.squint; break;
            case 'wide': eyeImage = this.assets.eyes.wide; break;
            case 'rolling': eyeImage = this.assets.eyes.rolling; break;
            case 'wink': eyeImage = this.assets.eyes.wink; break;
            default: eyeImage = this.assets.eyes.neutral;
        }

        // Draw eyes
        ctx.drawImage(eyeImage, -100, -70, 200, 80);

        // Get mouth image
        let mouthImage;
        switch (mouthState) {
            case 'halfOpen': mouthImage = this.assets.mouths.halfOpen; break;
            case 'open': mouthImage = this.assets.mouths.open; break;
            default: mouthImage = this.assets.mouths.closed;
        }

        // Draw mouth
        ctx.drawImage(mouthImage, -60, 30, 120, 60);

        // Draw accessories
        if (this.assets.accessories.microphone) {
            ctx.drawImage(this.assets.accessories.microphone, -100, 40, 40, 60);
        }

        if (this.assets.accessories.glasses) {
            ctx.drawImage(this.assets.accessories.glasses, -90, -70, 180, 60);
        }

        ctx.restore();

        return canvas.toBuffer('image/png');
    }

    /**
     * Load necessary assets (similar to VideoProcessor's loadAssets)
     */
    private async loadAssets() {
        const assetCache = new Map();

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

        // Load background (not needed for character frames but keeping for consistency)
        const background = await loadAsset(path.join(config.assetPaths.studio.backgrounds, 'background_0.png'));
        assetCache.set('background', background);

        // Load desk (not needed for character frames but keeping for consistency)
        const desk = await loadAsset(path.join(config.assetPaths.studio.props, 'desk_0.png'));
        assetCache.set('desk', desk);

        // Load character body
        const body = await loadAsset(path.join(config.assetPaths.character.body, 'body.png'));
        assetCache.set('body', body);

        // Load mouths
        const mouthClosed = await loadAsset(path.join(config.assetPaths.character.mouth, 'closed.png'));
        const mouthHalfOpen = await loadAsset(path.join(config.assetPaths.character.mouth, 'halfOpen.png'));
        const mouthOpen = await loadAsset(path.join(config.assetPaths.character.mouth, 'open.png'));

        assetCache.set('mouths', {
            closed: mouthClosed,
            halfOpen: mouthHalfOpen,
            open: mouthOpen
        });

        // Load eyes
        const eyeNeutral = await loadAsset(path.join(config.assetPaths.character.eyes, 'neutral.png'));
        const eyeSquint = await loadAsset(path.join(config.assetPaths.character.eyes, 'squint.png'));
        const eyeWide = await loadAsset(path.join(config.assetPaths.character.eyes, 'wide.png'));
        const eyeRolling = await loadAsset(path.join(config.assetPaths.character.eyes, 'rolling.png'));
        const eyeWink = await loadAsset(path.join(config.assetPaths.character.eyes, 'wink.png'));

        assetCache.set('eyes', {
            neutral: eyeNeutral,
            squint: eyeSquint,
            wide: eyeWide,
            rolling: eyeRolling,
            wink: eyeWink
        });

        // Load props
        const monitor = await loadAsset(path.join(config.assetPaths.studio.props, 'prop_0.png'));
        const mug = await loadAsset(path.join(config.assetPaths.studio.props, 'prop_1.png'));
        const papers = await loadAsset(path.join(config.assetPaths.studio.props, 'prop_2.png'));

        assetCache.set('props', {
            monitor,
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
}