'use client';

import Link from 'next/link';
import { Menu, Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { allRoutes } from '@/components/layout/main-nav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useFirebase } from '@/firebase/provider';

export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useFirebase();
  const userRole = role || 'employee';

  const visibleRoutes = allRoutes.filter((route) => 
    route.roles.includes(userRole)
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader className="text-left">
          <SheetTitle>
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold" onClick={() => setIsOpen(false)}>
              <Package2 className="h-6 w-6" />
              <span>Dog&Dog Invent+</span>
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Навигация по приложению
          </SheetDescription>
        </SheetHeader>
        <nav className="grid gap-6 text-lg font-medium mt-6">
          {visibleRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                'transition-colors hover:text-foreground',
                pathname.startsWith(route.href) ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {route.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
