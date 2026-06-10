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

const db = admin.firestore();
const auth = admin.auth();

const targetEmail = 'alisheryusupov0220@gmail.com';

async function main() {
  console.log(`🔍 Checking if user with email ${targetEmail} exists in Firebase Auth...`);
  
  let userRecord: admin.auth.UserRecord;
  let isNew = false;
  
  try {
    userRecord = await auth.getUserByEmail(targetEmail);
    console.log(`✅ Found existing user in Firebase Auth. UID: ${userRecord.uid}`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log(`ℹ️ User not found. Creating a new user...`);
      const tempPassword = 'SuperAdmin123!';
      userRecord = await auth.createUser({
        email: targetEmail,
        password: tempPassword,
        displayName: 'Alisher Yusupov',
        emailVerified: true
      });
      console.log(`✅ Successfully created user. UID: ${userRecord.uid}`);
      console.log(`🔑 Temporary credentials for testing:`);
      console.log(`   Email: ${targetEmail}`);
      console.log(`   Password: ${tempPassword}`);
      isNew = true;
    } else {
      console.error('❌ Error fetching user:', error);
      process.exit(1);
    }
  }

  const uid = userRecord.uid;
  const claims = {
    role: 'super_admin',
    orgId: 'super_org',
    locationId: null,
    locationIds: null
  };

  console.log(`⚙️ Setting custom user claims to:`, claims);
  await auth.setCustomUserClaims(uid, claims);
  console.log(`✅ Custom claims successfully set.`);

  console.log(`💾 Writing user profile to Firestore (/users/${uid})...`);
  await db.collection('users').doc(uid).set({
    id: uid,
    email: targetEmail,
    displayName: userRecord.displayName || 'Alisher Yusupov',
    role: 'super_admin',
    orgId: 'super_org',
    createdAt: isNew ? admin.firestore.FieldValue.serverTimestamp() : (userRecord.metadata.creationTime ? new Date(userRecord.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp()),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`✅ User profile successfully written to Firestore.`);
  
  console.log(`🎉 Success! ${targetEmail} is now a super_admin.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
