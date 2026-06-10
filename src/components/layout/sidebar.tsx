'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { allRoutes } from './main-nav';
import { Package2, ChevronRight, LogOut, User } from 'lucide-react';
import { useFirebase } from '@/firebase/provider';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, auth } = useFirebase();
  const userRole = role || 'employee';

  const visibleRoutes = allRoutes.filter((route) => 
    route.roles.includes(userRole)
  );

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r bg-card/60 backdrop-blur-xl transition-all duration-300 ease-in-out md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-3 font-headline text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 p-2 shadow-inner group overflow-hidden">
             <Package2 className="h-6 w-6 text-primary group-hover:scale-110 transition-transform duration-300" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-foreground">FLOW</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Invent+</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6">
        <nav className="space-y-1 px-4">
          {visibleRoutes.map((route) => {
            const isActive = pathname.startsWith(route.href);
            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/50" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <route.icon className={cn(
                  "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                )} />
                <span className="flex-1 truncate">{route.label}</span>
                {isActive && (
                  <ChevronRight className="h-4 w-4 opacity-70 animate-in fade-in slide-in-from-left-2 duration-300" />
                )}
                
                {isActive && (
                    <div className="absolute -left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profile and Logout section */}
      <div className="mt-auto border-t p-4 space-y-3 bg-muted/20">
        {user && (
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="text-xs font-semibold text-foreground truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {user.email}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/50 p-3 shadow-inner ring-1 ring-white/10">
          <div className="flex flex-col overflow-hidden">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Ваша роль</span>
            <span className="text-xs font-semibold text-foreground/80 capitalize truncate">
              {userRole.replace('_', ' ').toLowerCase() || 'Гость'}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSignOut} 
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl flex-shrink-0"
            title="Выйти из аккаунта"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
