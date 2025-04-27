import axios from 'axios';
import path from 'path';
import { NewsItem } from '../types';
import config from '../config/config';
import logger from '../utils/logger';
import { saveJsonToFile, generateId } from '../utils/fileManager';

export class NewsService {
    private apiKey: string;
    private apiUrl: string;
    private category: string;
    private itemsPerFetch: number;

    constructor() {
        this.apiKey = config.apis.news.key || '';
        this.apiUrl = config.apis.news.url;
        this.category = config.apis.news.category;
        this.itemsPerFetch = config.apis.news.itemsPerFetch;
    }

    async fetchEntertainmentNews(): Promise<NewsItem[]> {
        try {
            logger.info(`Fetching ${this.category} news...`);

            const endpoint = `${this.apiUrl}/top-headlines`;
            const params = {
                apiKey: this.apiKey,
                country: 'us', // Could be made configurable
                category: this.category,
                pageSize: this.itemsPerFetch
            };

            const response = await axios.get(endpoint, { params });

            if (!response.data.articles || !Array.isArray(response.data.articles)) {
                throw new Error('Invalid response format from News API');
            }

            const newsItems: NewsItem[] = response.data.articles.map((article: any) => ({
                id: generateId(),
                title: article.title || 'No title available',
                source: article.source?.name || 'Unknown Source',
                category: this.category,
                content: article.content || article.description || 'No content available',
                url: article.url || '',
                publishedAt: new Date(article.publishedAt || Date.now())
            }));

            // Save each news item
            newsItems.forEach(item => {
                const filename = `news_${item.id}.json`;
                saveJsonToFile(item, config.paths.news, filename);
            });

            logger.info(`Fetched ${newsItems.length} news items`);
            return newsItems;
        } catch (error) {
            logger.error(`Failed to fetch news: ${error}`);
            throw new Error(`Failed to fetch news: ${error}`);
        }
    }

    // You can add more methods here like:
    // fetchSportsNews(), fetchGeneralNews(), etc.

    async fetchNewsByKeywords(keywords: string[]): Promise<NewsItem[]> {
        try {
            logger.info(`Fetching news with keywords: ${keywords.join(', ')}...`);

            const endpoint = `${this.apiUrl}/everything`;
            const params = {
                apiKey: this.apiKey,
                q: keywords.join(' OR '),
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: this.itemsPerFetch
            };

            const response = await axios.get(endpoint, { params });

            if (!response.data.articles || !Array.isArray(response.data.articles)) {
                throw new Error('Invalid response format from News API');
            }

            const newsItems: NewsItem[] = response.data.articles.map((article: any) => ({
                id: generateId(),
                title: article.title || 'No title available',
                source: article.source?.name || 'Unknown Source',
                category: 'keyword-search',
                content: article.content || article.description || 'No content available',
                url: article.url || '',
                publishedAt: new Date(article.publishedAt || Date.now())
            }));

            // Save each news item
            newsItems.forEach(item => {
                const filename = `news_${item.id}.json`;
                saveJsonToFile(item, config.paths.news, filename);
            });

            logger.info(`Fetched ${newsItems.length} news items`);
            return newsItems;
        } catch (error) {
            logger.error(`Failed to fetch news by keywords: ${error}`);
            throw new Error(`Failed to fetch news by keywords: ${error}`);
        }
    }
}