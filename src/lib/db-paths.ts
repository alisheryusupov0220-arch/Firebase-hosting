/**
 * db-paths.ts — Centralized Firestore collection paths for multi-tenant architecture.
 * 
 * All org-specific data lives under organizations/{orgId}/... subcollections.
 * Global (legacy/test) collections are preserved with a _TEST_ prefix comment.
 * 
 * Usage:
 *   import { orgCol, orgDoc } from '@/lib/db-paths';
 *   const ref = adminDb.collection(orgCol(orgId).financeTransactions);
 *   const ref = adminDb.doc(orgDoc(orgId).bankAccount(accountId));
 */

/**
 * Returns all org-scoped collection paths for a given orgId.
 */
export function orgCol(orgId: string) {
  const base = `organizations/${orgId}`;
  return {
    erpItems:             `${base}/erp_items`,
    suppliers:            `${base}/suppliers`,
    contractors:          `${base}/contractors`,
    contractorItems:      `${base}/contractor_items`,
    bankAccounts:         `${base}/bank_accounts`,
    myCompanies:          `${base}/my_companies`,
    financeTransactions:  `${base}/finance_transactions`,
    accountsPayable:      `${base}/accounts_payable`,
    orderRequests:        `${base}/order_requests`,
    locations:            `${base}/locations`,
    staff:                `${base}/staff`,
    categories:           `${base}/categories`,
    pendingWriteOffs:     `${base}/pendingWriteOffs`,
    inventoryTemplates:   `${base}/inventory_templates`,
    inventoryTasks:       `${base}/inventory_tasks`,
    inventoryCounts:      `${base}/inventory_counts`,
  };
}

/**
 * Returns specific document paths for a given orgId.
 */
export function orgDoc(orgId: string) {
  const base = `organizations/${orgId}`;
  return {
    erpItem:              (id: string) => `${base}/erp_items/${id}`,
    supplier:             (id: string) => `${base}/suppliers/${id}`,
    contractor:           (id: string) => `${base}/contractors/${id}`,
    contractorItem:       (id: string) => `${base}/contractor_items/${id}`,
    bankAccount:          (id: string) => `${base}/bank_accounts/${id}`,
    myCompany:            (id: string) => `${base}/my_companies/${id}`,
    financeTransaction:   (id: string) => `${base}/finance_transactions/${id}`,
    accountPayable:       (id: string) => `${base}/accounts_payable/${id}`,
    orderRequest:         (id: string) => `${base}/order_requests/${id}`,
    location:             (id: string) => `${base}/locations/${id}`,
    category:             (id: string) => `${base}/categories/${id}`,
    pendingWriteOff:      (id: string) => `${base}/pendingWriteOffs/${id}`,
    inventoryTemplate:    (id: string) => `${base}/inventory_templates/${id}`,
    inventoryTask:        (id: string) => `${base}/inventory_tasks/${id}`,
    inventoryCount:       (id: string) => `${base}/inventory_counts/${id}`,
  };
}

/**
 * LEGACY (test) global collection names — kept for reference.
 * Do NOT use these for new features.
 */
export const LEGACY_COLLECTIONS = {
  erpItems:            'erp_items',
  suppliers:           'suppliers',
  contractors:         'contractors',
  bankAccounts:        'bank_accounts',
  myCompanies:         'my_companies',
  financeTransactions: 'finance_transactions',
  accountsPayable:     'accounts_payable',
} as const;
