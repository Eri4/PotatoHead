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
exports.SubtitleService = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const logger_1 = __importDefault(require("../utils/logger"));
// Set FFmpeg path from ffmpeg-static
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
class SubtitleService {
    constructor() {
        // Constants for subtitle appearance and timing
        this.SUBTITLE_STYLES = {
            // TikTok-optimized style with less intrusive display
            default: {
                fontName: 'Arial',
                fontSize: 8, // Slightly smaller to take up less space
                primaryColor: '&H00FFFFFF', // White text
                bold: 1,
                alignment: 2, // Bottom-center alignment
                marginV: 16, // Smaller bottom margin - places subtitles higher
                marginL: 20, // Left margin
                spacing: 0.2, // Letter spacing
                lineSpacing: 0.5 // Tighter line spacing
            },
            // Short video style - optimized for minimal intrusion
            short: {
                fontName: 'Arial',
                fontSize: 8, // Still readable but smaller
                primaryColor: '&H00FFFFFF',
                bold: 1,
                alignment: 2,
                marginV: 14, // Even smaller margin
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
                fontSize: 8, // Smaller text
                primaryColor: '&H00FFFFFF',
                bold: 1,
                alignment: 8, // Top-center alignment to avoid bottom UI
                marginV: 5, // Minimal margin
                marginL: 20,
                spacing: 0.2
            }
        };
        // Timing parameters
        this.MIN_SUBTITLE_DURATION = 1.2;
        this.MAX_SUBTITLE_DURATION = 3.0;
        this.INTER_SUBTITLE_PAUSE = 0.05;
        this.BASE_READING_SPEED = 0.06;
        this.EMPHASIZED_WORD_PATTERN = /\b[A-Z]{2,}\b/g;
    }
    /**
     * Create an SRT subtitle file from generated content
     */
    createSubtitles(content_1, audioResult_1, outputDir_1) {
        return __awaiter(this, arguments, void 0, function* (content, audioResult, outputDir, isShortFormat = false) {
            try {
                logger_1.default.info(`Creating subtitles for content: ${content.id}`);
                // Create SRT filename
                const srtFilename = `subtitles_${content.id}.srt`;
                const srtPath = path.join(outputDir, srtFilename);
                // Generate SRT content with improved timing
                const srtContent = this.generateSRT(content.rawText, audioResult.duration, isShortFormat);
                // Write SRT file
                fs.writeFileSync(srtPath, srtContent);
                logger_1.default.info(`Subtitle file created at: ${srtPath}`);
                return srtPath;
            }
            catch (error) {
                logger_1.default.error(`Failed to create subtitles: ${error}`);
                throw new Error(`Failed to create subtitles: ${error}`);
            }
        });
    }
    /**
     * Add subtitles to a video file using fluent-ffmpeg with optimized styling
     */
    addSubtitlesToVideo(videoPath_1, subtitlePath_1) {
        return __awaiter(this, arguments, void 0, function* (videoPath, subtitlePath, isShortFormat = false, useCompactStyle = false // Option to use compact style
        ) {
            return new Promise((resolve, reject) => {
                try {
                    logger_1.default.info(`Adding subtitles to video: ${videoPath}`);
                    // Create output filename for subtitled video
                    const videoDir = path.dirname(videoPath);
                    const videoFilename = path.basename(videoPath);
                    const outputFilename = `subtitled_${videoFilename}`;
                    const outputPath = path.join(videoDir, outputFilename);
                    // Fix path format for ffmpeg filtering (replace backslashes with forward slashes)
                    const normalizedSubtitlePath = subtitlePath.replace(/\\/g, '/');
                    // Select appropriate style based on video format and user preference
                    let styleKey = 'default';
                    if (useCompactStyle) {
                        styleKey = 'compact';
                    }
                    else if (isShortFormat) {
                        styleKey = 'short';
                    }
                    const style = this.SUBTITLE_STYLES[styleKey];
                    const styleString = this.buildStyleString(style);
                    (0, fluent_ffmpeg_1.default)(videoPath)
                        .videoFilters(`subtitles=${normalizedSubtitlePath}:force_style='${styleString}'`)
                        .output(outputPath)
                        .on('start', (commandLine) => {
                        logger_1.default.debug(`FFmpeg command: ${commandLine}`);
                    })
                        .on('progress', (progress) => {
                        logger_1.default.debug(`Processing: ${progress.percent}% done`);
                    })
                        .on('end', () => {
                        logger_1.default.info(`Subtitled video created at: ${outputPath}`);
                        resolve(outputPath);
                    })
                        .on('error', (err) => {
                        logger_1.default.error(`FFmpeg error: ${err.message}`);
                        reject(new Error(`Failed to add subtitles: ${err.message}`));
                    })
                        .run();
                }
                catch (error) {
                    logger_1.default.error(`Failed to add subtitles to video: ${error}`);
                    reject(new Error(`Failed to add subtitles to video: ${error}`));
                }
            });
        });
    }
    /**
     * Create a version of the video with different subtitle styles for comparison
     */
    createSubtitleTestVersions(videoPath, subtitlePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputs = [];
            const styles = Object.keys(this.SUBTITLE_STYLES);
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
                    yield new Promise((resolve, reject) => {
                        (0, fluent_ffmpeg_1.default)(videoPath)
                            .videoFilters(`subtitles=${normalizedSubtitlePath}:force_style='${styleString}'`)
                            .output(outputPath)
                            .on('end', () => {
                            outputs.push(outputPath);
                            resolve();
                        })
                            .on('error', reject)
                            .run();
                    });
                }
                catch (error) {
                    logger_1.default.error(`Failed to create ${styleKey} style version: ${error}`);
                }
            }
            return outputs;
        });
    }
    /**
     * Generate SRT subtitle content
     */
    generateSRT(text, totalDurationSeconds, isShortFormat = false) {
        // Adjust reading speed based on video format
        const readingSpeed = isShortFormat
            ? this.BASE_READING_SPEED * 0.9 // Slightly faster for short videos
            : this.BASE_READING_SPEED;
        // Create shorter chunks for less screen space usage
        const targetWordsPerChunk = isShortFormat ? 4 : 6; // Reduced from 5/7 to 4/6
        const chunks = this.createOptimalSubtitleChunks(text, isShortFormat, targetWordsPerChunk);
        let srtContent = '';
        let startTime = 0;
        // Distribute timing
        const timeDistribution = this.calculateTimeDistribution(chunks, totalDurationSeconds, readingSpeed);
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
    createOptimalSubtitleChunks(text, isShortFormat, targetWordsPerChunk = 6) {
        // Define preferred chunk size - now with customizable target
        const maxWordsPerChunk = targetWordsPerChunk + 2; // Just a bit larger than target
        // Split into sentences first
        const sentences = this.splitIntoSentences(text);
        const chunks = [];
        sentences.forEach(sentence => {
            // Skip empty sentences
            if (sentence.trim().length === 0)
                return;
            const words = sentence.split(' ');
            // Short sentence - keep it as is
            if (words.length <= maxWordsPerChunk) {
                chunks.push(sentence);
                return;
            }
            // Longer sentence - split intelligently
            let currentChunk = [];
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
    isNaturalBreakpoint(currentWord, nextWord) {
        if (!nextWord)
            return true;
        // End with punctuation
        if (/[,.;:!?]$/.test(currentWord))
            return true;
        // Break after conjunctions
        const conjunctions = ['and', 'but', 'or', 'nor', 'so', 'yet'];
        if (conjunctions.includes(currentWord.toLowerCase()))
            return true;
        // Break before relative pronouns
        const relativePronouns = ['who', 'whom', 'whose', 'which', 'that'];
        if (relativePronouns.includes(nextWord.toLowerCase()))
            return true;
        return false;
    }
    /**
     * Calculate optimal time distribution for subtitle chunks
     */
    calculateTimeDistribution(chunks, totalDuration, readingSpeed) {
        const distribution = [];
        // Calculate raw durations based on chunk length
        let totalRawDuration = 0;
        const rawDurations = chunks.map(chunk => {
            // Base duration on character count with special handling for emphasis
            const duration = chunk.length * readingSpeed;
            // Check for emphasized words (ALL CAPS)
            const emphasisCount = (chunk.match(this.EMPHASIZED_WORD_PATTERN) || []).length;
            const emphasisBonus = emphasisCount * 0.2; // Add 200ms per emphasized word
            // Check for dramatic pauses
            const pauseCount = (chunk.match(/\.\.\./g) || []).length;
            const pauseBonus = pauseCount * 0.3; // Add 300ms per pause
            // Apply minimum and maximum constraints
            const adjustedDuration = Math.max(this.MIN_SUBTITLE_DURATION, Math.min(this.MAX_SUBTITLE_DURATION, duration + emphasisBonus + pauseBonus));
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
    splitIntoSentences(text) {
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
    formatSrtTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }
    /**
     * Build FFmpeg style string from style object
     */
    buildStyleString(style) {
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
exports.SubtitleService = SubtitleService;
