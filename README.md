# Daily Tech Digest Bot

A TypeScript bot that automatically tracks product launches from Product Hunt, tech trends from Hacker News, and trending GitHub repositories, then sends beautiful daily email digests.

## Features

- **Product Launches**: Top launches from Product Hunt with makers, categories, and upvotes
- **Tech Trends**: Trending tech stories from Hacker News
- **GitHub Trending**: Top 5 most starred repositories daily
- **Daily Email Digest**: Beautiful HTML emails with card-based design
- **100% Free**: No API costs - uses free public APIs and web scraping
- **Configurable**: Customize schedule, content limits, and recipients
- **Type-Safe**: Built with TypeScript

## What You Get

Each morning, receive an email with:
1. **Product Launches** - New products from Product Hunt with maker names, descriptions, and categories
2. **Tech Trends** - Top Hacker News stories filtered for tech content
3. **GitHub Trending** - Top 5 trending repositories with stars gained today

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
MAX_TRENDS=5
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

**MAX_LAUNCHES**: Max Product Hunt launches (default: 5)
**MAX_TRENDS**: Max Hacker News stories (default: 5)

## How It Works

### Product Hunt Integration
- Uses Product Hunt RSS feed (no API key needed!)
- Fetches real product launches with names, descriptions, and links
- Estimates popularity based on feed position
- Includes taglines, topics, and direct links to products
- **Note**: Upvote counts are estimated (RSS doesn't include exact numbers)

### Hacker News Integration
- Uses official [Hacker News Firebase API](https://github.com/HackerNews/API)
- Fetches top stories
- Filters for tech-related content using keywords
- Filters by minimum score
- Sorts by points

### GitHub Trending Integration
- Scrapes [GitHub Trending](https://github.com/trending) page using Cheerio
- Fetches daily trending repositories (most starred today)
- Extracts repo name, author, description, language, and star counts
- Shows stars gained today vs total stars
- Top 5 repos with green accent border (GitHub brand color)
- **Note**: Uses web scraping (no API key needed)

### Email Digest
- Beautiful responsive HTML design with card-based layout
- Plain text fallback included
- Three sections: Product Hunt, Hacker News, and GitHub
- Color-coded accent borders (blue for PH, orange for HN, green for GitHub)
- Direct links to products, discussions, and repositories
- Clean, minimal styling with subtle shadows

## Project Structure

```
daily-twitter-bot/
├── src/
│   ├── index.ts              # Main app + scheduler
│   ├── config.ts             # Environment config
│   ├── productHuntClient.ts  # Product Hunt RSS parser
│   ├── hackerNewsClient.ts   # Hacker News API
│   ├── githubClient.ts       # GitHub trending scraper
│   └── emailService.ts       # Gmail sender + templates
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

Send one email immediately:
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

## Upgrading to Official Product Hunt API (Optional)

The bot already uses **real Product Hunt data via RSS feed**. To get exact upvote counts instead of estimates:

1. **Apply for API access**: https://api.producthunt.com/v2/docs
2. **Get OAuth token**: Follow PH API authentication docs
3. **Update `productHuntClient.ts:37`**: Replace RSS parsing with GraphQL queries
4. **Add to `.env`**:
   ```env
   PRODUCT_HUNT_API_TOKEN=your_token_here
   ```

Both Product Hunt (RSS) and Hacker News data are already real and live!

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
- Adjust MAX_LAUNCHES if needed
- Bot will fall back to example data if RSS fails

**No trends shown**
- Lower MIN_UPVOTES in .env (default is 50)
- Check Hacker News is accessible
- Tech keyword filter might be too strict

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
