import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environmental variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

// Extract credentials path
let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
if (credPath.startsWith('"') && credPath.endsWith('"')) {
  credPath = credPath.slice(1, -1);
}
if (credPath.startsWith("'") && credPath.endsWith("'")) {
  credPath = credPath.slice(1, -1);
}

if (!credPath || !fs.existsSync(credPath)) {
  console.error(`❌ GOOGLE_APPLICATION_CREDENTIALS file not found or not set at path: ${credPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

async function main() {
  const securityRules = admin.securityRules();
  console.log('🔍 Fetching current firestore rules release...');
  try {
    const release = await securityRules.getFirestoreRuleset();
    console.log(`✅ Active ruleset name: ${release.name}`);
    console.log('--- Active Rules Content ---');
    if (release.source && release.source.length > 0) {
      console.log(release.source[0].content);
    } else {
      console.log('No source content found in ruleset.');
    }
  } catch (err) {
    console.error('❌ Failed to get rules:', err);
  }
  process.exit(0);
}

main();
