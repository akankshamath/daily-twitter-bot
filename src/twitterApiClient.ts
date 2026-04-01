import axios from 'axios';
import { config } from './config';
import { TwitterSignal } from './types';
import { getAllQueries } from './constants/queries';
import { calculateRelevanceScore, meetsQualityThreshold } from './services/founderIntentScoring';

const API_BASE_URL = 'https://api.twitterapi.io/twitter/tweet/advanced_search';
const REQUEST_TIMEOUT = 10000;
const RATE_LIMIT_DELAY = 1000;
const MAX_RESULTS_PER_QUERY = 20;

export interface Tweet {
  author: string;
  authorId: string;
  followers: number;
  text: string;
  timestamp: string;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
}

export interface FounderSignal extends Tweet {
  relevanceScore: number;
  productName: string;
}

interface TwitterApiResponse {
  tweets: Array<{
    type: string;
    id: string;
    text: string;
    createdAt: string;
    likeCount: number;
    retweetCount: number;
    replyCount: number;
    author: {
      userName: string;
      id: string;
      followers: number;
    };
  }>;
  has_next_page: boolean;
  next_cursor?: string;
}

/**
 * Twitter API Client for detecting early-stage founder intent
 * Uses TwitterAPI.io to search for founder signals like co-founder searches,
 * building in public updates, and early-stage milestones
 */
export class TwitterApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.apiKey = config.twitterApi.apiKey;

    if (!this.apiKey) {
      console.warn('⚠️  Twitter API key not configured. Twitter signals will be skipped.');
    }
  }

  /**
   * Search Twitter for tweets matching a specific query
   */
  async searchTweets(query: string, maxResults: number = MAX_RESULTS_PER_QUERY): Promise<Tweet[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      console.log(`  → Searching: ${query}`);

      const response = await axios.get<TwitterApiResponse>(this.baseUrl, {
        params: {
          query,
          queryType: 'Latest',
          cursor: '',
        },
        headers: {
          'X-API-Key': this.apiKey,
        },
        timeout: REQUEST_TIMEOUT,
      });

      const tweets: Tweet[] = response.data.tweets
        .slice(0, maxResults)
        .map((tweet) => ({
          author: tweet.author.userName,
          authorId: tweet.author.id,
          followers: tweet.author.followers,
          text: tweet.text,
          timestamp: tweet.createdAt,
          likes: tweet.likeCount,
          retweets: tweet.retweetCount,
          replies: tweet.replyCount,
          url: `https://twitter.com/${tweet.author.userName}/status/${tweet.id}`,
        }));

      console.log(`    Found ${tweets.length} tweets`);
      return tweets;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`    Error: ${error.response?.status} - ${error.response?.statusText}`);
      } else {
        console.error(`    Error searching tweets:`, error);
      }
      return [];
    }
  }

  /**
   * Get early-stage founder intent signals from Twitter
   * Searches across multiple query categories and scores each tweet for credibility
   */
  async getFounderSignals(topN: number = 10): Promise<FounderSignal[]> {
    if (!this.apiKey) {
      console.log('⚠️  Skipping Twitter signals (no API key configured)');
      return [];
    }

    console.log('🐦 Fetching Twitter founder intent signals via TwitterAPI.io...');

    const allTweets: Tweet[] = [];
    const queries = getAllQueries();

    for (const query of queries) {
      const tweets = await this.searchTweets(query, MAX_RESULTS_PER_QUERY);
      allTweets.push(...tweets);

      // Rate limiting
      await this.delay(RATE_LIMIT_DELAY);
    }

    console.log(`🎯 Filtering ${allTweets.length} tweets for early-stage founder signals...`);

    // Score and filter tweets
    const signals: FounderSignal[] = allTweets
      .map((tweet) => {
        const score = calculateRelevanceScore({
          text: tweet.text,
          likes: tweet.likes,
          retweets: tweet.retweets,
          replies: tweet.replies,
          followers: tweet.followers,
        });

        const productName = this.extractProductName(tweet.text, tweet.author);

        return {
          ...tweet,
          relevanceScore: score,
          productName,
        };
      })
      .filter((signal) => meetsQualityThreshold(signal.relevanceScore))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Deduplicate by product name
    const deduped = this.deduplicateSignals(signals);

    console.log(`  → Found ${deduped.length} high-quality founder intent signals`);

    return deduped.slice(0, topN);
  }

  /**
   * Convert founder signals to company signals format for the enrichment pipeline
   */
  async getCompanySignals(topN: number = 5): Promise<TwitterSignal[]> {
    const founderSignals = await this.getFounderSignals(topN);

    return founderSignals.map((signal) => {
      const websiteUrl = this.extractUrl(signal.text);

      return {
        source: 'twitter' as const,
        sourceId: signal.url,
        collectedAt: new Date().toISOString(),
        companyName: signal.productName,
        productName: signal.productName,
        tweetUrl: signal.url,
        websiteUrl,
        description: signal.text,
        authorUsername: signal.author,
        authorFollowers: signal.followers,
        likes: signal.likes,
        retweets: signal.retweets,
        replies: signal.replies,
        relevanceScore: signal.relevanceScore,
        createdAt: signal.timestamp,
      };
    });
  }

  /**
   * Deduplicate signals by product name, keeping highest scoring ones
   */
  private deduplicateSignals(signals: FounderSignal[]): FounderSignal[] {
    const seen = new Set<string>();
    return signals.filter((signal) => {
      const key = signal.productName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract product/company name from tweet text
   * Falls back to author's Twitter handle if no product name is found
   */
  private extractProductName(text: string, authorHandle: string): string {
    // Try to extract product name from common patterns
    const patterns = [
      // Handle Twitter handles like @orellohq
      /@([a-zA-Z0-9_]{3,15})\b/,

      // "I'm calling it X" or "named X"
      /(?:calling|named)\s+(?:it\s+)?([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/,

      // "building/launching/working on X"
      /(?:launched|launching|announcing|introducing|releasing|built|building|created|made|shipped|working on)\s+(?:my|a|an|the)?\s*([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/,

      // "check out X" or "try X"
      /(?:check out|try)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/,

      // At start of tweet: "ProductName - description"
      /^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+-/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Filter out common false positives
        if (!['The', 'This', 'That', 'These', 'Those', 'My', 'Our', 'Your', 'Their'].includes(name)) {
          return name;
        }
      }
    }

    // Fallback: use first capitalized word (but not common words)
    const words = text.match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g);
    if (words && words.length > 0) {
      const commonWords = ['I', 'The', 'This', 'That', 'My', 'Our', 'Your', 'Their', 'What', 'Why', 'How', 'When', 'Where'];
      for (const word of words) {
        if (!commonWords.includes(word)) {
          return word;
        }
      }
    }

    // Last resort: use author's Twitter handle
    return `@${authorHandle}`;
  }

  /**
   * Extract URL from tweet text
   */
  private extractUrl(text: string): string | undefined {
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : undefined;
  }

  /**
   * Delay execution for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
