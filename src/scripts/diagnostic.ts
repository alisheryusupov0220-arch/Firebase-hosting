import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { adminDb, adminAuth } from '../firebase/server';

async function run() {
  console.log('--- DIAGNOSTIC SCRIPT START ---');
  try {
    // 1. Check all users
    console.log('\n--- USERS ---');
    const usersSnap = await adminDb.collection('users').get();
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      console.log(`User UID: ${doc.id}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Role in DB: ${data.role}`);
      console.log(`  OrgId in DB: ${data.orgId}`);
      try {
        const authUser = await adminAuth.getUser(doc.id);
        console.log(`  Auth Claims:`, authUser.customClaims);
      } catch (e: any) {
        console.log(`  Auth User Error:`, e.message);
      }
    }

    // 2. Check all organizations
    console.log('\n--- ORGANIZATIONS ---');
    const orgsSnap = await adminDb.collection('organizations').get();
    for (const doc of orgsSnap.docs) {
      const data = doc.data();
      console.log(`Org ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Poster URL: ${data.posterApiUrl}`);
      console.log(`  Poster Key: ${data.posterApiKey ? '***' : 'none'}`);

      // Subcollections
      const companiesSnap = await adminDb.collection(`organizations/${doc.id}/my_companies`).get();
      console.log(`  My Companies (${companiesSnap.size}):`);
      for (const cDoc of companiesSnap.docs) {
        console.log(`    - ID: ${cDoc.id}, brandName: ${cDoc.data().brandName}, legalName: ${cDoc.data().legalName}, inn: ${cDoc.data().inn}`);
      }

      const accountsSnap = await adminDb.collection(`organizations/${doc.id}/bank_accounts`).get();
      console.log(`  Bank Accounts (${accountsSnap.size}):`);
      for (const aDoc of accountsSnap.docs) {
        console.log(`    - ID: ${aDoc.id}, bankName: ${aDoc.data().bankName}, companyId: ${aDoc.data().companyId}, balance: ${aDoc.data().balance}, type: ${aDoc.data().type}`);
      }
    }
  } catch (err: any) {
    console.error('Error during diagnostics:', err);
  }
  console.log('\n--- DIAGNOSTIC SCRIPT END ---');
}

run();
