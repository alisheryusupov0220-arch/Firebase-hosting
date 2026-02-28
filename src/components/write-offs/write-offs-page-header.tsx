import { PageHeader } from '@/components/layout/page-header';
import { AddWriteOffDialog } from '@/components/write-offs/add-write-off-dialog';
import type { Ingredient, Storage } from '@/lib/poster';

type WriteOffsPageHeaderProps = {
  storages: Storage[];
  ingredients: Ingredient[];
};

export function WriteOffsPageHeader({ storages, ingredients }: WriteOffsPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <PageHeader title="Списания" description="Регистрация списаний товаров и отправка данных в Poster." />
      <AddWriteOffDialog 
        storages={storages}
        ingredients={ingredients}
      />
    </div>
  );
}
