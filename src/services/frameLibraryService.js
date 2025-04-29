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
exports.FrameLibraryService = void 0;
const canvas_1 = require("canvas");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Service that pre-renders and manages character frames for faster video generation
 */
class FrameLibraryService {
    constructor() {
        this.frameLibrary = new Map();
        this.initialized = false;
        this.assets = null;
        this.cachePath = path.join(config_1.default.paths.temp || 'temp', 'frame_library');
        fs.ensureDirSync(this.cachePath);
    }
    /**
     * Modified initialize method with support for more rotation values
     * This creates more pre-rendered frames for smoother animation
     */
    initialize(assets_1) {
        return __awaiter(this, arguments, void 0, function* (assets, useMoreRotations = false) {
            if (this.initialized)
                return;
            logger_1.default.info('Initializing frame library...');
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
                    this.assets = yield this.loadAssets();
                }
                let totalCombinations = mouthStates.length * eyeStates.length * headRotations.length;
                let renderedCount = 0;
                logger_1.default.info(`Pre-rendering ${totalCombinations} character state combinations...`);
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
                            }
                            else {
                                // Generate and save to cache
                                const buffer = yield this.renderCharacterFrame(mouthState, eyeState, headRotation);
                                fs.writeFileSync(framePath, buffer);
                                this.frameLibrary.set(frameKey, buffer);
                            }
                            renderedCount++;
                            // Log progress periodically
                            if (renderedCount % 10 === 0 || renderedCount === totalCombinations) {
                                logger_1.default.info(`Pre-rendered ${renderedCount}/${totalCombinations} character states`);
                            }
                        }
                    }
                }
                logger_1.default.info(`Frame library initialized with ${this.frameLibrary.size} pre-rendered states`);
                this.initialized = true;
            }
            catch (error) {
                logger_1.default.error(`Failed to initialize frame library: ${error}`);
                throw error;
            }
        });
    }
    /**
     * Improved getFrame method that handles continuous rotation values
     * This ensures smoother animation by finding the closest pre-rendered rotation
     */
    getFrame(mouthState, eyeState, headRotation) {
        if (!this.initialized) {
            logger_1.default.warn('Attempting to get frame from uninitialized library');
            return null;
        }
        // Determine available rotation values (change based on initialization)
        // We need to dynamically determine this based on what's in the library
        const rotationValues = [...new Set([...this.frameLibrary.keys()]
                .map(key => {
                const match = key.match(/rot(-?\d+)/);
                return match ? parseInt(match[1]) : null;
            })
                .filter(val => val !== null))].sort((a, b) => a - b);
        // Find the closest matching head rotation
        const closestRotation = rotationValues.reduce((prev, curr) => Math.abs(curr - headRotation) < Math.abs(prev - headRotation) ? curr : prev);
        const frameKey = this.getFrameKey(mouthState, eyeState, closestRotation);
        if (!this.frameLibrary.has(frameKey)) {
            logger_1.default.warn(`Frame not found in library: ${frameKey}`);
            return null;
        }
        return this.frameLibrary.get(frameKey);
    }
    /**
     * Clear frame library to free up memory
     */
    clearMemory() {
        this.frameLibrary.clear();
        this.initialized = false;
        logger_1.default.info('Frame library memory cleared');
    }
    /**
     * Generate a consistent key for the frame library
     */
    getFrameKey(mouthState, eyeState, headRotation) {
        return `character_${mouthState}_${eyeState}_rot${headRotation}`;
    }
    /**
     * Enhanced rendering with improved rotation handling
     */
    renderCharacterFrame(mouthState, eyeState, headRotation) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create a canvas just for the character
            const width = 400;
            const height = 500;
            const canvas = (0, canvas_1.createCanvas)(width, height);
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
                case 'squint':
                    eyeImage = this.assets.eyes.squint;
                    break;
                case 'wide':
                    eyeImage = this.assets.eyes.wide;
                    break;
                case 'rolling':
                    eyeImage = this.assets.eyes.rolling;
                    break;
                case 'wink':
                    eyeImage = this.assets.eyes.wink;
                    break;
                default: eyeImage = this.assets.eyes.neutral;
            }
            // Draw eyes
            ctx.drawImage(eyeImage, -100, -70, 200, 80);
            // Get mouth image
            let mouthImage;
            switch (mouthState) {
                case 'halfOpen':
                    mouthImage = this.assets.mouths.halfOpen;
                    break;
                case 'open':
                    mouthImage = this.assets.mouths.open;
                    break;
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
        });
    }
    /**
     * Load necessary assets (similar to VideoProcessor's loadAssets)
     */
    loadAssets() {
        return __awaiter(this, void 0, void 0, function* () {
            const assetCache = new Map();
            function loadAsset(assetPath) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        if (fs.existsSync(assetPath)) {
                            return yield (0, canvas_1.loadImage)(assetPath);
                        }
                    }
                    catch (err) {
                        logger_1.default.warn(`Failed to load asset: ${assetPath}`);
                    }
                    return null;
                });
            }
            // Load background (not needed for character frames but keeping for consistency)
            const background = yield loadAsset(path.join(config_1.default.assetPaths.studio.backgrounds, 'background_0.png'));
            assetCache.set('background', background);
            // Load desk (not needed for character frames but keeping for consistency)
            const desk = yield loadAsset(path.join(config_1.default.assetPaths.studio.props, 'desk_0.png'));
            assetCache.set('desk', desk);
            // Load character body
            const body = yield loadAsset(path.join(config_1.default.assetPaths.character.body, 'body.png'));
            assetCache.set('body', body);
            // Load mouths
            const mouthClosed = yield loadAsset(path.join(config_1.default.assetPaths.character.mouth, 'closed.png'));
            const mouthHalfOpen = yield loadAsset(path.join(config_1.default.assetPaths.character.mouth, 'halfOpen.png'));
            const mouthOpen = yield loadAsset(path.join(config_1.default.assetPaths.character.mouth, 'open.png'));
            assetCache.set('mouths', {
                closed: mouthClosed,
                halfOpen: mouthHalfOpen,
                open: mouthOpen
            });
            // Load eyes
            const eyeNeutral = yield loadAsset(path.join(config_1.default.assetPaths.character.eyes, 'neutral.png'));
            const eyeSquint = yield loadAsset(path.join(config_1.default.assetPaths.character.eyes, 'squint.png'));
            const eyeWide = yield loadAsset(path.join(config_1.default.assetPaths.character.eyes, 'wide.png'));
            const eyeRolling = yield loadAsset(path.join(config_1.default.assetPaths.character.eyes, 'rolling.png'));
            const eyeWink = yield loadAsset(path.join(config_1.default.assetPaths.character.eyes, 'wink.png'));
            assetCache.set('eyes', {
                neutral: eyeNeutral,
                squint: eyeSquint,
                wide: eyeWide,
                rolling: eyeRolling,
                wink: eyeWink
            });
            // Load props
            const monitor = yield loadAsset(path.join(config_1.default.assetPaths.studio.props, 'prop_0.png'));
            const mug = yield loadAsset(path.join(config_1.default.assetPaths.studio.props, 'prop_1.png'));
            const papers = yield loadAsset(path.join(config_1.default.assetPaths.studio.props, 'prop_2.png'));
            assetCache.set('props', {
                monitor,
                mug,
                papers
            });
            // Load accessories
            const microphone = yield loadAsset(path.join(config_1.default.assetPaths.character.accessories, 'accessory_0.png'));
            const glasses = yield loadAsset(path.join(config_1.default.assetPaths.character.accessories, 'accessory_1.png'));
            assetCache.set('accessories', {
                microphone,
                glasses
            });
            return Object.fromEntries(assetCache);
        });
    }
}
exports.FrameLibraryService = FrameLibraryService;
