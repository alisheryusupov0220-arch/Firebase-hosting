import { PageHeader } from '@/components/layout/page-header';

export default function InventoryPage() {
  return (
    <div>
      <PageHeader title="Инвентаризация" description="Проведение инвентаризаций для обновления остатков." />
      <div className="mt-8">
        {/* Inventory page content will go here */}
      </div>
    </div>
  );
}
