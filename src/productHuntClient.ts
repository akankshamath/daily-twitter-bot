import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { config } from './config';
import { ProductSignal } from './types';

function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLaunchDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return formatDate(parsed);
}

function normalizeExternalWebsiteUrl(websiteUrl?: string): string | undefined {
  if (!websiteUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (hostname === 'producthunt.com' || hostname.endsWith('.producthunt.com')) {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

function inferCompanyName(productName: string, websiteUrl?: string): string {
  const normalizedWebsiteUrl = normalizeExternalWebsiteUrl(websiteUrl);

  if (normalizedWebsiteUrl) {
    try {
      const parsed = new URL(normalizedWebsiteUrl);
      const hostname = parsed.hostname.replace(/^www\./, '');
      const label = hostname.split('.')[0];
      if (label) {
        return label;
      }
    } catch {
      // Fall back to product name.
    }
  }

  return productName;
}

function cleanOrganizationName(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/\s+[|\-:]\s+.*$/, '')
    .replace(/\b(home|official site|homepage)\b/gi, '')
    .trim();

  if (!cleaned) {
    return undefined;
  }

  const lowered = cleaned.toLowerCase();
  if (lowered === 'product hunt' || lowered === 'producthunt') {
    return undefined;
  }

  return cleaned;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export interface Launch {
  id: string;
  company: string;
  productName: string;
  date: string;
  launch_type: string;
  url: string;
  one_liner: string;
  description?: string;
  tags: string[];
  websiteUrl?: string;
  makerName?: string;
  votesCount?: number;
  commentsCount?: number;
  rank?: number;
}

type CheerioRoot = ReturnType<typeof cheerio.load>;

interface ProductHuntApiPost {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  url: string;
  website?: string;
  votesCount?: number;
  commentsCount?: number;
  createdAt?: string;
  topics?: {
    nodes?: Array<{
      name: string;
    }>;
  };
  makers?: Array<{
    name?: string;
    username?: string;
  }>;
}

interface ProductHuntApiResponse {
  data?: {
    posts?: {
      nodes?: ProductHuntApiPost[];
    };
  };
  errors?: Array<{
    message: string;
  }>;
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

  async getTodayLaunches(): Promise<Launch[]> {
    // Try official API first (best data quality)
    const apiLaunches = await this.getTodayLaunchesFromApi();
    if (apiLaunches.length > 0) {
      return apiLaunches;
    }

    // Fallback to RSS feed (no scraping needed)
    console.log('Falling back to Product Hunt RSS feed...');
    return this.getTodayLaunchesFromRSS();
  }

  private async getTodayLaunchesFromApi(): Promise<Launch[]> {
    if (!config.productHunt.token) {
      console.log('Product Hunt API token not configured. Skipping official API.');
      return [];
    }

    try {
      console.log('Fetching Product Hunt launches via official API...');

      const todayDate = formatDate(new Date());
      const postedAfter = `${todayDate}T00:00:00Z`;
      const postedBefore = `${todayDate}T23:59:59Z`;
      const query = `
        query DailyPosts($postedAfter: DateTime!, $postedBefore: DateTime!) {
          posts(
            first: 10
            featured: true
            order: VOTES
            postedAfter: $postedAfter
            postedBefore: $postedBefore
          ) {
            nodes {
              id
              name
              tagline
              description
              url
              website
              votesCount
              commentsCount
              createdAt
              topics(first: 5) {
                nodes {
                  name
                }
              }
              makers {
                name
                username
              }
            }
          }
        }
      `;

      const response = await axios.post<ProductHuntApiResponse>(
        'https://api.producthunt.com/v2/api/graphql',
        {
          query,
          variables: {
            postedAfter,
            postedBefore,
          },
        },
        {
          timeout: 10000,
          headers: {
            Authorization: `Bearer ${config.productHunt.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn(`Product Hunt API returned errors: ${response.data.errors.map(error => error.message).join('; ')}`);
        return [];
      }

      const launches = (response.data.data?.posts?.nodes ?? [])
        .filter(post => Boolean(post.name && post.url))
        .map((post): Launch => {
          const launchDate = parseLaunchDate(post.createdAt) ?? todayDate;
          const topics = (post.topics?.nodes ?? [])
            .map(topic => topic.name.trim())
            .filter(Boolean)
            .slice(0, 5);
          const makers = (post.makers ?? [])
            .map(maker => maker.name?.trim() || maker.username?.trim())
            .filter((name): name is string => Boolean(name));

          const websiteUrl = normalizeExternalWebsiteUrl(post.website);

          return {
            id: `${launchDate}-ph-${hashUrl(post.url)}`,
            company: inferCompanyName(post.name, websiteUrl),
            productName: post.name,
            date: launchDate,
            launch_type: 'Product Hunt',
            url: post.url,
            one_liner: post.tagline || post.name,
            description: post.description || post.tagline || post.name,
            tags: topics.length > 0 ? topics : ['producthunt'],
            websiteUrl,
            makerName: makers[0],
            votesCount: post.votesCount ?? 0,
            commentsCount: post.commentsCount ?? 0,
            rank: 0,
          };
        })
        .sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0))
        .slice(0, 5)
        .map((launch, index) => ({
          ...launch,
          rank: index + 1,
        }));

      console.log(`Found ${launches.length} launches from Product Hunt API`);
      return launches;
    } catch (error) {
      console.warn('Product Hunt API request failed. Using scrape-based fallback.');
      return [];
    }
  }


  private async getTodayLaunchesFromRSS(): Promise<Launch[]> {
    try {
      const feed = await this.parser.parseURL(this.rssUrl);
      const launches: Launch[] = [];
      const todayDate = formatDate(new Date());

      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        const launchDate = parseLaunchDate(item.pubDate);
        if (launchDate && launchDate !== todayDate) {
          continue;
        }

        const title = item.title;
        const url = item.link;
        const company = title.split('–')[0].split('-')[0].trim().slice(0, 80);
        const taglineParts = title.split(/–|-/);
        const one_liner = taglineParts.length > 1
          ? taglineParts.slice(1).join(' - ').trim()
          : title;
        const fullDescription = this.extractDescription(item.content || item.contentSnippet || '');

        launches.push({
          id: `${launchDate ?? todayDate}-ph-${hashUrl(url)}`,
          company,
          productName: company,
          date: launchDate ?? todayDate,
          launch_type: 'Product Hunt',
          url,
          one_liner,
          description: fullDescription || one_liner,
          tags: ['producthunt'],
        });

        if (launches.length >= 5) break;
      }

      console.log(`Found ${launches.length} launches from Product Hunt RSS (fallback)`);
      return launches.map((launch, index) => ({
        ...launch,
        rank: index + 1,
      }));
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
      productName: launch.productName,
      launchUrl: launch.url,
      websiteUrl: launch.websiteUrl,
      description: launch.description || launch.one_liner,
      tagline: launch.one_liner,
      topics: launch.tags,
      makerName: launch.makerName || 'Unknown',
      votesCount: launch.votesCount,
      commentsCount: launch.commentsCount,
      rank: launch.rank,
      createdAt: new Date(`${launch.date}T12:00:00`).toISOString(),
    }));
  }

  private async enrichLaunchOrganizations(launches: Launch[]): Promise<Launch[]> {
    return Promise.all(launches.map(async (launch) => {
      if (!launch.websiteUrl) {
        return launch;
      }

      const organizationName = await this.fetchOrganizationNameFromWebsite(launch.websiteUrl, launch.productName);
      if (!organizationName) {
        return launch;
      }

      return {
        ...launch,
        company: organizationName,
      };
    }));
  }

  private async fetchOrganizationNameFromWebsite(websiteUrl: string, productName: string): Promise<string | undefined> {
    try {
      const response = await axios.get(websiteUrl, {
        timeout: 8000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const candidates = [
        ...this.extractOrganizationCandidatesFromStructuredData($),
        $('meta[property="og:site_name"]').attr('content'),
        $('meta[name="application-name"]').attr('content'),
        $('meta[name="apple-mobile-web-app-title"]').attr('content'),
        $('meta[name="twitter:app:name:iphone"]').attr('content'),
        $('meta[name="author"]').attr('content'),
        $('title').first().text(),
        this.extractOrganizationCandidateFromBody($),
      ]
        .map((value) => cleanOrganizationName(value))
        .filter((value): value is string => Boolean(value));

      const normalizedProductName = normalizeLabel(productName);
      const match = candidates.find((candidate) => normalizeLabel(candidate) !== normalizedProductName);
      return match;
    } catch {
      return undefined;
    }
  }

  private extractOrganizationCandidatesFromStructuredData($: CheerioRoot): string[] {
    const candidates: string[] = [];

    $('script[type="application/ld+json"]').each((_, element) => {
      const raw = $(element).contents().text();
      if (!raw) {
        return;
      }

      for (const item of this.parseJsonLd(raw)) {
        this.collectOrganizationNames(item, candidates);
      }
    });

    return candidates;
  }

  private parseJsonLd(raw: string): unknown[] {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (parsed && typeof parsed === 'object' && '@graph' in parsed && Array.isArray((parsed as any)['@graph'])) {
        return (parsed as any)['@graph'];
      }

      return [parsed];
    } catch {
      return [];
    }
  }

  private collectOrganizationNames(node: unknown, candidates: string[]): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    const record = node as Record<string, unknown>;
    const type = record['@type'];

    if (typeof type === 'string' && /(Organization|Corporation|Company|Brand|WebSite|SoftwareApplication|Product)/i.test(type)) {
      this.pushCandidate(candidates, record.name);
      this.pushCandidate(candidates, this.readNestedName(record.publisher));
      this.pushCandidate(candidates, this.readNestedName(record.provider));
      this.pushCandidate(candidates, this.readNestedName(record.author));
      this.pushCandidate(candidates, this.readNestedName(record.brand));
      this.pushCandidate(candidates, this.readNestedName(record.manufacturer));
      this.pushCandidate(candidates, this.readNestedName(record.creator));
      this.pushCandidate(candidates, this.readNestedName(record.isPartOf));
    }

    Object.values(record).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => this.collectOrganizationNames(item, candidates));
      } else if (value && typeof value === 'object') {
        this.collectOrganizationNames(value, candidates);
      }
    });
  }

  private readNestedName(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    return typeof record.name === 'string' ? record.name : undefined;
  }

  private pushCandidate(candidates: string[], value: unknown): void {
    if (typeof value === 'string' && value.trim()) {
      candidates.push(value.trim());
    }
  }

  private extractOrganizationCandidateFromBody($: CheerioRoot): string | undefined {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const patterns = [
      /\bby\s+([A-Z][A-Za-z0-9&.\- ]{1,60})\b/,
      /\bfrom\s+([A-Z][A-Za-z0-9&.\- ]{1,60})\b/,
      /\bBuilt by\s+([A-Z][A-Za-z0-9&.\- ]{1,60})\b/i,
      /©\s*\d{4}\s+([A-Z][A-Za-z0-9&.\- ]{1,60})\b/,
    ];

    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractDescription(html: string): string {
    const text = html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    const cleanedText = text
      .replace(/Discussion\s*\|\s*Link\s*$/i, '')
      .replace(/Discussion\s*$/i, '')
      .trim();

    return cleanedText.substring(0, 200);
  }


  private parseCount(value: string): number {
    const cleaned = value.replace(/,/g, '').trim().toLowerCase();

    if (cleaned.endsWith('k')) {
      return Math.round(parseFloat(cleaned.replace('k', '')) * 1000);
    }

    return Number(cleaned) || 0;
  }
}
