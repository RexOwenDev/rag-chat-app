'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FileText, BarChart2, Settings, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  workspaceId: string;
  onNavClick?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function SidebarNav({ workspaceId, onNavClick }: SidebarNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: 'Chat',
      href: `/workspaces/${workspaceId}/chat`,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      label: 'Documents',
      href: `/workspaces/${workspaceId}/documents`,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: 'Analytics',
      href: `/workspaces/${workspaceId}/analytics`,
      icon: <BarChart2 className="h-4 w-4" />,
    },
    {
      label: 'Settings',
      href: `/workspaces/${workspaceId}/settings`,
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <nav className="flex flex-col gap-1 p-2" aria-label="Workspace navigation">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function WorkspaceSwitcherPlaceholder() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      <Database className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium truncate text-foreground">Workspace</span>
    </div>
  );
}
