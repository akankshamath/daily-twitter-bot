import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from './config';
import { HackerNewsSignal } from './types';

export interface Story {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants: number; // number of comments
  type: string;
  text?: string;
}

export interface HNUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
}

export class HackerNewsClient {
  private baseUrl = 'https://hacker-news.firebaseio.com/v0';

  /**
   * Fetches Show HN stories (product launches)
   * Show HN is where people launch their products on Hacker News
   */
  async getShowHNStories(limit: number = 15): Promise<Story[]> {
    try {
      console.log('Fetching Show HN stories from Hacker News API...');

      const { data: storyIds } = await axios.get<number[]>(`${this.baseUrl}/showstories.json`, {
        timeout: 10000,
      });

      // Fetch top N story details
      const stories = await Promise.all(
        storyIds.slice(0, Math.min(limit * 2, 30)).map(id => this.getStory(id)),
      );

      // Filter out null results and stories without URLs
      const validStories = stories
        .filter((story): story is Story => story !== null && !!story.url)
        .slice(0, limit);

      console.log(`Found ${validStories.length} Show HN stories`);
      return validStories;
    } catch (error) {
      console.error('Error fetching Hacker News Show HN stories:', error);
      console.log('No Hacker News Show HN stories will be included for this run.');
      return [];
    }
  }

  /**
   * Fetches top stories from Hacker News
   * API Docs: https://github.com/HackerNews/API
   */
  async getTopStories(limit: number = 10, minScore: number = 100): Promise<Story[]> {
    try {
      console.log('Fetching top stories from Hacker News...');

      // Get top story IDs
      const { data: topStoryIds } = await axios.get<number[]>(`${this.baseUrl}/topstories.json`, {
        timeout: 10000,
      });

      // Fetch details for top stories (limit to avoid too many requests)
      const stories = await Promise.all(
        topStoryIds.slice(0, Math.min(limit * 3, 50)).map(id => this.getStory(id)),
      );

      // Filter by score and URL presence
      const validStories = stories
        .filter((story): story is Story =>
          story !== null &&
          !!story.url &&
          story.score >= minScore
        )
        .slice(0, limit);

      console.log(`Found ${validStories.length} top stories (min score: ${minScore})`);
      return validStories;
    } catch (error) {
      console.error('Error fetching Hacker News top stories:', error);
      console.log('No Hacker News top stories will be included for this run.');
      return [];
    }
  }

  /**
   * Fetches a single story by ID
   */
  private async getStory(id: number): Promise<Story | null> {
    try {
      const { data } = await axios.get<Story>(`${this.baseUrl}/item/${id}.json`, {
        timeout: 5000,
      });
      return data;
    } catch (error) {
      console.error(`Error fetching story ${id}:`, error);
      return null;
    }
  }

  /**
   * Fetches user profile to enrich founder signals
   */
  private async getUser(username: string): Promise<HNUser | null> {
    try {
      const { data } = await axios.get<HNUser>(`${this.baseUrl}/user/${username}.json`, {
        timeout: 5000,
      });
      return data;
    } catch (error) {
      console.error(`Error fetching HN user ${username}:`, error);
      return null;
    }
  }

  /**
   * Gets best stories (alternative to top stories)
   */
  async getBestStories(): Promise<Story[]> {
    try {
      console.log('Fetching best stories from Hacker News...');

      const { data: bestStoryIds } = await axios.get<number[]>(`${this.baseUrl}/beststories.json`);

      const storyLimit = Math.min(config.content.maxTrends * 2, 30);
      const storyPromises = bestStoryIds.slice(0, storyLimit).map(id => this.getStory(id));

      const stories = await Promise.all(storyPromises);
      const validStories = stories.filter((story): story is Story => story !== null);

      console.log(`Found ${validStories.length} best stories from Hacker News`);
      return validStories;
    } catch (error) {
      console.error('Error fetching best stories:', error);
      return [];
    }
  }

  /**
   * Gets new stories (latest submissions)
   */
  async getNewStories(): Promise<Story[]> {
    try {
      const { data: newStoryIds } = await axios.get<number[]>(`${this.baseUrl}/newstories.json`);

      const storyLimit = Math.min(20, newStoryIds.length);
      const storyPromises = newStoryIds.slice(0, storyLimit).map(id => this.getStory(id));

      const stories = await Promise.all(storyPromises);
      const validStories = stories.filter((story): story is Story => story !== null);

      return validStories;
    } catch (error) {
      console.error('Error fetching new stories:', error);
      return [];
    }
  }

  /**
   * Filters stories posted within the last 24 hours
   */
  filterRecent(stories: Story[], hoursAgo: number = 24): Story[] {
    const cutoffTime = Date.now() / 1000 - hoursAgo * 3600;
    return stories.filter(story => story.time >= cutoffTime);
  }
  /**
   * Categorizes stories as trending (high engagement rate)
   */
  getTrendingStories(stories: Story[]): Story[] {
    const now = Date.now() / 1000;

    // Calculate engagement score (points per hour)
    const storiesWithEngagement = stories.map(story => {
      const ageInHours = (now - story.time) / 3600;
      const engagementRate = story.score / Math.max(ageInHours, 1);

      return {
        ...story,
        engagementRate,
      };
    });

    // Sort by engagement rate
    storiesWithEngagement.sort((a, b) => b.engagementRate - a.engagementRate);

    // Return top trending
    return storiesWithEngagement.slice(0, config.content.maxTrends);
  }

  /**
   * Filters tech-related stories using keywords
   */
  filterTechStories(stories: Story[]): Story[] {
    const techKeywords = [
      'ai', 'ml', 'machine learning', 'neural', 'llm', 'gpt',
      'programming', 'software', 'code', 'developer', 'framework',
      'javascript', 'python', 'rust', 'go', 'typescript',
      'web', 'api', 'database', 'cloud', 'aws', 'docker', 'kubernetes',
      'security', 'crypto', 'blockchain', 'startup', 'tech',
      'open source', 'github', 'linux', 'server', 'backend', 'frontend',
    ];

    return stories.filter(story => {
      const titleLower = story.title.toLowerCase();
      return techKeywords.some(keyword => titleLower.includes(keyword));
    });
  }

  /**
   * Check if a URL points to a product/company site (not a blog or news article)
   */
  private isProductUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();

      // Exclude common blog/news/content sites
      const excludedDomains = [
        'medium.com', 'substack.com', 'blog.', 'news.', 'techcrunch.com',
        'theverge.com', 'arstechnica.com', 'wired.com', 'reddit.com',
        'twitter.com', 'x.com', 'youtube.com', 'linkedin.com',
        'facebook.com', 'instagram.com', 'tiktok.com',
        'nytimes.com', 'washingtonpost.com', 'wsj.com', 'bloomberg.com',
        'reuters.com', 'bbc.com', 'cnn.com', 'theguardian.com',
        'arxiv.org', 'wikipedia.org', 'stackexchange.com', 'stackoverflow.com'
      ];

      // Check if domain matches excluded patterns
      if (excludedDomains.some(domain => hostname.includes(domain))) {
        return false;
      }

      // Exclude URLs with blog-like paths
      const blogPatterns = ['/blog/', '/post/', '/article/', '/news/', '/press/'];
      if (blogPatterns.some(pattern => path.includes(pattern))) {
        return false;
      }

      // Prefer domains with product indicators
      const productIndicators = ['/app', '/product', '/pricing', '/download', '/docs', '/api'];
      const hasProductIndicator = productIndicators.some(indicator => path.includes(indicator));

      // Allow GitHub repos as they often represent products
      if (hostname.includes('github.com')) {
        return true;
      }

      return true; // Allow by default if not explicitly excluded
    } catch {
      return false;
    }
  }

  /**
   * Converts HN stories to company signals for enrichment
   */
  async getCompanySignals(): Promise<HackerNewsSignal[]> {
    // Prioritize Show HN stories as they are actual product launches
    const showHNStories = await this.getShowHNStories(15);

    // For top stories, filter for relevance: only include product/company sites
    const topStories = await this.getTopStories(10, 150);
    const relevantTopStories = topStories.filter(story =>
      story.url && this.isProductUrl(story.url)
    );

    // Combine with Show HN taking priority
    const allStories = [...showHNStories, ...relevantTopStories];
    const collectedAt = new Date().toISOString();

    // Enrich stories with user data
    const signals = await Promise.all(
      allStories.map(async (story) => {
        const user = await this.getUser(story.by);
        const companyName = this.extractCompanyName(story.title, story.url);
        const storyType: 'show_hn' | 'top_story' = showHNStories.includes(story) ? 'show_hn' : 'top_story';

        return {
          source: 'hacker_news' as const,
          sourceId: `hn-${story.id}`,
          collectedAt,
          storyType,
          companyName,
          productName: this.extractProductName(story.title),
          storyUrl: `https://news.ycombinator.com/item?id=${story.id}`,
          websiteUrl: story.url,
          title: story.title,
          description: this.cleanDescription(story.text, story.title),
          authorUsername: story.by,
          authorKarma: user?.karma ?? 0,
          authorCreated: user?.created ? new Date(user.created * 1000).toISOString() : undefined,
          score: story.score,
          commentsCount: story.descendants || 0,
          createdAt: new Date(story.time * 1000).toISOString(),
        };
      }),
    );

    return signals;
  }

  /**
   * Extract company name from title and URL
   */
  private extractCompanyName(title: string, url?: string): string {
    // Try to extract from URL first
    if (url) {
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        const parts = domain.split('.');

        // Get the main domain name (before .com, .io, etc.)
        if (parts.length >= 2) {
          return this.capitalize(parts[parts.length - 2]);
        }
      } catch {
        // Fall through to title extraction
      }
    }

    // Extract from title (Show HN: ProductName - Description)
    const showHNMatch = title.match(/Show HN:\s*([^-–—(]+)/i);
    if (showHNMatch) {
      return showHNMatch[1].trim();
    }

    // Try to get first part of title
    const firstPart = title.split(/[-–—]/)[0].trim();
    return firstPart.substring(0, 50);
  }

  /**
   * Extract product name from title
   */
  private extractProductName(title: string): string {
    // For Show HN, extract product name
    const showHNMatch = title.match(/Show HN:\s*([^-–—(]+)/i);
    if (showHNMatch) {
      return showHNMatch[1].trim();
    }

    // Otherwise use first part of title
    return title.split(/[-–—]/)[0].trim();
  }

  /**
   * Extract description from title (everything after - or —)
   */
  private extractDescriptionFromTitle(title: string): string {
    const parts = title.split(/[-–—]/);
    if (parts.length > 1) {
      return parts.slice(1).join(' - ').trim();
    }
    return title;
  }

  private cleanDescription(text: string | undefined, title: string): string {
    const titleSummary = this.extractDescriptionFromTitle(title);
    if (!text) {
      return titleSummary;
    }

    const plainText = cheerio.load(`<div>${text}</div>`)('div').text().replace(/\s+/g, ' ').trim();
    if (!plainText) {
      return titleSummary;
    }

    const cleanedText = plainText
      .replace(/\bTech stack:.*$/i, '')
      .replace(/\bBlog post with the full story:.*$/i, '')
      .replace(/\bGitHub repo:.*$/i, '')
      .trim();

    if (titleSummary && titleSummary !== title && titleSummary.length <= 140) {
      return titleSummary;
    }

    const firstSentence = cleanedText.match(/^(.{1,220}?[.!?])(\s|$)/)?.[1]?.trim();
    if (firstSentence) {
      return firstSentence;
    }

    return cleanedText.length > 220
      ? `${cleanedText.slice(0, 217).trimEnd()}...`
      : cleanedText;
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
