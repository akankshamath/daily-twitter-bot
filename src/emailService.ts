import nodemailer from 'nodemailer';
import { config } from './config';
import { CategoryMomentum, CompanyProfile, DailyBrief, PersonToMeet, ProductSignal, RepositorySignal } from './types';
import {
  modernSection as createModernSection,
  modernTwitterSection as createModernTwitterSection,
  modernPeopleSection as createModernPeopleSection
} from './emailService-modern';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.user,
        pass: config.email.appPassword,
      },
    });
  }

  async sendDailyDigest(brief: DailyBrief, lastMessageId?: string): Promise<string> {
    const date = this.formatBriefDate(brief.date);
    const subject = config.emailDigest.subject;
    const htmlContent = this.minifyHtml(this.generateHtmlContent(brief, date));
    const textContent = this.generateTextContent(brief, date);

    const mailOptions = {
      from: config.email.user,
      to: config.email.to,
      subject,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: ${info.messageId}`);
      return info.messageId;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  private minifyHtml(html: string): string {
    return html
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n/g, '')
      .trim();
  }

  private generateHtmlContent(brief: DailyBrief, date: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background:#f5f5f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7; padding:32px 16px;">
          <tr>
            <td align="center">
              <!-- Header -->
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">
                <tr>
                  <td style="padding:32px; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:12px 12px 0 0;">
                    <div style="font-size:28px; line-height:34px; font-weight:700; color:#ffffff;">
                      🚀 Daily Startup Signals
                    </div>
                    <div style="font-size:15px; line-height:22px; color:rgba(255,255,255,0.9); margin-top:8px;">
                      ${this.escapeHtml(date)}
                    </div>
                    <div style="font-size:14px; line-height:20px; color:rgba(255,255,255,0.8); margin-top:12px;">
                      Fresh founders, launches & momentum from Twitter, Product Hunt, GitHub, and Hacker News
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Stats Cards -->
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; margin-top:-10px;">
                <tr>
                  <td style="padding:24px 24px 12px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${this.modernStatCard('🚀', brief.launchesToday.length, 'Launches', '#10b981')}
                        ${this.modernStatCard('🐦', brief.twitterFounders.length, 'Founders', '#1d9bf0')}
                      </tr>
                      <tr>
                        ${this.modernStatCard('📈', brief.emergingCompanies.length, 'Emerging', '#8b5cf6')}
                        ${this.modernStatCard('⚡', brief.acceleratingCompanies.length, 'Accelerating', '#f59e0b')}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Main Content -->
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                ${this.modernSection('🚀 Products Launching Today', 'Fresh launches with immediate public signal', brief.launchesToday, 'launch')}
                ${this.modernTwitterSection(brief.twitterFounders)}
                ${this.modernSection('📈 Newly Emerging Companies', 'Companies clearing the momentum bar', brief.emergingCompanies, 'emerging')}
                ${this.modernSection('⚡ Companies Accelerating', 'Previously seen companies picking up speed', brief.acceleratingCompanies, 'accelerating')}
                ${this.modernPeopleSection(brief.foundersToMeet)}

                <!-- Footer -->
                <tr>
                  <td style="padding:24px; text-align:center; border-top:1px solid #e5e7eb;">
                    <div style="font-size:13px; color:#9ca3af; line-height:20px;">
                      Generated by Daily Startup Signals • ${new Date().toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;
  }

  private modernStatCard(emoji: string, value: number, label: string, color: string): string {
    return `
      <td width="50%" style="padding:8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:12px; border:2px solid ${color}20;">
          <tr>
            <td style="padding:16px; text-align:center;">
              <div style="font-size:24px; margin-bottom:8px;">${emoji}</div>
              <div style="font-size:32px; line-height:38px; font-weight:700; color:${color};">${value}</div>
              <div style="font-size:13px; line-height:18px; color:#6b7280; font-weight:600; margin-top:4px;">${this.escapeHtml(label)}</div>
            </td>
          </tr>
        </table>
      </td>
    `;
  }

  private modernSection(title: string, description: string, companies: CompanyProfile[], variant: string): string {
    return createModernSection(title, description, companies, variant, this.escapeHtml.bind(this));
  }

  private modernTwitterSection(founders: CompanyProfile[]): string {
    return createModernTwitterSection(founders, this.escapeHtml.bind(this));
  }

  private modernPeopleSection(people: PersonToMeet[]): string {
    return createModernPeopleSection(people, this.escapeHtml.bind(this));
  }

  private section(title: string, description: string, companies: CompanyProfile[], variant: 'launch' | 'emerging' | 'accelerating'): string {
    const content = companies.length === 0
      ? this.emptyState(`No companies cleared the ${variant} threshold today.`)
      : companies.map(company => this.companyCard(company, variant)).join('');

    return `
      <tr>
        <td style="padding:18px 24px 8px 24px;">
          <div style="font-size:20px; line-height:25px; font-weight:700; color:#0f172a;">${this.escapeHtml(title)}</div>
          <div style="font-size:13px; line-height:20px; color:#64748b; margin-top:5px;">${this.escapeHtml(description)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 4px 24px;">${content}</td>
      </tr>
    `;
  }

  private companyCard(company: CompanyProfile, variant: 'launch' | 'emerging' | 'accelerating'): string {
    const githubSignal = company.sourceSignals.find((signal) => signal.source === 'github');
    const hackerNewsSignal = company.sourceSignals.find((signal) => signal.source === 'hacker_news');
    const isGitHubLed = !!githubSignal && !company.sourceSignals.some(signal => signal.source === 'product_hunt');
    const isHackerNewsLed = !!hackerNewsSignal && !company.sourceSignals.some(signal => signal.source === 'product_hunt') && !githubSignal;
    const accentColor = variant === 'launch'
      ? '#0f766e'
      : variant === 'emerging'
        ? '#1d4ed8'
        : '#b45309';
    const scoreColor = variant === 'launch'
      ? '#ccfbf1'
      : variant === 'emerging'
        ? '#dbeafe'
        : '#fef3c7';
    const scoreText = variant === 'launch'
      ? '#115e59'
      : variant === 'emerging'
        ? '#1e40af'
        : '#92400e';
    const signalLabel = variant === 'launch'
      ? 'Launch'
      : variant === 'emerging'
        ? 'Emerging'
        : 'Accelerating';
    const sourceSummary = this.buildSourceSummary(company);
    const metaItems = [
      `Stage: ${company.stageGuess.replace('_', ' ')}`,
      `Action: ${company.recommendedAction.replace('_', ' ')}`,
      `Categories: ${company.categories.join(', ') || 'Software'}`,
    ];

    const productHuntSignal = company.sourceSignals.find(signal => signal.source === 'product_hunt');
    const launchRank = variant === 'launch' && productHuntSignal && 'rank' in productHuntSignal ? productHuntSignal.rank : undefined;
    const bottomText = variant === 'launch' && productHuntSignal && 'description' in productHuntSignal
      ? productHuntSignal.description
      : company.thesis;
    const bottomLabel = variant === 'launch' ? 'Description' : 'Investment angle';
    const showBottomText = variant === 'launch'
      ? bottomText !== company.summary
      : true;
    const metricPills = this.companyMetrics(company, variant, accentColor);
    const githubHeader = githubSignal ? `${githubSignal.ownerLogin}/${githubSignal.repoName}` : undefined;
    const headlineName = variant === 'launch'
      ? company.productName
      : isGitHubLed && githubHeader
        ? githubHeader
        : isHackerNewsLed
          ? company.productName
      : company.companyName;
    const headlineUrl = isGitHubLed && githubSignal ? githubSignal.repoUrl : company.canonicalUrl;
    const hasDistinctOrganization = company.companyName.trim().toLowerCase() !== company.productName.trim().toLowerCase();
    let secondaryLabel: string;
    if (variant === 'launch') {
      secondaryLabel = hasDistinctOrganization ? `Organization: ${company.companyName}` : '';
    } else if (isGitHubLed) {
      secondaryLabel = '';
    } else if (isHackerNewsLed) {
      secondaryLabel = `Company: ${company.companyName}`;
    } else {
      secondaryLabel = `Product: ${company.productName}`;
    }
    const launchContext = variant === 'launch'
      ? [company.companyName && company.companyName !== company.productName ? `Company: ${company.companyName}` : undefined,
         this.displayWebsiteHostname(company) ? `Website: ${this.displayWebsiteHostname(company)}` : undefined]
          .filter((item): item is string => Boolean(item))
          .join('  •  ')
      : '';
    const showSignalLabel = variant !== 'launch';

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0; border:1px solid #dbe4ee; border-left:5px solid ${accentColor};">
        <tr>
          <td style="padding:16px 16px 14px 16px; background:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${launchRank ? `<td width="72" style="vertical-align:top; padding-right:14px;">${this.rankBadge(launchRank)}</td>` : ''}
                <td style="vertical-align:top; padding-right:12px;">
                  ${showSignalLabel ? `<div style="font-size:12px; line-height:18px; text-transform:uppercase; letter-spacing:0.08em; color:${accentColor}; font-weight:700;">${signalLabel}</div>` : ''}
                  <div style="font-size:19px; line-height:24px; font-weight:700; color:#0f172a; margin-top:3px;">
                    <a href="${headlineUrl ?? '#'}" style="color:#0f172a; text-decoration:none;">${this.escapeHtml(headlineName)}</a>
                  </div>
                  ${secondaryLabel ? `<div style="font-size:12px; line-height:18px; color:#64748b; margin-top:3px;">${this.escapeHtml(secondaryLabel)}</div>` : ''}
                  ${launchContext ? `<div style="font-size:12px; line-height:18px; color:#475569; margin-top:5px;">${this.escapeHtml(launchContext)}</div>` : ''}
                  <div style="font-size:12px; line-height:18px; color:#475569; margin-top:5px;">Source mix: ${this.escapeHtml(sourceSummary)}</div>
                </td>
              </tr>
            </table>
            <div style="font-size:13px; line-height:20px; color:#334155; margin-top:10px;">${this.escapeHtml(company.summary)}</div>
            <div style="font-size:12px; line-height:18px; color:#475569; margin-top:8px;">${this.escapeHtml(metaItems.join('  •  '))}</div>
            <div style="margin-top:10px;">${metricPills}</div>
            ${showBottomText ? `<div style="font-size:12px; line-height:18px; color:#111827; margin-top:8px;">
              <strong>${bottomLabel}:</strong> ${this.escapeHtml(bottomText)}
            </div>` : ''}
          </td>
        </tr>
      </table>
    `;
  }

  private rankBadge(rank: number): string {
    const colors = {
      1: { color: '#fff1b5', backgroundColor: '#e3c000' },
      2: { color: '#efefef', backgroundColor: '#b6b6b6' },
      3: { color: '#ffc179', backgroundColor: '#bd6e3c' },
      4: { color: '#ffc179', backgroundColor: '#bd6e3c' },
      5: { color: '#ffc179', backgroundColor: '#bd6e3c' },
    } as const;

    const badge = colors[rank as keyof typeof colors];
    if (!badge) {
      return '';
    }

    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:56px; height:56px;">
        <tr>
          <td align="center" valign="middle" style="width:56px; height:56px; border-radius:28px; background:${badge.backgroundColor}; color:${badge.color}; font-size:28px; line-height:28px; font-weight:700;">
            ${rank}
          </td>
        </tr>
      </table>
    `;
  }

  private twitterFoundersSection(founders: CompanyProfile[]): string {
    if (founders.length === 0) {
      return '';
    }

    const content = founders.map(company => this.twitterFounderCard(company)).join('');

    return `
      <tr>
        <td style="padding:18px 24px 8px 24px;">
          <div style="font-size:20px; line-height:25px; font-weight:700; color:#0f172a;">🐦 Early-Stage Founders (Twitter)</div>
          <div style="font-size:13px; line-height:20px; color:#64748b; margin-top:5px;">Builders actively sharing their journey: co-founder searches, first customers, and building in public.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 4px 24px;">${content}</td>
      </tr>
    `;
  }

  private twitterFounderCard(company: CompanyProfile): string {
    const twitterSignals = company.sourceSignals.filter(signal => signal.source === 'twitter');
    const primaryTwitter = twitterSignals[0];
    if (!primaryTwitter || primaryTwitter.source !== 'twitter') return '';

    const accentColor = '#1d9bf0'; // Twitter blue
    const scoreColor = '#e1f5fe';
    const scoreText = '#01579b';

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0; border:1px solid #dbe4ee; border-left:5px solid ${accentColor};">
        <tr>
          <td style="padding:16px 16px 14px 16px; background:#ffffff;">
            <div style="font-size:12px; line-height:18px; text-transform:uppercase; letter-spacing:0.08em; color:${accentColor}; font-weight:700;">TWITTER FOUNDER</div>
            <div style="font-size:19px; line-height:24px; font-weight:700; color:#0f172a; margin-top:3px;">
              <a href="${primaryTwitter.tweetUrl}" style="color:#0f172a; text-decoration:none;">${this.escapeHtml(company.productName)}</a>
            </div>
            <div style="font-size:12px; line-height:18px; color:#64748b; margin-top:3px;">@${this.escapeHtml(primaryTwitter.authorUsername)} • ${primaryTwitter.authorFollowers.toLocaleString()} followers</div>
            <div style="font-size:13px; line-height:20px; color:#334155; margin-top:10px;">${this.escapeHtml(primaryTwitter.description)}</div>
            <div style="margin-top:10px;">
              <span style="display:inline-block; margin:0 8px 8px 0; padding:5px 9px; background:#f8fafc; border:1px solid #dbe4ee; color:${accentColor}; font-size:12px; line-height:16px; font-weight:700;">Likes ${primaryTwitter.likes}</span>
              <span style="display:inline-block; margin:0 8px 8px 0; padding:5px 9px; background:#f8fafc; border:1px solid #dbe4ee; color:${accentColor}; font-size:12px; line-height:16px; font-weight:700;">Retweets ${primaryTwitter.retweets}</span>
              <span style="display:inline-block; margin:0 8px 8px 0; padding:5px 9px; background:#f8fafc; border:1px solid #dbe4ee; color:${accentColor}; font-size:12px; line-height:16px; font-weight:700;">Score ${primaryTwitter.relevanceScore}/10</span>
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  private peopleSection(people: PersonToMeet[]): string {
    const rows = people.length === 0
      ? this.emptyState('No founder or builder profiles available yet.')
      : people.map(person => this.personCard(person)).join('');

    return `
      <tr>
        <td style="padding:22px 24px 10px 24px;">
          <div style="font-size:22px; line-height:28px; font-weight:700; color:#0f172a;">Founders And Builders To Meet Now</div>
          <div style="font-size:14px; line-height:22px; color:#64748b; margin-top:6px;">People attached to the strongest companies and strongest public profiles.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px 24px;">${rows}</td>
      </tr>
    `;
  }

  private categoryMomentumSection(categories: CategoryMomentum[]): string {
    const rows = categories.length === 0
      ? this.emptyState('No category momentum shifts detected yet.')
      : categories.slice(0, 6).map(category => this.categoryRow(category)).join('');

    return `
      <tr>
        <td style="padding:22px 24px 10px 24px;">
          <div style="font-size:22px; line-height:28px; font-weight:700; color:#0f172a;">Categories Heating Up</div>
          <div style="font-size:14px; line-height:22px; color:#64748b; margin-top:6px;">Where company count and average score are moving together.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 20px 24px;">${rows}</td>
      </tr>
    `;
  }

  private categoryRow(category: CategoryMomentum): string {
    const delta = `${category.momentumDelta >= 0 ? '+' : ''}${category.momentumDelta}`;

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0; border:1px solid #dbe4ee;">
        <tr>
          <td style="padding:12px 14px; background:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:15px; line-height:22px; font-weight:700; color:#0f172a;">${this.escapeHtml(category.name)}</td>
                <td align="right" style="font-size:13px; line-height:20px; color:#475569;">Avg score ${category.averageScore}</td>
              </tr>
            </table>
            <div style="font-size:13px; line-height:20px; color:#475569; margin-top:6px;">
              ${this.escapeHtml(`Companies ${category.companyCount} • Previous ${category.previousCompanyCount} • Momentum ${delta}`)}
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  private personCard(entry: PersonToMeet): string {
    const meta = [
      entry.person.role.replace('_', ' '),
      entry.person.company,
      entry.person.trendingRank ? `GitHub trending #${entry.person.trendingRank}` : undefined,
      entry.person.followers ? `${entry.person.followers} followers` : undefined,
      entry.person.contributions ? `${entry.person.contributions} contributions` : undefined,
    ].filter((item): item is string => Boolean(item)).join('  •  ');

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0; border:1px solid #dbe4ee;">
        <tr>
          <td style="padding:14px 16px; background:#f8fafc;">
            <div style="font-size:17px; line-height:23px; font-weight:700; color:#0f172a;">
              <a href="${entry.person.profileUrl}" style="color:#0f172a; text-decoration:none;">${this.escapeHtml(entry.person.name)}</a>
              <span style="font-size:13px; line-height:20px; color:#64748b; font-weight:400;">  •  ${this.escapeHtml(entry.companyName)}</span>
            </div>
            <div style="font-size:13px; line-height:20px; color:#475569; margin-top:8px;">${this.escapeHtml(meta || 'Profile details unavailable')}</div>
            ${entry.person.popularRepoName ? `<div style="font-size:13px; line-height:20px; color:#111827; margin-top:8px;">
              <strong>Popular repo</strong><br/>
              ${entry.person.popularRepoUrl ? `<a href="${entry.person.popularRepoUrl}" style="color:#0f172a; text-decoration:none;">${this.escapeHtml(entry.person.popularRepoName)}</a>` : this.escapeHtml(entry.person.popularRepoName)}
              ${entry.person.popularRepoDescription ? `<div style="color:#475569; margin-top:2px;">${this.escapeHtml(entry.person.popularRepoDescription)}</div>` : ''}
            </div>` : ''}
            <div style="font-size:13px; line-height:20px; color:#111827; margin-top:8px;">${this.escapeHtml(entry.reason)}</div>
          </td>
        </tr>
      </table>
    `;
  }

  private companyMetrics(company: CompanyProfile, variant: 'launch' | 'emerging' | 'accelerating', accentColor: string): string {
    const repoCount = company.sourceSignals.filter(signal => signal.source === 'github').length;
    const launchCount = company.sourceSignals.filter(signal => signal.source === 'product_hunt').length;
    const hnCount = company.sourceSignals.filter(signal => signal.source === 'hacker_news').length;
    const twitterCount = company.sourceSignals.filter(signal => signal.source === 'twitter').length;
    const launchVotes = company.sourceSignals
      .filter((signal): signal is ProductSignal => signal.source === 'product_hunt')
      .reduce((sum, signal) => sum + (signal.votesCount ?? 0), 0);
    const launchComments = company.sourceSignals
      .filter((signal): signal is ProductSignal => signal.source === 'product_hunt')
      .reduce((sum, signal) => sum + (signal.commentsCount ?? 0), 0);

    const metrics = [
      variant === 'launch' && launchVotes > 0 ? `Votes ${launchVotes}` : undefined,
      variant === 'launch' && launchComments > 0 ? `Comments ${launchComments}` : undefined,
      repoCount > 0 ? `GitHub ${repoCount}` : undefined,
      hnCount > 0 ? `HN ${hnCount}` : undefined,
      twitterCount > 0 ? `Twitter ${twitterCount}` : undefined,
      variant !== 'launch' ? `Founder ${company.scores.founderStrength}` : undefined,
    ].filter((metric): metric is string => Boolean(metric));

    return metrics.map(metric =>
      `<span style="display:inline-block; margin:0 8px 8px 0; padding:5px 9px; background:#f8fafc; border:1px solid #dbe4ee; color:${accentColor}; font-size:12px; line-height:16px; font-weight:700;">${this.escapeHtml(metric)}</span>`
    ).join('');
  }

  private buildSourceSummary(company: CompanyProfile): string {
    const counts = {
      productHunt: company.sourceSignals.filter(signal => signal.source === 'product_hunt').length,
      github: company.sourceSignals.filter(signal => signal.source === 'github').length,
      hackerNews: company.sourceSignals.filter(signal => signal.source === 'hacker_news').length,
      twitter: company.sourceSignals.filter(signal => signal.source === 'twitter').length,
    };

    const parts = [
      counts.productHunt > 0 ? `${counts.productHunt} Product Hunt` : undefined,
      counts.github > 0 ? `${counts.github} GitHub` : undefined,
      counts.hackerNews > 0 ? `${counts.hackerNews} Hacker News` : undefined,
      counts.twitter > 0 ? `${counts.twitter} Twitter` : undefined,
    ].filter((part): part is string => Boolean(part));

    return parts.join(', ') || 'No sources';
  }

  private displayWebsiteHostname(company: CompanyProfile): string | undefined {
    const productHuntSignal = company.sourceSignals.find((signal): signal is ProductSignal => signal.source === 'product_hunt');
    const candidateUrl = productHuntSignal?.websiteUrl || company.canonicalUrl;

    if (!candidateUrl) {
      return undefined;
    }

    const hostname = this.getHostname(candidateUrl);
    if (hostname === 'producthunt.com' || hostname.endsWith('.producthunt.com')) {
      return undefined;
    }

    return hostname;
  }

  private emptyState(message: string): string {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed #cbd5e1;">
        <tr>
          <td style="padding:16px 18px; background:#f8fafc; color:#64748b; font-size:14px; line-height:22px;">
            ${this.escapeHtml(message)}
          </td>
        </tr>
      </table>
    `;
  }

  private generateTextContent(brief: DailyBrief, date: string): string {
    const sections = [
      this.companyTextSection('PRODUCTS LAUNCHING TODAY', brief.launchesToday, 'launch'),
      this.companyTextSection('NEWLY EMERGING COMPANIES', brief.emergingCompanies),
      this.companyTextSection('EXISTING COMPANIES ACCELERATING', brief.acceleratingCompanies),
      this.categoryMomentumTextSection(brief.categoryMomentum),
      this.peopleTextSection(brief.foundersToMeet),
    ];

    return `500 Startup news\n${date}\n${'='.repeat(72)}\n\n${sections.join('\n')}`;
  }

  private companyTextSection(title: string, companies: CompanyProfile[], variant: 'launch' | 'emerging' | 'accelerating' = 'emerging'): string {
    if (companies.length === 0) {
      return `${title}\n${'-'.repeat(72)}\nNo companies cleared this section today.\n`;
    }

    const body = companies.map((company, index) => {
      const founders = company.founders.slice(0, 3).map(person => this.personLabel(person.name, person.company)).join('; ') || 'Unknown';
      const contributors = company.githubContributors.slice(0, 3).map(person => this.personLabel(person.name, person.company)).join('; ') || 'Not available';
      const productHuntSignal = company.sourceSignals.find(signal => signal.source === 'product_hunt');
      const githubSignal = company.sourceSignals.find((signal): signal is RepositorySignal => signal.source === 'github');
      const isGitHubLed = !!githubSignal && !company.sourceSignals.some(signal => signal.source === 'product_hunt');
      const displayName = isGitHubLed && githubSignal && 'ownerLogin' in githubSignal
        ? `${githubSignal.ownerLogin}/${githubSignal.repoName}`
        : `${company.companyName} (${company.productName})`;
      const displayUrl = isGitHubLed && githubSignal && 'repoUrl' in githubSignal
        ? githubSignal.repoUrl
        : company.canonicalUrl;
      const bottomText = variant === 'launch' && productHuntSignal && 'description' in productHuntSignal
        ? productHuntSignal.description
        : company.thesis;
      const bottomLabel = variant === 'launch' ? 'Description' : 'Thesis';
      const showBottomText = variant === 'launch'
        ? bottomText !== company.summary
        : true;

      let cardText = `${index + 1}. ${displayName}
   URL: ${displayUrl ?? 'N/A'}
   Sources: ${this.buildSourceSummary(company)}
   Summary: ${company.summary}
   Categories: ${company.categories.join(', ') || 'Software'}
   Why now: ${company.whyNow.join(' ')}`;

      if (variant !== 'launch') {
        cardText += `
   Founders: ${founders}
   GitHub contributors: ${contributors}`;
      }

      if (showBottomText) {
        cardText += `
   ${bottomLabel}: ${bottomText}`;
      }

      cardText += '\n';
      return cardText;
    }).join('\n');

    return `${title}\n${'-'.repeat(72)}\n${body}`;
  }

  private peopleTextSection(people: PersonToMeet[]): string {
    if (people.length === 0) {
      return `FOUNDERS AND BUILDERS TO MEET NOW\n${'-'.repeat(72)}\nNo profiles available yet.\n`;
    }

    const body = people.map((entry, index) =>
      `${index + 1}. ${entry.person.name} (${entry.companyName})
   Profile: ${entry.person.profileUrl}
   Role: ${entry.person.role.replace('_', ' ')}
   Company: ${entry.person.company ?? 'Unknown'}
   ${entry.person.trendingRank ? `Trending rank: #${entry.person.trendingRank}\n` : ''}${entry.person.popularRepoName ? `   Popular repo: ${entry.person.popularRepoName}${entry.person.popularRepoDescription ? ` - ${entry.person.popularRepoDescription}` : ''}\n` : ''}   Reason: ${entry.reason}
`,
    ).join('\n');

    return `FOUNDERS AND BUILDERS TO MEET NOW\n${'-'.repeat(72)}\n${body}`;
  }

  private categoryMomentumTextSection(categories: CategoryMomentum[]): string {
    if (categories.length === 0) {
      return `CATEGORIES HEATING UP\n${'-'.repeat(72)}\nNo category momentum shifts detected yet.\n`;
    }

    const body = categories.slice(0, 6).map((category, index) =>
      `${index + 1}. ${category.name}
   Companies: ${category.companyCount}
   Previous: ${category.previousCompanyCount}
   Momentum: ${category.momentumDelta >= 0 ? '+' : ''}${category.momentumDelta}
   Average score: ${category.averageScore}
`,
    ).join('\n');

    return `CATEGORIES HEATING UP\n${'-'.repeat(72)}\n${body}`;
  }

  private personLabel(name: string, company?: string): string {
    return company ? `${name} (${company})` : name;
  }

  private formatBriefDate(date: string): string {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return date;
    }

    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return parsed.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }

  private getHostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}
