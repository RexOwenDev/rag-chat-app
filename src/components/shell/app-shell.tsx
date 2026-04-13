'use client';

import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TopNav } from './top-nav';
import { SidebarNav, WorkspaceSwitcherPlaceholder } from './sidebar-nav';
import type { User } from '@supabase/supabase-js';

interface AppShellProps {
  user: User;
  workspaceId: string;
  children: React.ReactNode;
}

export function AppShell({ user, workspaceId, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav user={user} onMenuToggle={() => setMobileOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 flex-col border-r border-border bg-background shrink-0">
          <WorkspaceSwitcherPlaceholder />
          <div className="flex-1 overflow-y-auto py-2">
            <SidebarNav workspaceId={workspaceId} />
          </div>
        </aside>

        {/* Mobile sidebar — slide-out Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-56 p-0">
            <WorkspaceSwitcherPlaceholder />
            <SidebarNav
              workspaceId={workspaceId}
              onNavClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
