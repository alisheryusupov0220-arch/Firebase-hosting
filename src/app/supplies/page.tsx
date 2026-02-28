import { getSupplies } from '@/lib/poster';
import { SuppliesPageClient } from '@/components/supplies/supplies-page-client';

export const dynamic = 'force-dynamic';

export default async function SuppliesPage() {
  const supplies = await getSupplies();

  return (
    <SuppliesPageClient initialSupplies={supplies} />
  );
}
