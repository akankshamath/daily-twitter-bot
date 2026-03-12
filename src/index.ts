import cron from 'node-cron';
import { config } from './config';
import { ProductHuntClient } from './productHuntClient';
import { HackerNewsClient } from './hackerNewsClient';
import { GitHubClient } from './githubClient';
import { EmailService } from './emailService';

async function runDailyUpdate() {
  console.log('\n' + '='.repeat(70));
  console.log('Daily Tech Digest Update');
  console.log('='.repeat(70));
  console.log(`Time: ${new Date().toLocaleString()}\n`);

  try {
    // Initialize services
    const productHuntClient = new ProductHuntClient();
    const hackerNewsClient = new HackerNewsClient();
    const githubClient = new GitHubClient();
    const emailService = new EmailService();

    // Fetch Product Hunt launches
    console.log('📦 Step 1/4: Fetching Product Hunt launches...');
    const allLaunches = await productHuntClient.getTodayLaunches();
    const topLaunches = allLaunches
      .sort((a, b) => b.votesCount - a.votesCount)
      .slice(0, config.content.maxLaunches);
    console.log(`   ✓ Found ${topLaunches.length} top launches\n`);

    // Fetch Hacker News trends
    console.log('📰 Step 2/4: Fetching Hacker News trends...');
    const topStories = await hackerNewsClient.getTopStories();

    // Filter and sort by score
    const techStories = hackerNewsClient.filterTechStories(topStories);
    const trendingStories = techStories
      .sort((a, b) => b.score - a.score)
      .slice(0, config.content.maxTrends);

    console.log(`   ✓ Found ${trendingStories.length} trending tech stories\n`);

    // Fetch GitHub trending repositories
    console.log('⭐ Step 3/4: Fetching GitHub trending repos...');
    const trendingRepos = await githubClient.getTrendingRepos(5);
    console.log(`   ✓ Found ${trendingRepos.length} trending repositories\n`);

    // Send email digest
    console.log('📧 Step 4/4: Sending email digest...');
    await emailService.sendDailyDigest(topLaunches, trendingStories, trendingRepos);
    console.log(`   ✓ Email sent to: ${config.email.to.join(', ')}\n`);

    // Summary
    console.log('='.repeat(70));
    console.log('✅ UPDATE COMPLETE');
    console.log('='.repeat(70));
    console.log(`📊 Summary:`);
    console.log(`   • Product Launches: ${topLaunches.length}`);
    console.log(`   • Tech Trends: ${trendingStories.length}`);
    console.log(`   • GitHub Repos: ${trendingRepos.length}`);
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
    console.log(`✅ Max Trends: ${config.content.maxTrends}\n`);
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
    await runDailyUpdate();
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
