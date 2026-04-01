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

interface TrendingDeveloper {
  login: string;
  name: string;
  profileUrl: string;
  rank: number;
  popularRepoName?: string;
  popularRepoDescription?: string;
  popularRepoUrl?: string;
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
    const trendingDevelopers = await this.getTrendingDevelopers(25);
    const trendingDeveloperMap = new Map(trendingDevelopers.map((developer) => [developer.login.toLowerCase(), developer]));
    const repos = await this.getTrendingRepos(limit);
    const signals = await Promise.all(repos.map(repo => this.buildCompanySignal(repo, trendingDeveloperMap)));
    return signals.filter((signal): signal is RepositorySignal => signal !== null);
  }

  async getTrendingDevelopers(limit: number = 10): Promise<TrendingDeveloper[]> {
    try {
      console.log('Fetching trending developers from GitHub Trending Developers...');

      const response = await axios.get(`${this.baseUrl}/developers?since=daily`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      const $ = cheerio.load(response.data);
      const developers: TrendingDeveloper[] = [];

      $('article.Box-row').each((index, el) => {
        if (developers.length >= limit) return false;

        const profileLink = $(el).find('h2 a, h1 a').first();
        const relativeProfileUrl = profileLink.attr('href') ?? '';
        const login = relativeProfileUrl.replace(/^\/+/, '').trim() || profileLink.text().trim().replace(/^@/, '');
        if (!login) return;

        const name = $(el).find('h1, h2').first().text().replace(/\s+/g, ' ').trim() || login;

        const popularRepoLink = $(el).find('article a[href^="/"][href*="/"]').filter((_, link) => {
          const href = $(link).attr('href') ?? '';
          const text = $(link).text().replace(/\s+/g, ' ').trim();
          return href.split('/').filter(Boolean).length >= 2 && text.length > 0;
        }).last();

        const relativePopularRepoUrl = popularRepoLink.attr('href') ?? '';
        const popularRepoName = popularRepoLink.text().replace(/\s+/g, ' ').trim() || undefined;
        const popularRepoUrl = relativePopularRepoUrl ? `https://github.com${relativePopularRepoUrl}` : undefined;
        const popularRepoDescription = $(el)
          .find('article div, article p')
          .map((_, node) => $(node).text().replace(/\s+/g, ' ').trim())
          .get()
          .find((text) => text.length > 0 && text !== popularRepoName && !text.startsWith('@'));

        developers.push({
          login,
          name,
          profileUrl: `https://github.com/${login}`,
          rank: index + 1,
          popularRepoName,
          popularRepoDescription,
          popularRepoUrl,
        });
      });

      return developers;
    } catch (error) {
      console.error('Error fetching GitHub trending developers:', error);
      return [];
    }
  }

  private async buildCompanySignal(repo: Repository, trendingDeveloperMap: Map<string, TrendingDeveloper>): Promise<RepositorySignal | null> {
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
      const enrichedContributors = contributors
        .filter((item): item is ContributorProfile => item !== null)
        .map((contributor) => this.applyTrendingDeveloperData(contributor, trendingDeveloperMap.get(contributor.login.toLowerCase())));

      const companyName = this.inferCompanyName(repo, repoData.homepage, enrichedContributors);

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
        contributors: enrichedContributors,
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
      if (this.isNotFoundError(error)) {
        console.warn(`GitHub profile ${login} was not found. Using contributor metadata from the repository response.`);
      } else {
        console.error(`Error fetching GitHub user ${login}:`, error);
      }
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

  private applyTrendingDeveloperData(contributor: ContributorProfile, developer?: TrendingDeveloper): ContributorProfile {
    if (!developer) {
      return contributor;
    }

    return {
      ...contributor,
      name: contributor.name || developer.name || contributor.login,
      profileUrl: contributor.profileUrl || developer.profileUrl,
      trendingRank: developer.rank,
      popularRepoName: developer.popularRepoName,
      popularRepoDescription: developer.popularRepoDescription,
      popularRepoUrl: developer.popularRepoUrl,
    };
  }

  private isNotFoundError(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 404;
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
