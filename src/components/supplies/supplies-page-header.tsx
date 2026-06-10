'use client';
import { PageHeader } from '@/components/layout/page-header';
import { AddSupplyDialog } from '@/components/supplies/add-supply-dialog';
import { type ERPItem } from '@/lib/types/erp';
import { type Storage, type PosterSupplier } from '@/lib/poster';

type SuppliesPageHeaderProps = {
  ingredients: ERPItem[] | null;
  storages: Storage[];
  suppliers: PosterSupplier[];
};

export function SuppliesPageHeader({ ingredients, storages, suppliers }: SuppliesPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <PageHeader title="Поставки" description="Учет поступлений товаров и материалов." />
      <AddSupplyDialog 
        ingredients={ingredients}
        storages={storages}
        suppliers={suppliers}
      />
    </div>
  );
}
