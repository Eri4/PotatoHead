"use strict";
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
exports.CharacterRenderer = void 0;
const canvas_1 = require("canvas");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
class CharacterRenderer {
    constructor() {
        this.frameCount = 0;
        this.width = config_1.default.video.width;
        this.height = config_1.default.video.height;
        this.canvas = (0, canvas_1.createCanvas)(this.width, this.height);
        this.ctx = this.canvas.getContext('2d');
        this.outputDir = path_1.default.join(config_1.default.paths.frames, `seq_${Date.now()}`);
        // Create output directory
        fs_extra_1.default.ensureDirSync(this.outputDir);
    }
    renderFrame(characterState, studioState, frameNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            // Clear the canvas
            this.ctx.clearRect(0, 0, this.width, this.height);
            try {
                // 1. Draw studio background
                yield this.drawStudioBackground(studioState.backgroundIndex);
                // 2. Draw news desk
                yield this.drawDesk(studioState.deskIndex);
                // 3. Draw studio props
                yield this.drawProps(studioState.propIndices);
                // 4. Draw PotatoHead character with current state
                yield this.drawPotatoHead(characterState.eyeState, characterState.mouthState, characterState.headRotation, characterState.accessoryIndices);
                // 5. Draw any overlay text
                if (studioState.overlayText) {
                    this.drawOverlayText(studioState.overlayText);
                }
                // 6. Save the frame
                const outputPath = this.saveFrame(frameNumber);
                return outputPath;
            }
            catch (error) {
                logger_1.default.error(`Error rendering frame ${frameNumber}: ${error}`);
                throw new Error(`Failed to render frame: ${error}`);
            }
        });
    }
    drawStudioBackground(backgroundIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try to load custom background
            const backgroundPath = path_1.default.join(config_1.default.assetPaths.studio.backgrounds, `background_${backgroundIndex}.png`);
            if (fs_extra_1.default.existsSync(backgroundPath)) {
                try {
                    const backgroundImage = yield (0, canvas_1.loadImage)(backgroundPath);
                    this.ctx.drawImage(backgroundImage, 0, 0, this.width, this.height);
                    return;
                }
                catch (err) {
                    logger_1.default.warn(`Failed to load background image: ${err}`);
                    // Fall back to default background
                }
            }
            // Default background drawing
            // Create gradient for studio wall
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
            gradient.addColorStop(0, '#2c3e50');
            gradient.addColorStop(1, '#1a242f');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.width, this.height);
            // Draw studio lights
            for (let i = 0; i < 3; i++) {
                this.ctx.beginPath();
                this.ctx.arc(this.width * (0.25 + i * 0.25), 50, 30, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255, 255, 200, 0.7)';
                this.ctx.fill();
            }
            // Draw network logo
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText('POTATO NEWS NETWORK', 50, 40);
            // Draw decorative elements
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(0, this.height - 60, this.width, 60);
        });
    }
    drawDesk(deskIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try to load custom desk
            const deskPath = path_1.default.join(config_1.default.assetPaths.studio.props, `desk_${deskIndex}.png`);
            if (fs_extra_1.default.existsSync(deskPath)) {
                try {
                    const deskImage = yield (0, canvas_1.loadImage)(deskPath);
                    this.ctx.drawImage(deskImage, this.width * 0.05, this.height * 0.6, this.width * 0.9, this.height * 0.35);
                    return;
                }
                catch (err) {
                    logger_1.default.warn(`Failed to load desk image: ${err}`);
                    // Fall back to default desk
                }
            }
            // Default desk drawing
            // Draw news desk
            this.ctx.fillStyle = '#8b4513';
            this.ctx.fillRect(this.width * 0.1, this.height * 0.6, this.width * 0.8, this.height * 0.3);
            // Desk top
            this.ctx.fillStyle = '#a0522d';
            this.ctx.fillRect(this.width * 0.05, this.height * 0.6, this.width * 0.9, this.height * 0.05);
            // Desk front panel with logo
            this.ctx.fillStyle = '#daa520';
            this.ctx.fillRect(this.width * 0.3, this.height * 0.65, this.width * 0.4, this.height * 0.2);
            // Logo on desk
            this.ctx.font = 'bold 36px Arial';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText('PNN', this.width * 0.46, this.height * 0.75);
        });
    }
    drawProps(propIndices) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const index of propIndices) {
                // Try to load custom prop
                const propPath = path_1.default.join(config_1.default.assetPaths.studio.props, `prop_${index}.png`);
                if (fs_extra_1.default.existsSync(propPath)) {
                    try {
                        const propImage = yield (0, canvas_1.loadImage)(propPath);
                        // Position depends on the prop
                        if (index === 0) { // Monitor
                            this.ctx.drawImage(propImage, this.width * 0.7, this.height * 0.45, this.width * 0.2, this.height * 0.15);
                        }
                        else if (index === 1) { // Coffee mug
                            this.ctx.drawImage(propImage, this.width * 0.2 - 30, this.height * 0.55 - 20, 60, 60);
                        }
                        else if (index === 2) { // Papers
                            this.ctx.drawImage(propImage, this.width * 0.3, this.height * 0.55, this.width * 0.2, this.height * 0.05);
                        }
                        continue;
                    }
                    catch (err) {
                        logger_1.default.warn(`Failed to load prop image ${index}: ${err}`);
                        // Fall back to default prop
                    }
                }
                // Default prop drawing
                if (index === 0) { // Monitor/screen
                    this.ctx.fillStyle = '#2c3e50';
                    this.ctx.fillRect(this.width * 0.7, this.height * 0.45, this.width * 0.2, this.height * 0.15);
                    this.ctx.strokeStyle = '#7f8c8d';
                    this.ctx.lineWidth = 5;
                    this.ctx.strokeRect(this.width * 0.7, this.height * 0.45, this.width * 0.2, this.height * 0.15);
                }
                else if (index === 1) { // Coffee mug
                    this.ctx.fillStyle = '#e74c3c';
                    this.ctx.beginPath();
                    this.ctx.arc(this.width * 0.2, this.height * 0.55, 20, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.fillRect(this.width * 0.2 - 20, this.height * 0.55, 40, 25);
                }
                else if (index === 2) { // Papers/notes
                    this.ctx.fillStyle = '#ecf0f1';
                    this.ctx.fillRect(this.width * 0.3, this.height * 0.55, this.width * 0.2, this.height * 0.05);
                    // Lines on paper
                    this.ctx.strokeStyle = '#95a5a6';
                    this.ctx.lineWidth = 1;
                    for (let i = 1; i < 5; i++) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.width * 0.3, this.height * (0.55 + i * 0.01));
                        this.ctx.lineTo(this.width * 0.5, this.height * (0.55 + i * 0.01));
                        this.ctx.stroke();
                    }
                }
            }
        });
    }
    drawPotatoHead(eyeState, mouthState, headRotation, accessoryIndices) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Save context for rotation
                this.ctx.save();
                // Position in center, above desk
                const centerX = this.width * 0.5;
                const centerY = this.height * 0.4;
                // Apply rotation
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate(headRotation * Math.PI / 180);
                // Check for and try to load body image
                const bodyPath = path_1.default.join(config_1.default.assetPaths.character.body, 'body.png');
                if (fs_extra_1.default.existsSync(bodyPath)) {
                    try {
                        const bodyImage = yield (0, canvas_1.loadImage)(bodyPath);
                        this.ctx.drawImage(bodyImage, -150, -180, 300, 360);
                    }
                    catch (err) {
                        // Fallback to drawn body
                        this.drawDefaultBody();
                    }
                }
                else {
                    // No custom body image, use default
                    this.drawDefaultBody();
                }
                // Check for and try to load eyes image
                const eyesPath = path_1.default.join(config_1.default.assetPaths.character.eyes, `${eyeState}.png`);
                if (fs_extra_1.default.existsSync(eyesPath)) {
                    try {
                        const eyesImage = yield (0, canvas_1.loadImage)(eyesPath);
                        this.ctx.drawImage(eyesImage, -100, -80, 200, 80);
                    }
                    catch (err) {
                        // Fallback to drawn eyes
                        this.drawEyes(eyeState);
                    }
                }
                else {
                    // No custom eyes image, use default
                    this.drawEyes(eyeState);
                }
                // Check for and try to load mouth image
                const mouthPath = path_1.default.join(config_1.default.assetPaths.character.mouth, `${mouthState}.png`);
                if (fs_extra_1.default.existsSync(mouthPath)) {
                    try {
                        const mouthImage = yield (0, canvas_1.loadImage)(mouthPath);
                        this.ctx.drawImage(mouthImage, -60, 30, 120, 60);
                    }
                    catch (err) {
                        // Fallback to drawn mouth
                        this.drawMouth(mouthState);
                    }
                }
                else {
                    // No custom mouth image, use default
                    this.drawMouth(mouthState);
                }
                // Draw accessories (either custom or default)
                for (const index of accessoryIndices) {
                    const accessoryPath = path_1.default.join(config_1.default.assetPaths.character.accessories, `accessory_${index}.png`);
                    if (fs_extra_1.default.existsSync(accessoryPath)) {
                        try {
                            const accessoryImage = yield (0, canvas_1.loadImage)(accessoryPath);
                            // Position depends on the accessory
                            if (index === 0) { // Microphone
                                this.ctx.drawImage(accessoryImage, -100, 30, 40, 60);
                            }
                            else if (index === 1) { // Glasses
                                this.ctx.drawImage(accessoryImage, -90, -60, 180, 60);
                            }
                        }
                        catch (err) {
                            // If loading fails, draw default accessories
                            this.drawDefaultAccessory(index);
                        }
                    }
                    else {
                        // No custom accessory image, use default
                        this.drawDefaultAccessory(index);
                    }
                }
                // Restore context
                this.ctx.restore();
            }
            catch (error) {
                logger_1.default.error(`Error in drawPotatoHead: ${error}`);
                // Reset context just in case
                this.ctx.restore();
                // Fall back to completely default drawing if something goes wrong
                this.ctx.save();
                this.ctx.translate(this.width * 0.5, this.height * 0.4);
                this.ctx.rotate(headRotation * Math.PI / 180);
                this.drawDefaultBody();
                this.drawEyes(eyeState);
                this.drawMouth(mouthState);
                this.drawAccessories(accessoryIndices);
                this.ctx.restore();
            }
        });
    }
    drawDefaultBody() {
        this.ctx.fillStyle = '#cd853f'; // Potato brown color
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 150, 180, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }
    drawEyes(eyeState) {
        // Left eye
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.ellipse(-50, -40, 30, eyeState === 'squint' ? 5 : 30, 0, 0, Math.PI * 2);
        this.ctx.fill();
        // Right eye (wink makes this one closed)
        if (eyeState !== 'wink') {
            this.ctx.beginPath();
            this.ctx.ellipse(50, -40, 30, eyeState === 'squint' ? 5 : 30, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
        else {
            this.ctx.beginPath();
            this.ctx.moveTo(20, -40);
            this.ctx.lineTo(80, -40);
            this.ctx.lineWidth = 5;
            this.ctx.strokeStyle = '#000000';
            this.ctx.stroke();
        }
        // Draw pupils based on state
        this.ctx.fillStyle = '#000000';
        // Left pupil
        let leftPupilX = -50;
        let rightPupilX = 50;
        let pupilY = -40;
        if (eyeState === 'rolling') {
            // Rolling eyes look upward
            pupilY -= 15;
        }
        else if (eyeState === 'wide') {
            // Wide eyes have bigger pupils
            this.ctx.beginPath();
            this.ctx.arc(leftPupilX, pupilY, 15, 0, Math.PI * 2);
            this.ctx.fill();
            // @ts-ignore
            if (eyeState !== 'wink') {
                this.ctx.beginPath();
                this.ctx.arc(rightPupilX, pupilY, 15, 0, Math.PI * 2);
                this.ctx.fill();
            }
            return;
        }
        // Standard pupils
        this.ctx.beginPath();
        this.ctx.arc(leftPupilX, pupilY, 10, 0, Math.PI * 2);
        this.ctx.fill();
        if (eyeState !== 'wink') {
            this.ctx.beginPath();
            this.ctx.arc(rightPupilX, pupilY, 10, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    drawMouth(mouthState) {
        this.ctx.fillStyle = '#8b0000'; // Dark red
        if (mouthState === 'closed') {
            // Simple line
            this.ctx.beginPath();
            this.ctx.moveTo(-60, 50);
            this.ctx.lineTo(60, 50);
            this.ctx.lineWidth = 5;
            this.ctx.strokeStyle = '#000000';
            this.ctx.stroke();
        }
        else if (mouthState === 'halfOpen') {
            // Half oval
            this.ctx.beginPath();
            this.ctx.ellipse(0, 50, 60, 20, 0, 0, Math.PI, false);
            this.ctx.fill();
        }
        else {
            // Full oval
            this.ctx.beginPath();
            this.ctx.ellipse(0, 50, 60, 40, 0, 0, Math.PI * 2);
            this.ctx.fill();
            // Inner mouth
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 50, 40, 25, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    drawDefaultAccessory(index) {
        if (index === 0) { // Microphone
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.fillRect(-90, 30, 20, 50);
            this.ctx.fillStyle = '#7f8c8d';
            this.ctx.beginPath();
            this.ctx.arc(-80, 30, 15, 0, Math.PI * 2);
            this.ctx.fill();
        }
        else if (index === 1) { // Glasses
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            // Left lens
            this.ctx.beginPath();
            this.ctx.ellipse(-50, -40, 35, 35, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            // Right lens
            this.ctx.beginPath();
            this.ctx.ellipse(50, -40, 35, 35, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            // Bridge
            this.ctx.beginPath();
            this.ctx.moveTo(-15, -40);
            this.ctx.lineTo(15, -40);
            this.ctx.stroke();
            // Arms
            this.ctx.beginPath();
            this.ctx.moveTo(-85, -40);
            this.ctx.lineTo(-150, -20);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(85, -40);
            this.ctx.lineTo(150, -20);
            this.ctx.stroke();
        }
    }
    drawAccessories(accessoryIndices) {
        // Microphone
        if (accessoryIndices.includes(0)) {
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.fillRect(-90, 30, 20, 50);
            this.ctx.fillStyle = '#7f8c8d';
            this.ctx.beginPath();
            this.ctx.arc(-80, 30, 15, 0, Math.PI * 2);
            this.ctx.fill();
        }
        // Glasses
        if (accessoryIndices.includes(1)) {
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            // Left lens
            this.ctx.beginPath();
            this.ctx.ellipse(-50, -40, 35, 35, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            // Right lens
            this.ctx.beginPath();
            this.ctx.ellipse(50, -40, 35, 35, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            // Bridge
            this.ctx.beginPath();
            this.ctx.moveTo(-15, -40);
            this.ctx.lineTo(15, -40);
            this.ctx.stroke();
            // Arms
            this.ctx.beginPath();
            this.ctx.moveTo(-85, -40);
            this.ctx.lineTo(-150, -20);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(85, -40);
            this.ctx.lineTo(150, -20);
            this.ctx.stroke();
        }
    }
    drawOverlayText(text) {
        // Draw text overlay for chyron/lower third
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.fillRect(0, this.height - 60, this.width, 60);
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(text, 20, this.height - 25);
    }
    saveFrame(frameNumber) {
        const paddedNum = frameNumber.toString().padStart(5, '0');
        const framePath = path_1.default.join(this.outputDir, `frame_${paddedNum}.png`);
        // Convert canvas to PNG and save
        const buffer = this.canvas.toBuffer('image/png');
        fs_extra_1.default.writeFileSync(framePath, buffer);
        return framePath;
    }
    getOutputDirectory() {
        return this.outputDir;
    }
}
exports.CharacterRenderer = CharacterRenderer;
