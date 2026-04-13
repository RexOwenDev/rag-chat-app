/**
 * Inngest serve endpoint — handles GET (introspection), POST (event delivery),
 * and PUT (SDK handshake) from the Inngest platform or dev server.
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processDocument } from '@/lib/inngest/functions/process-document';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocument],
});
