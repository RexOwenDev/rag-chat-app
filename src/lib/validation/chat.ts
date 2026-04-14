import { z } from 'zod';

/** Shape of a single message sent in the request body */
const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

/** POST /api/workspaces/[workspaceId]/chat — request body */
export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
