import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chat' };

// Placeholder — full ChatInterface built in Phase 3
export default function ChatPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">Chat — Phase 3</p>
    </div>
  );
}
