import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from './config';
import { ProductSignal } from './types';
import crypto from 'crypto';

function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

export interface Launch {
  id: string;
  company: string;
  date: string;
  launch_type: string;
  url: string;
  one_liner: string;
  tags: string[];
  votesCount?: number;
  commentsCount?: number;
  rank?: number;
}

export class ProductHuntClient {
  private parser: Parser;
  private rssUrl = 'https://www.producthunt.com/feed';
  private homepageUrl = 'https://www.producthunt.com/';

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
   * Scrapes Product Hunt homepage to get today's top 5 launches
   */
  async getTodayLaunches(): Promise<Launch[]> {
    try {
      console.log('Scraping Product Hunt homepage for today\'s top launches...');

      const response = await axios.get(this.homepageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const launches: Launch[] = [];
      const now = new Date();
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Product Hunt uses data attributes and specific CSS classes for posts
      // Look for the main post cards
      $('[data-test="post-item"]').each((_, element) => {
        if (launches.length >= 5) return false; // Stop after 5

        const $el = $(element);

        // Extract product name
        const name = $el.find('a[href*="/posts/"]').first().text().trim();
        if (!name) return;

        // Extract product URL
        const relativeUrl = $el.find('a[href*="/posts/"]').first().attr('href');
        const url = relativeUrl ? `https://www.producthunt.com${relativeUrl}` : '';
        if (!url) return;

        // Extract tagline/description
        const tagline = $el.find('[class*="tagline"], [class*="description"]').first().text().trim();

        // Extract company name (before any – or -)
        const company = name.split('–')[0].split('-')[0].trim().slice(0, 80);

        launches.push({
          id: `${todayDate}-ph-${hashUrl(url)}`,
          company,
          date: todayDate,
          launch_type: 'Product Hunt',
          url,
          one_liner: tagline || name,
          tags: ['producthunt'],
        });
      });

      console.log(`Found ${launches.length} top launches from Product Hunt homepage`);
      return launches;
    } catch (error) {
      console.error('Error scraping Product Hunt homepage:', error);
      console.log('Falling back to RSS feed...');

      // Fallback to RSS feed if scraping fails
      return this.getTodayLaunchesFromRSS();
    }
  }

  /**
   * Fallback method using RSS feed
   */
  private async getTodayLaunchesFromRSS(): Promise<Launch[]> {
    try {
      const feed = await this.parser.parseURL(this.rssUrl);
      const launches: Launch[] = [];
      const now = new Date();
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        const title = item.title;
        const url = item.link;
        const company = title.split('–')[0].split('-')[0].trim().slice(0, 80);
        const snippet = this.extractDescription(item.content || item.contentSnippet || '');
        const one_liner = snippet || title;

        launches.push({
          id: `${todayDate}-ph-${hashUrl(url)}`,
          company,
          date: todayDate,
          launch_type: 'Product Hunt',
          url,
          one_liner,
          tags: ['producthunt'],
        });

        if (launches.length >= 5) break;
      }

      console.log(`Found ${launches.length} launches from Product Hunt RSS (fallback)`);
      return launches;
    } catch (error) {
      console.error('Error fetching Product Hunt RSS feed:', error);
      return [];
    }
  }

  async getCompanySignals(): Promise<ProductSignal[]> {
    const launches = await this.getTodayLaunches();
    const collectedAt = new Date().toISOString();

    return launches.map(launch => ({
      source: 'product_hunt',
      sourceId: launch.id,
      collectedAt,
      companyName: launch.company,
      productName: launch.company,
      launchUrl: launch.url,
      websiteUrl: undefined,
      description: launch.one_liner,
      tagline: launch.one_liner,
      topics: launch.tags,
      makerName: 'Unknown',
      // No votesCount or commentsCount - RSS doesn't provide real data
      // Preserve launch day to avoid timezone drift in "launches today"
      createdAt: `${launch.date}T12:00:00.000Z`,
    }));
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

}









