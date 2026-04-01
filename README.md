# VC Daily Dealflow Bot

A TypeScript bot that tracks Product Hunt launches and GitHub momentum, enriches them into company profiles, and sends a daily investor-style email thread.

## Features

- **Product Hunt Signals**: Daily launches with maker names, topics, and estimated launch momentum
- **GitHub Signals**: Trending repositories enriched with contributors, public company hints, homepage URLs, and stars gained today
- **Investor Email Thread**: A recurring daily email thread grouped into emerging companies, accelerating companies, hot categories, and founders/builders to meet
- **Daily Snapshots**: Stores recent snapshots locally so each digest can compare today versus prior days
- **Configurable**: Customize schedule, content limits, recipients, subject line, and snapshot path
- **Type-Safe**: Built with TypeScript

## What You Get

Each morning, receive an email with:
1. **Newly Emerging Companies** - startups surfacing through Product Hunt and GitHub
2. **Existing Companies Accelerating** - tracked companies with rising momentum versus earlier snapshots
3. **Categories Heating Up** - sectors with increasing company count and stronger average scores
4. **Founders And Builders To Meet Now** - makers, repo owners, and core contributors tied to the highest-signal companies

## Prerequisites

- Node.js (v18 or higher)
- Gmail account with App Password

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (if not already enabled)
3. Search for **"App passwords"** in settings
4. Generate a new app password for **"Mail"**
5. Copy the 16-character password (remove spaces)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your details:

```env
# Gmail Configuration
GMAIL_USER=your-launches-bot@gmail.com
GMAIL_APP_PASSWORD=abcdabcdabcdabcd

# Email Recipients (comma-separated)
EMAIL_TO=you@company.com,colleague@company.com

# Schedule (9 AM daily)
CRON_SCHEDULE=0 9 * * *

# Content limits
MAX_LAUNCHES=5
MAX_EMERGING_COMPANIES=10
MAX_ACCELERATING_COMPANIES=10
MAX_PEOPLE_TO_MEET=8

# Optional GitHub API token for richer enrichment
GITHUB_TOKEN=

# Email thread + snapshot storage
EMAIL_SUBJECT=500 Startup News
SNAPSHOT_FILE=.data/daily-snapshots.json
```

### 4. Test It

```bash
npm run build
npm run dev -- --test
```

This sends a test email immediately. Check your inbox!

### 5. Run Daily

```bash
npm start
```

Bot runs in the background and sends emails at your scheduled time.

## Configuration

### Email Settings

**GMAIL_USER**: Your Gmail address
**GMAIL_APP_PASSWORD**: 16-char app password (not your regular password!)
**EMAIL_TO**: Comma-separated list of recipients

### Schedule

Uses cron syntax:

```bash
0 9 * * *      # 9 AM daily (default)
0 9 * * 1-5    # 9 AM weekdays only
0 */6 * * *    # Every 6 hours
30 8 * * *     # 8:30 AM daily
```

Test your cron expression: https://crontab.guru

### Content Limits

**MAX_LAUNCHES**: Max Product Hunt launches to ingest
**MAX_EMERGING_COMPANIES**: Max companies in the emerging section
**MAX_ACCELERATING_COMPANIES**: Max companies in the accelerating section
**MAX_PEOPLE_TO_MEET**: Max founder/builder profiles in the outreach section

### GitHub Enrichment

**GITHUB_TOKEN**: Optional but recommended. Improves GitHub API rate limits and contributor/company enrichment.

### Email Threading And Snapshot Storage

**EMAIL_SUBJECT**: Fixed subject used to keep digests in one email thread
**SNAPSHOT_FILE**: Local JSON file storing recent snapshots and the previous email `messageId`

## How It Works

### Product Hunt Integration
- Uses the Product Hunt RSS feed
- Builds company/product signals with launch summary, topics, maker name, and estimated launch momentum
- Upvote/comment counts remain estimates because RSS does not expose full Product Hunt analytics

### GitHub Integration
- Scrapes [GitHub Trending](https://github.com/trending) to discover repos with daily momentum
- Enriches each trending repo through the public GitHub API
- Pulls homepage URLs, topics, owner type, top contributors, and contributor profile data such as company and followers
- Works without a token, but rate limits are tighter

### Daily Snapshot And Briefing
- Stores local daily snapshots in JSON
- Detects newly emerging companies versus previously seen companies
- Compares momentum across snapshots to identify acceleration
- Aggregates category momentum
- Ranks founders/builders to meet now using company score plus profile strength

## Project Structure

```
daily-twitter-bot/
├── src/
│   ├── index.ts              # Main app + scheduler
│   ├── config.ts             # Environment config
│   ├── types.ts              # Shared normalized models
│   ├── storage.ts            # Local snapshot persistence
│   ├── companyEnricher.ts    # Company scoring + daily brief logic
│   ├── productHuntClient.ts  # Product Hunt RSS parser
│   ├── githubClient.ts       # GitHub trending scraper + API enrichment
│   └── emailService.ts       # Gmail sender + investor email templates
├── dist/                     # Compiled JS
├── .env                      # Your config
├── .env.example              # Config template
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### Development Mode

Run with auto-reload:
```bash
npm run dev
```

### Test Mode

Send one investor brief immediately:
```bash
npm run dev -- --test
```

### Production Mode

Run scheduled bot:
```bash
npm run build
npm start
```

## Running in Production

### Option 1: PM2 (Recommended)

Keep bot running with process manager:

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name tech-digest
pm2 save
pm2 startup  # Auto-start on reboot
```

Monitor:
```bash
pm2 logs tech-digest
pm2 status
```

### Option 2: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t tech-digest .
docker run -d --env-file .env --name tech-digest tech-digest
```

### Option 3: Screen/Tmux

```bash
screen -S tech-digest
npm start
# Press Ctrl+A then D to detach
```

Reattach later:
```bash
screen -r tech-digest
```

## Notes

- Product Hunt data is still RSS-based, so launch popularity remains estimated.
- GitHub contributor company names are best-effort and depend on public profile data.
- The thread view works best when `EMAIL_SUBJECT` stays fixed across days.

## Troubleshooting

### Email Not Sending

**Error: Invalid login / Authentication failed**
- Use App Password, not regular password
- Ensure 2-Step Verification is enabled
- Check for typos in GMAIL_USER and GMAIL_APP_PASSWORD

**Error: ENOTFOUND / Network error**
- Check internet connection
- Verify Gmail service is accessible

### No Content in Email

**No launches shown**
- Check if Product Hunt RSS feed is accessible
- Adjust `MAX_LAUNCHES` if needed
- The bot will omit Product Hunt launches for that run if the feed fails

**No GitHub contributor/company details**
- Add `GITHUB_TOKEN` to reduce rate-limit failures
- Some contributor profiles do not expose a public company name

### Bot Not Running at Scheduled Time

- Verify cron syntax at https://crontab.guru
- Ensure bot process is still running (`pm2 status` or check terminal)
- Check system timezone matches expected schedule
- Look for errors in logs

### Missing Environment Variables

```
Error: Missing required environment variable: GMAIL_USER
```

- Make sure `.env` file exists (not just `.env.example`)
- Check all required vars are set: GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO

## API Costs

### Product Hunt
- **RSS Feed**: Free, unlimited use
- **Official API**: Requires approval (optional upgrade)
- **Current**: Using free RSS feed

### Hacker News
- **Free**: Unlimited use of public API
- **Rate limits**: None for reasonable use

### GitHub Trending
- **Free**: Web scraping (no API key needed)
- **Rate limits**: Respect GitHub's robots.txt and ToS
- **Cost**: $0

### Gmail
- **Free**: 500 emails/day limit
- **Cost**: $0

**Total Monthly Cost: $0** 🎉

## Customization Ideas

### Add More Sources
- Reddit API (r/startups, r/technology)
- Dev.to API (trending articles)
- ArXiv trending papers (AI research)
- Twitter/X trending topics

### Filter Improvements
- Industry-specific filters (AI, crypto, SaaS)
- Company size filters
- Geographic filters

### Email Enhancements
- Weekly rollup option
- Categorize by topic
- Add charts/visualizations
- Personalized recommendations

### Notifications
- Slack webhooks
- Discord webhooks
- Push notifications

## Contributing

Feel free to:
- Add new data sources
- Improve filtering logic
- Enhance email templates
- Fix bugs

## License

ISC

## Resources

- [Hacker News API](https://github.com/HackerNews/API)
- [Product Hunt API](https://api.producthunt.com/v2/docs)
- [GitHub Trending](https://github.com/trending)
- [Cheerio (Web Scraping)](https://cheerio.js.org/)
- [Nodemailer Docs](https://nodemailer.com/)
- [Node-cron Docs](https://github.com/node-cron/node-cron)
- [Cron Expression Builder](https://crontab.guru)

## Support

Questions or issues? Check:
1. This README troubleshooting section
2. `.env.example` for configuration format
3. Console logs when running with `--test`

---

**Built with TypeScript, Product Hunt, Hacker News, GitHub, and Gmail**
