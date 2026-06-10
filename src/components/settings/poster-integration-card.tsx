'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDoc, useFirestore } from "@/firebase/hooks";
import { doc } from 'firebase/firestore';
import { updatePosterIntegrationAction } from "@/app/settings/actions";
import { Loader2, Key, Globe, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useMemoFirebase } from '@/firebase/provider';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

export function PosterIntegrationCard() {
  const { orgId } = useFirebase();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [urlError, setUrlError] = useState('');
  const [keyError, setKeyError] = useState('');
  const { toast } = useToast();

  const orgRef = useMemoFirebase(() => {
    if (!firestore || !orgId) return null;
    return doc(firestore, 'organizations', orgId);
  }, [firestore, orgId]);

  const { data: orgData, isLoading: orgLoading } = useDoc<any>(orgRef);

  useEffect(() => {
    if (orgData) {
      setApiUrl(orgData.posterApiUrl || '');
      setApiKey(orgData.posterApiKey || '');
    }
  }, [orgData]);

  function validateUrl(value: string): string {
    if (!value.trim()) return 'URL не может быть пустым.';
    try {
      const u = new URL(value.trim());
      if (!['http:', 'https:'].includes(u.protocol)) return 'URL должен начинаться с https://.';
    } catch {
      return 'Введите корректный URL (например: https://mycafe.joinposter.com/api).';
    }
    return '';
  }

  function validateKey(value: string): string {
    if (!value.trim()) return 'API Токен не может быть пустым.';
    if (value.trim().length < 8) return 'Токен слишком короткий.';
    return '';
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    const urlErr = validateUrl(apiUrl);
    const keyErr = validateKey(apiKey);
    setUrlError(urlErr);
    setKeyError(keyErr);
    if (urlErr || keyErr) return;

    setLoading(true);
    try {
      const result = await updatePosterIntegrationAction(orgId, apiUrl, apiKey);
      if (result.success) {
        toast({
          title: '✅ Интеграция сохранена',
          description: result.message,
        });
      } else {
        toast({
          title: 'Ошибка',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки интеграции.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = orgData?.posterApiUrl && orgData?.posterApiKey;
  const configuredAt = orgData?.posterConfiguredAt?.toDate?.()?.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  return (
    <Card className="border border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
      <form onSubmit={handleSave}>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
                  <Key className="h-4 w-4 text-indigo-600" />
                </div>
                Интеграция с Poster
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-slate-500">
                Подключите ваш аккаунт Poster POS для автоматической синхронизации данных.
              </CardDescription>
            </div>
            {isConfigured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 shrink-0">
                <CheckCircle className="h-3 w-3" />
                Активна
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {isConfigured && configuredAt && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              Последнее обновление: <span className="font-medium text-slate-700">{configuredAt}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="posterApiUrl" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              Poster API URL
            </Label>
            <Input
              id="posterApiUrl"
              placeholder="https://company.joinposter.com/api"
              value={apiUrl}
              onChange={(e) => { setApiUrl(e.target.value); setUrlError(''); }}
              disabled={loading || orgLoading}
              className={`text-sm ${urlError ? 'border-red-300 focus-visible:ring-red-300' : 'border-slate-200 focus-visible:ring-indigo-300'}`}
            />
            {urlError
              ? <FieldError message={urlError} />
              : <p className="text-[10px] text-slate-400">Например: <code className="rounded bg-slate-100 px-1 py-0.5">https://mycafe.joinposter.com/api</code></p>
            }
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="posterApiKey" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Key className="h-3.5 w-3.5 text-slate-400" />
              API Токен (Key)
            </Label>
            <Input
              id="posterApiKey"
              type="password"
              placeholder="Введите токен интеграции"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setKeyError(''); }}
              disabled={loading || orgLoading}
              className={`text-sm ${keyError ? 'border-red-300 focus-visible:ring-red-300' : 'border-slate-200 focus-visible:ring-indigo-300'}`}
            />
            {keyError
              ? <FieldError message={keyError} />
              : (
                <p className="flex items-center gap-1 text-[10px] text-slate-400">
                  Получите токен в Poster →&nbsp;
                  <a
                    href="https://joinposter.com/en/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline"
                  >
                    Настройки API <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </p>
              )
            }
          </div>
        </CardContent>

        <CardFooter className="border-t border-slate-100 pt-4">
          <Button
            type="submit"
            disabled={loading || orgLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium transition-all duration-150"
          >
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</>
              : 'Сохранить интеграцию'
            }
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
