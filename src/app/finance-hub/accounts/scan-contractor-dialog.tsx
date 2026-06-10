'use client';

import { useState, useRef } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScanFace, RefreshCw, UploadCloud, CheckCircle2, AlertCircle, Sparkles, Landmark } from 'lucide-react';
import { createContractorAction } from './actions';
import { scanContractorInvoiceAction } from './ai-ocr-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';

interface ScannedData {
    name: string;
    inn: string;
    bankAccount: string;
    bankCode: string;
    bankName: string;
    phone: string;
}

export function ScanContractorDialog() {
    const { orgId } = useFirebase();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [scanned, setScanned] = useState<ScannedData | null>(null);
    const [editData, setEditData] = useState<ScannedData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleReset() {
        setStep('upload');
        setPreview(null);
        setScanned(null);
        setEditData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function handleClose(isOpen: boolean) {
        setOpen(isOpen);
        if (!isOpen) handleReset();
    }

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            setPreview(base64);
            setOcrLoading(true);

            try {
                const result = await scanContractorInvoiceAction(base64);
                if (result.success && result.data) {
                    setScanned(result.data as ScannedData);
                    setEditData(result.data as ScannedData);
                    setStep('preview');
                    toast({ title: '✓ ИИ считал реквизиты', description: 'Проверьте данные и нажмите «Зарегистрировать»' });
                } else {
                    toast({ variant: 'destructive', title: 'ИИ не распознал', description: result.error || 'Попробуйте другой скриншот' });
                }
            } catch (err) {
                toast({ variant: 'destructive', title: 'Ошибка сканера', description: 'Что-то пошло не так' });
            } finally {
                setOcrLoading(false);
            }
        };
        reader.readAsDataURL(file);
    }

    async function handleSave() {
        if (!editData) return;
        if (!orgId) {
            toast({ variant: 'destructive', title: 'Ошибка', description: 'Организация не определена' });
            return;
        }
        setSaving(true);
        try {
            const result = await createContractorAction(orgId, editData);
            if (result.success) {
                toast({ title: '✓ Контрагент зарегистрирован', description: editData.name });
                handleClose(false);
            } else {
                toast({ variant: 'destructive', title: 'Ошибка реестра', description: result.error });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline"
                    className="h-14 px-8 rounded-[1.5rem] border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black uppercase text-[10px] tracking-widest shadow-lg transition-all hover:scale-[1.02] gap-2"
                >
                    <ScanFace className="w-5 h-5" /> Скан (ИИ)
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[560px] rounded-[3.5rem] p-0 border-none shadow-2xl overflow-hidden bg-white max-h-[95vh] overflow-y-auto scrollbar-hide">
                <DialogTitle className="sr-only">AI Скан Контрагента</DialogTitle>
                {/* HEADER */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-10 pb-8">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-[1.2rem] backdrop-blur">
                                    <ScanFace className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-100">AI Scanner</span>
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-white leading-tight">
                                Авто-регистрация<br />
                                <span className="text-emerald-200/80 font-thin italic text-xl">по скриншоту</span>
                            </h2>
                        </div>
                        <Sparkles className="w-12 h-12 text-white/10" />
                    </div>
                </div>

                <div className="p-10 space-y-8">
                    {/* STEP 1: UPLOAD */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <p className="text-sm text-muted-foreground font-medium">
                                Загрузи скриншот с реквизитами поставщика (Р/с, ИНН, МФО). ИИ сам вытащит всю информацию.
                            </p>
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                            <button
                                type="button"
                                disabled={ocrLoading}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "w-full h-48 rounded-[3rem] border-4 border-dashed flex flex-col items-center justify-center gap-4 transition-all",
                                    ocrLoading 
                                        ? "border-amber-300 bg-amber-50 cursor-wait" 
                                        : "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 cursor-pointer group"
                                )}
                            >
                                {ocrLoading ? (
                                    <>
                                        <RefreshCw className="h-10 w-10 text-amber-500 animate-spin" />
                                        <span className="text-sm font-black uppercase tracking-widest text-amber-600">ИИ анализирует...</span>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="h-10 w-10 text-emerald-400 group-hover:text-emerald-600 transition-colors group-hover:scale-110 duration-300" />
                                        <span className="text-sm font-black uppercase tracking-widest text-emerald-500">Выбрать скриншот</span>
                                        <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* STEP 2: PREVIEW + EDIT */}
                    {step === 'preview' && editData && (
                        <div className="space-y-6">
                            {/* AI скан - мини превью */}
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-[1.5rem] border-2 border-emerald-100">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-black uppercase text-emerald-700 tracking-widest">ИИ распознал данные</p>
                                    <p className="text-[10px] text-muted-foreground">Проверь и при необходимости скорректируй</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto rounded-xl text-[10px] font-black uppercase text-muted-foreground hover:text-rose-600">
                                    Другой скрин
                                </Button>
                            </div>

                            {/* ПОЛЯ ДЛЯ ПРОВЕРКИ И РЕДАКТИРОВАНИЯ */}
                            <div className="grid gap-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Наименование</Label>
                                    <Input 
                                        value={editData.name}
                                        onChange={e => setEditData({...editData, name: e.target.value})}
                                        className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-black text-sm uppercase"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">ИНН</Label>
                                        <Input 
                                            value={editData.inn}
                                            onChange={e => setEditData({...editData, inn: e.target.value})}
                                            className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-black font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Телефон</Label>
                                        <Input 
                                            value={editData.phone}
                                            onChange={e => setEditData({...editData, phone: e.target.value})}
                                            className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-black"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border-2 border-white shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Банковские реквизиты</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Расчетный счет (20 цифр)</Label>
                                        <Input 
                                            value={editData.bankAccount}
                                            onChange={e => setEditData({...editData, bankAccount: e.target.value})}
                                            className="h-12 rounded-xl bg-white border-2 border-slate-100 shadow-sm font-mono font-black text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">МФО</Label>
                                            <Input 
                                                value={editData.bankCode}
                                                onChange={e => setEditData({...editData, bankCode: e.target.value})}
                                                className="h-10 rounded-xl bg-white border-2 border-slate-100 shadow-sm font-mono font-black"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Банк</Label>
                                            <Input 
                                                value={editData.bankName}
                                                onChange={e => setEditData({...editData, bankName: e.target.value})}
                                                className="h-10 rounded-xl bg-white border-2 border-slate-100 shadow-sm font-black text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                onClick={handleSave} 
                                disabled={saving || !editData.name}
                                className="w-full h-16 rounded-[2rem] bg-emerald-600 hover:bg-black font-black uppercase text-[12px] tracking-[0.3em] shadow-xl shadow-emerald-100 transition-all"
                            >
                                {saving 
                                    ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Сохраняю...</> 
                                    : <><CheckCircle2 className="h-5 w-5 mr-2" /> Зарегистрировать</>
                                }
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
