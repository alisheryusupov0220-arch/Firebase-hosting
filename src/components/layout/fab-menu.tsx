'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, PackagePlus, PackageMinus } from 'lucide-react';
import { AddSupplyDialog } from '../supplies/add-supply-dialog';
import { AddWriteOffDialog } from '../write-offs/add-write-off-dialog';
import type { LocalIngredient } from '@/app/ingredients/actions';

type FabMenuProps = {
  ingredients: LocalIngredient[] | null;
};

export function FabMenu({ ingredients }: FabMenuProps) {
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 right-1/2 z-30 translate-x-1/2" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              className="h-16 w-16 rounded-full shadow-lg"
            >
              <Plus className="h-8 w-8" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="mb-2 w-56">
            <DropdownMenuItem onSelect={() => setSupplyDialogOpen(true)}>
              <PackagePlus className="mr-2 h-4 w-4" />
              <span>Новая поставка</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setWriteOffDialogOpen(true)}>
              <PackageMinus className="mr-2 h-4 w-4" />
              <span>Новое списание</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddSupplyDialog 
        ingredients={ingredients}
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        isFab
      />
      <AddWriteOffDialog
        ingredients={ingredients}
        open={writeOffDialogOpen}
        onOpenChange={setWriteOffDialogOpen}
        isFab
      />
    </>
  );
}
