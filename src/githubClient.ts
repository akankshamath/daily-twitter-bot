import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from './config';
import { ContributorProfile, RepositorySignal } from './types';

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
  private apiBaseUrl = 'https://api.github.com';

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'daily-twitter-bot',
      ...extraHeaders,
    };

    if (config.github.token) {
      headers.Authorization = `Bearer ${config.github.token}`;
    }

    return headers;
  }

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
      console.log('No GitHub repositories will be included for this run.');
      return [];
    }
  }

  async getCompanySignals(limit: number = 5): Promise<RepositorySignal[]> {
    const repos = await this.getTrendingRepos(limit);
    const signals = await Promise.all(repos.map(repo => this.buildCompanySignal(repo)));
    return signals.filter((signal): signal is RepositorySignal => signal !== null);
  }

  private async buildCompanySignal(repo: Repository): Promise<RepositorySignal | null> {
    try {
      const repoApiPath = this.extractRepoApiPath(repo.url);
      if (!repoApiPath) return null;

      const { data: repoData } = await axios.get<{
        homepage?: string;
        topics?: string[];
        owner: { login: string; type: string };
      }>(`${this.apiBaseUrl}/repos/${repoApiPath}`, {
        headers: this.getHeaders({ Accept: 'application/vnd.github+json' }),
        timeout: 10000,
      });

      const { data: contributorsData } = await axios.get<Array<{ login: string; html_url: string; avatar_url: string; contributions: number }>>(
        `${this.apiBaseUrl}/repos/${repoApiPath}/contributors?per_page=5`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        },
      );

      const contributors = await Promise.all(
        contributorsData.slice(0, 5).map(contributor =>
          this.getContributorProfile(contributor.login, contributor.html_url, contributor.avatar_url, contributor.contributions, contributor.login === repo.author),
        ),
      );

      const companyName = this.inferCompanyName(repo, repoData.homepage, contributors.filter((item): item is ContributorProfile => item !== null));

      return {
        source: 'github',
        sourceId: `gh-${repo.author}-${repo.name}`,
        collectedAt: new Date().toISOString(),
        companyName,
        repoName: repo.name,
        repoUrl: repo.url,
        homepageUrl: repoData.homepage || undefined,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        forks: repo.forks,
        starsToday: repo.starsToday,
        ownerLogin: repoData.owner.login,
        ownerType: repoData.owner.type,
        topics: repoData.topics ?? [],
        contributors: contributors.filter((item): item is ContributorProfile => item !== null),
      };
    } catch (error) {
      console.error(`Error enriching GitHub repo ${repo.author}/${repo.name}:`, error);
      return {
        source: 'github',
        sourceId: `gh-${repo.author}-${repo.name}`,
        collectedAt: new Date().toISOString(),
        companyName: this.fallbackCompanyName(repo),
        repoName: repo.name,
        repoUrl: repo.url,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        forks: repo.forks,
        starsToday: repo.starsToday,
        ownerLogin: repo.author,
        ownerType: 'Unknown',
        topics: [],
        contributors: [],
      };
    }
  }

  private extractRepoApiPath(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  private async getContributorProfile(
    login: string,
    profileUrl: string,
    avatarUrl: string,
    contributions: number,
    isOwner: boolean,
  ): Promise<ContributorProfile | null> {
    try {
      const { data } = await axios.get<{
        name?: string;
        company?: string;
        bio?: string;
        followers?: number;
        html_url: string;
      }>(`${this.apiBaseUrl}/users/${login}`, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      return {
        login,
        name: data.name || login,
        profileUrl: data.html_url || profileUrl,
        avatarUrl,
        company: data.company || undefined,
        bio: data.bio || undefined,
        followers: data.followers ?? 0,
        contributions,
        role: isOwner ? 'founder' : 'core_builder',
        source: 'github',
      };
    } catch (error) {
      console.error(`Error fetching GitHub user ${login}:`, error);
      return {
        login,
        name: login,
        profileUrl,
        avatarUrl,
        contributions,
        role: isOwner ? 'founder' : 'core_builder',
        source: 'github',
      };
    }
  }

  private inferCompanyName(repo: Repository, homepageUrl: string | undefined, contributors: ContributorProfile[]): string {
    if (homepageUrl) {
      try {
        const parsed = new URL(homepageUrl);
        const domain = parsed.hostname.replace(/^www\./, '');
        return domain.split('.')[0] || this.fallbackCompanyName(repo);
      } catch {
        return this.fallbackCompanyName(repo);
      }
    }

    const contributorCompany = contributors.find(contributor => contributor.company)?.company;
    if (contributorCompany) {
      return contributorCompany.replace(/^@/, '').trim();
    }

    return this.fallbackCompanyName(repo);
  }

  private fallbackCompanyName(repo: Repository): string {
    return repo.author || repo.name;
  }

  private parseCount(value: string): number {
    const cleaned = value.replace(/,/g, '').trim().toLowerCase();

    if (cleaned.endsWith('k')) {
      return Math.round(parseFloat(cleaned.replace('k', '')) * 1000);
    }

    return Number(cleaned) || 0;
  }
}
