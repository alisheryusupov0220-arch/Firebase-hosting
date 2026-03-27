'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/firebase/hooks";
import { initializeERPStructureAction } from "@/app/actions/erp-init";
import { Loader2, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ERPInitCard() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const result = await initializeERPStructureAction(user.uid, user.email!);
      if (result.success) {
        toast({
          title: "Успех",
          description: result.message,
        });
      } else {
        toast({
          title: "Ошибка",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить инициализацию.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          ERP Инициализация
        </CardTitle>
        <CardDescription>
          Настройте основные коллекции ERP (Склады, Роли) и назначьте себя Супер-Админом.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Это действие создаст коллекцию "locations" с основным складом и обновит ваш профиль, если это необходимо.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleInit} disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Инициализировать"}
        </Button>
      </CardFooter>
    </Card>
  );
}
