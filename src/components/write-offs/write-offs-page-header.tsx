import { PageHeader } from '@/components/layout/page-header';
import { AddWriteOffDialog } from '@/components/write-offs/add-write-off-dialog';
import { type ERPItem } from '@/lib/types/erp';

type WriteOffsPageHeaderProps = {
  ingredients: ERPItem[] | null;
};

export function WriteOffsPageHeader({ ingredients }: WriteOffsPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <PageHeader title="Списания" description="Регистрация списаний товаров и отправка данных в Poster." />
      <AddWriteOffDialog 
        ingredients={ingredients}
      />
    </div>
  );
}
