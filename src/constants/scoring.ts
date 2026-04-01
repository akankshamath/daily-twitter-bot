/**
 * Scoring weights and thresholds for Twitter founder intent detection
 */

// === FOUNDER INTENT SIGNAL WEIGHTS ===
export const INTENT_WEIGHTS = {
  COFOUNDER_SEARCH: 5,        // Highest signal - ready to commit
  ACTIVE_BUILDING: 4,          // Present continuous tense
  QUIT_JOB: 4,                 // Major commitment
  FIRST_MILESTONE: 4,          // Shows execution
  WORKING_ON: 3,               // Specific work
  VALIDATION_PHASE: 3,         // Testing market fit
  BUILDING_IN_PUBLIC: 2,       // Consistent updates
  PROBLEM_DISCOVERY: 2,        // Early ideation
};

// === CREDIBILITY INDICATOR WEIGHTS ===
export const CREDIBILITY_WEIGHTS = {
  HAS_LINK: 2,                 // Tangible product/demo
  TECH_STACK: 1,               // Technical depth
  METRICS: 1,                  // Data-driven thinking
};

// === ENGAGEMENT THRESHOLDS ===
export const ENGAGEMENT_THRESHOLDS = {
  LIKES: {
    LOW: 20,
    MEDIUM: 50,
    HIGH: 100,
  },
  RETWEETS: {
    LOW: 10,
    MEDIUM: 25,
  },
  REPLIES: {
    ENGAGED: 10,
  },
};

// === FOLLOWER THRESHOLDS ===
export const FOLLOWER_THRESHOLDS = {
  SOME_AUDIENCE: 500,
  ESTABLISHED: 1000,
  STRONG_NETWORK: 5000,
  INFLUENTIAL: 10000,
};

// === NEGATIVE SIGNAL PENALTIES ===
export const PENALTY_WEIGHTS = {
  EDUCATIONAL_CONTENT: -4,
  SPAM: -5,
  MOTIVATIONAL: -3,
  EXCESSIVE_HASHTAGS: -2,
};

// === SCORING LIMITS ===
export const SCORING_LIMITS = {
  BASE_SCORE: 5,
  MIN_SCORE: 0,
  MAX_SCORE: 10,
  QUALITY_THRESHOLD: 7,        // Minimum score to be considered high-quality
  MAX_HASHTAGS: 4,             // More than this is considered spammy
};
