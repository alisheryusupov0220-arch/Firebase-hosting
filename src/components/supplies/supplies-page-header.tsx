import { PageHeader } from '@/components/layout/page-header';
import { AddSupplyDialog } from '@/components/supplies/add-supply-dialog';
import type { Ingredient, PosterSupplier, Storage } from '@/lib/poster';

type SuppliesPageHeaderProps = {
  storages: Storage[];
  suppliers: PosterSupplier[];
  ingredients: Ingredient[];
};

export function SuppliesPageHeader({ storages, suppliers, ingredients }: SuppliesPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <PageHeader title="Поставки" description="Учет поступлений товаров и материалов." />
      <AddSupplyDialog 
        storages={storages}
        suppliers={suppliers}
        ingredients={ingredients}
      />
    </div>
  );
}
