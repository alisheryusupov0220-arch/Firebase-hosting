'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { CreateOrderForm } from './create-order-form';
import { useState } from 'react';

export function CreateOrderDialog({ locations }: { locations: { id: string, name: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all active:scale-95">
          <PlusCircle className="mr-2 h-5 w-5" />
          Сформировать заявку
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none p-0 shadow-2xl">
        <div className="bg-gradient-to-br from-background to-muted/20 p-6 space-y-6">
            <DialogHeader>
                <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                    Новая заявка FLOW
                </DialogTitle>
                <DialogDescription>
                    Создайте внутреннюю заявку. Вы сможете отправить её поставщику в WhatsApp или Telegram после сохранения.
                </DialogDescription>
            </DialogHeader>
            <CreateOrderForm 
                locations={locations} 
                onFormSubmitted={() => setOpen(false)} 
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
