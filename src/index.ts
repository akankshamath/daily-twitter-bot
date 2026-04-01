import cron from 'node-cron';
import { config } from './config';
import { ProductHuntClient } from './productHuntClient';
import { GitHubClient } from './githubClient';
import { HackerNewsClient } from './hackerNewsClient';
import { TwitterApiClient } from './twitterApiClient';
import { EmailService } from './emailService';
import { buildCompanyProfiles, buildDailyBrief } from './companyEnricher';
import { SnapshotStorage } from './storage';

let isUpdateInProgress = false;

async function runDailyUpdate() {
  if (isUpdateInProgress) {
    console.warn('Skipping scheduled update because a previous run is still in progress.');
    return;
  }

  isUpdateInProgress = true;
  console.log('\n' + '='.repeat(70));
  console.log('Daily Tech Digest Update');
  console.log('='.repeat(70));
  console.log(`Time: ${new Date().toLocaleString()}\n`);

  try {
    // Initialize services
    const productHuntClient = new ProductHuntClient();
    const githubClient = new GitHubClient();
    const hackerNewsClient = new HackerNewsClient();
    const twitterClient = new TwitterApiClient();
    const emailService = new EmailService();
    const storage = new SnapshotStorage(config.storage.snapshotFile);
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const previousSnapshot = await storage.getLatestSnapshot(date);

    console.log('📦 Step 1/6: Fetching Product Hunt company signals...');
    const productSignals = await productHuntClient.getCompanySignals();
    console.log(`   ✓ Found ${productSignals.length} Product Hunt signals\n`);

    console.log('⭐ Step 2/6: Fetching GitHub company signals...');
    const githubSignals = await githubClient.getCompanySignals(8);
    console.log(`   ✓ Found ${githubSignals.length} GitHub signals\n`);

    console.log('🔥 Step 3/6: Fetching Hacker News company signals...');
    const hackerNewsSignals = await hackerNewsClient.getCompanySignals();
    console.log(`   ✓ Found ${hackerNewsSignals.length} Hacker News signals (${hackerNewsSignals.filter(s => s.storyType === 'show_hn').length} Show HN, ${hackerNewsSignals.filter(s => s.storyType === 'top_story').length} top stories)\n`);

    console.log('🐦 Step 4/6: Fetching Twitter founder intent signals...');
    const twitterSignals = await twitterClient.getCompanySignals(10);
    console.log(`   ✓ Found ${twitterSignals.length} Twitter founder signals\n`);

    console.log('🧠 Step 5/6: Building VC brief...');
    const companies = buildCompanyProfiles([...productSignals, ...githubSignals, ...hackerNewsSignals, ...twitterSignals], previousSnapshot);
    const brief = buildDailyBrief(date, companies, previousSnapshot);
    brief.launchesToday = brief.launchesToday.slice(0, config.content.maxLaunches);
    brief.emergingCompanies = brief.emergingCompanies.slice(0, config.content.maxEmergingCompanies);
    brief.acceleratingCompanies = brief.acceleratingCompanies.slice(0, config.content.maxAcceleratingCompanies);
    brief.twitterFounders = brief.twitterFounders.slice(0, 10);
    brief.foundersToMeet = brief.foundersToMeet.slice(0, config.content.maxPeopleToMeet);
    const snapshot = { date, companies };
    console.log(`   ✓ Built brief for ${companies.length} companies\n`);

    console.log('📧 Step 6/6: Sending email digest...');
    const lastMessageId = (await storage.getMeta()).lastMessageId;
    const messageId = await emailService.sendDailyDigest(brief, lastMessageId);
    await storage.saveRunResult(snapshot, { lastMessageId: messageId });
    console.log(`   ✓ Email sent to: ${config.email.to.join(', ')}\n`);

    // Summary
    console.log('='.repeat(70));
    console.log('✅ UPDATE COMPLETE');
    console.log('='.repeat(70));
    console.log(`📊 Summary:`);
    console.log(`   • Product Hunt Signals: ${productSignals.length}`);
    console.log(`   • GitHub Signals: ${githubSignals.length}`);
    console.log(`   • Hacker News Signals: ${hackerNewsSignals.length} (${hackerNewsSignals.filter(s => s.storyType === 'show_hn').length} Show HN)`);
    console.log(`   • Twitter Signals: ${twitterSignals.length}`);
    console.log(`   • Launches Today: ${brief.launchesToday.length}`);
    console.log(`   • Emerging Companies: ${brief.emergingCompanies.length}`);
    console.log(`   • Accelerating Companies: ${brief.acceleratingCompanies.length}`);
    console.log(`   • People To Meet: ${brief.foundersToMeet.length}`);
    console.log(`   • Recipients: ${config.email.to.length}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR DURING UPDATE');
    console.error('='.repeat(70));

    if (error instanceof Error) {
      console.error(`Error: ${error.message}\n`);

      // Provide helpful error messages
      if (error.message.includes('EAUTH') || error.message.includes('Invalid login')) {
        console.error('💡 Tip: Check your Gmail credentials and app password in .env file');
        console.error('    Make sure you\'re using an App Password, not your regular password\n');
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
        console.error('💡 Tip: Check your internet connection\n');
      }
      if (error.message.includes('Missing required environment variable')) {
        console.error('💡 Tip: Make sure all required variables are set in your .env file\n');
      }
    } else {
      console.error(error);
    }

    console.error('='.repeat(70) + '\n');
    throw error;
  } finally {
    isUpdateInProgress = false;
  }
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                    DAILY TECH DIGEST TOOL                         ║');
  console.log('║             Product Launches + Tech Trends via Email              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Validate configuration
  console.log('🔧 Validating configuration...\n');
  try {
    const emailService = new EmailService();
    const isEmailValid = await emailService.testConnection();

    if (!isEmailValid) {
      console.error('❌ Email configuration is invalid');
      console.error('Please check your Gmail credentials in .env file\n');
      process.exit(1);
    }

    console.log('✅ Email service: Connected');
    console.log(`✅ Recipients: ${config.email.to.join(', ')}`);
    console.log(`✅ Schedule: ${config.schedule}`);
    console.log(`✅ Max Launches: ${config.content.maxLaunches}`);
    console.log(`✅ GitHub API Token: ${config.github.token ? 'Configured' : 'Not configured (public API only)'}`);
    console.log(`✅ Snapshot File: ${config.storage.snapshotFile}\n`);
  } catch (error) {
    console.error('Configuration validation failed\n');

    if (error instanceof Error && error.message.includes('Missing required environment variable')) {
      console.error('Make sure you have created a .env file based on .env.example');
      console.error('   Required variables: GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO\n');
    }

    process.exit(1);
  }

  // Check if running in test mode
  const isTestMode = process.argv.includes('--test') || process.argv.includes('--now');

  if (isTestMode) {
    console.log('═'.repeat(70));
    console.log('TEST MODE - Running one-time update');
    console.log('═'.repeat(70) + '\n');

    await runDailyUpdate();

    console.log('\nTest complete. Exiting...\n');
    process.exit(0);
  }

  // Schedule the job
  console.log('═'.repeat(70));
  console.log('⏰ SCHEDULER ACTIVATED');
  console.log('═'.repeat(70));
  console.log(`Schedule: ${config.schedule} (cron format)`);
  console.log('Status: Waiting for next scheduled run...');
  console.log('\n💡 Tips:');
  console.log('   • Press Ctrl+C to stop running');
  console.log('   • Run with --test flag to test immediately');
  console.log('   • Check .env file to modify schedule\n');
  console.log('═'.repeat(70) + '\n');

  // Validate cron expression
  if (!cron.validate(config.schedule)) {
    console.error(`Invalid cron schedule: ${config.schedule}\n`);
    process.exit(1);
  }

  // Schedule the task
  cron.schedule(config.schedule, async () => {
    try {
      await runDailyUpdate();
    } catch (error) {
      console.error('Scheduled update failed:', error);
    }
  });

  console.log('Tool is running...\n');
}

// Handle graceful shutdown 
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  console.log('Goodbye!\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  console.log('Goodbye!\n');
  process.exit(0);
});

// Run the application
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
