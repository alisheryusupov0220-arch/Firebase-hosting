import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createBankAccountAction, getMyCompaniesAction, getBankAccountsAction } from '../app/finance-hub/accounts/actions';

async function run() {
  const orgId = 'org_84a3zjo2';
  console.log('--- TESTING ACCOUNT CREATION ---');
  try {
    const companies = await getMyCompaniesAction(orgId);
    console.log('Existing companies:', companies);
    
    if (companies.length === 0) {
      console.log('No companies found. Cannot create account.');
      return;
    }

    const firstCompany = companies[0];
    console.log(`Using company: ${firstCompany.brandName} (${firstCompany.id})`);

    const accountData = {
      companyId: firstCompany.id,
      bankName: 'Test Bank Name',
      accountNumber: '12345678901234567890',
      currency: 'UZS',
      balance: '150000',
    };

    console.log('Calling createBankAccountAction...');
    const result = await createBankAccountAction(orgId, accountData);
    console.log('Create result:', result);

    const accounts = await getBankAccountsAction(orgId);
    console.log('All bank accounts now:', accounts);

  } catch (err: any) {
    console.error('Error:', err);
  }
}

run();
