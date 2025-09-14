import type React from 'react';
import { useState } from 'react';
import type { FrontendToBackendMessage, Item } from '@/components/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

type FunctionCallsPanelProps = {
  items: Item[];
  ws?: WebSocket | null; // pass down ws from parent
  sessionId?: string;
};

const FunctionCallsPanel: React.FC<FunctionCallsPanelProps> = ({
  items,
  ws,
  sessionId,
}) => {
  const [responses, setResponses] = useState<Record<string, string>>({});

  // Filter function_call items
  const functionCalls = items.filter((it) => it.type === 'function_call');

  // For each function_call, check for a corresponding function_call_output
  const functionCallsWithStatus = functionCalls.map((call) => {
    const outputs = items.filter(
      (it) => it.type === 'function_call_output' && it.call_id === call.call_id
    );
    const outputItem = outputs[0];
    const completed = call.status === 'completed' || !!outputItem;
    const response = outputItem ? outputItem.output : undefined;
    return {
      ...call,
      completed,
      response,
    };
  });

  const handleChange = (call_id: string, value: string) => {
    setResponses((prev) => ({ ...prev, [call_id]: value }));
  };

  const handleSubmit = (call: Item) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionId) {
      return;
    }
    const call_id = call.call_id || '';

    const createItemMessage: FrontendToBackendMessage = {
      sessionId,
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: JSON.stringify(responses[call_id] || ''),
      },
    };

    const createResponseMessage: FrontendToBackendMessage = {
      sessionId,
      type: 'response.create',
    };

    ws.send(JSON.stringify(createItemMessage));
    // Ask the model to continue after providing the tool response
    ws.send(JSON.stringify(createResponseMessage));
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-1.5 pb-0">
        <CardTitle className="font-semibold text-base">
          Function Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {functionCallsWithStatus.map((call) => (
              <div
                className="space-y-3 rounded-lg border bg-card p-4"
                key={call.id}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{call.name}</h3>
                  <Badge variant={call.completed ? 'default' : 'secondary'}>
                    {call.completed ? 'Completed' : 'Pending'}
                  </Badge>
                </div>

                {/* Show function parameters in a user-friendly way */}
                {call.name === 'get_more_information' && call.params ? (
                  <div className="space-y-2">
                    <div className="rounded-md border-orange-400 border-l-4 bg-orange-50 p-3">
                      <div className="space-y-1">
                        <p className="font-medium text-orange-800 text-sm">
                          AI is requesting:{' '}
                          {String(call.params.question || 'Information')}
                        </p>
                        {(() => {
                          const context = call.params.context;
                          if (context && typeof context === 'string') {
                            return (
                              <p className="text-orange-700 text-xs">
                                Context: {context}
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="break-all font-mono text-muted-foreground text-sm">
                    {JSON.stringify(call.params)}
                  </div>
                )}

                {call.completed ? (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    {JSON.stringify(JSON.parse(call.response || ''))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {call.name === 'get_more_information' && (
                      <p className="text-gray-600 text-sm">
                        Please provide the requested information:
                      </p>
                    )}
                    <Input
                      onChange={(e) =>
                        handleChange(call.call_id || '', e.target.value)
                      }
                      placeholder={
                        call.name === 'get_more_information' &&
                        call.params?.question
                          ? `Enter ${String(call.params.question)}...`
                          : 'Enter response'
                      }
                      value={responses[call.call_id || ''] || ''}
                    />
                    <Button
                      className="w-full"
                      disabled={!responses[call.call_id || '']}
                      onClick={() => handleSubmit(call)}
                      size="sm"
                      variant="outline"
                    >
                      {call.name === 'get_more_information'
                        ? 'Provide Information'
                        : 'Submit Response'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FunctionCallsPanel;
