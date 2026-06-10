import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { adminDb } from '../src/firebase/server';

async function main() {
    try {
        console.log("=== Listing Organizations ===");
        const orgsSnap = await adminDb.collection('organizations').get();
        if (orgsSnap.empty) {
            console.log("No organizations found.");
            return;
        }

        for (const orgDoc of orgsSnap.docs) {
            const orgId = orgDoc.id;
            console.log(`\nOrganization ID: ${orgId}`);
            console.log(JSON.stringify(orgDoc.data(), null, 2));

            console.log(`\n--- Order Requests for ${orgId} ---`);
            const ordersSnap = await adminDb.collection(`organizations/${orgId}/order_requests`).orderBy('createdAt', 'desc').limit(5).get();
            ordersSnap.forEach(d => {
                const data = d.data();
                console.log(`- Order ID: ${d.id}, Supplier: ${data.supplierName}, Total: ${data.totalPrice}, Status: ${data.status}, PosterId: ${data.posterSupplyId}, Image: ${data.imageUrl}`);
            });

            console.log(`\n--- Accounts Payable for ${orgId} ---`);
            const apSnap = await adminDb.collection(`organizations/${orgId}/accounts_payable`).orderBy('createdAt', 'desc').limit(5).get();
            apSnap.forEach(d => {
                const data = d.data();
                console.log(`- AP ID: ${d.id}, Supplier: ${data.supplierName}, Total: ${data.totalAmount}, Status: ${data.status}, PosterId: ${data.posterSupplyId}, Remaining: ${data.remainingAmount}`);
            });

            console.log(`\n--- Suppliers for ${orgId} ---`);
            const supSnap = await adminDb.collection(`organizations/${orgId}/suppliers`).orderBy('createdAt', 'desc').limit(5).get();
            supSnap.forEach(d => {
                const data = d.data();
                console.log(`- Supplier ID: ${d.id}, Name: ${data.name}, Balance: ${data.balance}`);
            });

            console.log(`\n--- Contractors for ${orgId} ---`);
            const conSnap = await adminDb.collection(`organizations/${orgId}/contractors`).orderBy('createdAt', 'desc').limit(5).get();
            conSnap.forEach(d => {
                const data = d.data();
                console.log(`- Contractor ID: ${d.id}, Name: ${data.name}, Balance: ${data.balance}, INN: ${data.inn}`);
            });
        }
    } catch (e) {
        console.error("Error running script:", e);
    }
}

main().then(() => process.exit(0));
