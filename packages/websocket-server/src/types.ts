// Shared types between backend and frontend

// Session-related types
import type { WebSocket } from "ws";

export type SessionStatus = "connecting" | "active" | "ending";

export type SessionInfo = {
	sessionId: string;
	status: SessionStatus;
	streamSid?: string;
	createdAt: number;
	hasModelConnection: boolean;
};

// WebSocket Message Types from Backend to Frontend
export type BackendToFrontendMessage =
	| {
			type: "sessions_list";
			sessions: SessionInfo[];
	  }
	| {
			type: "session_created";
			sessionId: string;
			session: SessionInfo;
	  }
	| {
			type: "session_updated";
			sessionId: string;
			session: SessionInfo;
	  }
	| {
			type: "session_closed";
			sessionId: string;
	  }
	| {
			type: "dtmf_sent";
			sessionId: string;
			digit: string;
			timestamp: number;
	  }
	| {
			type: "user_dtmf_sent";
			sessionId: string;
			digit: string;
			timestamp: number;
	  }
	| {
			type: "call_audio";
			sessionId: string;
			audio: string; // Base64 encoded g711_ulaw audio data from call
			audioSource: "twilio" | "openai"; // Source for different handling (Twilio=large chunks, OpenAI=small deltas)
			audioSize: number; // Size in bytes for debugging chunk patterns
			timestamp: number;
	  }
	| {
			type: "global_config.saved";
			config: SessionConfig;
			timestamp: number;
	  }
	// OpenAI Events (forwarded to frontend with sessionId) - flexible to handle OpenAI event spreading
	| {
			type: "input_audio_buffer.speech_started";
			sessionId: string;
			item_id?: string;
			timestamp: number;
			[key: string]: unknown;
	  }
	| {
			type: "conversation.item.created";
			sessionId: string;
			item?: ConversationItem | FunctionCallItem;
			timestamp: number;
			[key: string]: unknown;
	  }
	| {
			type: "conversation.item.input_audio_transcription.completed";
			sessionId: string;
			item_id?: string;
			transcript?: string;
			timestamp: number;
			[key: string]: unknown;
	  }
	| {
			type: "response.content_part.added";
			sessionId: string;
			item_id?: string;
			part?: { type: string; text: string };
			output_index?: number;
			timestamp: number;
			[key: string]: unknown;
	  }
	| {
			type: "response.audio_transcript.delta";
			sessionId: string;
			item_id?: string;
			delta?: string;
			output_index?: number;
			timestamp: number;
			[key: string]: unknown;
	  }
	| {
			type: "response.audio.delta";
			sessionId: string;
			item_id?: string;
			delta?: string;
			timestamp: number;
			[key: string]: unknown;
	  }
	| {
			type: "response.output_item.done";
			sessionId: string;
			item?: ConversationItem | FunctionCallItem;
			timestamp: number;
			[key: string]: unknown;
	  };

// WebSocket Message Types from Frontend to Backend
export type FrontendToBackendMessage =
	| {
			type: "global_config.update";
			config: SessionConfig;
	  }
	| {
			sessionId: string;
			type: "conversation.item.create";
			item: {
				type: "function_call_output";
				call_id: string;
				output: string;
			};
	  }
	| {
			sessionId: string;
			type: "response.create";
	  }
	| {
			type: "user_audio";
			sessionId: string;
			audio: string; // Base64 encoded audio data
			format?: string; // Audio format (e.g., 'g711_ulaw')
			sampleRate?: number; // Sample rate (e.g., 8000)
			timestamp: number;
	  }
	| {
			type: "user_dtmf";
			sessionId: string;
			digit: string;
			timestamp: number;
	  }
	| {
			type: "join_call_listener";
			sessionId: string;
			timestamp: number;
	  }
	| {
			type: "leave_call_listener";
			sessionId: string;
			timestamp: number;
	  };

// Conversation Item Types
export type ConversationItem =
	| {
			type: "message";
			id: string;
			role: "system" | "user" | "assistant" | "tool";
			content?: Array<{ type: string; text: string }>;
	  }
	| {
			type: "function_call_output";
			id: string;
			call_id: string;
			output: string;
	  };

export type FunctionCallItem = {
	type: "function_call";
	id: string;
	name: string;
	call_id: string;
	arguments: string;
};

// Frontend UI Types
export type Item = {
	id: string;
	object: string;
	type: "message" | "function_call" | "function_call_output";
	timestamp?: string;
	status?: "running" | "completed";
	sessionId?: string;
	// For "message" items
	role?: "system" | "user" | "assistant" | "tool";
	content?: Array<{ type: string; text: string }>;
	// For "function_call" items
	name?: string;
	call_id?: string;
	params?: Record<string, unknown>;
	// For "function_call_output" items
	output?: string;
};

export type SessionConfig = {
	instructions: string;
	voice: string;
	tools: string[];
};

export type PhoneNumber = {
	sid: string;
	friendlyName: string;
	voiceUrl?: string;
};

export type FunctionCall = {
	name: string;
	params: Record<string, unknown>;
	completed?: boolean;
	response?: string;
	status?: string;
	call_id?: string;
};

// Type guards for discriminated unions
export function isSessionMessage(msg: BackendToFrontendMessage): msg is Extract<
	BackendToFrontendMessage,
	{
		type:
			| "sessions_list"
			| "session_created"
			| "session_updated"
			| "session_closed";
	}
> {
	return [
		"sessions_list",
		"session_created",
		"session_updated",
		"session_closed",
	].includes(msg.type);
}

export function isOpenAIMessage(msg: BackendToFrontendMessage): msg is Exclude<
	BackendToFrontendMessage,
	{
		type:
			| "sessions_list"
			| "session_created"
			| "session_updated"
			| "session_closed";
	}
> {
	return !isSessionMessage(msg);
}

// Internal Backend Types (not exported to frontend)
export type CallSession = {
	sessionId: string;
	twilioConn?: WebSocket; // WebSocket from 'ws' package
	modelConn?: WebSocket; // WebSocket from 'ws' package
	streamSid?: string;
	saved_config?: unknown;
	lastAssistantItem?: string;
	responseStartTimestamp?: number;
	latestMediaTimestamp?: number;
	openAIApiKey?: string;
	status: SessionStatus;
	createdAt: number;
	frontendListeners?: Set<WebSocket>; // Frontend connections listening to this call
};

export type TwilioMessage =
	| { event: "start"; start: { streamSid: string } }
	| { event: "media"; media: { timestamp: number; payload: string } }
	| { event: "close" };

export type OpenAIEvent =
	| { type: "input_audio_buffer.speech_started"; item_id?: string }
	| { type: "response.audio.delta"; item_id?: string; delta?: string }
	| {
			type: "response.output_item.done";
			item?: {
				type: string;
				call_id: string;
				name: string;
				arguments: string;
			};
	  }
	| {
			type: string;
			[key: string]: unknown;
	  };
