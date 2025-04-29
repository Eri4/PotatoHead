import axios from 'axios';
import {NewsItem} from '../types';
import config from '../config/config';
import logger from '../utils/logger';
import {generateId, saveJsonToFile} from '../utils/fileManager';
import Parser from "rss-parser";

export class NewsService {
    private readonly apiKey: string;
    private readonly apiUrl: string;
    private readonly itemsPerFetch: number;

    // Centralized keyword collections for reuse
    private readonly weirdKeywords = [
        {word: 'unexplained', weight: 10},
        {word: 'mysterious', weight: 9},
        {word: 'bizarre', weight: 8},
        {word: 'strange', weight: 7},
        {word: 'unusual', weight: 6},
        {word: 'weird', weight: 8},
        {word: 'odd', weight: 5},
        {word: 'peculiar', weight: 6},
        {word: 'baffled', weight: 7},
        {word: 'puzzle', weight: 6},
        {word: 'mystery', weight: 9},
        {word: 'phenomenon', weight: 8},
        {word: 'cryptid', weight: 10},
        {word: 'bigfoot', weight: 9},
        {word: 'alien', weight: 7},
        {word: 'ufo', weight: 8},
        {word: 'ghost', weight: 7},
        {word: 'paranormal', weight: 9},
        {word: 'simulation', weight: 8},
        {word: 'glitch', weight: 9},
        {word: 'mandela effect', weight: 10},
        {word: 'parallel universe', weight: 9},
        {word: 'synchronicity', weight: 8},
        {word: 'reality shift', weight: 9},
        {word: 'quantum', weight: 6},
        {word: 'multiverse', weight: 8}
    ];

    private readonly negativePatterns = [
        'rape', 'assault', 'abuse',
        'racist', 'racism', 'nazi',
        'suicide', 'tragedy', 'tragic',
        'terrorist', 'terrorism', 'heartbreaking',
        'violent', 'miserable', 'mourning'
    ];

    private readonly contentCleanupRegexes = [
        /subscribe to our newsletter/i,
        /subscribe for more/i,
        /sign up for our newsletter/i,
        /read more at .+$/i,
        /click here to read more/i,
        /continue reading at/i,
        /for more information, visit/i,
        /\[\+\d+ chars\]/i,
        /\[\+\d+ more characters\]/i,
        /\.\.\. read more/i,
        /advertisement/i,
        /sponsored content/i,
        /follow us on (twitter|facebook|instagram)/i,
        /published: .+$/i,
        /updated: .+$/i
    ];

    private readonly categories = [
        {
            name: 'mystery',
            patterns: ['mystery', 'mysterious', 'unexplained', 'vanished', 'disappeared', 'unsolved', 'enigma']
        },
        {
            name: 'weird-science',
            patterns: ['scientists', 'research', 'discovery', 'quantum', 'physics', 'breakthrough', 'experiment']
        },
        {
            name: 'cryptid',
            patterns: ['cryptid', 'bigfoot', 'sasquatch', 'loch ness', 'creature', 'monster', 'sighting', 'yeti']
        },
        {
            name: 'paranormal',
            patterns: ['ghost', 'paranormal', 'supernatural', 'haunted', 'spirit', 'apparition', 'poltergeist']
        },
        {
            name: 'archaeology',
            patterns: ['ancient', 'archaeological', 'artifact', 'fossil', 'tomb', 'ruins', 'pyramid']
        },
        {
            name: 'bizarre',
            patterns: ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar', 'outlandish']
        },
        {
            name: 'simulation',
            patterns: ['simulation', 'matrix', 'glitch', 'reality', 'mandela effect', 'parallel universe']
        },
        {
            name: 'ufo',
            patterns: ['ufo', 'alien', 'extraterrestrial', 'spacecraft', 'flying saucer', 'abduction', 'tic tac']
        },
        {
            name: 'natural-mystery',
            patterns: ['natural phenomenon', 'weather anomaly', 'atmospheric', 'unexplained natural']
        }
    ];

    constructor() {
        this.apiKey = config.apis.news.key || '';
        this.apiUrl = config.apis.news.url;
        this.itemsPerFetch = config.apis.news.itemsPerFetch;
    }

    /**
     * Main method to fetch news with fallback strategies
     */
    async fetchNews(): Promise<NewsItem[]> {
        try {
            let allNews: NewsItem[] = [];
            let newsCount = 0;

            // Strategy 1: Curated sources (RSS feeds)
            try {
                logger.info('Fetching from curated weird news sources');
                const curatedNews = await this.fetchCuratedWeirdNews();
                if (curatedNews.length > 0) {
                    allNews = [...curatedNews];
                    newsCount = curatedNews.length;
                    logger.info(`Found ${newsCount} curated news items`);
                }
            } catch (error) {
                logger.warn(`Curated news fetch failed: ${error}`);
            }

            // Strategy 2: NewsAPI keyword search
            if (newsCount < this.itemsPerFetch) {
                try {
                    logger.info('Fetching keyword-based weird news');
                    const weirdNews = await this.fetchWeirdNews();
                    allNews = [...allNews, ...weirdNews];
                    logger.info(`Found ${weirdNews.length} keyword-based news items`);
                } catch (error) {
                    logger.warn(`Keyword-based news fetch failed: ${error}`);
                }
            }

            // Process results
            const uniqueNews = this.deduplicateNews(allNews);

            // Score and sort by weirdness/interest level
            const scoredNews = uniqueNews.map(item => ({
                item,
                score: this.calculateWeirdnessScore(item)
            }));

            // Take highest scored items up to the limit
            const finalNews = scoredNews
                .sort((a, b) => b.score - a.score)
                .slice(0, this.itemsPerFetch)
                .map(scored => scored.item);

            // Save items to file system
            this.saveNewsItems(finalNews);

            logger.info(`Returning ${finalNews.length} final news items`);
            return finalNews;
        } catch (error) {
            logger.error(`All news fetching methods failed: ${error}`);
            throw new Error(`Failed to fetch news: ${error}`);
        }
    }

    /**
     * Fetch news from curated RSS feeds
     */
    async fetchCuratedWeirdNews(): Promise<NewsItem[]> {
        const parser = new Parser();

        // Prioritize US sources
        const curatedSources = [
            // US sources
            'https://www.livescience.com/feeds/all',
            'https://futurism.com/feed',
            'https://www.npr.org/rss/rss.php?id=1053',
            'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
            'https://www.scientificamerican.com/rss/blog/60-second-science/',
            'https://www.discovermagazine.com/rss/all',
            'https://www.vice.com/en/rss',
            'https://rss.csmonitor.com/feeds/science',

            // International sources
            'https://www.sciencealert.com/feed',
            'https://strangesounds.org/feed',
            'https://www.odditycentral.com/feed',
            'https://phys.org/rss-feed/space-astronomy-news/'
        ];

        let allArticles: any[] = [];

        // Fetch from sources
        for (const sourceUrl of curatedSources) {
            try {
                const feed = await parser.parseURL(sourceUrl);

                if (feed.items && feed.items.length > 0) {
                    logger.info(`Found ${feed.items.length} articles from ${sourceUrl}`);

                    // Skip articles that don't seem weird/interesting
                    const filteredItems = feed.items.filter(item => {
                        const fullText = `${item.title || ''} ${item.content || item.contentSnippet || ''}`.toLowerCase();
                        // Only keep if it contains at least one weird keyword
                        return this.weirdKeywords.some(kw => fullText.includes(kw.word));
                    });

                    logger.info(`Kept ${filteredItems.length} weird articles from ${sourceUrl}`);
                    allArticles = allArticles.concat(filteredItems);
                }
            } catch (error) {
                logger.warn(`Failed to fetch from ${sourceUrl}: ${error}`);
            }
        }

        // Try backup sources if needed
        if (allArticles.length < this.itemsPerFetch) {
            const backupSources = [
                'https://news.google.com/rss/search?q=weird+OR+mysterious+OR+strange&hl=en-US&gl=US&ceid=US:en',
                'https://rss.app/feeds/L9ieHAx70dKjQH22.xml', // Custom feed of weird news
                'https://hnrss.org/newest?q=mysterious+OR+weird+OR+unexplained'
            ];

            for (const sourceUrl of backupSources) {
                try {
                    const feed = await parser.parseURL(sourceUrl);
                    if (feed.items && feed.items.length > 0) {
                        allArticles = allArticles.concat(feed.items);
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch from backup source ${sourceUrl}`);
                }
            }
        }

        // Filter out negative content
        const filteredArticles = allArticles.filter(article => {
            const fullText = `${article.title || ''} ${article.content || article.contentSnippet || ''}`.toLowerCase();
            return !this.negativePatterns.some(pattern => fullText.includes(pattern));
        });

        // Convert to NewsItem format
        return filteredArticles.map(article => ({
            id: generateId(),
            title: article.title || 'No title',
            source: article.creator || article.author || article.source?.name || 'Unknown Source',
            category: this.determineCategory(article),
            content: this.cleanContent(article.content || article.contentSnippet || 'No content available'),
            url: article.link || '',
            publishedAt: new Date(article.pubDate || article.isoDate || Date.now())
        }));
    }

    /**
     * Fetch weird news using NewsAPI
     */
    async fetchWeirdNews(): Promise<NewsItem[]> {
        try {
            // Create a compact, focused query for weird content
            const queries = [
                'extraordinary phenomenon OR "defies explanation" OR "cannot be explained"',
                'bizarre incident OR unexplained sighting OR strange occurrence',
                '"mysterious disappearance" OR "vanished without trace" OR "no explanation"',
                '"scientific breakthrough" AND (unusual OR unexpected OR revolutionary)',
                '"strange coincidence" OR "impossible timing" OR "beyond chance"',
                '"glitch in reality" OR "matrix malfunction" OR "reality shift"',
                '"rare natural phenomenon" OR "weather anomaly" OR "atmospheric mystery"',
                '"cosmic anomaly" OR "space mystery" OR "astronomical puzzle"'
            ];

            // Select 3 random queries for variety
            const selectedQueries = this.shuffleArray(queries).slice(0, 3);
            const query = selectedQueries.join(' OR ');

            logger.info(`Using NewsAPI query: ${query}`);

            // Fetch articles
            const endpoint = `${this.apiUrl}/everything`;
            const response = await axios.get(endpoint, {
                params: {
                    apiKey: this.apiKey,
                    q: query,
                    language: 'en',
                    sortBy: 'relevancy',
                    pageSize: this.itemsPerFetch * 2
                }
            });

            if (!response.data.articles || !Array.isArray(response.data.articles)) {
                throw new Error('Invalid response format from News API');
            }

            // Filter for positive content
            const filteredArticles = response.data.articles.filter((article: {
                title: any;
                description: any;
                content: any;
            }) => {
                const title = (article.title || '').toLowerCase();
                const description = (article.description || '').toLowerCase();
                const content = (article.content || '').toLowerCase();
                const fullText = `${title} ${description} ${content}`;

                return !this.negativePatterns.some(pattern => fullText.includes(pattern));
            });

            // Convert to NewsItem format
            return filteredArticles.map((article: {
                title: any;
                source: { name: any; };
                content: any;
                description: any;
                url: any;
                publishedAt: any;
            }) => ({
                id: generateId(),
                title: article.title || 'No title available',
                source: article.source?.name || 'Unknown Source',
                category: this.determineCategory(article),
                content: this.cleanContent(article.content || article.description || 'No content available'),
                url: article.url || '',
                publishedAt: new Date(article.publishedAt || Date.now())
            }));
        } catch (error) {
            logger.error(`Failed to fetch weird news: ${error}`);
            throw error;
        }
    }

    /**
     * Save news items to file system
     */
    private saveNewsItems(items: NewsItem[]): void {
        items.forEach(item => {
            const filename = `news_${item.id}.json`;
            saveJsonToFile(item, config.paths.news, filename);
        });
    }

    /**
     * Deduplicate news items by URL or title
     */
    private deduplicateNews(items: NewsItem[]): NewsItem[] {
        const unique = new Map<string, NewsItem>();

        for (const item of items) {
            const key = item.url || item.title;
            if (!unique.has(key)) {
                unique.set(key, item);
            }
        }

        return Array.from(unique.values());
    }

    /**
     * Calculate a "weirdness score" for content
     */
    private calculateWeirdnessScore(item: NewsItem | any): number {
        // For NewsItem objects
        let title = '', content = '';

        if ('title' in item && 'content' in item) {
            // It's a NewsItem
            title = (item.title || '').toLowerCase();
            content = (item.content || '').toLowerCase();
        } else {
            // It's a raw article object
            title = (item.title || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            content = (item.content || description || '').toLowerCase();
        }

        const fullText = `${title} ${content}`;
        let score = 0;

        // Score based on weird keywords
        this.weirdKeywords.forEach(keyword => {
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

        // Bonus for titles with strong indicators of weirdness
        if (/mind(-|\s)blowing|incredible|unbelievable|impossible|never(-|\s)before(-|\s)seen/i.test(title)) {
            score += 15;
        }

        // Penalize titles that sound like regular news
        if (/stock|market|profit|quarterly|politician|announce|stated|confirmed/i.test(title)) {
            score -= 15;
        }

        // Boost for content with frequent mentions of unexplained events
        const unexplainedCount = (fullText.match(/unexplained|mysterious|bizarre|strange|unusual/gi) || []).length;
        score += unexplainedCount * 3;

        // Check for clickbait patterns that often indicate interesting content
        if (/scientists can't explain|experts baffled|defies conventional wisdom/i.test(fullText)) {
            score += 12;
        }

        return score;
    }

    /**
     * Determine the most appropriate category for content
     */
    private determineCategory(item: NewsItem | any): string {
        // For NewsItem objects
        let title: string, content = '';

        if ('title' in item && 'content' in item) {
            // It's a NewsItem
            title = (item.title || '').toLowerCase();
            content = (item.content || '').toLowerCase();
        } else {
            // It's a raw article object
            title = (item.title || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            content = (item.content || description || '').toLowerCase();
        }

        const fullText = `${title} ${content}`;

        // Check each category against the full text
        for (const category of this.categories) {
            // Calculate how many patterns match
            const matchCount = category.patterns.filter(pattern => fullText.includes(pattern)).length;

            // If more than 1 pattern matches, consider it a strong category match
            if (matchCount >= 2) {
                return category.name;
            }
        }

        // Check for single pattern matches
        for (const category of this.categories) {
            if (category.patterns.some(pattern => fullText.includes(pattern))) {
                return category.name;
            }
        }

        // Default category
        return 'weird-news';
    }

    /**
     * Clean content by removing publisher-specific phrases
     */
    private cleanContent(content: string): string {
        if (!content) return content;

        let cleanedContent = content;

        this.contentCleanupRegexes.forEach(regex => {
            cleanedContent = cleanedContent.replace(regex, '');
        });

        // Trim extra whitespace
        cleanedContent = cleanedContent.trim().replace(/\s+/g, ' ');

        return cleanedContent;
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