'use client';

/**
 * SuggestedQuestions — clickable follow-up question chips.
 *
 * Rendered below the last assistant message once streaming completes.
 * Clicking a chip calls onSelect() with the question text, which the
 * chat interface uses to pre-fill and submit the input.
 */

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ questions, onSelect }: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Follow-up questions
      </p>
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="h-auto max-w-full justify-start whitespace-normal text-left text-xs"
            onClick={() => onSelect(q)}
          >
            <MessageCircle className="mr-1.5 h-3 w-3 shrink-0" />
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}
