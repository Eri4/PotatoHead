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
        this.category = config_1.default.apis.news.category;
        this.itemsPerFetch = config_1.default.apis.news.itemsPerFetch;
    }
    fetchEntertainmentNews() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Fetching ${this.category} news...`);
                const endpoint = `${this.apiUrl}/top-headlines`;
                const params = {
                    apiKey: this.apiKey,
                    country: 'us', // Could be made configurable
                    category: this.category,
                    pageSize: this.itemsPerFetch
                };
                const response = yield axios_1.default.get(endpoint, { params });
                if (!response.data.articles || !Array.isArray(response.data.articles)) {
                    throw new Error('Invalid response format from News API');
                }
                const newsItems = response.data.articles.map((article) => {
                    var _a;
                    return ({
                        id: (0, fileManager_1.generateId)(),
                        title: article.title || 'No title available',
                        source: ((_a = article.source) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Source',
                        category: this.category,
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
                logger_1.default.info(`Fetched ${newsItems.length} news items`);
                return newsItems;
            }
            catch (error) {
                logger_1.default.error(`Failed to fetch news: ${error}`);
                throw new Error(`Failed to fetch news: ${error}`);
            }
        });
    }
    // You can add more methods here like:
    // fetchSportsNews(), fetchGeneralNews(), etc.
    fetchNewsByKeywords(keywords) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Fetching news with keywords: ${keywords.join(', ')}...`);
                const endpoint = `${this.apiUrl}/everything`;
                const params = {
                    apiKey: this.apiKey,
                    q: keywords.join(' OR '),
                    language: 'en',
                    sortBy: 'publishedAt',
                    pageSize: this.itemsPerFetch
                };
                const response = yield axios_1.default.get(endpoint, { params });
                if (!response.data.articles || !Array.isArray(response.data.articles)) {
                    throw new Error('Invalid response format from News API');
                }
                const newsItems = response.data.articles.map((article) => {
                    var _a;
                    return ({
                        id: (0, fileManager_1.generateId)(),
                        title: article.title || 'No title available',
                        source: ((_a = article.source) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Source',
                        category: 'keyword-search',
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
                logger_1.default.info(`Fetched ${newsItems.length} news items`);
                return newsItems;
            }
            catch (error) {
                logger_1.default.error(`Failed to fetch news by keywords: ${error}`);
                throw new Error(`Failed to fetch news by keywords: ${error}`);
            }
        });
    }
}
exports.NewsService = NewsService;
