'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const inventoryNavItems = [
  { href: '/inventory', label: 'Проведение' },
  { href: '/inventory/history', label: 'История' },
  { href: '/inventory/templates', label: 'Шаблоны', disabled: true },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Инвентаризация"
        description="Управление запасами, проведение и просмотр инвентаризаций."
      />
      <Tabs value={pathname} onValueChange={handleTabChange}>
        <TabsList>
          {inventoryNavItems.map((item) => (
             <TabsTrigger key={item.href} value={item.href} disabled={item.disabled} className={cn(item.disabled && "cursor-not-allowed opacity-50")}>
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
