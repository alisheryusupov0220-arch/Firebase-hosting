'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase/hooks';
import { doc } from 'firebase/firestore';


export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'admin';

  const inventoryNavItems = [
    { href: '/inventory', label: 'Задания' },
    { href: '/inventory/history', label: 'История' },
    ...(isAdmin ? [{ href: '/inventory/templates', label: 'Шаблоны' }] : []),
  ];

  const handleTabChange = (value: string) => {
    router.push(value);
  };

  // Determine the active tab, even for nested routes
  const getCurrentTab = () => {
    if (pathname.startsWith('/inventory/templates')) {
        return '/inventory/templates';
    }
    if (pathname.startsWith('/inventory/history')) {
        return '/inventory/history';
    }
    // This will be the default for /inventory and its sub-routes like /inventory/conduct/[id]
    return '/inventory';
  };
  
  const activeTab = getCurrentTab();

  if (userProfile?.role === 'employee') {
    return <div className="pb-24">{children}</div>;
  }

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
