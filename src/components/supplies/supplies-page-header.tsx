import { PageHeader } from '@/components/layout/page-header';
import { AddSupplyDialog } from '@/components/supplies/add-supply-dialog';
import type { LocalIngredient } from '@/app/ingredients/actions';

type SuppliesPageHeaderProps = {
  ingredients: LocalIngredient[] | null;
};

export function SuppliesPageHeader({ ingredients }: SuppliesPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <PageHeader title="Поставки" description="Учет поступлений товаров и материалов." />
      <AddSupplyDialog 
        ingredients={ingredients}
      />
    </div>
  );
}
