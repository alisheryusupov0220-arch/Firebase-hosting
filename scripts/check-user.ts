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
  const uid = '6HpaEQH9npdx2Gpqi7C79XTiSRW2';
  console.log(`🔍 Checking user ${uid} in Auth...`);
  try {
    const user = await admin.auth().getUser(uid);
    console.log(`✅ User exists in Auth: ${user.email}, name: ${user.displayName}`);
    console.log(`Custom claims:`, user.customClaims);
  } catch (err: any) {
    console.error(`❌ User not found in Auth:`, err.message);
  }

  console.log(`🔍 Checking user ${uid} in Firestore...`);
  try {
    const doc = await admin.firestore().collection('users').doc(uid).get();
    if (doc.exists) {
      console.log(`✅ User exists in Firestore:`, doc.data());
    } else {
      console.log(`❌ User document not found in Firestore.`);
    }
  } catch (err: any) {
    console.error(`❌ Firestore error:`, err.message);
  }
  process.exit(0);
}

main();
