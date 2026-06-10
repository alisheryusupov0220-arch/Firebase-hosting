'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Send, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TelegramIntegrationCard() {
  return (
    <Card className="hover:border-sky-200 transition-all group">
      <CardHeader>
        <div className="flex items-center gap-2 text-sky-600 mb-2">
          <Send className="w-5 h-5" />
          <CardTitle className="text-lg">Интеграция Telegram</CardTitle>
        </div>
        <CardDescription>
          Управление привязкой Telegram-групп к брендам и банковским счетам, настройка топиков и вебхуков.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/settings/telegram">
          <Button variant="outline" className="w-full h-11 rounded-xl group-hover:bg-sky-50 border-sky-100 text-sky-700 font-bold">
            Настроить Telegram-бот
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
