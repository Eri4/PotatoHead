import { OpenAI } from 'openai';
import { NewsItem, GeneratedContent } from '../types';
import config from '../config/config';
import logger from '../utils/logger';
import { saveJsonToFile, generateId } from '../utils/fileManager';

export class AIService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: config.apis.openai.key
        });
    }

    async generateSarcasticContent(newsItem: NewsItem): Promise<GeneratedContent> {
        try {
            logger.info(`Generating sarcastic content for news item: ${newsItem.id}`);

            const prompt = this.buildPrompt(newsItem);

            const response = await this.openai.chat.completions.create({
                model: config.apis.openai.model,
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

            const content: GeneratedContent = {
                id: generateId(),
                newsItemId: newsItem.id,
                rawText,
                sentiment: this.analyzeSentiment(rawText),
                createdAt: new Date()
            };

            // Save the generated content
            const filename = `content_${content.id}.json`;
            saveJsonToFile(content, config.paths.content, filename);

            logger.info(`Generated content with ID: ${content.id}`);
            return content;
        } catch (error) {
            logger.error(`Failed to generate content: ${error}`);
            throw new Error(`Failed to generate content: ${error}`);
        }
    }

    private buildPrompt(newsItem: NewsItem): string {
        return `Create a sarcastic news announcement for the following entertainment news item:
    
HEADLINE: ${newsItem.title}
SOURCE: ${newsItem.source}
CONTENT: ${newsItem.content}
    
Respond as PotatoHead the sarcastic news announcer. Don't repeat the headline verbatim, but create an entertaining announcement about this news. Remember to include a call to action at the end telling viewers to like and subscribe.`;
    }

    private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'sarcastic' {
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
            if (matches) positiveCount += matches.length;
        });

        negativeWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) negativeCount += matches.length;
        });

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }
}