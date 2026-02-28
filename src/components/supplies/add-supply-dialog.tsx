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
import { PlusCircle } from 'lucide-react';
import type { Ingredient, PosterSupplier, Storage } from '@/lib/poster';
import { CreateSupplyForm } from './create-supply-form';

type AddSupplyDialogProps = {
  suppliers: PosterSupplier[];
  storages: Storage[];
  ingredients: Ingredient[];
};

export function AddSupplyDialog({ suppliers, storages, ingredients }: AddSupplyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Добавить поставку
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
          <DialogTitle>Новая поставка</DialogTitle>
          <DialogDescription>
            Заполните данные для регистрации новой поставки.
          </DialogDescription>
        </DialogHeader>
        <CreateSupplyForm
          suppliers={suppliers}
          storages={storages}
          ingredients={ingredients}
          onFormSubmitted={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
