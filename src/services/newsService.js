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
exports.NewsService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const fileManager_1 = require("../utils/fileManager");
class NewsService {
    constructor() {
        this.apiKey = config_1.default.apis.news.key || '';
        this.apiUrl = config_1.default.apis.news.url;
        this.itemsPerFetch = config_1.default.apis.news.itemsPerFetch;
    }
    /**
     * Fetch weird/mysterious news stories with improved categorization
     */
    fetchWeirdNews() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info('Fetching weird and mysterious news...');
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
                    'unusual historical fact OR discovery'
                ];
                // Random selection of 3 queries to diversify results across runs
                const shuffledQueries = this.shuffleArray([...queries]);
                const selectedQueries = shuffledQueries.slice(0, 3);
                const query = selectedQueries.join(' OR ');
                logger_1.default.info(`Using query: ${query}`);
                const endpoint = `${this.apiUrl}/everything`;
                const params = {
                    apiKey: this.apiKey,
                    q: query,
                    language: 'en',
                    sortBy: 'relevancy', // Switch to relevancy for better results
                    pageSize: this.itemsPerFetch * 2 // Get more to filter down
                };
                const response = yield axios_1.default.get(endpoint, { params });
                if (!response.data.articles || !Array.isArray(response.data.articles)) {
                    throw new Error('Invalid response format from News API');
                }
                // Filter out articles with specific negative patterns
                const filteredArticles = response.data.articles.filter((article) => {
                    const title = (article.title || '').toLowerCase();
                    const description = (article.description || '').toLowerCase();
                    // Filter out common news items we don't want
                    const negativePatterns = [
                        'covid', 'virus', 'pandemic',
                        'trump', 'biden', 'congress',
                        'stock market', 'economy', 'inflation',
                        'gun', 'shooting', 'killed',
                        'died', 'death', 'murder',
                        'rape', 'assault', 'abuse',
                        'disaster', 'hurricane', 'tornado', 'earthquake',
                        'racist', 'racism', 'nazi',
                        'sports', 'football', 'basketball', 'soccer'
                    ];
                    return !negativePatterns.some(pattern => title.includes(pattern) || description.includes(pattern));
                });
                // Quality check - prefer articles with actual content
                const rankedArticles = filteredArticles
                    .filter((article) => (article.content || article.description || '').length > 100)
                    .sort((a, b) => {
                    // Rank articles by their weirdness score
                    const scoreA = this.calculateWeirdnessScore(a);
                    const scoreB = this.calculateWeirdnessScore(b);
                    return scoreB - scoreA;
                });
                // Take top articles up to requested count
                const topArticles = rankedArticles.slice(0, this.itemsPerFetch);
                // Convert to NewsItem format
                const newsItems = topArticles.map((article) => {
                    var _a;
                    return ({
                        id: (0, fileManager_1.generateId)(),
                        title: article.title || 'No title available',
                        source: ((_a = article.source) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Source',
                        category: this.determineCategory(article),
                        content: article.content || article.description || 'No content available',
                        url: article.url || '',
                        publishedAt: new Date(article.publishedAt || Date.now())
                    });
                });
                // Save each news item
                newsItems.forEach(item => {
                    const filename = `news_${item.id}.json`;
                    (0, fileManager_1.saveJsonToFile)(item, config_1.default.paths.news, filename);
                });
                logger_1.default.info(`Fetched ${newsItems.length} weird/mysterious news items`);
                return newsItems;
            }
            catch (error) {
                logger_1.default.error(`Failed to fetch weird news: ${error}`);
                throw new Error(`Failed to fetch weird news: ${error}`);
            }
        });
    }
    /**
     * Backup method using category-based approach
     */
    fetchCategoryBasedWeirdNews() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info('Fetching weird news by category...');
                // Categories that might contain unusual stories
                const categories = ['science', 'technology', 'entertainment', 'health'];
                let allArticles = [];
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
                        const response = yield axios_1.default.get(endpoint, { params });
                        if (response.data.articles && Array.isArray(response.data.articles)) {
                            allArticles = allArticles.concat(response.data.articles);
                        }
                    }
                    catch (categoryError) {
                        logger_1.default.warn(`Failed to fetch ${category} news: ${categoryError}`);
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
                // Convert to NewsItem format
                const newsItems = topWeirdArticles.map((article) => {
                    var _a;
                    return ({
                        id: (0, fileManager_1.generateId)(),
                        title: article.title || 'No title available',
                        source: ((_a = article.source) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Source',
                        category: this.determineCategory(article),
                        content: article.content || article.description || 'No content available',
                        url: article.url || '',
                        publishedAt: new Date(article.publishedAt || Date.now())
                    });
                });
                // Save each news item
                newsItems.forEach(item => {
                    const filename = `news_${item.id}.json`;
                    (0, fileManager_1.saveJsonToFile)(item, config_1.default.paths.news, filename);
                });
                logger_1.default.info(`Fetched ${newsItems.length} category-based weird news items`);
                return newsItems;
            }
            catch (error) {
                logger_1.default.error(`Failed to fetch category-based weird news: ${error}`);
                throw new Error(`Failed to fetch category-based weird news: ${error}`);
            }
        });
    }
    /**
     * Fetch news with fallback methods
     */
    fetchNews() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try primary method first
                const weirdNews = yield this.fetchWeirdNews();
                // If we got enough items, return them
                if (weirdNews.length >= this.itemsPerFetch / 2) {
                    return weirdNews;
                }
                // Try backup method
                logger_1.default.info('Not enough weird news found, trying backup method');
                const backupNews = yield this.fetchCategoryBasedWeirdNews();
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
            }
            catch (error) {
                logger_1.default.error(`All news fetching methods failed: ${error}`);
                throw new Error(`Failed to fetch news: ${error}`);
            }
        });
    }
    /**
     * Calculate a "weirdness score" for an article
     */
    calculateWeirdnessScore(article) {
        const title = (article.title || '').toLowerCase();
        const description = (article.description || '').toLowerCase();
        const content = (article.content || '').toLowerCase();
        const fullText = `${title} ${description} ${content}`;
        let score = 0;
        // Keywords that indicate potentially weird/mysterious content
        const weirdKeywords = [
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
            { word: 'experts', weight: 3 }
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
    determineCategory(article) {
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
            { name: 'bizarre', patterns: ['bizarre', 'strange', 'unusual', 'weird', 'odd', 'peculiar'] }
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
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}
exports.NewsService = NewsService;
