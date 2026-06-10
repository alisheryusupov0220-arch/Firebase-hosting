'use client';

import React, { useState } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, FileText, User, Hash, Box } from 'lucide-react';

interface VerifyOnGateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (details: {
        invoiceNumber?: string;
        vehicleNumber?: string;
        driverName?: string;
        vatAmount?: number;
        packagingReturn?: Array<{ name: string, count: number }>;
    }) => void;
    isPending: boolean;
}

export function VerifyOnGateDialog({ open, onOpenChange, onConfirm, isPending }: VerifyOnGateDialogProps) {
    const [details, setDetails] = useState({
        invoiceNumber: '',
        vehicleNumber: '',
        driverName: '',
        vatAmount: '',
    });

    const [packaging, setPackaging] = useState<Array<{ name: string, count: number }>>([
        { name: 'Лотки / Ящики', count: 0 }
    ]);

    const handleConfirm = () => {
        onConfirm({
            ...details,
            vatAmount: Number(details.vatAmount) || 0,
            packagingReturn: packaging.filter(p => p.count > 0)
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black flex items-center gap-2">
                        <Truck className="h-6 w-6 text-primary" /> Приемка на рампе
                    </DialogTitle>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="flex items-center gap-2">
                                <Hash className="h-3 w-3" /> № Накладной
                            </Label>
                            <Input 
                                placeholder="Напр: 12846" 
                                value={details.invoiceNumber}
                                onChange={(e) => setDetails({...details, invoiceNumber: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Сумма НДС
                            </Label>
                            <Input 
                                type="number"
                                placeholder="0.00" 
                                value={details.vatAmount}
                                onChange={(e) => setDetails({...details, vatAmount: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2">
                            <Truck className="h-3 w-3" /> Госномер автомобиля
                        </Label>
                        <Input 
                            placeholder="01 059 MEA" 
                            value={details.vehicleNumber}
                            onChange={(e) => setDetails({...details, vehicleNumber: e.target.value})}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2">
                            <User className="h-3 w-3" /> ФИО Водителя
                        </Label>
                        <Input 
                            placeholder="ALIJON" 
                            value={details.driverName}
                            onChange={(e) => setDetails({...details, driverName: e.target.value})}
                        />
                    </div>

                    <div className="p-4 bg-muted/30 rounded-2xl space-y-3">
                        <Label className="flex items-center gap-2 font-bold">
                            <Box className="h-4 w-4" /> Возвратная тара
                        </Label>
                        {packaging.map((p, i) => (
                            <div key={i} className="flex items-center gap-4 text-sm font-medium">
                                <span className="flex-1">{p.name}</span>
                                <Input 
                                    type="number" 
                                    className="w-20 h-8" 
                                    value={p.count}
                                    onChange={(e) => {
                                        const newPkg = [...packaging];
                                        newPkg[i].count = Number(e.target.value);
                                        setPackaging(newPkg);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={isPending}
                        className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20"
                    >
                        {isPending ? 'Запись данных...' : 'Подтвердить прибытие'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
