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
  console.log(`🔍 Checking if any erp_items have orgId...`);
  try {
    const snap = await admin.firestore().collection('erp_items').where('orgId', '!=', '').limit(5).get();
    if (snap.empty) {
      console.log(`❌ No erp_items have an orgId field! They are all global or missing orgId.`);
      
      const totalSnap = await admin.firestore().collection('erp_items').limit(1).get();
      console.log(`Total erp_items collection exists? ${!totalSnap.empty}`);
    } else {
      console.log(`✅ Found erp_items with orgId:`);
      snap.forEach(doc => {
        console.log(`ID: ${doc.id}, orgId: ${doc.data().orgId}`);
      });
    }
  } catch (err: any) {
    console.error(`❌ Error:`, err.message);
  }
  process.exit(0);
}

main();
