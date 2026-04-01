/**
 * Founder Intent Scoring Service
 * Evaluates Twitter signals for early-stage founder credibility and intent
 */

import {
  INTENT_WEIGHTS,
  CREDIBILITY_WEIGHTS,
  ENGAGEMENT_THRESHOLDS,
  FOLLOWER_THRESHOLDS,
  PENALTY_WEIGHTS,
  SCORING_LIMITS,
} from '../constants/scoring';

export interface Tweet {
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  followers: number;
}

export interface ScoreBreakdown {
  intentScore: number;
  credibilityScore: number;
  engagementScore: number;
  networkScore: number;
  penaltyScore: number;
  totalScore: number;
}

/**
 * Calculate comprehensive relevance score for a tweet
 */
export function calculateRelevanceScore(tweet: Tweet): number {
  const breakdown = getScoreBreakdown(tweet);
  return Math.max(
    SCORING_LIMITS.MIN_SCORE,
    Math.min(SCORING_LIMITS.MAX_SCORE, breakdown.totalScore)
  );
}

/**
 * Get detailed score breakdown for debugging and analysis
 */
export function getScoreBreakdown(tweet: Tweet): ScoreBreakdown {
  const text = tweet.text.toLowerCase();

  const intentScore = calculateIntentScore(text);
  const credibilityScore = calculateCredibilityScore(text);
  const engagementScore = calculateEngagementScore(tweet);
  const networkScore = calculateNetworkScore(tweet.followers);
  const penaltyScore = calculatePenalties(text);

  const totalScore = SCORING_LIMITS.BASE_SCORE +
    intentScore +
    credibilityScore +
    engagementScore +
    networkScore +
    penaltyScore;

  return {
    intentScore,
    credibilityScore,
    engagementScore,
    networkScore,
    penaltyScore,
    totalScore,
  };
}

/**
 * Calculate founder intent signals score
 */
function calculateIntentScore(text: string): number {
  let score = 0;

  // Co-founder search (strongest signal)
  if (/\b(looking for.*co-?founder|need.*co-?founder|searching.*co-?founder|seeking.*co-?founder)\b/.test(text)) {
    score += INTENT_WEIGHTS.COFOUNDER_SEARCH;
  }

  // Active building
  if (/\b(i'm building|we're building|currently building|actively building|started building)\b/.test(text)) {
    score += INTENT_WEIGHTS.ACTIVE_BUILDING;
  }

  // Quit job to build
  if (/\b(quit.*job|left.*job|leaving.*job|resigned).*(build|startup|founder|full-time)\b/.test(text)) {
    score += INTENT_WEIGHTS.QUIT_JOB;
  }

  // First milestone
  if (/\b(first customer|first.*paying|first \$|first sale|first revenue|reached.*mrr)\b/.test(text)) {
    score += INTENT_WEIGHTS.FIRST_MILESTONE;
  }

  // Working on something
  if (/\b(working on|spent.*building|been working on)\b/.test(text)) {
    score += INTENT_WEIGHTS.WORKING_ON;
  }

  // Validation phase
  if (/\b(testing|validating|looking for beta users|need feedback|first users)\b/.test(text)) {
    score += INTENT_WEIGHTS.VALIDATION_PHASE;
  }

  // Building in public
  if (/\b(day \d+|building in public|#buildinpublic|progress update)\b/.test(text)) {
    score += INTENT_WEIGHTS.BUILDING_IN_PUBLIC;
  }

  // Problem discovery
  if (/\b(why doesn't|why isn't there|frustrated with|wish there was)\b/.test(text)) {
    score += INTENT_WEIGHTS.PROBLEM_DISCOVERY;
  }

  return score;
}

/**
 * Calculate credibility indicators score
 */
function calculateCredibilityScore(text: string): number {
  let score = 0;

  // Has link (website, demo, etc.)
  if (/https?:\/\//.test(text)) {
    score += CREDIBILITY_WEIGHTS.HAS_LINK;
  }

  // Mentions tech stack
  if (/\b(react|nextjs|typescript|python|go|rust|postgres|supabase|vercel|aws|kubernetes|docker)\b/.test(text)) {
    score += CREDIBILITY_WEIGHTS.TECH_STACK;
  }

  // Shows metrics
  if (/\b(\d+%|\d+x|\d+k users|\$\d+|mrr|arr)\b/.test(text)) {
    score += CREDIBILITY_WEIGHTS.METRICS;
  }

  return score;
}

/**
 * Calculate engagement score based on likes, retweets, replies
 */
function calculateEngagementScore(tweet: Tweet): number {
  let score = 0;

  // Likes
  if (tweet.likes >= ENGAGEMENT_THRESHOLDS.LIKES.HIGH) score += 3;
  else if (tweet.likes >= ENGAGEMENT_THRESHOLDS.LIKES.MEDIUM) score += 2;
  else if (tweet.likes >= ENGAGEMENT_THRESHOLDS.LIKES.LOW) score += 1;

  // Retweets
  if (tweet.retweets >= ENGAGEMENT_THRESHOLDS.RETWEETS.MEDIUM) score += 2;
  else if (tweet.retweets >= ENGAGEMENT_THRESHOLDS.RETWEETS.LOW) score += 1;

  // Replies (engaged audience)
  if (tweet.replies >= ENGAGEMENT_THRESHOLDS.REPLIES.ENGAGED) score += 1;

  return score;
}

/**
 * Calculate network credibility score based on follower count
 */
function calculateNetworkScore(followers: number): number {
  let score = 0;

  if (followers >= FOLLOWER_THRESHOLDS.INFLUENTIAL) score += 4;
  else if (followers >= FOLLOWER_THRESHOLDS.STRONG_NETWORK) score += 3;
  else if (followers >= FOLLOWER_THRESHOLDS.ESTABLISHED) score += 2;
  else if (followers >= FOLLOWER_THRESHOLDS.SOME_AUDIENCE) score += 1;

  return score;
}

/**
 * Calculate penalties for spam and low-quality content
 */
function calculatePenalties(text: string): number {
  let penalty = 0;

  // Educational/tutorial content
  if (/\b(tutorial|guide|tips|how to|top \d+|thread|lessons learned|advice)\b/.test(text)) {
    penalty += PENALTY_WEIGHTS.EDUCATIONAL_CONTENT;
  }

  // Spam/promotional
  if (/\b(hiring|job opening|we're hiring|join our team|giveaway|contest|follow|retweet to win|check out my)\b/.test(text)) {
    penalty += PENALTY_WEIGHTS.SPAM;
  }

  // Motivational posts
  if (/\b(inspirational|motivation|believe in yourself|never give up|keep going)\b/.test(text)) {
    penalty += PENALTY_WEIGHTS.MOTIVATIONAL;
  }

  // Excessive hashtags
  const hashtagCount = (text.match(/#/g) || []).length;
  if (hashtagCount > SCORING_LIMITS.MAX_HASHTAGS) {
    penalty += PENALTY_WEIGHTS.EXCESSIVE_HASHTAGS;
  }

  return penalty;
}

/**
 * Check if a score meets the quality threshold
 */
export function meetsQualityThreshold(score: number): boolean {
  return score >= SCORING_LIMITS.QUALITY_THRESHOLD;
}
