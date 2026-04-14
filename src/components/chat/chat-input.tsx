'use client';

/**
 * ChatInput — the message composition area.
 *
 * Keyboard behaviour:
 *  - Enter     → submit (if not loading)
 *  - Shift+Enter → insert newline (standard chat UX)
 *  - Auto-grows vertically up to 6 lines
 *
 * Accessibility:
 *  - Disabled visually and functionally while isLoading is true
 *  - Stop button appears during streaming
 */

import { useRef, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  placeholder = 'Ask a question about your documents…',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSubmit();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    // Auto-resize: reset height then set to scrollHeight
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`; // 144 = 6 lines × 24px
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        className={cn(
          'max-h-36 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0',
          isLoading && 'opacity-50'
        )}
        aria-label="Chat message input"
      />

      {isLoading ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onStop}
          aria-label="Stop generating"
          className="shrink-0 text-destructive hover:text-destructive"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          onClick={onSubmit}
          disabled={!value.trim()}
          aria-label="Send message"
          className="shrink-0 bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
