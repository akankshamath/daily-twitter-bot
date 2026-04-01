/**
 * Search queries for detecting early-stage founder intent on Twitter
 * Organized by signal strength and stage of company building
 */

export interface QueryCategory {
  name: string;
  description: string;
  queries: string[];
}

export const FOUNDER_INTENT_QUERIES: QueryCategory[] = [
  {
    name: 'Active Building',
    description: 'Present continuous tense - highest intent signal',
    queries: [
      '"I\'m building" min_faves:10 -filter:replies',
      '"We\'re building" min_faves:10 -filter:replies',
      '"Currently building" min_faves:10 -filter:replies',
      '"Started building" min_faves:10 -filter:replies',
    ],
  },
  {
    name: 'Co-founder Search',
    description: 'Very strong early commitment signal',
    queries: [
      '"looking for a co-founder" min_faves:5 -filter:replies',
      '"looking for technical co-founder" min_faves:5 -filter:replies',
      '"need a co-founder" min_faves:5 -filter:replies',
      '"searching for co-founder" min_faves:5 -filter:replies',
    ],
  },
  {
    name: 'Active Work',
    description: 'Working on something specific',
    queries: [
      '"working on" (startup OR product OR app OR saas) min_faves:10 -filter:replies',
      '"spent the last" (months OR weeks) "building" min_faves:10 -filter:replies',
      '"been working on" min_faves:8 -filter:replies',
    ],
  },
  {
    name: 'Career Commitment',
    description: 'Quit job to build - major commitment signal',
    queries: [
      '"quit my job" (build OR startup OR founder) min_faves:10 -filter:replies',
      '"left my job to" (build OR start) min_faves:10 -filter:replies',
      '"going full-time on" min_faves:8 -filter:replies',
    ],
  },
  {
    name: 'Validation Phase',
    description: 'Testing market fit and gathering feedback',
    queries: [
      '"testing" (idea OR prototype OR mvp OR beta) min_faves:8 -filter:replies',
      '"validating" (idea OR market OR product) min_faves:5 -filter:replies',
      '"looking for beta users" min_faves:10 -filter:replies',
      '"need feedback on" min_faves:8 -filter:replies',
    ],
  },
  {
    name: 'Building in Public',
    description: 'Consistent progress updates',
    queries: [
      '"Day" ("of building" OR "building in public") min_faves:5 -filter:replies',
      '#buildinpublic (progress OR update OR shipped) min_faves:10 -filter:replies',
    ],
  },
  {
    name: 'Problem Discovery',
    description: 'Early ideation and problem identification',
    queries: [
      '"Why doesn\'t" (exist OR tool OR app) min_faves:8 -filter:replies',
      '"Why isn\'t there" (product OR service OR tool) min_faves:8 -filter:replies',
      '"frustrated with" (current OR existing) min_faves:10 -filter:replies',
    ],
  },
  {
    name: 'First Milestones',
    description: 'Early revenue and customer validation',
    queries: [
      '"first customer" OR "first paying customer" min_faves:15 -filter:replies',
      '"first $" OR "first sale" OR "first revenue" min_faves:15 -filter:replies',
    ],
  },
  {
    name: 'Domain-Specific Building',
    description: 'Building in specific tech categories',
    queries: [
      '("building" OR "working on") (#ai OR #machinelearning OR #llm) min_faves:10 -filter:replies',
      '("building" OR "creating") (#saas OR #b2b OR #devtools) min_faves:10 -filter:replies',
      '("building" OR "developing") (#crypto OR #web3 OR #blockchain) min_faves:10 -filter:replies',
    ],
  },
];

/**
 * Get all queries as a flat array
 */
export function getAllQueries(): string[] {
  return FOUNDER_INTENT_QUERIES.flatMap(category => category.queries);
}

/**
 * Get queries by category name
 */
export function getQueriesByCategory(categoryName: string): string[] {
  const category = FOUNDER_INTENT_QUERIES.find(c => c.name === categoryName);
  return category?.queries ?? [];
}
