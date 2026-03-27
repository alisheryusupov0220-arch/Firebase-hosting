'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightLeft,
  ClipboardList,
  PackageMinus,
  PackagePlus,
  Settings,
  PieChart,
  FlaskConical,
  Boxes,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useDoc, useFirestore } from '@/firebase/hooks';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { UserRole } from '@/lib/types/erp';

export const allRoutes = [
  {
    href: '/supplies',
    label: 'Поставки (Poster)',
    icon: PackagePlus,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER', 'STAFF_POINT'],
  },
  {
    href: '/orders',
    label: 'Заявки FLOW',
    icon: ShoppingCart,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER', 'STAFF_POINT', 'KITCHEN'],
  },
  {
    href: '/suppliers',
    label: 'Поставщики',
    icon: Boxes, // Reuse Boxes or another icon like Users
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    href: '/write-offs',
    label: 'Списания',
    icon: PackageMinus,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER', 'STAFF_POINT', 'KITCHEN'],
  },
  {
    href: '/transfers',
    label: 'Перемещения',
    icon: ArrowRightLeft,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    href: '/inventory',
    label: 'Инвентаризация',
    icon: ClipboardList,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER', 'STAFF_POINT', 'KITCHEN'],
  },
  {
    href: '/menu-analytics',
    label: 'Аналитика меню',
    icon: PieChart,
    roles: ['admin', 'SUPER_ADMIN'],
  },
  {
    href: '/sandbox',
    label: 'Конструктор',
    icon: FlaskConical,
    roles: ['admin', 'SUPER_ADMIN'],
  },
  {
    href: '/ingredients',
    label: 'Ингредиенты',
    icon: Boxes,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    href: '/settings',
    label: 'Настройки',
    icon: Settings,
    roles: ['admin', 'SUPER_ADMIN', 'MANAGER', 'STAFF_POINT', 'KITCHEN', 'employee'],
  },
];

type UserProfile = {
  role: UserRole | string;
};

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const userRole = userProfile?.role || 'employee';

  const visibleRoutes = allRoutes.filter((route) => 
    route.roles.includes(userRole)
  );

  return (
    <nav className={cn('hidden items-center space-x-4 md:flex lg:space-x-6', className)}>
      {visibleRoutes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            'text-sm font-medium transition-colors hover:text-primary',
            pathname.startsWith(route.href) ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  );
}
