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
import { CreateSupplyForm } from './create-supply-form';
import type { LocalIngredient } from '@/app/ingredients/actions';

type AddSupplyDialogProps = {
  ingredients: LocalIngredient[] | null;
};

export function AddSupplyDialog({ ingredients }: AddSupplyDialogProps) {
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
          if ((event.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Новая поставка</DialogTitle>
          <DialogDescription>
            Выберите ингредиенты, укажите количество и сумму для регистрации новой поставки.
          </DialogDescription>
        </DialogHeader>
        <CreateSupplyForm
          ingredients={ingredients}
          onFormSubmitted={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
