'use client';

/**
 * SystemPromptForm — lets workspace owners edit the name and system prompt.
 * The system prompt is injected into Claude's context on every RAG query.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SystemPromptFormProps {
  workspaceId: string;
  initialName: string;
  initialSystemPrompt: string | null;
}

const SYSTEM_PROMPT_MAX = 4000;

export function SystemPromptForm({
  workspaceId,
  initialName,
  initialSystemPrompt,
}: SystemPromptFormProps) {
  const [name, setName] = useState(initialName);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt ?? '');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          system_prompt: systemPrompt.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(body.error ?? 'Failed to save settings');
        return;
      }

      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  const isDirty = name !== initialName || systemPrompt !== (initialSystemPrompt ?? '');
  const promptLength = systemPrompt.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Workspace Settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspace-name" className="text-xs">
            Workspace Name
          </Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="My Workspace"
            className="h-8 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="system-prompt" className="text-xs">
              System Prompt
            </Label>
            <span
              className={`text-[10px] tabular-nums ${
                promptLength > SYSTEM_PROMPT_MAX * 0.9 ? 'text-yellow-400' : 'text-muted-foreground'
              }`}
            >
              {promptLength}/{SYSTEM_PROMPT_MAX}
            </span>
          </div>
          <Textarea
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            maxLength={SYSTEM_PROMPT_MAX}
            placeholder="Optional instructions that shape how the assistant responds. E.g. 'Always respond in bullet points' or 'You are a legal assistant for Acme Corp. Cite relevant laws when applicable.'"
            rows={6}
            className="resize-none text-sm leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground">
            Injected into every chat session in this workspace. Leave blank to use the default RAG prompt.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="self-end"
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}
