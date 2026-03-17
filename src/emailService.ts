import nodemailer from 'nodemailer';
import { config } from './config';
import { CompanyProfile, DailyBrief, PersonToMeet } from './types';

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
    const date = new Date(brief.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = config.emailDigest.subject;
    const htmlContent = this.generateHtmlContent(brief, date);
    const textContent = this.generateTextContent(brief, date);

    const mailOptions = {
      from: config.email.user,
      to: config.email.to,
      subject,
      text: textContent,
      html: htmlContent,
      inReplyTo: lastMessageId,
      references: lastMessageId ? [lastMessageId] : undefined,
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

  private generateHtmlContent(brief: DailyBrief, date: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0; padding:0; background:#f5f3ee; color:#1c1c1c; font-family:Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ee; padding:32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="720" cellpadding="0" cellspacing="0" border="0" style="width:720px; max-width:720px; background:#fffdf9; border:1px solid #e7dfd2;">
                <tr>
                  <td style="padding:32px 40px 16px 40px;">
                    <div style="font-size:28px; line-height:34px; font-weight:700; color:#0f172a;">VC Daily Dealflow Thread</div>
                    <div style="font-size:14px; line-height:22px; color:#6b7280; margin-top:8px;">${this.escapeHtml(date)}</div>
                    <div style="font-size:15px; line-height:24px; color:#475569; margin-top:12px;">
                      Signals from Product Hunt launches and GitHub momentum, organized around products launching today, companies showing real momentum, and founders/builders worth meeting.
                    </div>
                  </td>
                </tr>
                ${this.section('Products Launching Today', brief.launchesToday, 'launch')}
                ${this.section('Newly Emerging Companies', brief.emergingCompanies, 'emerging')}
                ${this.section('Existing Companies Accelerating', brief.acceleratingCompanies, 'accelerating')}
                ${this.peopleSection(brief.foundersToMeet)}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;
  }

  private section(title: string, companies: CompanyProfile[], variant: 'launch' | 'emerging' | 'accelerating'): string {
    const content = companies.length === 0
      ? `<div style="font-size:14px; line-height:22px; color:#6b7280;">No companies cleared the ${variant} threshold today.</div>`
      : companies.map(company => this.companyCard(company, variant)).join('');

    return `
      <tr>
        <td style="padding:20px 40px 8px 40px;">
          <div style="font-size:22px; line-height:28px; font-weight:700; color:#111827;">${title}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 12px 40px;">${content}</td>
      </tr>
    `;
  }

  private companyCard(company: CompanyProfile, variant: 'launch' | 'emerging' | 'accelerating'): string {
    const founders = company.founders.slice(0, 3).map(person => this.personLabel(person.name, person.company)).join(' • ') || 'Unknown';
    const contributors = company.githubContributors.slice(0, 3).map(person => this.personLabel(person.name, person.company)).join(' • ') || 'Not available';
    const accentColor = variant === 'launch'
      ? '#059669'
      : variant === 'emerging'
        ? '#2563eb'
        : '#d97706';

    return `
      <div style="border:1px solid #e5dccf; border-left:5px solid ${accentColor}; border-radius:12px; padding:18px 20px; margin:14px 0; background:#fff;">
        <div style="font-size:18px; line-height:24px; font-weight:700; color:#0f172a;">
          <a href="${company.canonicalUrl ?? '#'}" style="color:#0f172a; text-decoration:none;">${this.escapeHtml(company.companyName)}</a>
          <span style="font-size:13px; color:#64748b; font-weight:400;"> • ${this.escapeHtml(company.productName)}</span>
        </div>
        <div style="font-size:14px; line-height:22px; color:#334155; margin-top:8px;">${this.escapeHtml(company.summary)}</div>
        <div style="font-size:13px; line-height:20px; color:#64748b; margin-top:8px;">
          Categories: ${this.escapeHtml(company.categories.join(', ') || 'Software')}
        </div>
        <div style="font-size:13px; line-height:20px; color:#111827; margin-top:8px;">
          <strong>Why now:</strong> ${this.escapeHtml(company.whyNow.join(' '))}
        </div>
        <div style="font-size:13px; line-height:20px; color:#111827; margin-top:8px;">
          <strong>Founder signal:</strong> ${this.escapeHtml(founders)}
        </div>
        <div style="font-size:13px; line-height:20px; color:#111827; margin-top:6px;">
          <strong>GitHub contributors:</strong> ${this.escapeHtml(contributors)}
        </div>
        <div style="font-size:13px; line-height:20px; color:#111827; margin-top:6px;">
          <strong>Investment angle:</strong> ${this.escapeHtml(company.thesis)}
        </div>
      </div>
    `;
  }

  private peopleSection(people: PersonToMeet[]): string {
    const rows = people.length === 0
      ? `<div style="font-size:14px; line-height:22px; color:#6b7280;">No founder or builder profiles available yet.</div>`
      : people.map(person => this.personCard(person)).join('');

    return `
      <tr>
        <td style="padding:20px 40px 8px 40px;">
          <div style="font-size:22px; line-height:28px; font-weight:700; color:#111827;">Founders And Builders To Meet Now</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 32px 40px;">${rows}</td>
      </tr>
    `;
  }

  private personCard(entry: PersonToMeet): string {
    return `
      <div style="border:1px solid #e5dccf; border-radius:12px; padding:14px 16px; margin:12px 0; background:#fff;">
        <div style="font-size:16px; line-height:22px; font-weight:700; color:#0f172a;">
          <a href="${entry.person.profileUrl}" style="color:#0f172a; text-decoration:none;">${this.escapeHtml(entry.person.name)}</a>
          <span style="font-size:13px; line-height:20px; color:#64748b; font-weight:400;"> • ${this.escapeHtml(entry.companyName)}</span>
        </div>
        <div style="font-size:13px; line-height:20px; color:#475569; margin-top:6px;">
          ${this.escapeHtml(entry.person.role.replace('_', ' '))}${entry.person.company ? ` • ${this.escapeHtml(entry.person.company)}` : ''}${entry.person.followers ? ` • ${entry.person.followers} followers` : ''}${entry.person.contributions ? ` • ${entry.person.contributions} contributions` : ''}
        </div>
        <div style="font-size:13px; line-height:20px; color:#111827; margin-top:8px;">${this.escapeHtml(entry.reason)}</div>
      </div>
    `;
  }

  private generateTextContent(brief: DailyBrief, date: string): string {
    const sections = [
      this.companyTextSection('PRODUCTS LAUNCHING TODAY', brief.launchesToday, 'launch'),
      this.companyTextSection('NEWLY EMERGING COMPANIES', brief.emergingCompanies),
      this.companyTextSection('EXISTING COMPANIES ACCELERATING', brief.acceleratingCompanies),
      this.peopleTextSection(brief.foundersToMeet),
    ];

    return `VC DAILY DEALFLOW THREAD\n${date}\n${'='.repeat(72)}\n\n${sections.join('\n')}`;
  }

  private companyTextSection(title: string, companies: CompanyProfile[], variant: 'launch' | 'emerging' | 'accelerating' = 'emerging'): string {
    if (companies.length === 0) {
      return `${title}\n${'-'.repeat(72)}\nNo companies cleared this section today.\n`;
    }

    const body = companies.map((company, index) => {
      const founders = company.founders.slice(0, 3).map(person => this.personLabel(person.name, person.company)).join('; ') || 'Unknown';
      const contributors = company.githubContributors.slice(0, 3).map(person => this.personLabel(person.name, person.company)).join('; ') || 'Not available';

      return `${index + 1}. ${company.companyName} (${company.productName})
   URL: ${company.canonicalUrl ?? 'N/A'}
   Summary: ${company.summary}
   Categories: ${company.categories.join(', ') || 'Software'}
   Why now: ${company.whyNow.join(' ')}
   Founders: ${founders}
   GitHub contributors: ${contributors}
   Thesis: ${company.thesis}
`;
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
   Reason: ${entry.reason}
`,
    ).join('\n');

    return `FOUNDERS AND BUILDERS TO MEET NOW\n${'-'.repeat(72)}\n${body}`;
  }

  private personLabel(name: string, company?: string): string {
    return company ? `${name} (${company})` : name;
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
