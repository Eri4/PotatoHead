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
exports.VideoService = void 0;
const path = __importStar(require("path"));
const videoProcessor_1 = require("../animation/videoProcessor");
const subtitleService_1 = require("./subtitleService");
const soundEffectsService_1 = require("./soundEffectsService");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = __importDefault(require("../config/config"));
const fileManager_1 = require("../utils/fileManager");
class VideoService {
    constructor() {
        this.videoProcessor = new videoProcessor_1.VideoProcessor();
        this.subtitleService = new subtitleService_1.SubtitleService();
        this.soundEffectsService = new soundEffectsService_1.SoundEffectsService();
    }
    /**
     * Create a complete video for content with all enhancements
     */
    createVideoForContent(content, audioResult, newsItem // Optional newsItem parameter for filename formatting
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                logger_1.default.info(`Creating enhanced video for content: ${content.id}`);
                // Determine if this should be a short-format video
                const isShortFormat = audioResult.duration <= (((_a = config_1.default.tiktok) === null || _a === void 0 ? void 0 : _a.shortFormat) || 15);
                // Determine content type for labeling
                const contentType = this.determineContentType(content.rawText);
                // Generate animation frames with improved lip sync
                const frameSequence = yield this.videoProcessor.generateFrameSequence(audioResult.duration, audioResult.path, content.rawText, isShortFormat);
                // Generate custom filename if newsItem is provided
                let customFilename;
                if (newsItem) {
                    customFilename = (0, fileManager_1.formatVideoFilename)(newsItem, content);
                    logger_1.default.info(`Using formatted filename: ${customFilename}`);
                }
                // Combine frames and audio into base video
                const baseVideoResult = yield this.videoProcessor.createVideo(frameSequence.directory, audioResult.path, audioResult.duration, customFilename // Pass the custom filename
                );
                // Create subtitles with smaller chunks for better timing
                const subtitlePath = yield this.subtitleService.createSubtitles(content, audioResult, path.dirname(baseVideoResult.path), isShortFormat);
                // Add subtitles to video
                const subtitledVideoPath = yield this.subtitleService.addSubtitlesToVideo(baseVideoResult.path, subtitlePath);
                // Add sound effects
                const finalVideoPath = yield this.soundEffectsService.addSoundEffectsToVideo(subtitledVideoPath, isShortFormat);
                // Create result object with updated path
                const finalResult = Object.assign(Object.assign({}, baseVideoResult), { path: finalVideoPath, url: `/videos/${path.basename(finalVideoPath)}` });
                logger_1.default.info(`Enhanced video creation complete: ${finalVideoPath}, format: ${isShortFormat ? 'short' : 'standard'}`);
                return finalResult;
            }
            catch (error) {
                logger_1.default.error(`Failed to create enhanced video for content: ${error}`);
                throw new Error(`Failed to create enhanced video for content: ${error}`);
            }
        });
    }
    determineContentType(text) {
        const lowerText = text.toLowerCase();
        const weirdWords = ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar'];
        const funnyWords = ['funny', 'hilarious', 'laugh', 'comedy', 'ridiculous', 'absurd'];
        let weirdCount = 0;
        let funnyCount = 0;
        weirdWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches)
                weirdCount += matches.length;
        });
        funnyWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches)
                funnyCount += matches.length;
        });
        return weirdCount >= funnyCount ? "WEIRD" : "FUNNY";
    }
}
exports.VideoService = VideoService;
