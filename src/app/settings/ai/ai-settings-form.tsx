'use client';

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Save, RefreshCw, AlertCircle, Sparkles, ChevronDown } from "lucide-react";
import { AISystemSettings } from "@/lib/types/settings";
import { updateAISettingsAction } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export function AISettingsForm({ initialSettings }: { initialSettings: AISystemSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await updateAISettingsAction(settings);
      if (res.success) {
        toast({
          title: "Настройки сохранены",
          description: "ИИ-агент теперь работает по обновленным алгоритмам.",
        });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить настройки.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white/50 p-6 rounded-3xl border border-slate-100 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Инженер промптов</h1>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Управление интеллектуальным ядром FLOW</p>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="h-12 px-8 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-tighter shadow-xl active:scale-95 transition-all"
        >
          {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Сохранить изменения
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-[0_45px_100px_-20px_rgba(0,0,0,0.08)] overflow-hidden bg-white">
            <div className="h-2 bg-indigo-600 w-full" />
            <CardHeader className="px-10 pt-10 pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-slate-800">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Системный Промпт (Алгоритм)
                </CardTitle>
                <div className="px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-black text-indigo-600 uppercase">System Instruction</div>
              </div>
              <CardDescription className="text-xs font-semibold text-slate-400 mt-2">
                Это главная инструкция, которой руководствуется ИИ Gemini при обработке документов. 
                Здесь описываются правила парсинга, условия валидации и обязательные поля.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-10 pb-10 space-y-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-50 rounded-3xl -m-2 opacity-50 group-focus-within:opacity-100 transition-opacity" />
                <Textarea 
                  value={settings.systemPrompt} 
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  placeholder="Введите системные инструкции..."
                  className="min-h-[500px] rounded-2xl border-none bg-transparent font-mono text-[13px] leading-relaxed relative z-10 focus-visible:ring-0 shadow-none scrollbar-hide text-slate-700"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-none shadow-xl bg-slate-900 text-white">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] opacity-50">Настройки модели</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">AI Model (Двигатель)</Label>
                <Select 
                  value={settings.model} 
                  onValueChange={(val) => setSettings({ ...settings, model: val })}
                >
                  <SelectTrigger className="w-full h-14 bg-white/10 border-white/5 rounded-2xl font-mono text-sm text-white focus:ring-indigo-500">
                    <SelectValue placeholder="Выберите модель" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                    <SelectItem value="gemini-2.5-flash" className="focus:bg-indigo-600 focus:text-white">
                      Gemini 2.5 Flash (Ultra Fast 2026)
                    </SelectItem>
                    <SelectItem value="gemini-2.0-flash-exp" className="focus:bg-indigo-600 focus:text-white">
                      Gemini 2.0 Flash (Fastest)
                    </SelectItem>
                    <SelectItem value="gemini-1.5-flash-latest" className="focus:bg-indigo-600 focus:text-white">
                      Gemini 1.5 Flash (Stable)
                    </SelectItem>
                    <SelectItem value="gemini-1.5-pro-latest" className="focus:bg-indigo-600 focus:text-white">
                      Gemini 1.5 Pro (Powerful)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-indigo-300/50 font-bold uppercase mt-1">
                  *2.5 Flash — Рекомендуемая модель FLOW (v3) для 2026 года.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Gemini API Key (Ключ API)</Label>
                <Input 
                   type="password"
                   value={settings.geminiApiKey || ''}
                   onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                   placeholder="AIzaSy..."
                   className="h-14 bg-white/10 border-white/5 rounded-2xl font-mono text-sm text-white placeholder:opacity-20 focus:ring-indigo-500"
                />
                <p className="text-[9px] text-indigo-300/50 font-bold uppercase mt-1">
                  Необходим для работы ИИ-оцифровки накладных и списаний.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Креативность (Temp)</Label>
                <Input 
                   type="range" 
                   min="0" 
                   max="1" 
                   step="0.05" 
                   value={settings.temperature}
                   onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                   className="h-2 accent-indigo-400 bg-white/10 border-none rounded-full cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-black uppercase opacity-40 px-1">
                   <span>Точность (0.0)</span>
                   <span className="text-indigo-400 text-sm">{settings.temperature}</span>
                   <span>Креатив (1.0)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                    Будьте осторожны при изменении системного промпта. Изменение структуры JSON или удаление обязательных требований к валидации может привести к ошибкам в финансовом хабе.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
             <div className="w-10 h-10 rounded-xl bg-amber-200/50 flex items-center justify-center shrink-0">
                 <RefreshCw className="w-5 h-5 text-amber-700" />
             </div>
             <div>
                <h4 className="text-[11px] font-black uppercase tracking-tight text-amber-900 mb-1">Версионность</h4>
                <p className="text-[10px] text-amber-800/70 font-medium">Система автоматически применяет новый промпт ко всем последующим транзакциям во время OCR-обработки.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
