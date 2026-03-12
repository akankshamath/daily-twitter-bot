import nodemailer from 'nodemailer';
import { config } from './config';
import { Launch } from './productHuntClient';
import { Story } from './hackerNewsClient';
import { Repository } from './githubClient';

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

  async sendDailyDigest(launches: Launch[], trends: Story[], repos: Repository[]): Promise<void> {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `Daily Tech Digest - ${date}`;
    const htmlContent = this.generateHtmlContent(launches, trends, repos, date);
    const textContent = this.generateTextContent(launches, trends, repos, date);

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
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  private generateHtmlContent(launches: Launch[], trends: Story[], repos: Repository[], date: string): string {
    const launchesSection = this.generateLaunchesHtml(launches);
    const trendsSection = this.generateTrendsHtml(trends);
    const reposSection = this.generateReposHtml(repos);
  
    return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0; padding:0; background-color:#f2f2f2;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f2f2; margin:0; padding:40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border-collapse:collapse;">
                
                <!-- Top spacing -->
                <tr>
                  <td style="padding:32px 40px 16px 40px; text-align:center; font-family:Arial, Helvetica, sans-serif;">
                    <div style="font-size:18px; font-weight:700; color:#111111; margin-bottom:8px;">
                      Daily Tech Digest
                    </div>
                    <div style="font-size:13px; color:#666666;">
                      ${this.escapeHtml(date)}
                    </div>
                  </td>
                </tr>
  
                <!-- Intro -->
                <tr>
                  <td style="padding:8px 40px 24px 40px; font-family:Arial, Helvetica, sans-serif; color:#222222;">
                    <div style="font-size:24px; line-height:32px; font-weight:700; margin-bottom:12px;">
                      Your daily snapshot of tech launches and trends
                    </div>
                    <div style="font-size:15px; line-height:24px; color:#555555;">
                      We pulled today’s most notable Product Hunt launches and the strongest stories from Hacker News into one clean digest.
                    </div>
                  </td>
                </tr>
  
                <!-- Divider -->
                <tr>
                  <td style="padding:0 40px;">
                    <div style="height:1px; background-color:#e8e8e8; line-height:1px; font-size:1px;">&nbsp;</div>
                  </td>
                </tr>
  
                <!-- Launches -->
                <tr>
                  <td style="padding:28px 40px 10px 40px; font-family:Arial, Helvetica, sans-serif;">
                    <div style="font-size:20px; font-weight:700; color:#111111; margin-bottom:16px;">
                      Product Hunt Launches
                    </div>
                    ${launchesSection}
                  </td>
                </tr>
  
                <!-- Divider -->
                <tr>
                  <td style="padding:8px 40px 0 40px;">
                    <div style="height:1px; background-color:#e8e8e8; line-height:1px; font-size:1px;">&nbsp;</div>
                  </td>
                </tr>
  
                <!-- HN -->
                <tr>
                  <td style="padding:28px 40px 10px 40px; font-family:Arial, Helvetica, sans-serif;">
                    <div style="font-size:20px; font-weight:700; color:#111111; margin-bottom:16px;">
                      Trending on Hacker News
                    </div>
                    ${trendsSection}
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:8px 40px 0 40px;">
                    <div style="height:1px; background-color:#e8e8e8; line-height:1px; font-size:1px;">&nbsp;</div>
                  </td>
                </tr>

                <!-- GitHub -->
                <tr>
                  <td style="padding:28px 40px 10px 40px; font-family:Arial, Helvetica, sans-serif;">
                    <div style="font-size:20px; font-weight:700; color:#111111; margin-bottom:16px;">
                      Trending on GitHub
                    </div>
                    ${reposSection}
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td align="center" style="padding:24px 40px 16px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#111111" style="border-radius:6px;">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
  
                <!-- Footer -->
                <tr>
                  <td style="padding:8px 40px 36px 40px; text-align:center; font-family:Arial, Helvetica, sans-serif;">
                    <div style="font-size:12px; line-height:18px; color:#888888;">
                      Powered by Product Hunt, Hacker News, and GitHub
                    </div>
                    <div style="font-size:12px; line-height:18px; color:#aaaaaa; margin-top:8px;">
                      Generated automatically by your daily trend tracker
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

  private generateLaunchesHtml(launches: Launch[]): string {
    if (launches.length === 0) {
      return `
        <div style="font-size:14px; line-height:1.5; color:#1c1c1c;">
          No new products today.
        </div>
      `;
    }
  
    return launches.map((launch, index) => `
      <div style="background-color:#ffffff; border:1px solid #e7e7e7; border-left:4px solid rgb(46, 93, 247); border-right:4px solid rgb(46, 93, 247); border-radius:14px; padding:22px; margin-bottom:16px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
        <div style="font-size:18px; line-height:26px; font-weight:700; margin-bottom:8px;">
          <a href="${launch.url}" style="color:#111111; text-decoration:none;">${index + 1}. ${this.escapeHtml(launch.name)}</a>
        </div>
        <div style="font-size:15px; line-height:22px; color:#555555; margin-bottom:10px;">
          ${this.escapeHtml(launch.tagline)}
        </div>
        <div style="font-size:13px; line-height:20px; color:#999999; margin-bottom:8px;">
          by ${this.escapeHtml(launch.author)}
        </div>
        ${launch.topics.length > 0 ? `
        <div style="font-size:13px; line-height:20px; margin-top:4px;">
          ${launch.topics.slice(0, 3).map(topic => `<span style="display:inline-block; padding:3px 10px; margin-right:6px; margin-top:4px; background-color:#f3f4f6; border-radius:12px; color:#6b7280; font-size:12px;">${this.escapeHtml(topic)}</span>`).join('')}
        </div>
        ` : ''}
      </div>
    `).join('');
  }

  private generateTrendsHtml(trends: Story[]): string {
    if (trends.length === 0) {
      return `
        <div style="font-size:14px; line-height:22px; color:#666666;">
          No trending stories found.
        </div>
      `;
    }
  
    return trends.map((trend, index) => `
      <div style="background-color:#ffffff; border:1px solid #e7e7e7; border-left:4px solid rgb(46, 93, 247); border-right:4px solid rgb(46, 93, 247); border-radius:14px; padding:22px; margin-bottom:16px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
        <div style="font-size:18px; line-height:26px; font-weight:700; margin-bottom:8px;">
          <a href="${trend.url || `https://news.ycombinator.com/item?id=${trend.id}`}" style="color:#111111; text-decoration:none;">${index + 1}. ${this.escapeHtml(trend.title)}</a>
        </div>
        <div style="font-size:13px; line-height:20px; color:#666666; margin-bottom:10px;">
          ${trend.score} points • ${trend.descendants || 0} comments • by ${this.escapeHtml(trend.by)}
        </div>
        <div style="font-size:14px; line-height:20px; color:#6b7280;">
          <a href="https://news.ycombinator.com/item?id=${trend.id}" style="color:#999999; text-decoration:none;">Discussion</a>
        </div>
      </div>
    `).join('');
  }

  private generateReposHtml(repos: Repository[]): string {
    if (repos.length === 0) {
      return `
        <div style="font-size:14px; line-height:22px; color:#666666;">
          No trending repositories found.
        </div>
      `;
    }

    return repos.map((repo, index) => `
      <div style="background-color:#ffffff; border:1px solid #e7e7e7; border-left:4px solid #2da44e; border-right:4px solid #2da44e; border-radius:14px; padding:22px; margin-bottom:16px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
        <div style="font-size:18px; line-height:26px; font-weight:700; margin-bottom:8px;">
          <a href="${repo.url}" style="color:#111111; text-decoration:none;">${index + 1}. ${this.escapeHtml(repo.author)}/${this.escapeHtml(repo.name)}</a>
        </div>
        <div style="font-size:15px; line-height:22px; color:#555555; margin-bottom:10px;">
          ${this.escapeHtml(repo.description)}
        </div>
        <div style="font-size:13px; line-height:20px; color:#666666;">
          ⭐ ${repo.starsToday.toLocaleString()} stars today • ${repo.stars.toLocaleString()} total stars • ${this.escapeHtml(repo.language)}
        </div>
      </div>
    `).join('');
  }

  private generateTextContent(launches: Launch[], trends: Story[], repos: Repository[], date: string): string {
    let content = `DAILY TECH DIGEST - ${date}\n${'='.repeat(60)}\n\n`;

    // Launches section
    content += 'NEW PRODUCT LAUNCHES\n' + '-'.repeat(60) + '\n\n';
    if (launches.length === 0) {
      content += 'No new products launched today\n\n';
    } else {
      launches.forEach((launch, index) => {
        content += `${index + 1}. ${launch.name}\n`;
        content += `   ${launch.tagline}\n`;
        if (launch.topics.length > 0) {
          content += `   Topics: ${launch.topics.join(', ')}\n`;
        }
        content += `   ${launch.url}\n\n`;
      });
    }

    // Trends section
    content += '\nTRENDING ON HACKER NEWS\n' + '-'.repeat(60) + '\n\n';
    if (trends.length === 0) {
      content += 'No trending stories found\n\n';
    } else {
      trends.forEach((trend, index) => {
        content += `${index + 1}. ${trend.title}\n`;
        content += `   ▲ ${trend.score} points • 💬 ${trend.descendants || 0} comments • by ${trend.by}\n`;
        if (trend.url) {
          content += `   ${trend.url}\n`;
        }
        content += `   Discussion: https://news.ycombinator.com/item?id=${trend.id}\n\n`;
      });
    }

    // GitHub repos section
    content += '\nTRENDING ON GITHUB\n' + '-'.repeat(60) + '\n\n';
    if (repos.length === 0) {
      content += 'No trending repositories found\n\n';
    } else {
      repos.forEach((repo, index) => {
        content += `${index + 1}. ${repo.author}/${repo.name}\n`;
        content += `   ${repo.description}\n`;
        content += `   ⭐ ${repo.starsToday} stars today • ${repo.stars} total stars • ${repo.language}\n`;
        content += `   ${repo.url}\n\n`;
      });
    }

    content += '\n' + '-'.repeat(60) + '\n';
    content += 'Powered by Product Hunt, Hacker News, and GitHub\n';
    content += `Generated at ${new Date().toLocaleString()}`;

    return content;
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
