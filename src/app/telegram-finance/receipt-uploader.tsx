'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { testReceiptAction } from './actions';
import { Camera, RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';

export function ReceiptUploader() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('loading');
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const result = await testReceiptAction(base64);
                
                if (result) {
                    setStatus('success');
                    setTimeout(() => setStatus('idle'), 3000);
                } else {
                    setStatus('error');
                    setTimeout(() => setStatus('idle'), 5000);
                }
            };
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    return (
        <div className="flex items-center gap-4 border-2 border-dashed border-muted rounded-lg p-6 bg-muted/30">
            <div className="flex-1">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Camera className="w-5 h-5" /> 
                    Проверка ИИ чека
                </h3>
                <p className="text-sm text-muted-foreground mt-1 text-wrap">
                    Загрузите скриншот перевода для проверки логики Gemini прямо здесь.
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
                <button 
                  className={`px-6 py-3 rounded-full font-medium transition-all flex items-center gap-2 shadow-sm 
                    ${status === 'loading' ? 'bg-secondary text-secondary-foreground animate-pulse' : 
                      status === 'success' ? 'bg-green-600 text-white' : 
                      status === 'error' ? 'bg-red-600 text-white' : 
                      'bg-primary text-white hover:opacity-90'}`}
                >
                    {status === 'loading' && <RotateCw className="w-4 h-4 animate-spin" />}
                    {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
                    {status === 'error' && <AlertCircle className="w-4 h-4" />}
                    
                    {status === 'loading' ? 'Распознавание...' : 
                     status === 'success' ? 'Готово!' : 
                     status === 'error' ? 'Ошибка ИИ' : 
                     'Загрузить чек'}
                </button>
            </div>
        </div>
    );
}
