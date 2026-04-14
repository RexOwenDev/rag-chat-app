/**
 * Builds the system prompt injected into every Claude RAG chat request.
 *
 * The prompt instructs Claude to:
 *  1. Ground every claim in the provided source context
 *  2. Use [N] citation markers that match the numbered context chunks
 *  3. Never answer from training data when the context is silent
 *  4. Optionally append 3 suggested follow-up questions as trailing JSON
 *
 * An optional `workspaceSystemPrompt` (from workspaces.system_prompt) is
 * appended at the end, letting workspace owners customize Claude's persona
 * or domain focus without overriding the citation grounding rules.
 */

const CITATION_RULES = `
## Citation Rules
- Every factual claim MUST cite its source using inline [N] markers (e.g., "The policy states [1]...").
- Use the exact source numbers from the context block below.
- You may cite multiple sources for a single claim: [1][3].
- Never fabricate information not present in the provided context.
- If the context does not contain an answer, say so clearly rather than guessing.
`.trim();

const SUGGESTED_QUESTIONS_RULES = `
## Suggested Follow-up Questions
After your response, append EXACTLY this JSON block (no other text after it):
{"suggestedQuestions":["Question 1?","Question 2?","Question 3?"]}
Generate 3 relevant follow-up questions a user might ask based on your response and the available context.
`.trim();

/**
 * Builds the complete RAG system prompt.
 *
 * @param contextBlock    Numbered source chunks from buildContext()
 * @param workspacePrompt Optional workspace-level system prompt (may be null)
 */
export function buildRAGSystemPrompt(
  contextBlock: string,
  workspacePrompt: string | null = null
): string {
  const parts = [
    'You are a knowledgeable assistant with access to the documents in this workspace.',
    '',
    CITATION_RULES,
    '',
    '## Source Context',
    contextBlock || '(No relevant documents found for this query.)',
    '',
    SUGGESTED_QUESTIONS_RULES,
  ];

  if (workspacePrompt?.trim()) {
    parts.push('', '## Workspace Instructions', workspacePrompt.trim());
  }

  return parts.join('\n');
}
