import type {
  BackendToFrontendMessage,
  Item,
  SessionInfo,
} from '@/components/types';

import {
  OpenAIEventHandlers,
  SessionEventHandlers,
  type StateUpdaters,
} from './session-event-handlers';

// Event router that delegates to specific handlers
export class SessionEventRouter {
  private readonly sessionHandlers: SessionEventHandlers;
  private readonly openAIHandlers: OpenAIEventHandlers;

  constructor(
    setItems: React.Dispatch<React.SetStateAction<Record<string, Item[]>>>,
    setSessions?: React.Dispatch<
      React.SetStateAction<Record<string, SessionInfo>>
    >
  ) {
    const stateUpdaters: StateUpdaters = {
      updateItems: (updater) => setItems(updater),
      updateSessions: setSessions
        ? (updater) => setSessions(updater)
        : undefined,
    };

    this.sessionHandlers = new SessionEventHandlers(stateUpdaters);
    this.openAIHandlers = new OpenAIEventHandlers(stateUpdaters);
  }

  // Main event router - clean and focused
  route(event: BackendToFrontendMessage): void {
    switch (event.type) {
      // Session lifecycle events
      case 'sessions_list':
        this.sessionHandlers.handleSessionsList(event);
        break;

      case 'session_created':
        this.sessionHandlers.handleSessionCreated(event);
        break;

      case 'session_updated':
        this.sessionHandlers.handleSessionUpdated(event);
        break;

      case 'session_closed':
        this.sessionHandlers.handleSessionClosed(event);
        break;

      case 'global_config.saved':
        // Global config confirmation - could add UI feedback here
        console.log('Global configuration saved successfully:', event.config);
        break;

      // OpenAI events
      case 'input_audio_buffer.speech_started':
        this.openAIHandlers.handleSpeechStarted(event);
        break;

      case 'conversation.item.created':
        this.openAIHandlers.handleConversationItemCreated(event);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.openAIHandlers.handleTranscriptionCompleted(event);
        break;

      case 'response.content_part.added':
        this.openAIHandlers.handleContentPartAdded(event);
        break;

      case 'response.audio_transcript.delta':
        this.openAIHandlers.handleAudioTranscriptDelta(event);
        break;

      case 'response.output_item.done':
        this.openAIHandlers.handleFunctionCallDone(event);
        break;

      default:
        // Handle unknown events gracefully - could log to monitoring service in production
        // Unknown event type: event.type
        break;
    }
  }
}

// Clean, simple interface for the components
export default function handleRealtimeEvent(
  ev: BackendToFrontendMessage,
  setItems: React.Dispatch<React.SetStateAction<Record<string, Item[]>>>,
  setSessions?: React.Dispatch<
    React.SetStateAction<Record<string, SessionInfo>>
  >
) {
  // Create router instance (could be memoized for performance)
  const router = new SessionEventRouter(setItems, setSessions);

  // Route the event
  router.route(ev);
}
