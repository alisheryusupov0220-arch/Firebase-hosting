'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { testReceiptFinanceAction } from './actions';
import { Upload, RotateCw, CheckCircle2, AlertCircle, FileText, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirebase } from '@/firebase/provider';

export function FinanceReceiptUploader() {
    const { orgId } = useFirebase();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [lastScan, setLastScan] = useState<any>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('loading');
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                if (!orgId) {
                    setStatus('error');
                    return;
                }
                const result = await testReceiptFinanceAction(base64, orgId);
                
                if (result) {
                    setLastScan(result);
                    setStatus('success');
                    setTimeout(() => setStatus('idle'), 5000);
                } else {
                    setStatus('error');
                    setTimeout(() => setStatus('idle'), 4000);
                }
            };
        } catch (err) {
            console.error('Frontend Upload Error:', err);
            setStatus('error');
        }
    };

    return (
        <Card className="border-2 border-dashed bg-blue-50/20 border-blue-200">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 space-y-1">
                        <h3 className="font-bold text-xl flex items-center gap-2 text-blue-700">
                            <FileText className="w-5 h-5 fill-blue-700" /> 
                            Смарт-Загрузка Чека (B2B/B2C)
                        </h3>
                        <p className="text-sm text-blue-600/80">
                            Загрузите скриншот или фото платежки. ИИ автоматически распознает ИНН, 
                            счет и назначение платежа, и добавит транзакцию в Hub.
                        </p>
                    </div>
                    
                    <div className="relative">
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:pointer-events-none"
                            disabled={status === 'loading'}
                        />
                        <Button 
                          className={`min-w-[200px] h-14 rounded-xl text-lg font-bold shadow-lg transition-all
                            ${status === 'loading' ? 'bg-secondary animate-pulse' : 
                              status === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 
                              status === 'error' ? 'bg-red-600 hover:bg-red-700' : 
                              'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                        >
                            {status === 'loading' && <RotateCw className="w-5 h-5 animate-spin mr-2" />}
                            {status === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
                            {status === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
                            
                            {status === 'loading' ? 'Система думает...' : 
                             status === 'success' ? 'Распознано!' : 
                             status === 'error' ? 'Ошибка Gemini' : 
                             'Загрузить Файл'}
                        </Button>
                    </div>
                </div>

                {lastScan && status === 'success' && (
                    <div className="mt-6 p-4 rounded-xl bg-white border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 font-bold border-blue-200 uppercase tracking-tighter">
                                {lastScan.doc_type}
                            </Badge>
                            {lastScan.quality_control?.is_blurred && (
                                <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-rose-100 gap-1 font-bold">
                                    <AlertTriangle className="w-3 h-3" /> Размыто
                                </Badge>
                            )}
                            {lastScan.quality_control?.is_truncated && (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-bold">
                                    <AlertTriangle className="w-3 h-3" /> Обрезано
                                </Badge>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Сумма</div>
                                <div className="text-lg font-black text-slate-800 tracking-tight">
                                    {(lastScan.amount || lastScan.amounts?.total || 0).toLocaleString()} {lastScan.currency || lastScan.amounts?.currency || 'UZS'}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Контрагент</div>
                                <div className="text-sm font-bold text-blue-700 truncate">{lastScan.counterparty || 'Не распознан'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Дата</div>
                                <div className="text-sm font-bold text-slate-600">{lastScan.date || '—'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Статус ИИ</div>
                                <div className="text-sm font-black text-green-600">
                                    {((lastScan.quality_control?.confidence_level || 0.95) * 100).toFixed(0)}% Доверия
                                </div>
                            </div>
                        </div>

                        {lastScan.quality_control?.validation_error && (
                            <div className="mt-3 p-2 rounded bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> 
                                Ошибка расчета: {lastScan.quality_control.validation_error}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

import { Card, CardContent } from '@/components/ui/card';
