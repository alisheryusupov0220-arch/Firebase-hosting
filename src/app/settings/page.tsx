
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileCard } from "@/components/settings/profile-card";


export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Настройки"
        description="Управляйте настройками вашего аккаунта и приложения."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ProfileCard />
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
      </div>
    </div>
  );
}
