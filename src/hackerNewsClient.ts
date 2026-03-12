import axios from 'axios';
import { config } from './config';

export interface Story {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  time: number;
  descendants: number; // number of comments
  type: string;
  text?: string;
}

export class HackerNewsClient {
  private baseUrl = 'https://hacker-news.firebaseio.com/v0';

  /**
   * Fetches top stories from Hacker News
   * API Docs: https://github.com/HackerNews/API
   */
  async getTopStories(): Promise<Story[]> {
    try {
      console.log('Fetching top stories from Hacker News...');

      // Get top story IDs
      const { data: topStoryIds } = await axios.get<number[]>(`${this.baseUrl}/topstories.json`);

      // Fetch details for top stories (limit to avoid too many requests)
      const storyLimit = Math.min(config.content.maxTrends * 2, 30);
      const storyPromises = topStoryIds.slice(0, storyLimit).map(id => this.getStory(id));

      const stories = await Promise.all(storyPromises);

      // Filter out nulls and stories without URLs
      const validStories = stories.filter((story): story is Story => {
        return story !== null && (story.url !== undefined || story.text !== undefined);
      });

      console.log(`Found ${validStories.length} stories from Hacker News`);
      return validStories;
    } catch (error) {
      console.error('Error fetching Hacker News data:', error);
      return [];
    }
  }

  /**
   * Fetches a single story by ID
   */
  private async getStory(id: number): Promise<Story | null> {
    try {
      const { data } = await axios.get<Story>(`${this.baseUrl}/item/${id}.json`);
      return data;
    } catch (error) {
      console.error(`Error fetching story ${id}:`, error);
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
}
