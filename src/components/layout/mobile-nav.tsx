'use client';

import Link from 'next/link';
import { Menu, Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { allRoutes } from '@/components/layout/main-nav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useUser, useDoc, useFirestore } from '@/firebase/hooks';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { UserRole } from '@/lib/types/erp';

type UserProfile = {
  role: UserRole | string;
};

export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <nav className="grid gap-6 text-lg font-medium">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold" onClick={() => setIsOpen(false)}>
            <Package2 className="h-6 w-6" />
            <span className="sr-only">Dog&Dog Invent+</span>
          </Link>
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
