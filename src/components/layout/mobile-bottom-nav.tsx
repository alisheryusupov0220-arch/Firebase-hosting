'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { employeeRoutes } from './main-nav';

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 z-20 w-full border-t bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
      <div className="grid h-16 grid-cols-4 pt-2">
        {employeeRoutes.map((route) => {
          const isActive = pathname.startsWith(route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                'group inline-flex flex-col items-center justify-center p-2 text-center',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <route.icon className="h-6 w-6" />
              <span className="text-xs">
                {route.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
