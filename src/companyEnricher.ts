import { CompanyProfile, CompanySignal, ContributorProfile, DailyBrief, DailySnapshot, ProductSignal, RepositorySignal, CategoryMomentum, PersonToMeet } from './types';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/www\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCompanyId(signal: CompanySignal): string {
  if (signal.source === 'product_hunt' && signal.websiteUrl) {
    try {
      const url = new URL(signal.websiteUrl);
      return slugify(url.hostname);
    } catch {
      return slugify(signal.companyName);
    }
  }

  if (signal.source === 'github' && signal.homepageUrl) {
    try {
      const url = new URL(signal.homepageUrl);
      return slugify(url.hostname);
    } catch {
      return slugify(signal.companyName);
    }
  }

  if (signal.source === 'hacker_news' && signal.websiteUrl) {
    try {
      const url = new URL(signal.websiteUrl);
      return slugify(url.hostname);
    } catch {
      return slugify(signal.companyName);
    }
  }

  return slugify(signal.companyName);
}

function dedupePeople(people: ContributorProfile[]): ContributorProfile[] {
  const seen = new Map<string, ContributorProfile>();

  for (const person of people) {
    const key = person.profileUrl || person.login || `${person.name}-${person.company ?? ''}`;
    if (!seen.has(key)) {
      seen.set(key, person);
      continue;
    }

    const existing = seen.get(key)!;
    seen.set(key, {
      ...existing,
      contributions: Math.max(existing.contributions ?? 0, person.contributions ?? 0) || undefined,
      followers: Math.max(existing.followers ?? 0, person.followers ?? 0) || undefined,
      company: existing.company || person.company,
      bio: existing.bio || person.bio,
    });
  }

  return Array.from(seen.values());
}

function inferCategories(signals: CompanySignal[]): string[] {
  const raw = new Set<string>();

  for (const signal of signals) {
    if (signal.source === 'product_hunt') {
      signal.topics.forEach(topic => raw.add(topic));
      raw.add(inferKeywordCategory(`${signal.tagline} ${signal.description}`));
    } else if (signal.source === 'github') {
      if (signal.language && signal.language !== 'Unknown') {
        raw.add(signal.language);
      }
      signal.topics.forEach(topic => raw.add(topic));
      raw.add(inferKeywordCategory(`${signal.repoName} ${signal.description}`));
    } else if (signal.source === 'hacker_news') {
      raw.add(inferKeywordCategory(`${signal.title} ${signal.description}`));
    }
  }

  return Array.from(raw).filter(Boolean).slice(0, 5);
}

function inferKeywordCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/(agent|llm|gpt|ai|model|inference)/.test(lower)) return 'AI';
  if (/(developer|api|sdk|infra|platform|cloud|database|observability)/.test(lower)) return 'Developer Tools';
  if (/(finance|payments|bank|billing|tax|accounting)/.test(lower)) return 'Fintech';
  if (/(security|identity|auth|privacy|compliance)/.test(lower)) return 'Security';
  if (/(sales|crm|revenue|marketing|growth)/.test(lower)) return 'Go-To-Market';
  if (/(health|clinic|care|medical|bio)/.test(lower)) return 'Healthcare';
  return 'Software';
}

function chooseCanonicalUrl(signals: CompanySignal[]): string | undefined {
  for (const signal of signals) {
    if (signal.source === 'product_hunt' && signal.websiteUrl) return signal.websiteUrl;
    if (signal.source === 'github' && signal.homepageUrl) return signal.homepageUrl;
    if (signal.source === 'hacker_news' && signal.websiteUrl) return signal.websiteUrl;
  }

  const productHuntSignal = signals.find((signal): signal is ProductSignal => signal.source === 'product_hunt');
  if (productHuntSignal) return productHuntSignal.launchUrl;

  const hnSignal = signals.find(signal => signal.source === 'hacker_news');
  if (hnSignal && 'storyUrl' in hnSignal) return hnSignal.storyUrl;

  const repoSignal = signals.find((signal): signal is RepositorySignal => signal.source === 'github');
  return repoSignal?.repoUrl;
}

function summarize(signals: CompanySignal[]): string {
  const launch = signals.find((signal): signal is ProductSignal => signal.source === 'product_hunt');
  if (launch) {
    return launch.description || launch.tagline;
  }

  const hnSignal = signals.find(signal => signal.source === 'hacker_news');
  if (hnSignal && 'description' in hnSignal) {
    return hnSignal.description;
  }

  const repo = signals.find((signal): signal is RepositorySignal => signal.source === 'github');
  return repo?.description || 'No summary available.';
}

function buildWhyNow(signals: CompanySignal[], previous?: CompanyProfile): string[] {
  const items: string[] = [];

  const launch = signals.find((signal): signal is ProductSignal => signal.source === 'product_hunt');
  if (launch) {
    items.push(`Launched on Product Hunt today.`);
  }

  const hnSignals = signals.filter(signal => signal.source === 'hacker_news');
  if (hnSignals.length > 0) {
    const showHNCount = hnSignals.filter(s => 'storyType' in s && s.storyType === 'show_hn').length;
    const totalScore = hnSignals.reduce((sum, s) => sum + ('score' in s ? s.score : 0), 0);
    const totalComments = hnSignals.reduce((sum, s) => sum + ('commentsCount' in s ? s.commentsCount : 0), 0);

    if (showHNCount > 0) {
      items.push(`${showHNCount} Show HN post${showHNCount > 1 ? 's' : ''} with ${totalScore} points and ${totalComments} comments.`);
    } else {
      items.push(`Trending on Hacker News with ${totalScore} points and ${totalComments} comments.`);
    }
  }

  const repos = signals.filter((signal): signal is RepositorySignal => signal.source === 'github');
  const totalStarsToday = repos.reduce((sum, repo) => sum + repo.starsToday, 0);
  if (repos.length > 0) {
    items.push(`${repos.length} trending GitHub repo${repos.length > 1 ? 's' : ''} adding ${totalStarsToday.toLocaleString()} stars today.`);
  }

  if (previous) {
    const previousSignals = previous.sourceSignals.filter((signal): signal is RepositorySignal => signal.source === 'github');
    const previousStarsToday = previousSignals.reduce((sum, repo) => sum + repo.starsToday, 0);
    const delta = totalStarsToday - previousStarsToday;
    if (delta > 0) {
      items.push(`GitHub momentum improved by ${delta.toLocaleString()} stars/day versus the prior snapshot.`);
    }
  } else if (items.length === 0) {
    items.push('Newly appeared in the tracked signal set.');
  }

  return items;
}

function inferThesis(companyName: string, categories: string[], summary: string): string {
  const primaryCategory = categories[0] ?? 'software';
  return `${companyName} is surfacing as a ${primaryCategory.toLowerCase()} company with current public momentum. ${summary}`;
}

function inferStage(signals: CompanySignal[]): CompanyProfile['stageGuess'] {
  const repos = signals.filter((signal): signal is RepositorySignal => signal.source === 'github');
  const stars = repos.reduce((sum, repo) => sum + repo.stars, 0);
  const hasLaunch = signals.some(signal => signal.source === 'product_hunt');
  const hasShowHN = signals.some(signal => signal.source === 'hacker_news' && 'storyType' in signal && signal.storyType === 'show_hn');

  if ((hasLaunch || hasShowHN) && stars < 5000) return 'pre_seed';
  if (stars < 25000) return 'seed';
  if (stars >= 25000) return 'growth';
  return 'unclear';
}

function founderStrength(founders: ContributorProfile[], contributors: ContributorProfile[]): number {
  const followerScore = founders.reduce((sum, founder) => sum + Math.min(founder.followers ?? 0, 5000), 0) / 100;
  const contributorScore = contributors.reduce((sum, person) => sum + Math.min(person.contributions ?? 0, 100), 0);
  return Math.min(Math.round(followerScore + contributorScore), 100);
}

function computeScores(signals: CompanySignal[], founders: ContributorProfile[], contributors: ContributorProfile[], previous?: CompanyProfile) {
  const hasLaunch = signals.some(signal => signal.source === 'product_hunt');
  const repos = signals.filter((signal): signal is RepositorySignal => signal.source === 'github');
  const starsToday = repos.reduce((sum, repo) => sum + repo.starsToday, 0);

  // Calculate Hacker News engagement score
  const hnSignals = signals.filter(signal => signal.source === 'hacker_news');
  const hnScore = hnSignals.reduce((sum, signal) => {
    if ('score' in signal && 'commentsCount' in signal) {
      const points = signal.score;
      const comments = signal.commentsCount;
      const isShowHN = 'storyType' in signal && signal.storyType === 'show_hn';
      // Show HN gets bonus, high engagement (points + comments) drives score
      return sum + (isShowHN ? 30 : 15) + Math.min(points / 10, 20) + Math.min(comments / 5, 10);
    }
    return sum;
  }, 0);

  // Combine signals: Product Hunt launch, HN engagement, and GitHub momentum
  const emerging = Math.min(100, Math.round((hasLaunch ? 40 : 0) + hnScore + starsToday / 3));
  const previousStarsToday = previous
    ? previous.sourceSignals
        .filter((signal): signal is RepositorySignal => signal.source === 'github')
        .reduce((sum, repo) => sum + repo.starsToday, 0)
    : 0;
  const acceleration = Math.min(100, Math.max(0, Math.round(starsToday - previousStarsToday + (previous ? 20 : 35))));
  const founder = founderStrength(founders, contributors);
  const overall = Math.min(100, Math.round(emerging * 0.45 + acceleration * 0.25 + founder * 0.3));

  return { overall, emerging, acceleration, founderStrength: founder };
}

function chooseAction(score: number): CompanyProfile['recommendedAction'] {
  if (score >= 75) return 'reach_out';
  if (score >= 55) return 'research';
  return 'watch';
}

function isSameLocalDate(dateString: string, targetDate: string): boolean {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` === targetDate;
}

export function buildCompanyProfiles(signals: CompanySignal[], previousSnapshot?: DailySnapshot): CompanyProfile[] {
  const grouped = new Map<string, CompanySignal[]>();

  for (const signal of signals) {
    const id = normalizeCompanyId(signal);
    const current = grouped.get(id) ?? [];
    current.push(signal);
    grouped.set(id, current);
  }

  const previousById = new Map(previousSnapshot?.companies.map(company => [company.id, company]) ?? []);
  const companies: CompanyProfile[] = [];

  for (const [id, companySignals] of grouped.entries()) {
    const previous = previousById.get(id);
    const productSignal = companySignals.find((signal): signal is ProductSignal => signal.source === 'product_hunt');
    const repoSignals = companySignals.filter((signal): signal is RepositorySignal => signal.source === 'github');
    const hnSignals = companySignals.filter(signal => signal.source === 'hacker_news');
    const contributors = dedupePeople(repoSignals.flatMap(repo => repo.contributors));

    // Build founders list from Product Hunt makers, HN authors, and GitHub maintainers
    const hnFounders: ContributorProfile[] = hnSignals
      .filter(signal => 'authorUsername' in signal && 'authorKarma' in signal)
      .map(signal => ({
        login: (signal as any).authorUsername,
        name: (signal as any).authorUsername,
        profileUrl: `https://news.ycombinator.com/user?id=${(signal as any).authorUsername}`,
        role: 'founder' as const,
        source: 'hacker_news' as const,
        followers: (signal as any).authorKarma,
      }));

    const founders = dedupePeople([
      ...(productSignal
        ? [{
            login: productSignal.makerName.toLowerCase().replace(/\s+/g, '-'),
            name: productSignal.makerName,
            profileUrl: productSignal.launchUrl,
            role: 'founder' as const,
            source: 'product_hunt' as const,
          }]
        : []),
      ...hnFounders,
      ...contributors.filter(person => person.role === 'founder' || person.role === 'maintainer').slice(0, 2),
    ]);
    const categories = inferCategories(companySignals);
    const summary = summarize(companySignals);
    const scores = computeScores(companySignals, founders, contributors, previous);
    const starsToday = repoSignals.reduce((sum, repo) => sum + repo.starsToday, 0);
    const previousStarsToday = previous
      ? previous.sourceSignals
          .filter((signal): signal is RepositorySignal => signal.source === 'github')
          .reduce((sum, repo) => sum + repo.starsToday, 0)
      : 0;

    const hnSignal = hnSignals[0];
    const companyName = productSignal?.companyName ??
                        repoSignals[0]?.companyName ??
                        (hnSignal && 'companyName' in hnSignal ? hnSignal.companyName : 'Unknown');
    const productName = productSignal?.productName ??
                        repoSignals[0]?.repoName ??
                        (hnSignal && 'productName' in hnSignal ? hnSignal.productName : 'Unknown');

    companies.push({
      id,
      companyName,
      productName,
      canonicalUrl: chooseCanonicalUrl(companySignals),
      summary,
      categories,
      sourceSignals: companySignals,
      founders,
      githubContributors: contributors,
      whyNow: buildWhyNow(companySignals, previous),
      thesis: inferThesis(companyName, categories, summary),
      recommendedAction: chooseAction(scores.overall),
      stageGuess: inferStage(companySignals),
      scores,
      delta: {
        isNew: !previous,
        launchCountDelta: companySignals.filter(signal => signal.source === 'product_hunt').length
          - (previous?.sourceSignals.filter(signal => signal.source === 'product_hunt').length ?? 0),
        repoCountDelta: repoSignals.length
          - (previous?.sourceSignals.filter(signal => signal.source === 'github').length ?? 0),
        starsTodayDelta: starsToday - previousStarsToday,
        contributorDelta: contributors.length - (previous?.githubContributors.length ?? 0),
        scoreDelta: scores.overall - (previous?.scores.overall ?? 0),
      },
    });
  }

  return companies.sort((a, b) => b.scores.overall - a.scores.overall);
}

function buildCategoryMomentum(companies: CompanyProfile[], previousSnapshot?: DailySnapshot): CategoryMomentum[] {
  const currentMap = new Map<string, CompanyProfile[]>();
  const previousMap = new Map<string, number>();

  for (const company of companies) {
    for (const category of company.categories) {
      const current = currentMap.get(category) ?? [];
      current.push(company);
      currentMap.set(category, current);
    }
  }

  for (const company of previousSnapshot?.companies ?? []) {
    for (const category of company.categories) {
      previousMap.set(category, (previousMap.get(category) ?? 0) + 1);
    }
  }

  return Array.from(currentMap.entries())
    .map(([name, categoryCompanies]) => ({
      name,
      companyCount: categoryCompanies.length,
      previousCompanyCount: previousMap.get(name) ?? 0,
      momentumDelta: categoryCompanies.length - (previousMap.get(name) ?? 0),
      averageScore: Math.round(categoryCompanies.reduce((sum, company) => sum + company.scores.overall, 0) / categoryCompanies.length),
    }))
    .sort((a, b) => b.momentumDelta - a.momentumDelta || b.averageScore - a.averageScore)
    .slice(0, 6);
}

function buildPeopleToMeet(companies: CompanyProfile[]): PersonToMeet[] {
  const people: PersonToMeet[] = [];

  for (const company of companies) {
    const candidates = dedupePeople([...company.founders, ...company.githubContributors]).slice(0, 3);
    for (const person of candidates) {
      const score = company.scores.overall + Math.min(person.followers ?? 0, 5000) / 250 + Math.min(person.contributions ?? 0, 100) / 5;
      people.push({
        companyId: company.id,
        companyName: company.companyName,
        person,
        reason: `${company.companyName} scored ${company.scores.overall}/100 with ${company.delta.isNew ? 'new emergence' : 'accelerating momentum'} and ${company.categories[0] ?? 'software'} relevance.`,
        score: Math.round(score),
      });
    }
  }

  return people
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildDailyBrief(date: string, companies: CompanyProfile[], previousSnapshot?: DailySnapshot): DailyBrief {
  const launchesToday = companies
    .filter(company =>
      company.sourceSignals.some((signal): signal is ProductSignal =>
        signal.source === 'product_hunt' && isSameLocalDate(signal.createdAt, date),
      ),
    )
    .sort((a, b) => {
      // Sort by overall score since we don't have real vote counts
      return b.scores.overall - a.scores.overall;
    })
    .slice(0, 12);

  const emergingCompanies = companies
    .filter(company => company.delta.isNew || company.scores.emerging >= 60)
    .sort((a, b) => b.scores.emerging - a.scores.emerging)
    .slice(0, 10);

  const acceleratingCompanies = companies
    .filter(company => !company.delta.isNew && (company.delta.starsTodayDelta > 0 || company.delta.scoreDelta > 0))
    .sort((a, b) => b.delta.starsTodayDelta - a.delta.starsTodayDelta || b.delta.scoreDelta - a.delta.scoreDelta)
    .slice(0, 10);

  return {
    date,
    launchesToday,
    emergingCompanies,
    acceleratingCompanies,
    categoryMomentum: buildCategoryMomentum(companies, previousSnapshot),
    foundersToMeet: buildPeopleToMeet(companies),
    allCompanies: companies,
  };
}
