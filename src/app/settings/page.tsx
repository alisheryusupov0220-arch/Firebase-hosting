'use client';

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileCard } from "@/components/settings/profile-card";
import { useUser, useDoc, useFirestore } from "@/firebase/hooks";
import { doc } from "firebase/firestore";
import { ManageEmployeesCard } from "@/components/settings/manage-employees-card";
import { ManageLocationsCard } from "@/components/settings/location-dialogs";
import { useMemoFirebase, useFirebase } from "@/firebase/provider";
import { ERPInitCard } from "@/components/settings/erp-init-card";
import { AIAgentSettingsCard } from "@/components/settings/ai-agent-card";
import { PosterIntegrationCard } from "@/components/settings/poster-integration-card";
import { TelegramIntegrationCard } from "@/components/settings/telegram-integration-card";
import { UserRole } from "@/lib/types/erp";

type UserProfile = {
  role: UserRole | string;
};

export default function SettingsPage() {
  const { user, role } = useFirebase();
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const isAdmin = role === 'brand_admin' || role === 'super_admin';

  return (
    <div className="space-y-8 pb-24">
      {isAdmin && (
        <PageHeader
          title="Настройки"
          description="Управляйте настройками вашего аккаунта и приложения."
        />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isAdmin && <PosterIntegrationCard />}
        {isAdmin && <AIAgentSettingsCard />}
        {isAdmin && <TelegramIntegrationCard />}
        {isAdmin && <ProfileCard />}
        <Card>
          <CardHeader>
            <CardTitle>Тема</CardTitle>
            <CardDescription>
              Выберите светлую или темную тему для интерфейса.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>
        {isAdmin && <ManageLocationsCard />}
        {isAdmin && <ManageEmployeesCard />}
        {isAdmin && <ERPInitCard />}
      </div>
    </div>
  );
}
