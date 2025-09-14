export type SessionStatus = 'connecting' | 'active' | 'ending';
export type SessionInfo = {
    sessionId: string;
    status: SessionStatus;
    streamSid?: string;
    createdAt: number;
    hasModelConnection: boolean;
};
export type CallSession = {
    sessionId: string;
    twilioConn?: unknown;
    modelConn?: unknown;
    streamSid?: string;
    saved_config?: unknown;
    lastAssistantItem?: string;
    responseStartTimestamp?: number;
    latestMediaTimestamp?: number;
    openAIApiKey?: string;
    status: SessionStatus;
    createdAt: number;
};
export type SessionConfig = {
    instructions: string;
    voice: string;
    tools: string[];
};
export type TwilioMessage = {
    event: 'start';
    start: {
        streamSid: string;
    };
} | {
    event: 'media';
    media: {
        timestamp: number;
        payload: string;
    };
} | {
    event: 'close';
};
export type OpenAIEvent = {
    type: 'input_audio_buffer.speech_started';
    item_id?: string;
} | {
    type: 'response.audio.delta';
    item_id?: string;
    delta: string;
    output_index?: number;
} | {
    type: 'response.content_part.added';
    item_id: string;
    part: {
        type: string;
        text: string;
    };
    output_index: number;
} | {
    type: 'response.audio_transcript.delta';
    item_id: string;
    delta: string;
    output_index: number;
} | {
    type: 'response.output_item.done';
    item: {
        type: 'function_call';
        call_id: string;
        name: string;
        arguments: string;
    };
} | {
    type: 'conversation.item.created';
    item: {
        type: 'message';
        id: string;
        role: 'user' | 'assistant' | 'system' | 'tool';
        content?: Array<{
            type: string;
            text: string;
        }>;
    };
} | {
    type: 'conversation.item.created';
    item: {
        type: 'function_call_output';
        id: string;
        call_id: string;
        output: string;
    };
} | {
    type: 'conversation.item.input_audio_transcription.completed';
    item_id: string;
    transcript: string;
} | {
    type: 'session.created';
} | {
    type: Exclude<string, 'input_audio_buffer.speech_started' | 'response.audio.delta' | 'response.content_part.added' | 'response.audio_transcript.delta' | 'response.output_item.done' | 'conversation.item.created' | 'conversation.item.input_audio_transcription.completed' | 'session.created'>;
    [key: string]: unknown;
};
export type FrontendMessage = {
    sessionId: string;
    type: 'session.update';
    session: SessionConfig;
} | {
    sessionId: string;
    type: 'conversation.item.create';
    item: {
        type: 'function_call_output';
        call_id: string;
        output: string;
    };
} | {
    sessionId: string;
    type: 'response.create';
} | {
    sessionId: string;
    type: Exclude<string, 'session.update' | 'conversation.item.create' | 'response.create'>;
    [key: string]: unknown;
};
export type BackendSessionEvent = {
    type: 'sessions_list';
    sessions: SessionInfo[];
} | {
    type: 'session_created';
    sessionId: string;
    session: SessionInfo;
} | {
    type: 'session_updated';
    sessionId: string;
    session: SessionInfo;
} | {
    type: 'session_closed';
    sessionId: string;
};
export type BackendOpenAIEvent = {
    sessionId: string;
    timestamp: number;
} & OpenAIEvent;
export type BackendMessage = BackendSessionEvent | BackendOpenAIEvent;
export type ItemType = 'message' | 'function_call' | 'function_call_output';
export type ItemRole = 'system' | 'user' | 'assistant' | 'tool';
export type ItemStatus = 'running' | 'completed';
export type Item = {
    id: string;
    object: string;
    type: ItemType;
    timestamp?: string;
    status?: ItemStatus;
    sessionId?: string;
    role?: ItemRole;
    content?: Array<{
        type: string;
        text: string;
    }>;
    name?: string;
    call_id?: string;
    params?: Record<string, unknown>;
    output?: string;
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
export declare function isSessionEvent(message: BackendMessage): message is BackendSessionEvent;
export declare function isOpenAIEvent(message: BackendMessage): message is BackendOpenAIEvent;
export declare function isFunctionCallItem(item: Item): item is Item & {
    type: 'function_call';
    name: string;
    call_id: string;
};
export declare function isMessageItem(item: Item): item is Item & {
    type: 'message';
    role: ItemRole;
};
