import { SuppliesPageClient } from '@/components/supplies/supplies-page-client';

export const dynamic = 'force-dynamic';

// Supplies are fetched client-side using orgId from Firebase auth context.
// We do NOT call getSupplies() on the server because it requires org-specific
// Poster API credentials that are only available after the user authenticates.
export default function SuppliesPage() {
  return <SuppliesPageClient />;
}
