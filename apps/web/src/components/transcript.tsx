/** biome-ignore-all lint/style/noNestedTernary: <explanation> */
import { Bot, MessageSquare, Phone, Wrench } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';
import type { Item } from '@/components/types';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

type TranscriptProps = {
  items: Item[];
  sessionId?: string;
};

const Transcript: React.FC<TranscriptProps> = ({ items, sessionId }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  // Show messages, function calls, and function call outputs in the transcript
  const transcriptItems = items.filter(
    (it) =>
      it.type === 'message' ||
      it.type === 'function_call' ||
      it.type === 'function_call_output'
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardContent className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0">
        {transcriptItems.length === 0 && (
          <div className="mt-36 flex h-full flex-1 items-center justify-center">
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-secondary/20">
                <MessageSquare className="h-16 w-16 bg-transparent text-foreground/10" />
              </div>
              <div className="space-y-1 text-center">
                <p className="font-medium text-foreground/60 text-sm">
                  No messages yet
                </p>
                <p className="text-muted-foreground text-sm">
                  Start a call to see the transcript
                </p>
              </div>
            </div>
          </div>
        )}
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-6 p-6">
            {transcriptItems.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isTool = msg.role === 'tool';
              // Default to assistant if not user or tool
              let Icon = Bot;
              if (isUser) {
                Icon = Phone;
              } else if (isTool) {
                Icon = Wrench;
              }

              // Combine all text parts into a single string for display
              const displayText = msg.content
                ? msg.content.map((c) => c.text).join('')
                : '';

              return (
                <div className="flex items-start gap-3" key={msg.id}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      isUser
                        ? 'border-border bg-background'
                        : isTool
                          ? 'border-secondary bg-secondary'
                          : 'border-secondary bg-secondary'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`font-medium text-sm ${
                          isUser ? 'text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {isUser
                          ? 'Caller'
                          : isTool
                            ? 'Tool Response'
                            : 'Assistant'}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="break-words text-muted-foreground text-sm leading-relaxed">
                      {displayText}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Transcript;
