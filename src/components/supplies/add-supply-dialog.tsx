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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isFab?: boolean;
};

export function AddSupplyDialog({ ingredients, open, onOpenChange, isFab = false }: AddSupplyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const dialogContent = (
    <DialogContent className="sm:max-w-[625px]">
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
  );

  if (isFab) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Добавить поставку
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
