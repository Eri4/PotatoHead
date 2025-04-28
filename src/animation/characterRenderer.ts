import { createCanvas, loadImage, Canvas } from 'canvas';
import fs from 'fs-extra';
import path from 'path';
import { AnimationState, StudioState } from '../types';
import config from '../config/config';
import logger from '../utils/logger';

export class CharacterRenderer {
    private canvas: Canvas;
    private ctx: any;
    private width: number;
    private height: number;
    private frameCount: number = 0;
    private outputDir: string;

    constructor() {
        this.width = config.video.width;
        this.height = config.video.height;
        this.canvas = createCanvas(this.width, this.height);
        this.ctx = this.canvas.getContext('2d');
        this.outputDir = path.join(config.paths.frames, `seq_${Date.now()}`);

        // Create output directory
        fs.ensureDirSync(this.outputDir);
    }

    async renderFrame(
        characterState: AnimationState,
        studioState: StudioState,
        frameNumber: number,
        isShortFormat: boolean = false
    ): Promise<string> {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        try {
            // 1. Draw studio background
            await this.drawStudioBackground(studioState.backgroundIndex);

            // 2. Draw news desk
            await this.drawDesk(studioState.deskIndex);

            // 3. Draw studio props
            await this.drawProps(studioState.propIndices);

            // 4. Draw PotatoHead character with current state
            await this.drawPotatoHead(
                characterState.eyeState,
                characterState.mouthState,
                characterState.headRotation,
                characterState.accessoryIndices
            );

            // 5. Draw any overlay text
            if (studioState.overlayText) {
                this.drawOverlayText(studioState.overlayText, isShortFormat);
            }

            // 6. Save the frame
            const outputPath = this.saveFrame(frameNumber);
            return outputPath;
        } catch (error) {
            logger.error(`Error rendering frame ${frameNumber}: ${error}`);
            throw new Error(`Failed to render frame: ${error}`);
        }
    }

    private async drawStudioBackground(backgroundIndex: number): Promise<void> {
        // Try to load custom background
        const backgroundPath = path.join(config.assetPaths.studio.backgrounds, `background_${backgroundIndex}.png`);

        if (fs.existsSync(backgroundPath)) {
            try {
                const backgroundImage = await loadImage(backgroundPath);
                this.ctx.drawImage(backgroundImage, 0, 0, this.width, this.height);
                return;
            } catch (err) {
                logger.warn(`Failed to load background image: ${err}`);
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
            this.ctx.arc(
                this.width * (0.25 + i * 0.25),
                50,
                30,
                0,
                Math.PI * 2
            );
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
    }

    private async drawDesk(deskIndex: number): Promise<void> {
        // Try to load custom desk
        const deskPath = path.join(config.assetPaths.studio.props, `desk_${deskIndex}.png`);

        if (fs.existsSync(deskPath)) {
            try {
                const deskImage = await loadImage(deskPath);
                this.ctx.drawImage(deskImage, this.width * 0.05, this.height * 0.6, this.width * 0.9, this.height * 0.35);
                return;
            } catch (err) {
                logger.warn(`Failed to load desk image: ${err}`);
                // Fall back to default desk
            }
        }

        // Default desk drawing
        // Draw news desk
        this.ctx.fillStyle = '#8b4513';
        this.ctx.fillRect(
            this.width * 0.1,
            this.height * 0.6,
            this.width * 0.8,
            this.height * 0.3
        );

        // Desk top
        this.ctx.fillStyle = '#a0522d';
        this.ctx.fillRect(
            this.width * 0.05,
            this.height * 0.6,
            this.width * 0.9,
            this.height * 0.05
        );

        // Desk front panel with logo
        this.ctx.fillStyle = '#daa520';
        this.ctx.fillRect(
            this.width * 0.3,
            this.height * 0.65,
            this.width * 0.4,
            this.height * 0.2
        );

        // Logo on desk
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('PNN', this.width * 0.46, this.height * 0.75);
    }

    private async drawProps(propIndices: number[]): Promise<void> {
        for (const index of propIndices) {
            // Try to load custom prop
            const propPath = path.join(config.assetPaths.studio.props, `prop_${index}.png`);

            if (fs.existsSync(propPath)) {
                try {
                    const propImage = await loadImage(propPath);

                    // Position depends on the prop
                    if (index === 0) { // Monitor
                        this.ctx.drawImage(propImage, this.width * 0.7, this.height * 0.45, this.width * 0.2, this.height * 0.15);
                    } else if (index === 1) { // Coffee mug
                        this.ctx.drawImage(propImage, this.width * 0.2 - 30, this.height * 0.55 - 20, 60, 60);
                    } else if (index === 2) { // Papers
                        this.ctx.drawImage(propImage, this.width * 0.3, this.height * 0.55, this.width * 0.2, this.height * 0.05);
                    }

                    continue;
                } catch (err) {
                    logger.warn(`Failed to load prop image ${index}: ${err}`);
                    // Fall back to default prop
                }
            }

            // Default prop drawing
            if (index === 0) { // Monitor/screen
                this.ctx.fillStyle = '#2c3e50';
                this.ctx.fillRect(
                    this.width * 0.7,
                    this.height * 0.45,
                    this.width * 0.2,
                    this.height * 0.15
                );
                this.ctx.strokeStyle = '#7f8c8d';
                this.ctx.lineWidth = 5;
                this.ctx.strokeRect(
                    this.width * 0.7,
                    this.height * 0.45,
                    this.width * 0.2,
                    this.height * 0.15
                );
            } else if (index === 1) { // Coffee mug
                this.ctx.fillStyle = '#e74c3c';
                this.ctx.beginPath();
                this.ctx.arc(
                    this.width * 0.2,
                    this.height * 0.55,
                    20,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
                this.ctx.fillRect(
                    this.width * 0.2 - 20,
                    this.height * 0.55,
                    40,
                    25
                );
            } else if (index === 2) { // Papers/notes
                this.ctx.fillStyle = '#ecf0f1';
                this.ctx.fillRect(
                    this.width * 0.3,
                    this.height * 0.55,
                    this.width * 0.2,
                    this.height * 0.05
                );
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
    }

    private async drawPotatoHead(
        eyeState: 'neutral' | 'squint' | 'wide' | 'rolling' | 'wink',
        mouthState: 'closed' | 'halfOpen' | 'open',
        headRotation: number,
        accessoryIndices: number[]
    ): Promise<void> {
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
            const bodyPath = path.join(config.assetPaths.character.body, 'body.png');
            if (fs.existsSync(bodyPath)) {
                try {
                    const bodyImage = await loadImage(bodyPath);
                    this.ctx.drawImage(bodyImage, -150, -180, 300, 360);
                } catch (err) {
                    // Fallback to drawn body
                    this.drawDefaultBody();
                }
            } else {
                // No custom body image, use default
                this.drawDefaultBody();
            }

            // Check for and try to load eyes image
            const eyesPath = path.join(config.assetPaths.character.eyes, `${eyeState}.png`);
            if (fs.existsSync(eyesPath)) {
                try {
                    const eyesImage = await loadImage(eyesPath);
                    this.ctx.drawImage(eyesImage, -100, -80, 200, 80);
                } catch (err) {
                    // Fallback to drawn eyes
                    this.drawEyes(eyeState);
                }
            } else {
                // No custom eyes image, use default
                this.drawEyes(eyeState);
            }

            // Check for and try to load mouth image
            const mouthPath = path.join(config.assetPaths.character.mouth, `${mouthState}.png`);
            if (fs.existsSync(mouthPath)) {
                try {
                    const mouthImage = await loadImage(mouthPath);
                    this.ctx.drawImage(mouthImage, -60, 30, 120, 60);
                } catch (err) {
                    // Fallback to drawn mouth
                    this.drawMouth(mouthState);
                }
            } else {
                // No custom mouth image, use default
                this.drawMouth(mouthState);
            }

            // Draw accessories (either custom or default)
            for (const index of accessoryIndices) {
                const accessoryPath = path.join(config.assetPaths.character.accessories, `accessory_${index}.png`);

                if (fs.existsSync(accessoryPath)) {
                    try {
                        const accessoryImage = await loadImage(accessoryPath);
                        // Position depends on the accessory
                        if (index === 0) { // Microphone
                            this.ctx.drawImage(accessoryImage, -100, 30, 40, 60);
                        } else if (index === 1) { // Glasses
                            this.ctx.drawImage(accessoryImage, -90, -60, 180, 60);
                        }
                    } catch (err) {
                        // If loading fails, draw default accessories
                        this.drawDefaultAccessory(index);
                    }
                } else {
                    // No custom accessory image, use default
                    this.drawDefaultAccessory(index);
                }
            }

            // Restore context
            this.ctx.restore();
        } catch (error) {
            logger.error(`Error in drawPotatoHead: ${error}`);

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
    }

    private drawDefaultBody(): void {
        this.ctx.fillStyle = '#cd853f'; // Potato brown color
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 150, 180, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawEyes(eyeState: 'neutral' | 'squint' | 'wide' | 'rolling' | 'wink'): void {
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
        } else {
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
        } else if (eyeState === 'wide') {
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

    private drawMouth(mouthState: 'closed' | 'halfOpen' | 'open'): void {
        this.ctx.fillStyle = '#8b0000'; // Dark red

        if (mouthState === 'closed') {
            // Simple line
            this.ctx.beginPath();
            this.ctx.moveTo(-60, 50);
            this.ctx.lineTo(60, 50);
            this.ctx.lineWidth = 5;
            this.ctx.strokeStyle = '#000000';
            this.ctx.stroke();
        } else if (mouthState === 'halfOpen') {
            // Half oval
            this.ctx.beginPath();
            this.ctx.ellipse(0, 50, 60, 20, 0, 0, Math.PI, false);
            this.ctx.fill();
        } else {
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

    private drawDefaultAccessory(index: number): void {
        if (index === 0) { // Microphone
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.fillRect(-90, 30, 20, 50);
            this.ctx.fillStyle = '#7f8c8d';
            this.ctx.beginPath();
            this.ctx.arc(-80, 30, 15, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (index === 1) { // Glasses
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

    private drawAccessories(accessoryIndices: number[]): void {
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

    private drawOverlayText(text: string, isShortFormat: boolean): void {
        // For short format videos, make overlay more prominent
        if (isShortFormat) {
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(0, this.height - 80, this.width, 80);

            this.ctx.font = 'bold 36px Arial';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(text, 20, this.height - 30);
        } else {
            // Your existing overlay code
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(0, this.height - 60, this.width, 60);

            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(text, 20, this.height - 25);
        }
    }

    private saveFrame(frameNumber: number): string {
        const paddedNum = frameNumber.toString().padStart(5, '0');
        const framePath = path.join(this.outputDir, `frame_${paddedNum}.png`);

        // Convert canvas to PNG and save
        const buffer = this.canvas.toBuffer('image/png');
        fs.writeFileSync(framePath, buffer);

        return framePath;
    }

    getOutputDirectory(): string {
        return this.outputDir;
    }
}