import Parser from 'rss-parser';
import { config } from './config';

export interface Launch {
  id: number;
  name: string;
  tagline: string;
  description: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  thumbnail: string;
  topics: string[];
  author: string;
}

export class ProductHuntClient {
  private parser: Parser;
  private rssUrl = 'https://www.producthunt.com/feed';

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['description', 'description'],
          ['link', 'link'],
          ['pubDate', 'pubDate'],
        ],
      },
    });
  }

  /**
   * Fetches today's product launches from Product Hunt RSS feed
   * This is the easiest way to get Product Hunt data without API approval
   */
  async getTodayLaunches(): Promise<Launch[]> {
    try {
      console.log('Fetching launches from Product Hunt RSS feed...');

      const feed = await this.parser.parseURL(this.rssUrl);
      const launches: Launch[] = [];

      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        // Parse the title which often includes tagline
        // Format is usually: "Product Name - Tagline"
        const titleParts = item.title.split(' - ');
        const name = titleParts[0] || item.title;
        const tagline = titleParts.slice(1).join(' - ') || '';

        // Extract description from content
        const description = this.extractDescription(item.content || item.contentSnippet || '');

        // Generate a simple ID from the link
        const id = this.generateIdFromUrl(item.link);

        // Product Hunt RSS doesn't include vote counts, so we'll estimate based on position
        // Earlier items in feed = more popular
        const position = feed.items.indexOf(item);
        const estimatedVotes = Math.max(300 - position * 20, 50);

        launches.push({
          id,
          name,
          tagline: tagline || description.substring(0, 100),
          description,
          url: item.link,
          votesCount: estimatedVotes,
          commentsCount: Math.floor(estimatedVotes / 10), // Estimate
          createdAt: item.pubDate || new Date().toISOString(),
          thumbnail: this.extractImage(item.content || '') || '',
          topics: this.extractTopics(item.categories || []),
          author: item.creator || item.author || 'Unknown',
        });
      }

      console.log(`Found ${launches.length} launches from Product Hunt RSS`);
      return launches.slice(0, config.content.maxLaunches);
    } catch (error) {
      console.error('Error fetching Product Hunt RSS feed:', error);
      console.log('Falling back to example data...');
      return this.getFallbackLaunches();
    }
  }

  /**
   * Extract plain text description from HTML content
   */
  private extractDescription(html: string): string {
    // Remove HTML tags and get plain text
    const text = html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // Remove "Discussion | Link" footer that appears in RSS feeds
    const cleanedText = text
      .replace(/Discussion\s*\|\s*Link\s*$/i, '')
      .replace(/Discussion\s*$/i, '')
      .trim();

    // Return first 200 chars
    return cleanedText.substring(0, 200);
  }

  /**
   * Extract image URL from HTML content
   */
  private extractImage(html: string): string {
    const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : '';
  }

  /**
   * Extract topics from RSS categories
   */
  private extractTopics(categories: string[]): string[] {
    return categories.slice(0, 5); // Limit to 5 topics
  }

  /**
   * Generate numeric ID from URL
   */
  private generateIdFromUrl(url: string): number {
    // Extract post slug and create a simple hash
    const match = url.match(/\/posts\/([^\/]+)/);
    if (match) {
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < match[1].length; i++) {
        const char = match[1].charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    }
    return Math.floor(Math.random() * 1000000);
  }

  /**
   * Fallback data if RSS feed fails
   */
  private getFallbackLaunches(): Launch[] {
    const today = new Date().toISOString();

    return [
      {
        id: 1,
        name: 'Example Product 1',
        tagline: 'Revolutionary AI tool for productivity',
        description: 'A comprehensive AI-powered tool that helps teams collaborate better and get more done. Features include smart scheduling, automated workflows, and real-time analytics.',
        url: 'https://www.producthunt.com/posts/example-1',
        votesCount: 342,
        commentsCount: 45,
        createdAt: today,
        thumbnail: '',
        topics: ['Productivity', 'AI', 'SaaS'],
        author: 'Example Maker',
      },
      {
        id: 2,
        name: 'Example Product 2',
        tagline: 'Developer tools for modern teams',
        description: 'Build, test, and deploy faster with our integrated development platform. Includes CI/CD, code review tools, and deployment automation.',
        url: 'https://www.producthunt.com/posts/example-2',
        votesCount: 287,
        commentsCount: 32,
        createdAt: today,
        thumbnail: '',
        topics: ['Developer Tools', 'DevOps'],
        author: 'Example Maker',
      },
      {
        id: 3,
        name: 'Example Product 3',
        tagline: 'Analytics dashboard for startups',
        description: 'Get insights into your business metrics with beautiful, real-time dashboards. Track revenue, users, and key performance indicators in one place.',
        url: 'https://www.producthunt.com/posts/example-3',
        votesCount: 198,
        commentsCount: 21,
        createdAt: today,
        thumbnail: '',
        topics: ['Analytics', 'Business'],
        author: 'Example Maker',
      },
    ];
  }
}
