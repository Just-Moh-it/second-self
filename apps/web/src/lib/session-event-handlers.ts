import type {
  BackendToFrontendMessage,
  Item,
  SessionInfo,
} from '@/components/types';

// Types for state managers
export type ItemsState = Record<string, Item[]>;
export type SessionsState = Record<string, SessionInfo>;

export type StateUpdaters = {
  updateItems: (updater: (prev: ItemsState) => ItemsState) => void;
  updateSessions?: (updater: (prev: SessionsState) => SessionsState) => void;
};

// Session-specific event handlers
export class SessionEventHandlers {
  private readonly stateUpdaters: StateUpdaters;

  constructor(stateUpdaters: StateUpdaters) {
    this.stateUpdaters = stateUpdaters;
  }

  // Session lifecycle events
  handleSessionsList = (
    ev: Extract<BackendToFrontendMessage, { type: 'sessions_list' }>
  ) => {
    if (!this.stateUpdaters.updateSessions) {
      return;
    }

    const sessionMap: SessionsState = {};
    for (const session of ev.sessions) {
      sessionMap[session.sessionId] = session;
    }

    this.stateUpdaters.updateSessions(() => sessionMap);
  };

  handleSessionCreated = (
    ev: Extract<BackendToFrontendMessage, { type: 'session_created' }>
  ) => {
    if (!this.stateUpdaters.updateSessions) {
      return;
    }

    this.stateUpdaters.updateSessions((prev) => ({
      ...prev,
      [ev.sessionId]: ev.session,
    }));

    // Initialize empty items array for this session
    this.stateUpdaters.updateItems((prev) => ({
      ...prev,
      [ev.sessionId]: [],
    }));
  };

  handleSessionUpdated = (
    ev: Extract<BackendToFrontendMessage, { type: 'session_updated' }>
  ) => {
    if (!this.stateUpdaters.updateSessions) {
      return;
    }

    this.stateUpdaters.updateSessions((prev) => ({
      ...prev,
      [ev.sessionId]: ev.session,
    }));
  };

  handleSessionClosed = (
    ev: Extract<BackendToFrontendMessage, { type: 'session_closed' }>
  ) => {
    if (!this.stateUpdaters.updateSessions) {
      return;
    }

    this.stateUpdaters.updateSessions((prev) => {
      const updated = { ...prev };
      delete updated[ev.sessionId];
      return updated;
    });
    // Keep items for reference - could optionally remove them
  };
}

// OpenAI-specific event handlers
export class OpenAIEventHandlers {
  private readonly stateUpdaters: StateUpdaters;

  constructor(stateUpdaters: StateUpdaters) {
    this.stateUpdaters = stateUpdaters;
  }

  private createItem(base: Partial<Item>, sessionId: string): Item {
    return {
      object: 'realtime.item',
      timestamp: new Date().toLocaleTimeString(),
      sessionId,
      ...base,
    } as Item;
  }

  private addItemToSession(sessionId: string, item: Item): void {
    this.stateUpdaters.updateItems((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), item],
    }));
  }

  private updateSessionItems(
    sessionId: string,
    updater: (items: Item[]) => Item[]
  ): void {
    this.stateUpdaters.updateItems((prev) => ({
      ...prev,
      [sessionId]: updater(prev[sessionId] || []),
    }));
  }

  handleSpeechStarted = (
    ev: Extract<
      BackendToFrontendMessage,
      { type: 'input_audio_buffer.speech_started' }
    >
  ) => {
    const { item_id: itemId } = ev;
    if (!itemId) {
      return;
    }

    this.addItemToSession(
      ev.sessionId,
      this.createItem(
        {
          id: itemId,
          type: 'message',
          role: 'user',
          content: [{ type: 'text', text: '...' }],
          status: 'running',
        },
        ev.sessionId
      )
    );
  };

  handleConversationItemCreated = (
    ev: Extract<BackendToFrontendMessage, { type: 'conversation.item.created' }>
  ) => {
    const { item } = ev;
    if (!item) {
      return;
    }

    if (item.type === 'message') {
      const updatedContent =
        item.content && item.content.length > 0 ? item.content : [];

      this.updateSessionItems(ev.sessionId, (prev) => {
        const idx = prev.findIndex((m) => m.id === item.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            ...item,
            content: updatedContent,
            status: 'completed',
            timestamp:
              updated[idx].timestamp || new Date().toLocaleTimeString(),
          };
          return updated;
        }
        return [
          ...prev,
          this.createItem(
            {
              ...item,
              content: updatedContent,
              status: 'completed',
            },
            ev.sessionId
          ),
        ];
      });
    } else if (item.type === 'function_call_output') {
      this.updateSessionItems(ev.sessionId, (prev) => {
        const newItems = [
          ...prev,
          this.createItem(
            {
              ...item,
              role: 'tool',
              content: [
                {
                  type: 'text',
                  text: `Function call response: ${item.output}`,
                },
              ],
              status: 'completed',
            },
            ev.sessionId
          ),
        ];

        return newItems.map((m) =>
          m.call_id === item.call_id && m.type === 'function_call'
            ? { ...m, status: 'completed' }
            : m
        );
      });
    }
  };

  handleTranscriptionCompleted = (
    ev: Extract<
      BackendToFrontendMessage,
      { type: 'conversation.item.input_audio_transcription.completed' }
    >
  ) => {
    const { item_id, transcript } = ev;
    if (!(item_id && transcript)) {
      return;
    }

    this.updateSessionItems(ev.sessionId, (prev) =>
      prev.map((m) =>
        m.id === item_id && m.type === 'message' && m.role === 'user'
          ? {
              ...m,
              content: [{ type: 'text', text: transcript }],
              status: 'completed',
            }
          : m
      )
    );
  };

  handleContentPartAdded = (
    ev: Extract<
      BackendToFrontendMessage,
      { type: 'response.content_part.added' }
    >
  ) => {
    const { item_id, part, output_index } = ev;
    const isValidEvent =
      item_id && part && output_index === 0 && part.type === 'text';
    if (!isValidEvent) {
      return;
    }

    this.updateSessionItems(ev.sessionId, (prev) => {
      const idx = prev.findIndex((m) => m.id === item_id);
      if (idx >= 0) {
        const updated = [...prev];
        const existingContent = updated[idx].content || [];
        updated[idx] = {
          ...updated[idx],
          content: [...existingContent, { type: part.type, text: part.text }],
        };
        return updated;
      }
      return [
        ...prev,
        this.createItem(
          {
            id: item_id,
            type: 'message',
            role: 'assistant',
            content: [{ type: part.type, text: part.text }],
            status: 'running',
          },
          ev.sessionId
        ),
      ];
    });
  };

  handleAudioTranscriptDelta = (
    ev: Extract<
      BackendToFrontendMessage,
      { type: 'response.audio_transcript.delta' }
    >
  ) => {
    const { item_id, delta, output_index } = ev;
    const isValidEvent = item_id && delta && output_index === 0;
    if (!isValidEvent) {
      return;
    }

    this.updateSessionItems(ev.sessionId, (prev) => {
      const idx = prev.findIndex((m) => m.id === item_id);
      if (idx >= 0) {
        const updated = [...prev];
        const existingContent = updated[idx].content || [];
        updated[idx] = {
          ...updated[idx],
          content: [...existingContent, { type: 'text', text: delta }],
        };
        return updated;
      }
      return [
        ...prev,
        this.createItem(
          {
            id: item_id,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: delta }],
            status: 'running',
          },
          ev.sessionId
        ),
      ];
    });
  };

  handleFunctionCallDone = (
    ev: Extract<BackendToFrontendMessage, { type: 'response.output_item.done' }>
  ) => {
    const { item } = ev;
    if (!item || item.type !== 'function_call') {
      return;
    }

    this.addItemToSession(
      ev.sessionId,
      this.createItem(
        {
          id: item.id,
          type: 'function_call',
          name: item.name,
          call_id: item.call_id,
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `${item.name}(${JSON.stringify(JSON.parse(item.arguments))})`,
            },
          ],
          status: 'running',
        },
        ev.sessionId
      )
    );
  };
}
