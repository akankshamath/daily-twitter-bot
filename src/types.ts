export interface ContributorProfile {
  login: string;
  name: string;
  profileUrl: string;
  avatarUrl?: string;
  company?: string;
  bio?: string;
  followers?: number;
  contributions?: number;
  trendingRank?: number;
  popularRepoName?: string;
  popularRepoDescription?: string;
  popularRepoUrl?: string;
  role: 'founder' | 'core_builder' | 'maintainer';
  source: 'github' | 'product_hunt' | 'hacker_news';
}

export interface ProductSignal {
  source: 'product_hunt';
  sourceId: string;
  collectedAt: string;
  companyName: string;
  productName: string;
  launchUrl: string;
  websiteUrl?: string;
  description: string;
  tagline: string;
  topics: string[];
  makerName: string;
  votesCount?: number;  // Optional - RSS doesn't provide this
  commentsCount?: number;  // Optional - RSS doesn't provide this
  rank?: number;
  createdAt: string;
}

export interface RepositorySignal {
  source: 'github';
  sourceId: string;
  collectedAt: string;
  companyName: string;
  repoName: string;
  repoUrl: string;
  homepageUrl?: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  starsToday: number;
  ownerLogin: string;
  ownerType: string;
  topics: string[];
  contributors: ContributorProfile[];
}

export interface HackerNewsSignal {
  source: 'hacker_news';
  sourceId: string;
  collectedAt: string;
  storyType: 'show_hn' | 'top_story';
  companyName: string;
  productName: string;
  storyUrl: string;
  websiteUrl?: string;
  title: string;
  description: string;
  authorUsername: string;
  authorKarma: number;
  authorCreated?: string;
  score: number;
  commentsCount: number;
  createdAt: string;
}

export interface TwitterSignal {
  source: 'twitter';
  sourceId: string;
  collectedAt: string;
  companyName: string;
  productName: string;
  tweetUrl: string;
  websiteUrl?: string;
  description: string;
  authorUsername: string;
  authorFollowers: number;
  likes: number;
  retweets: number;
  replies: number;
  relevanceScore: number;
  createdAt: string;
}

export type CompanySignal = ProductSignal | RepositorySignal | HackerNewsSignal | TwitterSignal;

export interface CompanyScores {
  overall: number;
  emerging: number;
  acceleration: number;
  founderStrength: number;
}

export interface CompanyDelta {
  isNew: boolean;
  launchCountDelta: number;
  repoCountDelta: number;
  starsTodayDelta: number;
  contributorDelta: number;
  scoreDelta: number;
}

export interface CompanyProfile {
  id: string;
  companyName: string;
  productName: string;
  canonicalUrl?: string;
  summary: string;
  categories: string[];
  sourceSignals: CompanySignal[];
  founders: ContributorProfile[];
  githubContributors: ContributorProfile[];
  whyNow: string[];
  thesis: string;
  recommendedAction: 'watch' | 'research' | 'reach_out';
  stageGuess: 'pre_seed' | 'seed' | 'growth' | 'unclear';
  scores: CompanyScores;
  delta: CompanyDelta;
}

export interface CategoryMomentum {
  name: string;
  companyCount: number;
  previousCompanyCount: number;
  momentumDelta: number;
  averageScore: number;
}

export interface PersonToMeet {
  companyId: string;
  companyName: string;
  person: ContributorProfile;
  reason: string;
  score: number;
}

export interface DailyBrief {
  date: string;
  launchesToday: CompanyProfile[];
  emergingCompanies: CompanyProfile[];
  acceleratingCompanies: CompanyProfile[];
  twitterFounders: CompanyProfile[];
  categoryMomentum: CategoryMomentum[];
  foundersToMeet: PersonToMeet[];
  allCompanies: CompanyProfile[];
}

export interface SnapshotMeta {
  lastMessageId?: string;
}

export interface DailySnapshot {
  date: string;
  companies: CompanyProfile[];
  meta?: SnapshotMeta;
}
