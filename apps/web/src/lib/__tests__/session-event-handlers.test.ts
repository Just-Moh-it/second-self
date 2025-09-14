// Example of how the new modular architecture enables easy testing

import type {
  BackendToFrontendMessage,
  Item,
  SessionInfo,
} from '@/components/types';
import {
  OpenAIEventHandlers,
  SessionEventHandlers,
} from '../session-event-handlers';

describe('SessionEventHandlers', () => {
  let mockUpdateItems: jest.Mock;
  let mockUpdateSessions: jest.Mock;
  let handlers: SessionEventHandlers;

  beforeEach(() => {
    mockUpdateItems = jest.fn();
    mockUpdateSessions = jest.fn();
    handlers = new SessionEventHandlers({
      updateItems: mockUpdateItems,
      updateSessions: mockUpdateSessions,
    });
  });

  it('should handle session creation correctly', () => {
    const event: Extract<
      BackendToFrontendMessage,
      { type: 'session_created' }
    > = {
      type: 'session_created',
      sessionId: 'session-123',
      session: {
        sessionId: 'session-123',
        status: 'active',
        createdAt: Date.now(),
        hasModelConnection: true,
      },
    };

    handlers.handleSessionCreated(event);

    expect(mockUpdateSessions).toHaveBeenCalledWith(expect.any(Function));
    expect(mockUpdateItems).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle sessions list correctly', () => {
    const sessions: SessionInfo[] = [
      {
        sessionId: 'session-1',
        status: 'active',
        createdAt: Date.now(),
        hasModelConnection: true,
      },
      {
        sessionId: 'session-2',
        status: 'connecting',
        createdAt: Date.now(),
        hasModelConnection: false,
      },
    ];

    const event: Extract<BackendToFrontendMessage, { type: 'sessions_list' }> =
      {
        type: 'sessions_list',
        sessions,
      };

    handlers.handleSessionsList(event);

    expect(mockUpdateSessions).toHaveBeenCalledWith(expect.any(Function));

    // Test the updater function
    const updaterFn = mockUpdateSessions.mock.calls[0][0];
    const result = updaterFn({});

    expect(result).toEqual({
      'session-1': sessions[0],
      'session-2': sessions[1],
    });
  });
});

describe('OpenAIEventHandlers', () => {
  let mockUpdateItems: jest.Mock;
  let handlers: OpenAIEventHandlers;

  beforeEach(() => {
    mockUpdateItems = jest.fn();
    handlers = new OpenAIEventHandlers({
      updateItems: mockUpdateItems,
    });
  });

  it('should handle speech started correctly', () => {
    const event = {
      type: 'input_audio_buffer.speech_started',
      sessionId: 'session-123',
      item_id: 'item-456',
      timestamp: Date.now(),
    } as BackendToFrontendMessage;

    handlers.handleSpeechStarted(event as any);

    expect(mockUpdateItems).toHaveBeenCalledWith(expect.any(Function));

    // Test the updater function
    const updaterFn = mockUpdateItems.mock.calls[0][0];
    const result = updaterFn({ 'session-123': [] });

    expect(result['session-123']).toHaveLength(1);
    expect(result['session-123'][0]).toMatchObject({
      id: 'item-456',
      type: 'message',
      role: 'user',
      status: 'running',
      sessionId: 'session-123',
    });
  });
});

/* 
This demonstrates how the new architecture enables:

✅ Easy unit testing of individual handlers
✅ Mocking state updaters for isolated testing  
✅ Clear separation of concerns
✅ Predictable, pure functions
✅ Type-safe event handling

Compare this to testing the old 300+ line monolithic function! 
*/
