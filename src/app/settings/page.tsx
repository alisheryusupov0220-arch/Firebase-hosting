'use client';

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileCard } from "@/components/settings/profile-card";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase/hooks";
import { doc } from "firebase/firestore";
import { ManageEmployeesCard } from "@/components/settings/manage-employees-card";

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc(userProfileRef);

  return (
    <div className="space-y-8 pb-24">
      {userProfile?.role === 'admin' && (
        <PageHeader
          title="Настройки"
          description="Управляйте настройками вашего аккаунта и приложения."
        />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {userProfile?.role === 'admin' && <ProfileCard />}
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
        {userProfile?.role === 'admin' && <ManageEmployeesCard />}
      </div>
    </div>
  );
}
