import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    } else {
        console.error('No GOOGLE_APPLICATION_CREDENTIALS env var found.');
        process.exit(1);
    }
}

const db = admin.firestore();

async function main() {
    const orgId = 'org_84a3zjo2';
    const accSnap = await db.collection(`organizations/${orgId}/bank_accounts`).get();
    console.log(`org_84a3zjo2 bank_accounts count: ${accSnap.size}`);
    accSnap.forEach(doc => {
        console.log(`- ID: ${doc.id}, data:`, doc.data());
    });
}

main().catch(err => console.error(err));
