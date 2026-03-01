'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const inventoryNavItems = [
  { href: '/inventory', label: 'Задания' },
  { href: '/inventory/history', label: 'История' },
  { href: '/inventory/templates', label: 'Шаблоны' },
];

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleTabChange = (value: string) => {
    router.push(value);
  };

  // Determine the active tab, even for nested routes
  const activeTab = inventoryNavItems.find(item => pathname.startsWith(item.href))?.href || pathname;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Инвентаризация"
        description="Управление запасами, проведение и просмотр инвентаризаций."
      />
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {inventoryNavItems.map((item) => (
             <TabsTrigger key={item.href} value={item.href}>
                {item.label}
             </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
