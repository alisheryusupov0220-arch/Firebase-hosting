import Link from 'next/link';
import { Package2 } from 'lucide-react';
import { MainNav } from '@/components/layout/main-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UserNav } from '@/components/layout/user-nav';

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Link href="/" className="flex items-center gap-2 font-headline text-lg font-semibold">
        <Package2 className="h-6 w-6" />
        <span>Dog&Dog Invent+</span>
      </Link>
      <MainNav className="mx-auto" />
      <div className="ml-auto flex items-center gap-4">
        <UserNav />
        <MobileNav />
      </div>
    </header>
  );
}
