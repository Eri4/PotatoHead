import axios from 'axios';
import {NewsItem} from '../types';
import config from '../config/config';
import logger from '../utils/logger';
import {saveJsonToFile, generateId} from '../utils/fileManager';

export class NewsService {
    private readonly apiKey: string;
    private readonly apiUrl: string;
    private readonly itemsPerFetch: number;

    constructor() {
        this.apiKey = config.apis.news.key || '';
        this.apiUrl = config.apis.news.url;
        this.itemsPerFetch = config.apis.news.itemsPerFetch;
    }

    /**
     * Fetch weird/mysterious news stories with improved categorization
     */
    async fetchWeirdNews(): Promise<NewsItem[]> {
        try {
            logger.info('Fetching weird and mysterious news...');

            // Structured keywords for better categorization
            const queries = [
                // Weird phenomena and discoveries
                'unexplained OR mysterious phenomenon',
                'bizarre OR strange discovery',
                'unusual creature OR animal sighting',

                // Mysteries
                'unsolved mystery OR unexplained disappearance',
                'archaeological discovery OR ancient mystery',
                'cryptid OR bigfoot OR "loch ness"',

                // Weird science
                'scientists baffled OR puzzled',
                'quantum physics strange OR weird',
                'unexplained scientific finding',

                // Cultural curiosities
                'strange tradition OR ritual OR festival',
                'bizarre law OR rule OR ordinance',
                'unusual historical fact OR discovery',

                // Added: Simulation Theory and Reality Glitches
                'simulation theory OR matrix reality',
                'glitch in reality OR matrix glitch',
                'mandela effect OR parallel universe',
                'time slip OR time anomaly',
                'reality shift OR dimension jump'
            ];

            // Random selection of 3 queries to diversify results across runs
            const shuffledQueries = this.shuffleArray([...queries]);
            const selectedQueries = shuffledQueries.slice(0, 3);
            const query = selectedQueries.join(' OR ');

            logger.info(`Using query: ${query}`);

            const endpoint = `${this.apiUrl}/everything`;
            const params = {
                apiKey: this.apiKey,
                q: query,
                language: 'en',
                sortBy: 'relevancy', // Switch to relevancy for better results
                pageSize: this.itemsPerFetch * 2 // Get more to filter down
            };

            const response = await axios.get(endpoint, {params});

            if (!response.data.articles || !Array.isArray(response.data.articles)) {
                throw new Error('Invalid response format from News API');
            }

            // Filter out articles with specific negative patterns
            const filteredArticles = response.data.articles.filter((article: { title: any; description: any; content: any; }) => {
                const title = (article.title || '').toLowerCase();
                const description = (article.description || '').toLowerCase();
                const content = (article.content || '').toLowerCase();
                const fullText = `${title} ${description} ${content}`;

                // Filter out common news items we don't want
                const negativePatterns = [
                    'rape', 'assault', 'abuse',
                    'racist', 'racism', 'nazi',
                    'suicide', 'tragedy', 'tragic',
                    'terrorist', 'terrorism'
                ];

                // Basic sentiment analysis - filter out negative content
                const negativeEmotionWords = [
                    'awful', 'heartbreaking', 'distressing',
                    'grim', 'gruesome', 'violent',
                    'miserable', 'suffering', 'painful', 'mourning'
                ];

                // Check for negative patterns
                if (negativePatterns.some(pattern => fullText.includes(pattern))) {
                    return false;
                }

                // Check for negative emotion words (basic sentiment)
                if (negativeEmotionWords.some(word => fullText.includes(word))) {
                    return false;
                }

                return true;
            });

            // Quality check - prefer articles with actual content
            const rankedArticles = filteredArticles
                .filter((article: { content: any; description: any; }) => (article.content || article.description || '').length > 100)
                .sort((a: any, b: any) => {
                    // Rank articles by their weirdness score
                    const scoreA = this.calculateWeirdnessScore(a);
                    const scoreB = this.calculateWeirdnessScore(b);
                    return scoreB - scoreA;
                });

            // Take top articles up to requested count
            const topArticles = rankedArticles.slice(0, this.itemsPerFetch);

            // Convert to NewsItem format and clean content
            const newsItems: NewsItem[] = topArticles.map((article: any) => {
                let cleanedContent = article.content || article.description || 'No content available';

                // Clean publisher-specific phrases
                cleanedContent = this.cleanContent(cleanedContent);

                return {
                    id: generateId(),
                    title: article.title || 'No title available',
                    source: article.source?.name || 'Unknown Source',
                    category: this.determineCategory(article),
                    content: cleanedContent,
                    url: article.url || '',
                    publishedAt: new Date(article.publishedAt || Date.now())
                };
            });

            // Save each news item
            newsItems.forEach(item => {
                const filename = `news_${item.id}.json`;
                saveJsonToFile(item, config.paths.news, filename);
            });

            logger.info(`Fetched ${newsItems.length} weird/mysterious news items`);
            return newsItems;
        } catch (error) {
            logger.error(`Failed to fetch weird news: ${error}`);
            throw new Error(`Failed to fetch weird news: ${error}`);
        }
    }

    /**
     * Clean content by removing publisher-specific phrases
     */
    private cleanContent(content: string): string {
        if (!content) return content;

        const phrasesToRemove = [
            // Common subscription phrases
            /subscribe to our newsletter/i,
            /subscribe for more/i,
            /sign up for our newsletter/i,

            // Read more patterns
            /read more at .+$/i,
            /click here to read more/i,
            /continue reading at/i,
            /for more information, visit/i,

            // Character limits
            /\[\+\d+ chars\]/i,
            /\[\+\d+ more characters\]/i,
            /\.\.\. read more/i,

            // Ads and promotions
            /advertisement/i,
            /sponsored content/i,
            /follow us on (twitter|facebook|instagram)/i,

            // Publication dates
            /published: .+$/i,
            /updated: .+$/i
        ];

        let cleanedContent = content;
        phrasesToRemove.forEach(phrase => {
            cleanedContent = cleanedContent.replace(phrase, '');
        });

        // Trim extra whitespace
        cleanedContent = cleanedContent.trim().replace(/\s+/g, ' ');

        return cleanedContent;
    }

    /**
     * Backup method using category-based approach
     */
    async fetchCategoryBasedWeirdNews(): Promise<NewsItem[]> {
        try {
            logger.info('Fetching weird news by category...');

            // Categories that might contain unusual stories
            const categories = ['science', 'technology', 'entertainment', 'health'];
            let allArticles: any[] = [];

            // Fetch from multiple categories
            for (const category of categories) {
                const endpoint = `${this.apiUrl}/top-headlines`;
                const params = {
                    apiKey: this.apiKey,
                    category: category,
                    language: 'en',
                    pageSize: Math.ceil(this.itemsPerFetch / categories.length) * 2
                };

                try {
                    const response = await axios.get(endpoint, {params});
                    if (response.data.articles && Array.isArray(response.data.articles)) {
                        allArticles = allArticles.concat(response.data.articles);
                    }
                } catch (categoryError) {
                    logger.warn(`Failed to fetch ${category} news: ${categoryError}`);
                }
            }

            // Score and filter articles for weirdness
            const scoredArticles = allArticles.map(article => ({
                article,
                score: this.calculateWeirdnessScore(article)
            }));

            // Sort by weirdness score and take top results
            const topWeirdArticles = scoredArticles
                .sort((a, b) => b.score - a.score)
                .slice(0, this.itemsPerFetch)
                .map(item => item.article);

            // Convert to NewsItem format and clean content
            const newsItems: NewsItem[] = topWeirdArticles.map((article: any) => {
                let cleanedContent = article.content || article.description || 'No content available';

                // Clean publisher-specific phrases
                cleanedContent = this.cleanContent(cleanedContent);

                return {
                    id: generateId(),
                    title: article.title || 'No title available',
                    source: article.source?.name || 'Unknown Source',
                    category: this.determineCategory(article),
                    content: cleanedContent,
                    url: article.url || '',
                    publishedAt: new Date(article.publishedAt || Date.now())
                };
            });

            // Filter out negative content
            const positiveNewsItems = newsItems.filter(item => {
                const fullText = `${item.title} ${item.content}`.toLowerCase();

                // Basic negative content check
                const negativeEmotionWords = [
                    'awful', 'heartbreaking', 'distressing',
                    'grim', 'gruesome', 'violent'
                ];

                return !negativeEmotionWords.some(word => fullText.includes(word));
            });

            // Save each news item
            positiveNewsItems.forEach(item => {
                const filename = `news_${item.id}.json`;
                saveJsonToFile(item, config.paths.news, filename);
            });

            logger.info(`Fetched ${positiveNewsItems.length} category-based weird news items`);
            return positiveNewsItems;
        } catch (error) {
            logger.error(`Failed to fetch category-based weird news: ${error}`);
            throw new Error(`Failed to fetch category-based weird news: ${error}`);
        }
    }

    /**
     * Fetch news with fallback methods
     */
    async fetchNews(): Promise<NewsItem[]> {
        try {
            // Try primary method first
            const weirdNews = await this.fetchWeirdNews();

            // If we got enough items, return them
            if (weirdNews.length >= this.itemsPerFetch / 2) {
                return weirdNews;
            }

            // Try backup method
            logger.info('Not enough weird news found, trying backup method');
            const backupNews = await this.fetchCategoryBasedWeirdNews();

            // Combine unique results from both methods
            const combinedNews = [...weirdNews];
            const existingIds = new Set(weirdNews.map(item => item.url));

            for (const item of backupNews) {
                if (!existingIds.has(item.url)) {
                    combinedNews.push(item);
                    existingIds.add(item.url);

                    // Stop once we have enough items
                    if (combinedNews.length >= this.itemsPerFetch) {
                        break;
                    }
                }
            }

            return combinedNews;
        } catch (error) {
            logger.error(`All news fetching methods failed: ${error}`);
            throw new Error(`Failed to fetch news: ${error}`);
        }
    }

    /**
     * Calculate a "weirdness score" for an article
     */
    private calculateWeirdnessScore(article: any): number {
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const content = (article.content || '').toLowerCase();
        const fullText = `${title} ${description} ${content}`;

        let score = 0;

        // Keywords that indicate potentially weird/mysterious content
        const weirdKeywords = [
            // Original keywords
            { word: 'unexplained', weight: 10 },
            { word: 'mysterious', weight: 9 },
            { word: 'bizarre', weight: 8 },
            { word: 'strange', weight: 7 },
            { word: 'unusual', weight: 6 },
            { word: 'weird', weight: 8 },
            { word: 'odd', weight: 5 },
            { word: 'peculiar', weight: 6 },
            { word: 'baffled', weight: 7 },
            { word: 'puzzled', weight: 6 },
            { word: 'mystery', weight: 9 },
            { word: 'phenomenon', weight: 8 },
            { word: 'unexplainable', weight: 10 },
            { word: 'cryptid', weight: 10 },
            { word: 'bigfoot', weight: 9 },
            { word: 'loch ness', weight: 9 },
            { word: 'alien', weight: 7 },
            { word: 'ufo', weight: 8 },
            { word: 'ghost', weight: 7 },
            { word: 'paranormal', weight: 9 },
            { word: 'ancient', weight: 6 },
            { word: 'discovery', weight: 5 },
            { word: 'archaeological', weight: 6 },
            { word: 'scientists', weight: 4 },
            { word: 'researchers', weight: 3 },
            { word: 'experts', weight: 3 },

            // Added: Simulation theory and reality glitches
            { word: 'simulation', weight: 8 },
            { word: 'matrix', weight: 7 },
            { word: 'glitch', weight: 9 },
            { word: 'mandela effect', weight: 10 },
            { word: 'parallel universe', weight: 9 },
            { word: 'parallel world', weight: 9 },
            { word: 'alternate reality', weight: 8 },
            { word: 'dimension', weight: 7 },
            { word: 'time slip', weight: 9 },
            { word: 'deja vu', weight: 7 },
            { word: 'coincidence', weight: 5 },
            { word: 'synchronicity', weight: 8 },
            { word: 'reality shift', weight: 9 },
            { word: 'reality glitch', weight: 10 },
            { word: 'quantum', weight: 6 },
            { word: 'multiverse', weight: 8 },
            { word: 'consciousness', weight: 5 },
            { word: 'universe', weight: 4 }
        ];

        // Add to score based on keyword matches
        weirdKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword.word}\\b`, 'gi');
            const matches = fullText.match(regex);
            if (matches) {
                score += matches.length * keyword.weight;
            }
        });

        // Bonus for question marks in title (indicates mystery)
        if (title.includes('?')) {
            score += 10;
        }

        // Bonus for quotation marks (often indicates unusual claims)
        const quotationMatches = fullText.match(/"/g);
        if (quotationMatches) {
            score += quotationMatches.length * 2;
        }

        return score;
    }

    /**
     * Determine the most appropriate category for an article
     */
    private determineCategory(article: any): string {
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const content = (article.content || '').toLowerCase();
        const fullText = `${title} ${description} ${content}`;

        // Category detection patterns
        const categories = [
            { name: 'mystery', patterns: ['mystery', 'mysterious', 'unexplained', 'vanished', 'disappeared', 'unsolved'] },
            { name: 'weird-science', patterns: ['scientists', 'research', 'study', 'discovery', 'quantum', 'physics'] },
            { name: 'cryptid', patterns: ['cryptid', 'bigfoot', 'sasquatch', 'loch ness', 'creature', 'monster', 'sighting'] },
            { name: 'paranormal', patterns: ['ghost', 'paranormal', 'supernatural', 'haunted', 'spirit', 'apparition'] },
            { name: 'archaeology', patterns: ['ancient', 'archaeological', 'artifact', 'fossil', 'tomb', 'ruins'] },
            { name: 'bizarre', patterns: ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar'] },
            // Added: New categories
            { name: 'simulation', patterns: ['simulation', 'matrix', 'glitch', 'reality', 'mandela effect', 'parallel universe'] },
            { name: 'coincidence', patterns: ['coincidence', 'synchronicity', 'chance', 'probability', 'unlikely'] }
        ];

        // Check for category matches
        for (const category of categories) {
            if (category.patterns.some(pattern => fullText.includes(pattern))) {
                return category.name;
            }
        }

        // Default category
        return 'weird-news';
    }

    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    private shuffleArray<T>(array: T[]): T[] {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}