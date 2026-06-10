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
import { type ERPItem } from '@/lib/types/erp';

type AddWriteOffDialogProps = {
  ingredients: ERPItem[] | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isFab?: boolean;
};

export function AddWriteOffDialog({ ingredients, open, onOpenChange, isFab = false }: AddWriteOffDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  
  const dialogContent = (
     <DialogContent className="sm:max-w-[625px]">
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
          <PackageMinus className="mr-2 h-4 w-4" />
          Добавить списание
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
