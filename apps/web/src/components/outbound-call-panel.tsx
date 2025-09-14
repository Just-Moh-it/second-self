'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type OutboundCallPanelProps = {
  ws: WebSocket | null;
  onCallInitiated?: (phoneNumber: string) => void;
};

const DEFAULT_NUMBERS = [
  { label: 'Test Number', number: '+1 540-998-4745' },
  { label: 'Google', number: '+1 (540) 315-1034' },
];

const OutboundCallPanel = ({ ws, onCallInitiated }: OutboundCallPanelProps) => {
  const [customNumber, setCustomNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const makeCall = async (phoneNumber: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      // Call the backend API to initiate the outbound call
      const response = await fetch('http://localhost:8081/make-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phoneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to make call: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Call initiated:', result);

      // Notify parent component
      if (onCallInitiated) {
        onCallInitiated(phoneNumber);
      }

      // Clear custom number input
      setCustomNumber('');
    } catch (error) {
      console.error('Error making call:', error);
      // TODO: Show error toast/notification
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomCall = () => {
    if (customNumber.trim()) {
      makeCall(customNumber.trim());
    }
  };

  const formatPhoneNumber = (number: string) => {
    // Remove any formatting and add consistent formatting
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-semibold text-lg">
              Make Outbound Call
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">
              Click to call a number and start an AI agent session
            </p>
          </div>
          <Badge
            className="text-xs"
            variant={
              ws?.readyState === WebSocket.OPEN ? 'default' : 'secondary'
            }
          >
            {ws?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Quick Call Numbers */}
          <div>
            <h3 className="mb-3 font-medium text-sm">Quick Call Numbers</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {DEFAULT_NUMBERS.map((contact) => (
                <div
                  className="flex items-center justify-between rounded-lg border bg-muted p-3"
                  key={contact.number}
                >
                  <div>
                    <p className="font-medium text-sm">{contact.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatPhoneNumber(contact.number)}
                    </p>
                  </div>
                  <Button
                    className="bg-success text-success-foreground hover:bg-success/90"
                    disabled={isLoading || ws?.readyState !== WebSocket.OPEN}
                    onClick={() => makeCall(contact.number)}
                    size="sm"
                  >
                    {isLoading ? 'Calling...' : 'Call'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Number Input */}
          <div>
            <h3 className="mb-3 font-medium text-sm">Call Custom Number</h3>
            <div className="flex gap-2">
              <Input
                className="text-sm"
                onChange={(e) => setCustomNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomCall();
                  }
                }}
                placeholder="Enter phone number (e.g., +1 555-123-4567)"
                value={customNumber}
              />
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                disabled={
                  !customNumber.trim() ||
                  isLoading ||
                  ws?.readyState !== WebSocket.OPEN
                }
                onClick={handleCustomCall}
              >
                {isLoading ? 'Calling...' : 'Call'}
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="rounded-md border-primary border-l-4 bg-primary/10 p-3">
              <p className="font-medium text-primary text-sm">
                Initiating call...
              </p>
              <p className="text-primary/80 text-xs">
                The call is being set up through Twilio. You'll see the session
                appear below once connected.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OutboundCallPanel;
