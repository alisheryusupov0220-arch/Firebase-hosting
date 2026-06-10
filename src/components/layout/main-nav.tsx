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
  Truck,
  Layers,
  Users,
  Calendar,
  Landmark,
  MessageSquare,
  Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';

export const allRoutes = [
  {
    href: '/supplies',
    label: 'Поставки (Poster)',
    icon: PackagePlus,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee'],
  },
  {
    href: '/supplies/reception',
    label: 'Приемка по фото',
    icon: Camera,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee'],
  },
  {
    href: '/orders',
    label: 'Заявки FLOW',
    icon: ShoppingCart,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'],
  },
  {
    href: '/write-offs',
    label: 'Списания',
    icon: PackageMinus,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'],
  },
  {
    href: '/finance-hub',
    label: 'Финансовый Хаб',
    icon: PieChart, 
    roles: ['super_admin', 'brand_admin'],
  },
  {
    href: '/finance-hub/accounts',
    label: 'Банки и Счета',
    icon: Landmark, 
    roles: ['super_admin', 'brand_admin'],
  },
  {
    href: '/transfers',
    label: 'Перемещения',
    icon: ArrowRightLeft,
    roles: ['super_admin', 'brand_admin', 'outlet_admin'],
  },
  {
    href: '/inventory',
    label: 'Инвентаризация',
    icon: ClipboardList,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'],
  },
  {
    href: '/menu-analytics',
    label: 'Аналитика меню',
    icon: PieChart,
    roles: ['super_admin', 'brand_admin'],
  },
  {
    href: '/super-admin',
    label: 'Супер Панель',
    icon: Settings,
    roles: ['super_admin'],
  },
  {
    href: '/sandbox',
    label: 'Конструктор',
    icon: FlaskConical,
    roles: ['super_admin'],
  },
  {
    href: '/ingredients',
    label: 'Ингредиенты',
    icon: Layers,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee'],
  },
  {
    href: '/ingredients/schedule',
    label: 'Матрица Заказов',
    icon: Calendar,
    roles: ['super_admin', 'brand_admin', 'outlet_admin'],
  },
  {
    href: '/ingredients/categories',
    label: 'Категории',
    icon: Layers,
    roles: ['super_admin', 'brand_admin', 'outlet_admin'],
  },
  {
    href: '/settings/telegram',
    label: 'Telegram Бот',
    icon: MessageSquare,
    roles: ['super_admin', 'brand_admin'],
  },
  {
    href: '/settings',
    label: 'Настройки',
    icon: Settings,
    roles: ['super_admin', 'brand_admin', 'outlet_admin', 'employee', 'cashier'],
  },
];

export const employeeRoutes = allRoutes.filter(route => 
  route.roles.some(role => ['employee', 'cashier'].includes(role))
).slice(0, 4);

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { role } = useFirebase();
  const userRole = role || 'employee';

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
