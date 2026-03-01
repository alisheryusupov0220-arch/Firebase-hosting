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
} from 'lucide-react';

import { cn } from '@/lib/utils';

export const mainRoutes = [
  {
    href: '/supplies',
    label: 'Поставки',
    icon: PackagePlus,
  },
  {
    href: '/write-offs',
    label: 'Списания',
    icon: PackageMinus,
  },
  {
    href: '/transfers',
    label: 'Перемещения',
    icon: ArrowRightLeft,
  },
  {
    href: '/inventory',
    label: 'Инвентаризация',
    icon: ClipboardList,
  },
  {
    href: '/menu-analytics',
    label: 'Аналитика меню',
    icon: PieChart,
  },
  {
    href: '/sandbox',
    label: 'Конструктор',
    icon: FlaskConical,
  },
  {
    href: '/ingredients',
    label: 'Ингредиенты',
    icon: Boxes,
  },
  {
    href: '/settings',
    label: 'Настройки',
    icon: Settings,
  },
];

export const employeeRoutes = [
   {
    href: '/supplies',
    label: 'Поставки',
    icon: PackagePlus,
  },
  {
    href: '/write-offs',
    label: 'Списания',
    icon: PackageMinus,
  },
  {
    href: '/inventory',
    label: 'Инвентаризация',
    icon: ClipboardList,
  },
  {
    href: '/settings',
    label: 'Настройки',
    icon: Settings,
  },
]


export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn('hidden items-center space-x-4 md:flex lg:space-x-6', className)}>
      {mainRoutes.map((route) => (
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
