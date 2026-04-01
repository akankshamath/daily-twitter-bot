import { CompanyProfile, CompanySignal, ContributorProfile, DailyBrief, DailySnapshot, ProductSignal, RepositorySignal, CategoryMomentum, PersonToMeet } from './types';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/www\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
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

  if (signal.source === 'twitter' && signal.websiteUrl) {
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
    let launchText = 'Launched on Product Hunt today';
    const details: string[] = [];

    if (launch.votesCount && launch.votesCount > 0) {
      details.push(`${launch.votesCount} upvotes`);
    }
    if (launch.commentsCount && launch.commentsCount > 0) {
      details.push(`${launch.commentsCount} comments`);
    }

    if (details.length > 0) {
      launchText += ` with ${details.join(' and ')}`;
    }

    launchText += '.';
    items.push(launchText);
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

function inferThesis(
  companyName: string,
  productName: string,
  categories: string[],
  signals: CompanySignal[],
  recommendedAction: CompanyProfile['recommendedAction'],
): string {
  const primaryCategory = (categories[0] ?? 'software').toLowerCase();
  const parts: string[] = [];
  const launch = signals.find((signal): signal is ProductSignal => signal.source === 'product_hunt');
  const hnSignals = signals.filter(signal => signal.source === 'hacker_news');
  const repos = signals.filter((signal): signal is RepositorySignal => signal.source === 'github');

  if (launch) {
    const launchDetails: string[] = [];
    if (launch.rank && launch.rank <= 5) {
      launchDetails.push(`ranked #${launch.rank} on Product Hunt`);
    }
    if (launch.votesCount && launch.votesCount > 0) {
      launchDetails.push(`${launch.votesCount} upvotes`);
    }
    if (launch.commentsCount && launch.commentsCount > 0) {
      launchDetails.push(`${launch.commentsCount} comments`);
    }

    parts.push(
      launchDetails.length > 0
        ? `${productName} is getting live launch-day demand in ${primaryCategory} with ${launchDetails.join(', ')}.`
        : `${productName} is a fresh Product Hunt launch in ${primaryCategory}, which makes this a timely first-look opportunity.`,
    );
  }

  if (hnSignals.length > 0) {
    const totalPoints = hnSignals.reduce((sum, signal) => sum + ('score' in signal ? signal.score : 0), 0);
    const totalComments = hnSignals.reduce((sum, signal) => sum + ('commentsCount' in signal ? signal.commentsCount : 0), 0);
    const showHNCount = hnSignals.filter(signal => 'storyType' in signal && signal.storyType === 'show_hn').length;

    if (showHNCount > 0) {
      parts.push(`Hacker News discussion is founder-led, with ${showHNCount} Show HN post${showHNCount > 1 ? 's' : ''}, ${totalPoints} points, and ${totalComments} comments.`);
    } else {
      parts.push(`Hacker News is providing organic distribution with ${totalPoints} points and ${totalComments} comments.`);
    }
  }

  if (repos.length > 0) {
    const totalStarsToday = repos.reduce((sum, repo) => sum + repo.starsToday, 0);
    const repoCount = repos.length;
    parts.push(`${repoCount} GitHub repo${repoCount > 1 ? 's are' : ' is'} adding ${totalStarsToday.toLocaleString()} stars today, which points to real developer pull.`);
  }

  if (launch && (hnSignals.length > 0 || repos.length > 0)) {
    parts.push(`${companyName} is showing cross-channel validation rather than a single-source spike.`);
  }

  const actionText = recommendedAction === 'reach_out'
    ? 'This looks worth an immediate outreach while the signal is still fresh.'
    : recommendedAction === 'research'
      ? 'This looks worth deeper research before the current momentum cools.'
      : 'This is worth watching for repeat traction across additional channels.';

  parts.push(actionText);

  return parts.join(' ');
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

function buildLaunchCards(companies: CompanyProfile[], date: string): CompanyProfile[] {
  const launchCards: CompanyProfile[] = [];

  for (const company of companies) {
    const productSignals = company.sourceSignals.filter((signal): signal is ProductSignal =>
      signal.source === 'product_hunt' && isSameLocalDate(signal.createdAt, date),
    );

    for (const signal of productSignals) {
      const launchFounder = signal.makerName && signal.makerName !== 'Unknown'
        ? [{
            login: signal.makerName.toLowerCase().replace(/\s+/g, '-'),
            name: signal.makerName,
            profileUrl: signal.launchUrl,
            role: 'founder' as const,
            source: 'product_hunt' as const,
          }]
        : company.founders;

      launchCards.push({
        ...company,
        id: `${company.id}-${signal.sourceId}`,
        companyName: signal.companyName,
        productName: signal.productName,
        canonicalUrl: signal.websiteUrl || signal.launchUrl || company.canonicalUrl,
        summary: signal.description || signal.tagline,
        categories: signal.topics.length > 0 ? signal.topics : company.categories,
        sourceSignals: [signal],
        founders: launchFounder,
        githubContributors: [],
        whyNow: [
          `Launched on Product Hunt today${signal.rank ? ` at rank #${signal.rank}` : ''}${signal.votesCount ? ` with ${signal.votesCount} upvotes` : ''}${signal.commentsCount ? ` and ${signal.commentsCount} comments` : ''}.`,
        ],
      });
    }
  }

  return launchCards
    .sort((a, b) => {
      const aSignal = a.sourceSignals[0] as ProductSignal;
      const bSignal = b.sourceSignals[0] as ProductSignal;
      return (bSignal.votesCount ?? 0) - (aSignal.votesCount ?? 0) || (aSignal.rank ?? 999) - (bSignal.rank ?? 999);
    })
    .slice(0, 5);
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

    const primaryRepo = repoSignals[0];
    const shouldFlipGitHubNames = !productSignal &&
      hnSignals.length === 0 &&
      !!primaryRepo &&
      normalizeLabel(primaryRepo.companyName) === normalizeLabel(primaryRepo.ownerLogin) &&
      normalizeLabel(primaryRepo.repoName) !== normalizeLabel(primaryRepo.ownerLogin);

    const hnSignal = hnSignals[0];
    const companyName = productSignal?.companyName ??
                        (shouldFlipGitHubNames ? primaryRepo.repoName : repoSignals[0]?.companyName) ??
                        (hnSignal && 'companyName' in hnSignal ? hnSignal.companyName : 'Unknown');
    const productName = productSignal?.productName ??
                        (shouldFlipGitHubNames ? primaryRepo.ownerLogin : repoSignals[0]?.repoName) ??
                        (hnSignal && 'productName' in hnSignal ? hnSignal.productName : 'Unknown');

    const recommendedAction = chooseAction(scores.overall);

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
      thesis: inferThesis(companyName, productName, categories, companySignals, recommendedAction),
      recommendedAction,
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
      const trendingBonus = person.trendingRank ? Math.max(0, 16 - person.trendingRank) * 3 : 0;
      const score = company.scores.overall
        + Math.min(person.followers ?? 0, 5000) / 250
        + Math.min(person.contributions ?? 0, 100) / 5
        + trendingBonus;
      const popularRepoText = person.popularRepoName
        ? ` Popular repo: ${person.popularRepoName}${person.popularRepoDescription ? ` - ${person.popularRepoDescription}` : ''}.`
        : '';
      const trendingText = person.trendingRank
        ? ` Ranked #${person.trendingRank} on GitHub Trending Developers.`
        : '';

      people.push({
        companyId: company.id,
        companyName: company.companyName,
        person,
        reason: `${company.companyName} scored ${company.scores.overall}/100 with ${company.delta.isNew ? 'new emergence' : 'accelerating momentum'} and ${company.categories[0] ?? 'software'} relevance.${trendingText}${popularRepoText}`,
        score: Math.round(score),
      });
    }
  }

  return people
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildDailyBrief(date: string, companies: CompanyProfile[], previousSnapshot?: DailySnapshot): DailyBrief {
  const launchesToday = buildLaunchCards(companies, date);

  const emergingCompanies = companies
    .filter(company => company.delta.isNew || company.scores.emerging >= 60)
    .sort((a, b) => b.scores.emerging - a.scores.emerging)
    .slice(0, 10);

  const acceleratingCompanies = companies
    .filter(company => !company.delta.isNew && (company.delta.starsTodayDelta > 0 || company.delta.scoreDelta > 0))
    .sort((a, b) => b.delta.starsTodayDelta - a.delta.starsTodayDelta || b.delta.scoreDelta - a.delta.scoreDelta)
    .slice(0, 10);

  // Twitter founder signals - early-stage builders
  const twitterFounders = companies
    .filter(company => company.sourceSignals.some(signal => signal.source === 'twitter'))
    .sort((a, b) => {
      const aTwitterCount = a.sourceSignals.filter(s => s.source === 'twitter').length;
      const bTwitterCount = b.sourceSignals.filter(s => s.source === 'twitter').length;
      return bTwitterCount - aTwitterCount || b.scores.overall - a.scores.overall;
    })
    .slice(0, 10);

  return {
    date,
    launchesToday,
    emergingCompanies,
    acceleratingCompanies,
    twitterFounders,
    categoryMomentum: buildCategoryMomentum(companies, previousSnapshot),
    foundersToMeet: buildPeopleToMeet(companies),
    allCompanies: companies,
  };
}
