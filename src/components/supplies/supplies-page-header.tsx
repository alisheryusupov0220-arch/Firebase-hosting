'use client';

import { PageHeader } from '@/components/layout/page-header';
import { AddSupplyDialog } from '@/components/supplies/add-supply-dialog';
import type { Ingredient, PosterSupplier, Storage } from '@/lib/poster';

// Minimal employee type, as avatar is not needed in the form
type Employee = {
  id: string;
  name: string;
};

type SuppliesPageHeaderProps = {
  storages: Storage[];
  suppliers: PosterSupplier[];
  ingredients: Ingredient[];
  employees: Employee[];
};

export function SuppliesPageHeader({ storages, suppliers, ingredients, employees }: SuppliesPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <PageHeader title="Поставки" description="Учет поступлений товаров и материалов." />
      <AddSupplyDialog 
        storages={storages}
        suppliers={suppliers}
        ingredients={ingredients}
        employees={employees}
      />
    </div>
  );
}
