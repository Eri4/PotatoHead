import { getAudioDurationInSeconds } from 'get-audio-duration';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { GeneratedContent, AudioResult } from '../types';
import config from '../config/config';
import logger from '../utils/logger';
import { generateId } from '../utils/fileManager';

export class VoiceService {
    private apiKey: string;
    private apiUrl: string;
    private voiceId: string;
    private stability: number;
    private similarityBoost: number;

    constructor() {
        this.apiKey = config.apis.elevenlabs.key as string;
        this.apiUrl = config.apis.elevenlabs.url;
        this.voiceId = config.apis.elevenlabs.voiceId as string;
        this.stability = config.apis.elevenlabs.stability;
        this.similarityBoost = config.apis.elevenlabs.similarityBoost;
    }

    async generateSpeech(content: GeneratedContent): Promise<AudioResult> {
        try {
            logger.info(`Generating speech for content: ${content.id}`);

            const endpoint = `${this.apiUrl}/text-to-speech/${this.voiceId}`;

            const response = await axios.post(
                endpoint,
                {
                    text: content.rawText,
                    voice_settings: {
                        stability: this.stability,
                        similarity_boost: this.similarityBoost
                    }
                },
                {
                    headers: {
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg'
                    },
                    responseType: 'arraybuffer'
                }
            );

            // Generate a unique filename
            const filename = `speech_${content.id}.mp3`;
            const outputPath = path.join(config.paths.audio, filename);

            // Save the audio file
            fs.writeFileSync(outputPath, response.data);

            // Get actual audio duration in seconds
            const duration = await this.getAudioDuration(outputPath);

            const result: AudioResult = {
                path: outputPath,
                duration: duration,
                url: `/audio/${filename}`
            };

            logger.info(`Generated speech saved to: ${outputPath} with duration: ${duration}s`);
            return result;
        } catch (error) {
            logger.error(`Failed to generate speech: ${error}`);
            throw new Error(`Failed to generate speech: ${error}`);
        }
    }

    /**
     * Gets the actual duration of an audio file
     * @param filePath Path to the audio file
     * @returns Duration in seconds
     */
    private async getAudioDuration(filePath: string): Promise<number> {
        try {
            const duration = await getAudioDurationInSeconds(filePath);
            return Math.ceil(duration); // Round up to nearest second
        } catch (error) {
            logger.warn(`Could not get exact audio duration: ${error}, using estimation`);

            // Fallback to file size estimation (very rough)
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            // Very rough estimate: ~16KB per second for MP3 at standard quality
            return Math.ceil(fileSizeInBytes / (16 * 1024));
        }
    }

    // In a real implementation, you might add additional methods like:
    // - getVoices() to list available voices
    // - getCharacterCount() to check your ElevenLabs character usage
    // - adjustVoiceSettings() to experiment with different voice parameters
}