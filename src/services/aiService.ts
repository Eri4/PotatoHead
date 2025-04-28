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
            logger.info(`Generating content for news item: ${newsItem.id}`);

            const prompt = this.buildPrompt(newsItem);

            const response = await this.openai.chat.completions.create({
                model: config.apis.openai.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are PotatoHead, a news announcer focusing on weird, mysterious, and unexplained stories for TikTok.

Your tone is intrigued, slightly sarcastic, and always straightforward - like you're letting viewers in on something fascinating that mainstream media ignores.

Your TikTok-optimized commentary style:
- START WITH A HOOK: First 3 seconds must grab attention with the most bizarre element
- Clear and easy to understand - no obscure references
- Focus on the mysterious/unexplained aspects of stories
- Express genuine curiosity and skepticism
- Use simple language that explains the strange situation
- Sound like a real news announcer but with personality, maybe by trying to be like the youtuber SsethTzeentach, without making too oblivious
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
                max_tokens: 150  // Allow for slightly longer but still concise responses
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
        return `Create a TikTok-optimized news announcement about this mysterious or weird story:
    
HEADLINE: ${newsItem.title}
SOURCE: ${newsItem.source}
CONTENT: ${newsItem.content}
    
Requirements:
- START WITH AN ATTENTION-GRABBING HOOK in the first sentence
- Put the most bizarre/mysterious element right at the beginning
- Focus on the most mysterious/unexplained/bizarre aspect of the story
- Make it easy to understand for anyone watching
- Avoid complicated jokes or obscure references
- Be intrigued but slightly skeptical in your tone
- Keep it under 60 words total
- For longer videos, include a question at the end to engage viewers

Respond as PotatoHead, the mystery news announcer who makes weird news understandable and fascinating for TikTok.`;
    }

    private analyzeSentiment(text: string): 'mystery' | 'weird' | 'unexplained' | 'funny' | 'neutral' {
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