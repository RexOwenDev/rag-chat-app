import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Documents' };

// Placeholder — DocumentManager built in Phase 2
export default function DocumentsPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">Documents — Phase 2</p>
    </div>
  );
}
