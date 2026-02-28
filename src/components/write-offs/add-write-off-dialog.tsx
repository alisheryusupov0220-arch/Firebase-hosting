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
import { CreateWriteOffForm } from './create-write-off-form';
import type { LocalIngredient } from '@/app/ingredients/actions';

type AddWriteOffDialogProps = {
  ingredients: LocalIngredient[] | null;
};

export function AddWriteOffDialog({ ingredients }: AddWriteOffDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            Выберите ингредиенты и укажите количество для списания.
          </DialogDescription>
        </DialogHeader>
        <CreateWriteOffForm
          ingredients={ingredients}
          onFormSubmitted={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
