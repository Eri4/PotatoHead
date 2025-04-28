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
exports.AIService = void 0;
const openai_1 = require("openai");
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const fileManager_1 = require("../utils/fileManager");
class AIService {
    constructor() {
        this.openai = new openai_1.OpenAI({
            apiKey: config_1.default.apis.openai.key
        });
    }
    generateSarcasticContent(newsItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Generating content for news item: ${newsItem.id}`);
                const prompt = this.buildPrompt(newsItem);
                const response = yield this.openai.chat.completions.create({
                    model: config_1.default.apis.openai.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are PotatoHead, a news announcer focusing on weird, mysterious, and unexplained stories.

Your tone is intrigued, slightly sarcastic, and always straightforward - like you're letting viewers in on something fascinating that mainstream media ignores.

Your commentary style:
- Clear and easy to understand - no obscure references
- Focus on the mysterious/unexplained aspects of stories
- Express genuine curiosity and skepticism
- Use simple language that explains the strange situation
- Sound like a real news announcer but with personality
- Include one thoughtful question to make viewers think

Keep your commentary under 60 words and focus on making the weird elements clear and compelling.
For videos under 15 seconds: Just focus on the strangest element without any intro.
For longer videos: Include "This is PotatoHead with Mysterious News" at the beginning and end with "What do YOU think happened?" or similar engaging question.`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7, // Balanced between creativity and coherence
                    max_tokens: 150 // Allow for slightly longer but still concise responses
                });
                const rawText = response.choices[0].message.content || '';
                const content = {
                    id: (0, fileManager_1.generateId)(),
                    newsItemId: newsItem.id,
                    rawText,
                    sentiment: this.analyzeSentiment(rawText),
                    createdAt: new Date()
                };
                // Save the generated content
                const filename = `content_${content.id}.json`;
                (0, fileManager_1.saveJsonToFile)(content, config_1.default.paths.content, filename);
                logger_1.default.info(`Generated content with ID: ${content.id}`);
                return content;
            }
            catch (error) {
                logger_1.default.error(`Failed to generate content: ${error}`);
                throw new Error(`Failed to generate content: ${error}`);
            }
        });
    }
    buildPrompt(newsItem) {
        return `Create a clear, engaging news announcement about this mysterious or weird story:
    
HEADLINE: ${newsItem.title}
SOURCE: ${newsItem.source}
CONTENT: ${newsItem.content}
    
Requirements:
- Focus on the most mysterious/unexplained/bizarre aspect of the story
- Make it easy to understand for anyone watching
- Avoid complicated jokes or obscure references
- Be intrigued but slightly skeptical in your tone
- Keep it under 60 words total
- For longer videos, include a question at the end to engage viewers

Respond as PotatoHead, the mystery news announcer who makes weird news understandable and fascinating.`;
    }
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();
        // Check for mystery indicators
        const mysteryIndicators = ['mystery', 'mysterious', 'unexplained', 'vanished', 'disappeared', 'unsolved', 'puzzle'];
        if (mysteryIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'mystery';
        }
        // Check for weird indicators
        const weirdIndicators = ['weird', 'strange', 'bizarre', 'odd', 'unusual', 'peculiar', 'inexplicable'];
        if (weirdIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'weird';
        }
        // Check for unexplained indicators
        const unexplainedIndicators = ['scientists baffled', 'experts confused', 'no explanation', 'phenomenon', 'supernatural'];
        if (unexplainedIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'unexplained';
        }
        // Check for funny indicators
        const funnyIndicators = ['funny', 'hilarious', 'laugh', 'comedy', 'ridiculous'];
        if (funnyIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'funny';
        }
        return 'neutral';
    }
}
exports.AIService = AIService;
