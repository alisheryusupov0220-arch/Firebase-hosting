'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { allRoutes } from './main-nav';
import { useFirebase } from '@/firebase/provider';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { role } = useFirebase();
  const userRole = role || 'employee';

  const visibleRoutes = allRoutes.filter((route) => {
    const bottomNavPages = ['/supplies', '/supplies/reception', '/orders', '/write-offs', '/inventory', '/settings'];
    return route.roles.includes(userRole) && bottomNavPages.includes(route.href);
  }).slice(0, 5);

  return (
    <div className="fixed bottom-0 left-0 z-20 w-full border-t bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
      <div className={cn("grid h-16 pt-2", {
        "grid-cols-2": visibleRoutes.length === 2,
        "grid-cols-3": visibleRoutes.length === 3,
        "grid-cols-4": visibleRoutes.length === 4,
        "grid-cols-5": visibleRoutes.length === 5,
      })}>
        {visibleRoutes.map((route) => {
          const isActive = route.href === '/supplies'
            ? pathname === '/supplies'
            : pathname.startsWith(route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                'group inline-flex flex-col items-center justify-center p-1.5 text-center transition-all duration-200',
                isActive ? 'text-primary scale-105 font-bold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <route.icon className={cn("h-5 w-5 transition-transform", isActive ? "stroke-[2.5px]" : "")} />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">
                {route.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
