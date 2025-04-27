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
                logger_1.default.info(`Generating sarcastic content for news item: ${newsItem.id}`);
                const prompt = this.buildPrompt(newsItem);
                const response = yield this.openai.chat.completions.create({
                    model: config_1.default.apis.openai.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are PotatoHead, a sarcastic entertainment news announcer. 
Your tone is dry, witty, and slightly cynical. 
You find most celebrity news stories to be predictable or absurd, and you're not afraid to point that out.
Keep your commentary concise and clear - around 2-3 sentences per news item.
Occasionally throw in puns or references.
Try to mimic the style of the youtuber Internet Historian but do not mention him.
Never break character.
Use terminology like "folks", "ladies and gentlemen", "in breaking news", etc. to sound like a news announcer.
Include a call to action at the end of EVERY report, telling viewers to like, subscribe, or follow.
Always end with a sarcastic sign-off phrase like "Back to you in the studio, if anyone's still watching" or "This has been PotatoHead, wasting your time as usual."`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.8,
                    max_tokens: 250
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
        return `Create a sarcastic news announcement for the following entertainment news item:
    
HEADLINE: ${newsItem.title}
SOURCE: ${newsItem.source}
CONTENT: ${newsItem.content}
    
Respond as PotatoHead the sarcastic news announcer. Don't repeat the headline verbatim, but create an entertaining announcement about this news. Remember to include a call to action at the end telling viewers to like and subscribe.`;
    }
    analyzeSentiment(text) {
        // This is a simple heuristic; in a production system you might use
        // a more sophisticated sentiment analysis approach
        const lowerText = text.toLowerCase();
        // Check for sarcasm indicators
        const sarcasmIndicators = ['obviously', 'shocking', 'surprise', 'wow', 'who knew', 'unbelievable', 'shocking news'];
        if (sarcasmIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'sarcastic';
        }
        // Count positive and negative words
        const positiveWords = ['great', 'good', 'wonderful', 'excellent', 'amazing', 'fantastic'];
        const negativeWords = ['bad', 'terrible', 'awful', 'disappointing', 'sad', 'unfortunate'];
        let positiveCount = 0;
        let negativeCount = 0;
        positiveWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches)
                positiveCount += matches.length;
        });
        negativeWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches)
                negativeCount += matches.length;
        });
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
}
exports.AIService = AIService;
