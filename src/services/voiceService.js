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
exports.VoiceService = void 0;
const get_audio_duration_1 = require("get-audio-duration");
const axios_1 = __importDefault(require("axios"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
class VoiceService {
    constructor() {
        this.apiKey = config_1.default.apis.elevenlabs.key;
        this.apiUrl = config_1.default.apis.elevenlabs.url;
        this.voiceId = config_1.default.apis.elevenlabs.voiceId;
        this.stability = config_1.default.apis.elevenlabs.stability;
        this.similarityBoost = config_1.default.apis.elevenlabs.similarityBoost;
    }
    generateSpeech(content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Generating speech for content: ${content.id}`);
                const endpoint = `${this.apiUrl}/text-to-speech/${this.voiceId}`;
                const response = yield axios_1.default.post(endpoint, {
                    text: content.rawText,
                    voice_settings: {
                        stability: this.stability,
                        similarity_boost: this.similarityBoost
                    }
                }, {
                    headers: {
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg'
                    },
                    responseType: 'arraybuffer'
                });
                // Generate a unique filename
                const filename = `speech_${content.id}.mp3`;
                const outputPath = path_1.default.join(config_1.default.paths.audio, filename);
                // Save the audio file
                fs_extra_1.default.writeFileSync(outputPath, response.data);
                // Get actual audio duration in seconds
                const duration = yield this.getAudioDuration(outputPath);
                const result = {
                    path: outputPath,
                    duration: duration,
                    url: `/audio/${filename}`
                };
                logger_1.default.info(`Generated speech saved to: ${outputPath} with duration: ${duration}s`);
                return result;
            }
            catch (error) {
                logger_1.default.error(`Failed to generate speech: ${error}`);
                throw new Error(`Failed to generate speech: ${error}`);
            }
        });
    }
    /**
     * Gets the actual duration of an audio file
     * @param filePath Path to the audio file
     * @returns Duration in seconds
     */
    getAudioDuration(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const duration = yield (0, get_audio_duration_1.getAudioDurationInSeconds)(filePath);
                return Math.ceil(duration); // Round up to nearest second
            }
            catch (error) {
                logger_1.default.warn(`Could not get exact audio duration: ${error}, using estimation`);
                // Fallback to file size estimation (very rough)
                const stats = fs_extra_1.default.statSync(filePath);
                const fileSizeInBytes = stats.size;
                // Very rough estimate: ~16KB per second for MP3 at standard quality
                return Math.ceil(fileSizeInBytes / (16 * 1024));
            }
        });
    }
}
exports.VoiceService = VoiceService;
