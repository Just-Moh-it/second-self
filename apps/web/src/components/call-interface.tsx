'use client';

import { useEffect, useState } from 'react';
import CallListener from '@/components/call-listener';
import ChecklistAndConfig from '@/components/checklist-and-config';
import FunctionCallsPanel from '@/components/function-calls-panel';
import GlobalConfigPanel from '@/components/global-config-panel';
import OutboundCallPanel from '@/components/outbound-call-panel';
import TopBar from '@/components/top-bar';
import Transcript from '@/components/transcript';
import type {
  FrontendToBackendMessage,
  Item,
  SessionConfig,
  SessionInfo,
} from '@/components/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import handleRealtimeEvent from '@/lib/session-event-router';

// Constants
const SESSION_ID_REGEX = /^session-(\d+)-(.+)$/;

const CallInterface = () => {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [allConfigsReady, setAllConfigsReady] = useState(false);
  const [sessionItems, setSessionItems] = useState<Record<string, Item[]>>({});
  const [sessions, setSessions] = useState<Record<string, SessionInfo>>({});
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Constants
  const TRUNCATE_LENGTH = 8;

  useEffect(() => {
    if (allConfigsReady && !ws) {
      const newWs = new WebSocket('ws://localhost:8081/logs');

      newWs.onopen = () => {
        // Connected to logs websocket
      };

      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealtimeEvent(data, setSessionItems, setSessions);
      };

      newWs.onclose = () => {
        setWs(null);
      };

      setWs(newWs);
    }
  }, [allConfigsReady, ws]);

  const handleGlobalConfigSave = (config: SessionConfig) => {
    // Send global config to backend
    if (ws && ws.readyState === WebSocket.OPEN) {
      const updateEvent: FrontendToBackendMessage = {
        type: 'global_config.update',
        config,
      };
      ws.send(JSON.stringify(updateEvent));
      console.log('Global configuration saved:', config);
    } else {
      console.warn('Cannot save global config: WebSocket not connected');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'ending':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatSessionId = (sessionId: string) => {
    // Extract timestamp and beginning of UUID for display
    // Format: session-${timestamp}-${uuid}
    const match = sessionId.match(SESSION_ID_REGEX);
    if (match) {
      const [, timestamp, uuid] = match;
      // Show timestamp and first 8 characters of UUID
      return `${timestamp}-${uuid.substring(0, TRUNCATE_LENGTH)}`;
    }
    return sessionId;
  };

  return (
    <div className="flex flex-col">
      <ChecklistAndConfig
        ready={allConfigsReady}
        selectedPhoneNumber={selectedPhoneNumber}
        setReady={setAllConfigsReady}
        setSelectedPhoneNumber={setSelectedPhoneNumber}
      />
      <TopBar />
      <div className="flex flex-grow flex-col overflow-hidden p-4">
        {/* Global Configuration Panel - Always Visible */}
        <GlobalConfigPanel onSave={handleGlobalConfigSave} ws={ws} />

        {/* Outbound Call Panel */}
        <OutboundCallPanel ws={ws} />

        {/* Call Monitoring Area */}
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {Object.entries(sessions).length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  <div className="space-y-2">
                    <h3 className="font-medium">No Active Call Sessions</h3>
                    <p className="text-sm">
                      Configure your global settings above. Sessions will appear
                      here when calls are received.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              Object.entries(sessions).map(([sessionId, sessionInfo]) => (
                <Collapsible
                  className="border-2"
                  defaultOpen={true}
                  key={sessionId}
                >
                  <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge
                        className={`text-white ${getStatusBadgeColor(sessionInfo.status)}`}
                      >
                        {sessionInfo.status}
                      </Badge>
                      <span className="font-medium">
                        Call {formatSessionId(sessionId)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {new Date(sessionInfo.createdAt).toLocaleTimeString()}
                      </span>
                      {sessionInfo.streamSid && (
                        <Badge className="text-xs" variant="outline">
                          {sessionInfo.streamSid.substring(0, TRUNCATE_LENGTH)}
                          ...
                        </Badge>
                      )}
                      <Badge
                        className="text-xs"
                        variant={
                          sessionInfo.hasModelConnection
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {sessionInfo.hasModelConnection
                          ? 'AI Connected'
                          : 'AI Disconnected'}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="p-4 space-y-4">
                      {/* Call Audio Listener - Always available for active calls */}
                      <CallListener
                        hasActiveCall={sessionInfo.status === 'active'}
                        sessionId={sessionId}
                        ws={ws}
                      />

                      {/* Transcript and Function Calls Grid */}
                      <div className="grid grid-cols-3 gap-4">
                        {/* Left/Middle Column: Transcript (Expanded) */}
                        <div className="col-span-2 flex flex-col gap-4 overflow-hidden">
                          <Transcript
                            items={sessionItems[sessionId] || []}
                            sessionId={sessionId}
                          />
                        </div>

                        {/* Right Column: Function Calls */}
                        <div className="col-span-1 flex flex-col overflow-hidden">
                          <FunctionCallsPanel
                            items={sessionItems[sessionId] || []}
                            sessionId={sessionId}
                            ws={ws}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default CallInterface;
