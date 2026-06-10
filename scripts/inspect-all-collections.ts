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
  const collections = [
    'order_requests',
    'accounts_payable',
    'suppliers',
    'finance_transactions',
    'stock_transactions',
    'transactions_telegram',
    'erp_categories',
    'contractor_items',
    'telegram_groups',
    'inventory_templates',
    'inventory_tasks',
    'bank_accounts',
    'my_companies',
    'users'
  ];

  console.log('🔍 Scanning collections schema in Firestore...');
  const db = admin.firestore();
  
  for (const colName of collections) {
    try {
      const snap = await db.collection(colName).limit(10).get();
      if (snap.empty) {
        console.log(`- Collection [${colName}]: EMPTY`);
        continue;
      }
      
      let hasOrgId = false;
      let sampleDoc: any = null;
      
      snap.forEach(doc => {
        const data = doc.data();
        if ('orgId' in data) {
          hasOrgId = true;
        }
        if (!sampleDoc) {
          sampleDoc = data;
        }
      });
      
      console.log(`- Collection [${colName}]: ${snap.size} docs. Has orgId in data? ${hasOrgId ? '✅ YES' : '❌ NO'}`);
    } catch (err: any) {
      console.log(`- Collection [${colName}]: ERROR (${err.message})`);
    }
  }
  process.exit(0);
}

main();
