'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrainCircuit, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AIAgentSettingsCard() {
  return (
    <Card className="hover:border-indigo-200 transition-all group">
      <CardHeader>
        <div className="flex items-center gap-2 text-indigo-600 mb-2">
          <BrainCircuit className="w-5 h-5" />
          <CardTitle className="text-lg">Настройки ИИ</CardTitle>
        </div>
        <CardDescription>
          Управление системными промптами, логикой распознавания и поведением ИИ-агента Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/settings/ai">
          <Button variant="outline" className="w-full h-11 rounded-xl group-hover:bg-indigo-50 border-indigo-100 text-indigo-700 font-bold">
            Настроить алгоритмы
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
