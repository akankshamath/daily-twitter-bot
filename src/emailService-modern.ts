// Modern UI components for email service

export function modernSection(title: string, description: string, companies: any[], variant: string, escapeHtml: (text: string) => string): string {
  if (companies.length === 0) {
    return '';
  }

  const cards = companies.map(company => modernCompanyCard(company, variant, escapeHtml)).join('');

  return `
    <tr>
      <td style="padding:32px 24px 8px 24px;">
        <div style="font-size:22px; line-height:28px; font-weight:700; color:#111827;">${escapeHtml(title)}</div>
        <div style="font-size:14px; line-height:20px; color:#6b7280; margin-top:6px;">${escapeHtml(description)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 24px 24px;">
        ${cards}
      </td>
    </tr>
  `;
}

function modernCompanyCard(company: any, variant: string, escapeHtml: (text: string) => string): string {
  const colorMap: Record<string, string> = {
    launch: '#10b981',
    emerging: '#8b5cf6',
    accelerating: '#f59e0b',
  };
  const accentColor = colorMap[variant] || '#6366f1';

  const productHuntSignal = company.sourceSignals.find((s: any) => s.source === 'product_hunt');
  const githubSignal = company.sourceSignals.find((s: any) => s.source === 'github');
  const sourceSummary = buildSourceSummary(company);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
      <tr>
        <td style="padding:20px; border-left:4px solid ${accentColor};">
          <div style="font-size:18px; line-height:24px; font-weight:700; color:#111827;">
            <a href="${company.canonicalUrl || '#'}" style="color:#111827; text-decoration:none;">${escapeHtml(company.productName)}</a>
          </div>
          <div style="font-size:13px; line-height:18px; color:#9ca3af; margin-top:4px;">
            ${escapeHtml(company.companyName)} • ${escapeHtml(sourceSummary)}
          </div>
          <div style="font-size:14px; line-height:21px; color:#4b5563; margin-top:12px;">
            ${escapeHtml(company.summary)}
          </div>
          <div style="margin-top:12px;">
            ${buildMetricPills(company, variant, accentColor, escapeHtml)}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function buildSourceSummary(company: any): string {
  const counts = {
    productHunt: company.sourceSignals.filter((s: any) => s.source === 'product_hunt').length,
    github: company.sourceSignals.filter((s: any) => s.source === 'github').length,
    hackerNews: company.sourceSignals.filter((s: any) => s.source === 'hacker_news').length,
    twitter: company.sourceSignals.filter((s: any) => s.source === 'twitter').length,
  };

  const parts = [];
  if (counts.productHunt > 0) parts.push(`PH`);
  if (counts.github > 0) parts.push(`GitHub`);
  if (counts.hackerNews > 0) parts.push(`HN`);
  if (counts.twitter > 0) parts.push(`Twitter`);

  return parts.join(' • ') || 'Unknown';
}

function buildMetricPills(company: any, variant: string, color: string, escapeHtml: (text: string) => string): string {
  const metrics = [];

  const twitterCount = company.sourceSignals.filter((s: any) => s.source === 'twitter').length;
  const githubCount = company.sourceSignals.filter((s: any) => s.source === 'github').length;
  const hnCount = company.sourceSignals.filter((s: any) => s.source === 'hacker_news').length;

  if (twitterCount > 0) metrics.push(`🐦 ${twitterCount}`);
  if (githubCount > 0) metrics.push(`⭐ ${githubCount}`);
  if (hnCount > 0) metrics.push(`🔥 ${hnCount}`);

  return metrics.map(m =>
    `<span style="display:inline-block; margin-right:8px; margin-bottom:8px; padding:6px 12px; background:${color}15; border-radius:20px; color:${color}; font-size:12px; font-weight:600;">${escapeHtml(m)}</span>`
  ).join('');
}

export function modernTwitterSection(founders: any[], escapeHtml: (text: string) => string): string {
  if (founders.length === 0) {
    return '';
  }

  const cards = founders.map(company => modernTwitterCard(company, escapeHtml)).join('');

  return `
    <tr>
      <td style="padding:32px 24px 8px 24px;">
        <div style="font-size:22px; line-height:28px; font-weight:700; color:#111827;">🐦 Early-Stage Founders (Twitter)</div>
        <div style="font-size:14px; line-height:20px; color:#6b7280; margin-top:6px;">
          Builders actively sharing: co-founder searches, first customers, building in public
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 24px 24px;">
        ${cards}
      </td>
    </tr>
  `;
}

function modernTwitterCard(company: any, escapeHtml: (text: string) => string): string {
  const twitterSignal = company.sourceSignals.find((s: any) => s.source === 'twitter');
  if (!twitterSignal) return '';

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
      <tr>
        <td style="padding:20px; border-left:4px solid #1d9bf0;">
          <div style="display:flex; align-items:center; margin-bottom:12px;">
            <div style="font-size:18px; line-height:24px; font-weight:700; color:#111827;">
              <a href="${twitterSignal.tweetUrl}" style="color:#111827; text-decoration:none;">${escapeHtml(company.productName)}</a>
            </div>
          </div>
          <div style="font-size:13px; line-height:18px; color:#6b7280; margin-bottom:12px;">
            @${escapeHtml(twitterSignal.authorUsername)} • ${twitterSignal.authorFollowers.toLocaleString()} followers
          </div>
          <div style="font-size:14px; line-height:21px; color:#374151; padding:12px; background:#f9fafb; border-radius:8px; margin-bottom:12px;">
            "${escapeHtml(twitterSignal.description)}"
          </div>
          <div>
            <span style="display:inline-block; margin-right:12px; padding:6px 12px; background:#1d9bf015; border-radius:20px; color:#1d9bf0; font-size:12px; font-weight:600;">
              ❤️ ${twitterSignal.likes}
            </span>
            <span style="display:inline-block; margin-right:12px; padding:6px 12px; background:#1d9bf015; border-radius:20px; color:#1d9bf0; font-size:12px; font-weight:600;">
              🔄 ${twitterSignal.retweets}
            </span>
            <span style="display:inline-block; padding:6px 12px; background:#10b98115; border-radius:20px; color:#10b981; font-size:12px; font-weight:600;">
              Score ${twitterSignal.relevanceScore}/10
            </span>
          </div>
        </td>
      </tr>
    </table>
  `;
}

export function modernPeopleSection(people: any[], escapeHtml: (text: string) => string): string {
  if (people.length === 0) {
    return '';
  }

  const cards = people.map(person => modernPersonCard(person, escapeHtml)).join('');

  return `
    <tr>
      <td style="padding:32px 24px 8px 24px;">
        <div style="font-size:22px; line-height:28px; font-weight:700; color:#111827;">👥 Founders To Meet</div>
        <div style="font-size:14px; line-height:20px; color:#6b7280; margin-top:6px;">
          People attached to the strongest companies and profiles
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 32px 24px;">
        ${cards}
      </td>
    </tr>
  `;
}

function modernPersonCard(entry: any, escapeHtml: (text: string) => string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px; background:#ffffff; border-radius:12px; border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:20px; border-left:4px solid #8b5cf6;">
          <div style="font-size:18px; line-height:24px; font-weight:700; color:#111827;">
            <a href="${entry.person.profileUrl}" style="color:#111827; text-decoration:none;">${escapeHtml(entry.person.name)}</a>
          </div>
          <div style="font-size:13px; line-height:18px; color:#6b7280; margin-top:4px;">
            ${escapeHtml(entry.companyName)} • ${escapeHtml(entry.person.role.replace('_', ' '))}
          </div>
          <div style="font-size:14px; line-height:21px; color:#4b5563; margin-top:12px;">
            ${escapeHtml(entry.reason)}
          </div>
        </td>
      </tr>
    </table>
  `;
}
