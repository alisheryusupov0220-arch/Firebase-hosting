import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
        });
    } else {
        admin.initializeApp({
            projectId: 'studio-6350931931-426d4',
        });
    }
}

const db = admin.firestore();

async function main() {
    console.log("Fetching organizations...");
    const orgsSnap = await db.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
        const orgData = orgDoc.data();
        console.log(`\nOrganization: ${orgDoc.id} - ${orgData.name || 'Unnamed'}`);
        
        const contractorsSnap = await db.collection('organizations').doc(orgDoc.id).collection('contractors').get();
        console.log(`Contractors count: ${contractorsSnap.size}`);
        contractorsSnap.docs.forEach(d => {
            const data = d.data();
            console.log(`  - ID: ${d.id}`);
            console.log(`    Name: "${data.name}"`);
            console.log(`    LegalName: "${data.legalName || ''}"`);
            console.log(`    Aliases: ${JSON.stringify(data.aliases || [])}`);
            console.log(`    INN: "${data.inn || ''}"`);
        });
    }
}

main().catch(console.error);
