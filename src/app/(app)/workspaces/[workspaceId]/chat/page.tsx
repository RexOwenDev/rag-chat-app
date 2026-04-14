import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ChatInterface } from '@/components/chat/chat-interface';
import type { RAGChatMessage } from '@/lib/hooks/use-chat';

export const metadata: Metadata = { title: 'Chat' };

interface PageProps {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ conversationId?: string }>;
}

/**
 * Chat page — Server Component.
 *
 * Pre-fetches two things before handing off to the client ChatInterface:
 *  1. Whether the workspace has any ready documents (for the empty state)
 *  2. Existing messages if a conversationId is provided in the query string
 */
export default async function ChatPage({ params, searchParams }: PageProps) {
  const { workspaceId } = await params;
  const { conversationId } = await searchParams;

  const supabase = await createClient();

  // Check if there are any ready documents in the workspace
  const { count: docCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'ready')
    .is('deleted_at', null);

  const noDocuments = (docCount ?? 0) === 0;

  // Pre-fetch conversation history if conversationId provided
  let initialMessages: RAGChatMessage[] = [];
  const resolvedConversationId: string | undefined = conversationId;

  if (conversationId) {
    const { data: messages } = await supabase
      .from('messages')
      .select('id, role, content, faithfulness_score, relevance_score')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messages) {
      initialMessages = messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        text: m.content,
        parts: [{ type: 'text' as const, text: m.content }],
        faithfulnessScore: (m.faithfulness_score as number | null) ?? null,
        relevanceScore: (m.relevance_score as number | null) ?? null,
      }));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ChatInterface
        workspaceId={workspaceId}
        conversationId={resolvedConversationId}
        initialMessages={initialMessages}
        noDocuments={noDocuments}
      />
    </div>
  );
}
