// PhoneNumberChecklist.tsx
'use client';

import { CheckCircle, Circle, Eye, EyeOff } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type PhoneNumberChecklistProps = {
  selectedPhoneNumber: string;
  allConfigsReady: boolean;
  setAllConfigsReady: (ready: boolean) => void;
};

const PhoneNumberChecklist: React.FC<PhoneNumberChecklistProps> = ({
  selectedPhoneNumber,
  allConfigsReady,
  setAllConfigsReady,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex flex-col">
        <span className="text-muted-foreground text-sm">Number</span>
        <div className="flex items-center">
          <span className="w-36 font-medium">
            {isVisible ? selectedPhoneNumber || 'None' : '••••••••••'}
          </span>
          <Button
            className="h-8 w-8"
            onClick={() => setIsVisible(!isVisible)}
            size="icon"
            variant="ghost"
          >
            {isVisible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {allConfigsReady ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-foreground text-sm">
            {allConfigsReady ? 'Setup Ready' : 'Setup Not Ready'}
          </span>
        </div>
        <Button
          onClick={() => setAllConfigsReady(false)}
          size="sm"
          variant="outline"
        >
          Checklist
        </Button>
      </div>
    </Card>
  );
};

export default PhoneNumberChecklist;
