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

console.log(`📂 Loading service account credentials from: ${credPath}`);
const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

async function main() {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    console.error(`❌ firestore.rules file not found at: ${rulesPath}`);
    process.exit(1);
  }
  
  console.log(`📖 Reading rules from: ${rulesPath}`);
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('🚀 Releasing new Firestore Security Ruleset from source...');
  const securityRules = admin.securityRules();
  const ruleset = await securityRules.releaseFirestoreRulesetFromSource(rulesContent);
  console.log(`🎉 Ruleset successfully released: ${ruleset.name}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed to deploy rules:', err);
  process.exit(1);
});
