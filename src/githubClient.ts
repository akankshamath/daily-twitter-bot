import axios from 'axios';
import * as cheerio from 'cheerio';

export interface Repository {
  name: string;
  author: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  starsToday: number;
}

export class GitHubClient {
  private baseUrl = 'https://github.com/trending';

  async getTrendingRepos(limit: number = 5): Promise<Repository[]> {
    try {
      console.log('Fetching trending repositories from GitHub Trending page...');

      const response = await axios.get(`${this.baseUrl}?since=daily`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      const $ = cheerio.load(response.data);
      const repos: Repository[] = [];

      $('article.Box-row').each((_, el) => {
        if (repos.length >= limit) return false;

        const titleText = $(el).find('h2 a').text().replace(/\s+/g, ' ').trim();
        const [author, name] = titleText.split('/').map(s => s.trim());

        const relativeUrl = $(el).find('h2 a').attr('href') ?? '';
        const url = relativeUrl ? `https://github.com${relativeUrl}` : '';

        const description = $(el).find('p').text().replace(/\s+/g, ' ').trim() || 'No description provided';

        const language =
          $(el).find('[itemprop="programmingLanguage"]').text().trim() || 'Unknown';

        const starLinks = $(el).find('a[href$="/stargazers"]');
        const forkLinks = $(el).find('a[href$="/forks"]');

        const stars = this.parseCount($(starLinks[0]).text().trim());
        const forks = this.parseCount($(forkLinks[0]).text().trim());

        const starsTodayText = $(el)
          .find('span.d-inline-block.float-sm-right')
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        const starsTodayMatch = starsTodayText.match(/([\d,.kK]+)\s+stars?\s+today/i);
        const starsToday = starsTodayMatch ? this.parseCount(starsTodayMatch[1]) : 0;

        repos.push({
          name: name || '',
          author: author || '',
          url,
          description,
          language,
          stars,
          forks,
          starsToday,
        });
      });

      console.log(`Found ${repos.length} trending repositories`);
      return repos;
    } catch (error) {
      console.error('Error fetching GitHub trending:', error);
      throw error;
    }
  }

  private parseCount(value: string): number {
    const cleaned = value.replace(/,/g, '').trim().toLowerCase();

    if (cleaned.endsWith('k')) {
      return Math.round(parseFloat(cleaned.replace('k', '')) * 1000);
    }

    return Number(cleaned) || 0;
  }
}