'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PackageMinus } from 'lucide-react';
import type { Ingredient, Storage } from '@/lib/poster';
import { CreateWriteOffForm } from './create-write-off-form';

type Employee = {
  id: string;
  name: string;
};

type AddWriteOffDialogProps = {
  storages: Storage[];
  ingredients: Ingredient[];
  employees: Employee[];
};

export function AddWriteOffDialog({ storages, ingredients, employees }: AddWriteOffDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DialogTrigger asChild>
        <Button>
          <PackageMinus className="mr-2 h-4 w-4" />
          Добавить списание
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[625px]"
        onPointerDownOutside={(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (target.closest('[cmdk-root]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Новое списание</DialogTitle>
          <DialogDescription>
            Выберите склад, сотрудника и ингредиенты для списания.
          </DialogDescription>
        </DialogHeader>
        <CreateWriteOffForm
          storages={storages}
          ingredients={ingredients}
          employees={employees}
          onFormSubmitted={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
