import dotenv from 'dotenv';

dotenv.config();

interface Config {
  email: {
    user: string;
    appPassword: string;
    to: string[];
  };
  schedule: string;
  content: {
    maxLaunches: number;
    maxTrends: number;
    maxEmergingCompanies: number;
    maxAcceleratingCompanies: number;
    maxPeopleToMeet: number;
  };
  github: {
    token?: string;
  };
  storage: {
    snapshotFile: string;
  };
  emailDigest: {
    subject: string;
  };
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  email: {
    user: getEnvVar('GMAIL_USER'),
    appPassword: getEnvVar('GMAIL_APP_PASSWORD'),
    to: getEnvVar('EMAIL_TO').split(',').map(email => email.trim()),
  },
  schedule: process.env.CRON_SCHEDULE || '0 9 * * *',
  content: {
    maxLaunches: parseInt(process.env.MAX_LAUNCHES || '20', 10),
    maxTrends: parseInt(process.env.MAX_TRENDS || '15', 10),
    maxEmergingCompanies: parseInt(process.env.MAX_EMERGING_COMPANIES || '10', 10),
    maxAcceleratingCompanies: parseInt(process.env.MAX_ACCELERATING_COMPANIES || '10', 10),
    maxPeopleToMeet: parseInt(process.env.MAX_PEOPLE_TO_MEET || '8', 10),
  },
  github: {
    token: process.env.GITHUB_TOKEN,
  },
  storage: {
    snapshotFile: process.env.SNAPSHOT_FILE || '.data/daily-snapshots.json',
  },
  emailDigest: {
    subject: process.env.EMAIL_SUBJECT || 'VC Daily Dealflow Thread',
  },
};
