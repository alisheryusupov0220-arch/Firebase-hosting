import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { adminDb, adminAuth } from '../firebase/server';

async function run() {
  console.log('--- RESTORING ADMIN ROLES ---');
  try {
    const usersSnap = await adminDb.collection('users').get();
    let count = 0;
    
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const uid = doc.id;
      
      if (data.role === 'admin') {
        console.log(`Fixing user UID: ${uid} (${data.email})`);
        
        // 1. Update root /users/{uid}
        await adminDb.collection('users').doc(uid).update({ role: 'brand_admin' });
        
        // 2. Update staff subcollection if orgId exists
        if (data.orgId) {
          const staffRef = adminDb.collection('organizations').doc(data.orgId).collection('staff').doc(uid);
          const staffDoc = await staffRef.get();
          if (staffDoc.exists) {
            await staffRef.update({ role: 'brand_admin' });
          }
        }
        
        // 3. Update Auth claims
        try {
          const authUser = await adminAuth.getUser(uid);
          const currentClaims = authUser.customClaims || {};
          const newClaims = {
            ...currentClaims,
            role: 'brand_admin'
          };
          await adminAuth.setCustomUserClaims(uid, newClaims);
          console.log(`  Updated custom claims:`, newClaims);
        } catch (e: any) {
          console.log(`  Failed to update custom claims for ${uid}:`, e.message);
        }
        
        count++;
      }
    }
    
    console.log(`Successfully fixed ${count} users.`);
  } catch (err: any) {
    console.error('Error during role restoration:', err);
  }
  console.log('--- RESTORING ADMIN ROLES END ---');
}

run();
