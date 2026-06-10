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

const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

async function main() {
  console.log(`🔍 Checking sample documents from suppliers collection...`);
  try {
    const snap = await admin.firestore().collection('suppliers').limit(3).get();
    if (snap.empty) {
      console.log(`⚠️ suppliers collection is empty!`);
    } else {
      snap.forEach(doc => {
        console.log(`ID: ${doc.id}`);
        console.log(`Fields:`, JSON.stringify(doc.data(), null, 2));
        console.log(`-----------------------------------`);
      });
    }

    const hasOrgIdSnap = await admin.firestore().collection('suppliers').where('orgId', '!=', '').limit(1).get();
    console.log(`Does any supplier have orgId? ${!hasOrgIdSnap.empty}`);

  } catch (err: any) {
    console.error(`❌ Error fetching suppliers:`, err.message);
  }
  process.exit(0);
}

main();
