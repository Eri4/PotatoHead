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
exports.VideoService = void 0;
const videoProcessor_1 = require("../animation/videoProcessor");
const logger_1 = __importDefault(require("../utils/logger"));
class VideoService {
    constructor() {
        this.videoProcessor = new videoProcessor_1.VideoProcessor();
    }
    createVideoForContent(content, audioResult) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Creating video for content: ${content.id}`);
                // 1. Generate animation frames based on audio
                const frameSequence = yield this.videoProcessor.generateFrameSequence(audioResult.duration, audioResult.path);
                // 2. Combine frames and audio into video
                const videoResult = yield this.videoProcessor.createVideo(frameSequence.directory, audioResult.path, audioResult.duration);
                logger_1.default.info(`Video created successfully: ${videoResult.path}`);
                return videoResult;
            }
            catch (error) {
                logger_1.default.error(`Failed to create video for content: ${error}`);
                throw new Error(`Failed to create video for content: ${error}`);
            }
        });
    }
}
exports.VideoService = VideoService;
