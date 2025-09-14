import { type RawData, WebSocket } from "ws";
import {
	CALL_TERMINATION_DELAY_MS,
	DEFAULT_SESSION_CONFIG,
	SESSION_ID_PREFIX,
} from "./constants";
import functions from "./functionHandlers";
import type {
	BackendToFrontendMessage,
	CallSession,
	FrontendToBackendMessage,
	OpenAIEvent,
	SessionConfig,
	SessionInfo,
	TwilioMessage,
} from "./types";

// Map of sessionId -> CallSession
const callSessions = new Map<string, CallSession>();

// Single frontend monitoring connection
let frontendConn: WebSocket | undefined;

// Global configuration that applies to all new sessions
let globalConfig: SessionConfig = { ...DEFAULT_SESSION_CONFIG };

// Periodic health check to detect silent connection failures
const HEALTH_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
let healthCheckInterval: NodeJS.Timeout | undefined;

function startHealthCheck() {
	if (healthCheckInterval) {
		return; // Already running
	}

	console.log("Starting connection health check monitor...");
	healthCheckInterval = setInterval(() => {
		const activeSessions = Array.from(callSessions.entries());

		if (activeSessions.length === 0) {
			return;
		}

		console.log(
			`[HEALTH CHECK] Checking ${activeSessions.length} active sessions...`,
		);

		for (const [sessionId, session] of activeSessions) {
			const now = Date.now();
			const sessionAge = now - session.createdAt;

			const healthStatus = {
				sessionId,
				age: Math.round(sessionAge / 1000) + "s",
				status: session.status,
				twilioConn: session.twilioConn ? isOpen(session.twilioConn) : false,
				modelConn: session.modelConn ? isOpen(session.modelConn) : false,
				streamSid: !!session.streamSid,
				lastMediaTimestamp: session.latestMediaTimestamp || "none",
			};

			// Check for potential issues
			const issues: string[] = [];

			if (session.status === "active" && !healthStatus.twilioConn) {
				issues.push("Twilio connection lost");
			}

			if (session.status === "active" && !healthStatus.modelConn) {
				issues.push("OpenAI connection lost");
			}

			if (
				session.status === "active" &&
				sessionAge > 300000 &&
				!session.latestMediaTimestamp
			) {
				issues.push("No audio received after 5 minutes");
			}

			if (issues.length > 0) {
				console.warn(`[${sessionId}] HEALTH ISSUES DETECTED:`, issues);
				console.warn(`[${sessionId}] Health status:`, healthStatus);
			}
		}
	}, HEALTH_CHECK_INTERVAL_MS);
}

// Start health check when first session is created
function ensureHealthCheckRunning() {
	if (!healthCheckInterval && callSessions.size > 0) {
		startHealthCheck();
	}
}

// Generate unique session ID
function generateSessionId(): string {
	return `${SESSION_ID_PREFIX}-${getCurrentTimestamp()}-${crypto.randomUUID()}`;
}

// Helper function to get current timestamp
function getCurrentTimestamp(): number {
	return Date.now();
}

export function handleCallConnection(
	ws: WebSocket,
	openAIApiKey: string,
): string {
	const sessionId = generateSessionId();

	const callSession: CallSession = {
		sessionId,
		twilioConn: ws,
		openAIApiKey,
		status: "connecting",
		createdAt: getCurrentTimestamp(),
	};

	callSessions.set(sessionId, callSession);

	// Start health monitoring if this is the first session
	ensureHealthCheckRunning();

	console.log(
		`[${sessionId}] New call session created, WebSocket ready state: ${ws.readyState}`,
	);
	notifyFrontend({
		type: "session_created",
		sessionId,
		session: getSessionInfo(callSession),
	});

	// Add comprehensive Twilio WebSocket event logging
	ws.on("message", (data) => {
		try {
			handleTwilioMessage(sessionId, data);
		} catch (error) {
			console.error(`[${sessionId}] CRITICAL ERROR handling Twilio message:`, {
				error: error instanceof Error ? error.message : "unknown error",
				stack:
					error instanceof Error ? error.stack?.substring(0, 500) : "no stack",
			});
		}
	});

	ws.on("error", (error) => {
		console.error(`[${sessionId}] Twilio WebSocket ERROR:`, {
			message: error.message,
			code: (error as any).code || "unknown",
			stack: error.stack?.substring(0, 500) || "no stack",
		});
	});

	ws.on("close", (code, reason) => {
		console.warn(`[${sessionId}] Twilio WebSocket CLOSED:`, {
			code: code || "no code",
			reason: reason?.toString() || "no reason",
			wasClean: code === 1000,
			timestamp: new Date().toISOString(),
		});
		closeCallSession(sessionId);
	});

	ws.on("ping", () => {
		console.log(`[${sessionId}] Twilio WebSocket ping received`);
	});

	ws.on("pong", () => {
		console.log(`[${sessionId}] Twilio WebSocket pong received`);
	});

	return sessionId;
}

export function handleFrontendConnection(ws: WebSocket) {
	cleanupConnection(frontendConn);
	frontendConn = ws;

	console.log("Frontend monitoring connection established");

	// Send current sessions to frontend
	const activeSessions = Array.from(callSessions.values()).map(getSessionInfo);
	jsonSend(ws, { type: "sessions_list", sessions: activeSessions });

	ws.on("message", handleFrontendMessage);
	ws.on("close", () => {
		cleanupConnection(frontendConn);
		frontendConn = undefined;
		console.log("Frontend monitoring connection closed");
	});
}

// Helper functions
function getSessionInfo(callSession: CallSession): SessionInfo {
	return {
		sessionId: callSession.sessionId,
		status: callSession.status,
		streamSid: callSession.streamSid,
		createdAt: callSession.createdAt,
		hasModelConnection: !!callSession.modelConn,
	};
}

function notifyFrontend(message: BackendToFrontendMessage) {
	if (frontendConn) {
		jsonSend(frontendConn, message);
	}
}

function closeCallSession(sessionId: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		return;
	}

	console.log(`Closing call session: ${sessionId}`);

	// Clean up connections
	cleanupConnection(callSession.twilioConn);
	cleanupConnection(callSession.modelConn);

	// Remove from active sessions
	callSessions.delete(sessionId);

	// Notify frontend
	notifyFrontend({ type: "session_closed", sessionId });
}

export async function terminateCall(sessionId: string, reason: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.warn(`Cannot terminate call - session not found: ${sessionId}`);
		return;
	}

	console.log(
		`Terminating call for session ${sessionId} with reason: ${reason}`,
	);

	// Update session status
	callSession.status = "ending";

	// Simulate async operation to satisfy async function requirement
	await Promise.resolve();

	// Close Twilio connection first to end the actual call
	if (callSession.twilioConn && isOpen(callSession.twilioConn)) {
		console.log(`Closing Twilio connection for session ${sessionId}`);
		callSession.twilioConn.close();
	}

	// Close OpenAI connection
	if (callSession.modelConn && isOpen(callSession.modelConn)) {
		console.log(`Closing OpenAI connection for session ${sessionId}`);
		callSession.modelConn.close();
	}

	// Clean up the session after a short delay to allow connections to close properly
	setTimeout(() => {
		closeCallSession(sessionId);
	}, CALL_TERMINATION_DELAY_MS);

	// Notify frontend immediately that call is ending
	notifyFrontend({
		type: "session_updated",
		sessionId,
		session: getSessionInfo(callSession),
	});
}

export async function sendDTMF(sessionId: string, digit: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		throw new Error(`Cannot send DTMF - session not found: ${sessionId}`);
	}

	if (!callSession.twilioConn || !isOpen(callSession.twilioConn)) {
		throw new Error(
			`Cannot send DTMF - Twilio connection not active for session: ${sessionId}`,
		);
	}

	if (!callSession.streamSid) {
		throw new Error(
			`Cannot send DTMF - no stream SID for session: ${sessionId}`,
		);
	}

	console.log(`Sending DTMF digit "${digit}" to session ${sessionId}`);

	// Send DTMF tone to Twilio
	jsonSend(callSession.twilioConn, {
		event: "dtmf",
		streamSid: callSession.streamSid,
		dtmf: {
			digit: digit,
		},
	});

	// Notify frontend that DTMF was sent
	notifyFrontend({
		type: "dtmf_sent",
		sessionId,
		digit,
		timestamp: Date.now(),
	});

	// Simulate async operation to satisfy async function requirement
	await Promise.resolve();
}

// Handle user audio from frontend takeover
function handleUserAudio(
	sessionId: string,
	base64Audio: string,
	format?: string,
	sampleRate?: number,
) {
	console.log(`[${sessionId}] 🎤 BACKEND: Received user_audio message`, {
		audioLength: base64Audio.length,
		format: format || "unknown",
		sampleRate: sampleRate || "unknown",
	});

	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.error(
			`[${sessionId}] 🎤 BACKEND: Cannot send user audio - session not found`,
		);
		return;
	}

	// Log format info on first packet for debugging
	const userAudioCount = (callSession as any).userAudioCount || 0;
	if (userAudioCount === 0) {
		console.log(
			`[${sessionId}] 🎤 BACKEND: First user audio packet - format: ${format || "unknown"}, sampleRate: ${sampleRate || "unknown"}Hz`,
		);
	}

	// Handle format conversion if needed
	let processedAudio = base64Audio;
	if (format === "pcm_f32le") {
		console.warn(
			`[${sessionId}] 🎤 BACKEND: Received PCM format - should convert to g711_ulaw for Twilio/OpenAI compatibility`,
		);
		console.warn(
			`[${sessionId}] 🎤 BACKEND: For now, forwarding raw PCM (this may cause audio issues)`,
		);

		// TODO: Implement PCM to g711_ulaw conversion here
		// For now, we'll forward the raw data and see what happens
		processedAudio = base64Audio;
	}

	// DUAL AUDIO ROUTING: Send user audio to BOTH Twilio AND OpenAI
	// This ensures both the call participant AND the AI hear the human user

	// 1. Send to Twilio (so call participant hears the human)
	let twilioSuccess = false;
	if (
		callSession.twilioConn &&
		isOpen(callSession.twilioConn) &&
		callSession.streamSid
	) {
		try {
			jsonSend(callSession.twilioConn, {
				event: "media",
				streamSid: callSession.streamSid,
				media: {
					payload: processedAudio,
				},
			});
			twilioSuccess = true;

			if (userAudioCount % 50 === 0) {
				console.log(
					`[${sessionId}] 🎤 BACKEND: User audio packet ${userAudioCount + 1} sent to Twilio (call participant)`,
				);
			}
		} catch (error) {
			console.error(
				`[${sessionId}] 🎤 BACKEND: Error sending user audio to Twilio:`,
				{
					error: error instanceof Error ? error.message : "unknown error",
					audioLength: processedAudio.length,
					originalFormat: format,
				},
			);
		}
	} else {
		console.warn(
			`[${sessionId}] 🎤 BACKEND: Cannot send user audio to Twilio:`,
			{
				twilioConnExists: !!callSession.twilioConn,
				twilioConnOpen: callSession.twilioConn
					? isOpen(callSession.twilioConn)
					: false,
				streamSid: !!callSession.streamSid,
			},
		);
	}

	// 2. ALSO send to OpenAI (so AI maintains conversation context)
	let openaiSuccess = false;
	if (callSession.modelConn && isOpen(callSession.modelConn)) {
		try {
			jsonSend(callSession.modelConn, {
				type: "input_audio_buffer.append",
				audio: processedAudio,
			});
			openaiSuccess = true;

			if (userAudioCount % 50 === 0) {
				console.log(
					`[${sessionId}] 🎤 BACKEND: User audio packet ${userAudioCount + 1} sent to OpenAI (AI context)`,
				);
			}
		} catch (error) {
			console.error(
				`[${sessionId}] 🎤 BACKEND: Error sending user audio to OpenAI:`,
				{
					error: error instanceof Error ? error.message : "unknown error",
					audioLength: processedAudio.length,
					originalFormat: format,
				},
			);
		}
	} else {
		console.warn(
			`[${sessionId}] 🎤 BACKEND: Cannot send user audio to OpenAI:`,
			{
				modelConnExists: !!callSession.modelConn,
				modelConnOpen: callSession.modelConn
					? isOpen(callSession.modelConn)
					: false,
			},
		);
	}

	// Update counters and log summary
	(callSession as any).userAudioCount = userAudioCount + 1;

	if (userAudioCount % 50 === 0) {
		console.log(
			`[${sessionId}] 🎤 BACKEND: User audio routing summary - Twilio: ${twilioSuccess ? "✅" : "❌"}, OpenAI: ${openaiSuccess ? "✅" : "❌"} (format: ${format})`,
		);
	}
}

// Handle user DTMF from frontend takeover
function handleUserDTMF(sessionId: string, digit: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.error(`[${sessionId}] Cannot send user DTMF - session not found`);
		return;
	}

	if (!callSession.twilioConn || !isOpen(callSession.twilioConn)) {
		console.error(
			`[${sessionId}] Cannot send user DTMF - Twilio connection not active`,
		);
		return;
	}

	if (!callSession.streamSid) {
		console.error(`[${sessionId}] Cannot send user DTMF - no stream SID`);
		return;
	}

	console.log(`[${sessionId}] 🔢 User pressed keypad digit: ${digit}`);

	try {
		// Send DTMF tone to Twilio
		jsonSend(callSession.twilioConn, {
			event: "dtmf",
			streamSid: callSession.streamSid,
			dtmf: {
				digit: digit,
			},
		});

		// Notify frontend that user DTMF was sent
		notifyFrontend({
			type: "user_dtmf_sent",
			sessionId,
			digit,
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error(`[${sessionId}] Error sending user DTMF:`, {
			error: error instanceof Error ? error.message : "unknown error",
			digit,
		});
	}
}

// Handle frontend joining as call listener
function handleJoinCallListener(
	sessionId: string,
	frontendWs: WebSocket | null | undefined,
) {
	console.log(
		`[${sessionId}] 🎧 BACKEND: Processing join_call_listener request`,
	);

	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.error(
			`[${sessionId}] 🎧 BACKEND: Cannot join listener - session not found`,
		);
		return;
	}

	if (!frontendWs) {
		console.error(
			`[${sessionId}] 🎧 BACKEND: Cannot join listener - frontend connection not available`,
		);
		return;
	}

	if (!isOpen(frontendWs)) {
		console.error(
			`[${sessionId}] 🎧 BACKEND: Cannot join listener - frontend connection not active (readyState: ${frontendWs?.readyState || "undefined"})`,
		);
		return;
	}

	// Initialize listeners set if it doesn't exist
	if (!callSession.frontendListeners) {
		callSession.frontendListeners = new Set();
		console.log(
			`[${sessionId}] 🎧 BACKEND: Initialized frontend listeners set`,
		);
	}

	// Add frontend connection to listeners
	callSession.frontendListeners.add(frontendWs);

	console.log(
		`[${sessionId}] 🎧 BACKEND: Frontend joined as call listener successfully (${callSession.frontendListeners.size} total listeners)`,
	);
}

// Handle frontend leaving as call listener
function handleLeaveCallListener(
	sessionId: string,
	frontendWs: WebSocket | null | undefined,
) {
	console.log(
		`[${sessionId}] 🔇 BACKEND: Processing leave_call_listener request`,
	);

	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.log(
			`[${sessionId}] 🔇 BACKEND: Cannot leave listener - session not found (already closed)`,
		);
		return; // Session might already be closed
	}

	if (!frontendWs) {
		console.log(
			`[${sessionId}] 🔇 BACKEND: Cannot leave listener - no frontend connection provided`,
		);
		return;
	}

	if (!callSession.frontendListeners) {
		console.log(
			`[${sessionId}] 🔇 BACKEND: Cannot leave listener - no listeners set exists`,
		);
		return;
	}

	// Remove frontend connection from listeners
	const wasListening = callSession.frontendListeners.has(frontendWs);
	callSession.frontendListeners.delete(frontendWs);

	console.log(
		`[${sessionId}] 🔇 BACKEND: Frontend left call listener - was listening: ${wasListening} (${callSession.frontendListeners?.size || 0} remaining listeners)`,
	);
}

// Send call audio to all frontend listeners with source information
function broadcastCallAudioToListeners(
	sessionId: string,
	audioPayload: string,
	audioSource: "twilio" | "openai" = "twilio",
) {
	const callSession = callSessions.get(sessionId);
	if (!callSession || !callSession.frontendListeners) {
		// Only log occasionally to avoid spam
		const logCount = (callSession as any)?.broadcastLogCount || 0;
		if (logCount % 100 === 0) {
			console.log(
				`[${sessionId}] 🔊 BACKEND: No listeners for call audio broadcast (${logCount} attempts)`,
			);
		}
		(callSession as any).broadcastLogCount = logCount + 1;
		return;
	}

	const listenerCount = callSession.frontendListeners.size;
	if (listenerCount === 0) {
		return;
	}

	// Log first broadcast and then every 50th, with source and size info
	const broadcastCount = (callSession as any)?.audioBroadcastCount || 0;
	if (broadcastCount === 0 || broadcastCount % 50 === 0) {
		console.log(
			`[${sessionId}] 🔊 BACKEND: Broadcasting ${audioSource.toUpperCase()} audio to ${listenerCount} listeners (${audioPayload.length} bytes, broadcast ${broadcastCount + 1})`,
		);
	}
	(callSession as any).audioBroadcastCount = broadcastCount + 1;

	const deadConnections: WebSocket[] = [];

	let listenerIndex = 0;
	callSession.frontendListeners.forEach((listenerWs) => {
		if (isOpen(listenerWs)) {
			try {
				jsonSend(listenerWs, {
					type: "call_audio",
					sessionId,
					audio: audioPayload,
					audioSource,
					audioSize: audioPayload.length,
					timestamp: getCurrentTimestamp(),
				});
			} catch (error) {
				console.error(
					`[${sessionId}] 🔊 BACKEND: Error sending audio to listener ${listenerIndex}:`,
					error,
				);
				deadConnections.push(listenerWs);
			}
		} else {
			console.warn(
				`[${sessionId}] 🔊 BACKEND: Listener ${listenerIndex} connection not open (readyState: ${listenerWs?.readyState || "undefined"})`,
			);
			deadConnections.push(listenerWs);
		}
		listenerIndex++;
	});

	// Clean up dead connections
	if (deadConnections.length > 0) {
		console.log(
			`[${sessionId}] 🔊 BACKEND: Cleaning up ${deadConnections.length} dead listener connections`,
		);
		deadConnections.forEach((deadWs) => {
			callSession.frontendListeners?.delete(deadWs);
		});
	}
}

// Function to handle function calls from OpenAI
async function handleFunctionCall(
	sessionId: string,
	item: { name: string; arguments: string; call_id: string },
): Promise<string | null> {
	console.log("Handling function call:", item);
	const fnDef = functions.find((f) => f.schema.name === item.name);
	if (!fnDef) {
		throw new Error(`No handler found for function: ${item.name}`);
	}

	let args: Record<string, unknown>;
	try {
		args = JSON.parse(item.arguments);
	} catch {
		return JSON.stringify({
			error: "Invalid JSON arguments for function call.",
		});
	}

	// Route based on function type
	if (fnDef.callType === "backend") {
		// Backend function - execute immediately
		try {
			console.log("Executing backend function:", fnDef.schema.name, args);
			if (!fnDef.handler) {
				throw new Error(`Backend function ${item.name} missing handler`);
			}
			const result = await fnDef.handler(args, { sessionId });
			return result;
		} catch (err: unknown) {
			console.error("Error running backend function:", err);
			return JSON.stringify({
				error: `Error running function ${item.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
			});
		}
	} else if (fnDef.callType === "frontend_input") {
		// Frontend input function - let it appear in function calls panel for manual response
		console.log("Frontend input function called:", fnDef.schema.name, args);

		// Return null to indicate waiting for manual user response through function calls panel
		return null;
	}

	throw new Error(`Unknown function call type: ${fnDef.callType}`);
}

function handleTwilioMessage(sessionId: string, data: RawData) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.error(
			`[${sessionId}] CRITICAL: Received Twilio message for UNKNOWN session!`,
		);
		return;
	}

	let msg: TwilioMessage;
	try {
		msg = parseMessage(data) as TwilioMessage;
		if (!msg) {
			console.error(
				`[${sessionId}] CRITICAL: Failed to parse Twilio message:`,
				{
					dataType: typeof data,
					dataLength: data.toString().length,
					dataPreview: data.toString().substring(0, 200),
				},
			);
			return;
		}

		// Log Twilio events for debugging (but not too verbose for media)
		if (msg.event !== "media") {
			console.log(`[${sessionId}] Twilio event:`, {
				event: msg.event,
				streamSid: "start" in msg ? msg.start?.streamSid : undefined,
			});
		}
	} catch (error) {
		console.error(`[${sessionId}] ERROR parsing Twilio message:`, {
			error: error instanceof Error ? error.message : "unknown error",
			rawData: data.toString().substring(0, 300),
		});
		return;
	}

	switch (msg.event) {
		case "start":
			if (msg.start) {
				callSession.streamSid = msg.start.streamSid;
				callSession.latestMediaTimestamp = 0;
				callSession.lastAssistantItem = undefined;
				callSession.responseStartTimestamp = undefined;
				callSession.status = "active";
				console.log(
					`Call session ${sessionId} started with streamSid: ${msg.start.streamSid}`,
				);
				tryConnectModel(sessionId);
				notifyFrontend({
					type: "session_updated",
					sessionId,
					session: getSessionInfo(callSession),
				});
			}
			break;
		case "media":
			if (msg.media) {
				callSession.latestMediaTimestamp = msg.media.timestamp;

				// Log audio flow every 50 media packets (less verbose but still trackable)
				const mediaCount = (callSession as any).mediaPacketCount || 0;
				(callSession as any).mediaPacketCount = mediaCount + 1;

				if (mediaCount % 50 === 0) {
					console.log(
						`[${sessionId}] Audio flow: received ${mediaCount + 1} media packets, latest timestamp: ${msg.media.timestamp}`,
					);
				}

				// Forward audio to OpenAI (existing behavior)
				if (isOpen(callSession.modelConn)) {
					try {
						jsonSend(callSession.modelConn, {
							type: "input_audio_buffer.append",
							audio: msg.media.payload,
						});

						// Log successful audio forward every 100 packets
						if (mediaCount % 100 === 0) {
							console.log(
								`[${sessionId}] Successfully forwarded audio packet ${mediaCount + 1} to OpenAI`,
							);
						}
					} catch (error) {
						console.error(`[${sessionId}] ERROR forwarding audio to OpenAI:`, {
							error: error instanceof Error ? error.message : "unknown error",
							timestamp: msg.media.timestamp,
							payloadLength: msg.media.payload?.length || 0,
						});
					}
				} else {
					// This is critical - audio coming in but no OpenAI connection
					if (mediaCount % 10 === 0) {
						// Log more frequently for this critical issue
						console.error(
							`[${sessionId}] CRITICAL: Audio received but OpenAI connection is NOT OPEN!`,
							{
								modelConnState: callSession.modelConn
									? "exists but not open"
									: "undefined",
								audioTimestamp: msg.media.timestamp,
								sessionStatus: callSession.status,
							},
						);
					}
				}

				// NEW: Also forward Twilio call audio to frontend listeners (peer participant architecture)
				broadcastCallAudioToListeners(sessionId, msg.media.payload, "twilio");
			} else {
				console.warn(
					`[${sessionId}] Received media event but msg.media is undefined`,
				);
			}
			break;
		case "close":
			console.log(`Call session ${sessionId} ended by Twilio`);
			closeCallSession(sessionId);
			break;
		default:
			// This should never happen with proper discriminated union
			console.warn(
				"Unexpected Twilio event:",
				(msg as { event: string }).event,
			);
			break;
	}
}

function handleFrontendMessage(data: RawData) {
	const msg = parseMessage(data) as FrontendToBackendMessage;
	if (!msg) {
		return;
	}

	// Handle global config updates
	if (msg.type === "global_config.update") {
		globalConfig = msg.config;
		console.log("Global configuration updated:", globalConfig);

		// Notify frontend that global config was saved
		notifyFrontend({
			type: "global_config.saved",
			config: globalConfig,
			timestamp: getCurrentTimestamp(),
		});
		return;
	}

	// Handle session-specific messages
	if (!("sessionId" in msg)) {
		console.warn("Frontend message missing sessionId:", msg);
		return;
	}

	const sessionId = msg.sessionId;
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.warn(`Frontend message for unknown session: ${sessionId}`);
		return;
	}

	// Handle user audio from frontend takeover
	if (msg.type === "user_audio") {
		handleUserAudio(sessionId, msg.audio, msg.format, msg.sampleRate);
		return;
	}

	// Handle user DTMF from frontend takeover
	if (msg.type === "user_dtmf") {
		handleUserDTMF(sessionId, msg.digit);
		return;
	}

	// Handle frontend joining as call listener
	if (msg.type === "join_call_listener") {
		handleJoinCallListener(sessionId, frontendConn);
		return;
	}

	// Handle frontend leaving as call listener
	if (msg.type === "leave_call_listener") {
		handleLeaveCallListener(sessionId, frontendConn);
		return;
	}

	// Forward other messages to OpenAI (remove sessionId as it's not part of OpenAI protocol)
	const { sessionId: _, ...messageData } = msg;
	if (isOpen(callSession.modelConn)) {
		jsonSend(callSession.modelConn, messageData);
	}
}

function tryConnectModel(sessionId: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.error(
			`[${sessionId}] CRITICAL: tryConnectModel called for UNKNOWN session!`,
		);
		return;
	}

	// Detailed connection readiness check
	const readinessCheck = {
		twilioConn: !!callSession.twilioConn,
		twilioConnOpen: callSession.twilioConn
			? isOpen(callSession.twilioConn)
			: false,
		streamSid: !!callSession.streamSid,
		openAIApiKey: !!callSession.openAIApiKey,
	};

	console.log(`[${sessionId}] Connection readiness check:`, readinessCheck);

	if (
		!(
			callSession.twilioConn &&
			callSession.streamSid &&
			callSession.openAIApiKey
		)
	) {
		console.warn(
			`[${sessionId}] Session not ready for OpenAI connection:`,
			readinessCheck,
		);
		return;
	}

	if (isOpen(callSession.modelConn)) {
		console.log(`[${sessionId}] Session already has active OpenAI connection`);
		return;
	}

	console.log(`[${sessionId}] Initiating OpenAI WebSocket connection...`);

	callSession.modelConn = new WebSocket(
		"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
		{
			headers: {
				Authorization: `Bearer ${callSession.openAIApiKey}`,
				"OpenAI-Beta": "realtime=v1",
			},
		},
	);

	callSession.modelConn.on("open", () => {
		console.log(`OpenAI connection established for session ${sessionId}`);

		console.log(`Using global config for session ${sessionId}:`, globalConfig);

		jsonSend(callSession.modelConn, {
			type: "session.update",
			session: {
				modalities: ["text", "audio"],
				turn_detection: { type: "semantic_vad" },
				speed: 1.2,
				input_audio_transcription: { model: "whisper-1" },
				input_audio_format: "g711_ulaw",
				output_audio_format: "g711_ulaw",
				// Apply global configuration
				instructions: globalConfig.instructions,
				voice: globalConfig.voice,
				tools: globalConfig.tools.map((toolName) => ({
					type: "function",
					name: toolName,
				})),
			},
		});

		notifyFrontend({
			type: "session_updated",
			sessionId,
			session: getSessionInfo(callSession),
		});
	});

	callSession.modelConn.on("message", (data) => {
		console.log(
			`[${sessionId}] Received OpenAI message, size: ${data.toString().length} bytes`,
		);
		handleModelMessage(sessionId, data);
	});

	callSession.modelConn.on("error", (error) => {
		console.error(`[${sessionId}] OpenAI WebSocket ERROR:`, {
			message: error.message,
			code: (error as any).code || "unknown",
			type: (error as any).type || "unknown",
			stack: error.stack?.substring(0, 500) || "no stack",
		});
		closeModel(sessionId);
	});

	callSession.modelConn.on("close", (code, reason) => {
		console.warn(`[${sessionId}] OpenAI WebSocket CLOSED:`, {
			code: code || "no code",
			reason: reason?.toString() || "no reason provided",
			wasClean: code === 1000,
			timestamp: new Date().toISOString(),
		});
		closeModel(sessionId);
	});

	// Add ping/pong for connection health monitoring
	callSession.modelConn.on("ping", () => {
		console.log(`[${sessionId}] OpenAI WebSocket ping received`);
	});

	callSession.modelConn.on("pong", () => {
		console.log(`[${sessionId}] OpenAI WebSocket pong received`);
	});
}

function handleModelMessage(sessionId: string, data: RawData) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.error(
			`[${sessionId}] CRITICAL: Received OpenAI message for UNKNOWN session!`,
		);
		return;
	}

	let event: OpenAIEvent;
	try {
		event = parseMessage(data) as OpenAIEvent;
		if (!event) {
			console.error(
				`[${sessionId}] CRITICAL: Failed to parse OpenAI message:`,
				{
					dataType: typeof data,
					dataLength: data.toString().length,
					dataPreview: data.toString().substring(0, 200),
				},
			);
			return;
		}

		// Log the event type for debugging - with special handling for errors
		if (event.type === "error") {
			console.error(`[${sessionId}] 🚨 OpenAI ERROR EVENT:`, {
				type: event.type,
				fullEvent: event,
				error: (event as any).error || "no error field",
				message: (event as any).message || "no message field",
				code: (event as any).code || "no code field",
			});
		} else {
			console.log(`[${sessionId}] OpenAI event:`, {
				type: event.type,
				hasItemId: "item_id" in event,
				hasDelta: "delta" in event,
				hasItem: "item" in event,
			});
		}
	} catch (error) {
		console.error(`[${sessionId}] ERROR parsing OpenAI message:`, {
			error: error instanceof Error ? error.message : "unknown error",
			rawData: data.toString().substring(0, 300),
		});
		return;
	}

	// Forward to frontend with session context
	const frontendEvent = {
		...event,
		sessionId,
		timestamp: getCurrentTimestamp(),
	};

	// Ensure function call items have proper typing for frontend
	if (
		event.type === "response.output_item.done" &&
		event.item &&
		typeof event.item === "object" &&
		event.item !== null &&
		"type" in event.item &&
		event.item.type === "function_call"
	) {
		const functionCallItem = event.item as {
			type: string;
			call_id: string;
			name: string;
			arguments: string;
		};
		(frontendEvent as Record<string, unknown>).item = {
			...functionCallItem,
			id: functionCallItem.call_id, // Use call_id as id if id is missing
		};
	}

	notifyFrontend(frontendEvent as BackendToFrontendMessage);

	processModelEvent(sessionId, callSession, event);
}

function processModelEvent(
	sessionId: string,
	callSession: CallSession,
	event: OpenAIEvent,
) {
	switch (event.type) {
		case "input_audio_buffer.speech_started":
			handleTruncation(sessionId);
			break;

		case "response.audio.delta":
			handleAudioDelta(callSession, event);
			break;

		case "response.output_item.done":
			handleFunctionCallComplete(callSession, event);
			break;

		case "error":
			// Handle OpenAI error events
			console.error(
				`[${sessionId}] 🚨 CRITICAL: OpenAI reported an error, this will block all responses!`,
				{
					event: event,
					sessionStatus: callSession.status,
					connectionAge: Date.now() - callSession.createdAt,
					audioPacketsReceived: (callSession as any).mediaPacketCount || 0,
				},
			);

			// Notify frontend about the error
			notifyFrontend({
				type: "error" as any,
				sessionId,
				error: event,
				timestamp: getCurrentTimestamp(),
			});
			break;

		case "session.created":
			console.log(`[${sessionId}] ✅ OpenAI session created successfully`);
			break;

		case "session.updated":
			console.log(
				`[${sessionId}] ✅ OpenAI session configuration updated successfully`,
			);
			break;

		default:
			// Log unhandled events for debugging
			console.log(`[${sessionId}] Unhandled OpenAI event type: ${event.type}`);
			break;
	}
}

function handleAudioDelta(callSession: CallSession, event: OpenAIEvent) {
	if (event.type !== "response.audio.delta") {
		return;
	}

	// Type assertion after type guard to help TypeScript
	const audioDeltaEvent = event as Extract<
		OpenAIEvent,
		{ type: "response.audio.delta" }
	>;

	// Track audio response count for logging
	const audioResponseCount = (callSession as any).audioResponseCount || 0;
	(callSession as any).audioResponseCount = audioResponseCount + 1;

	// Log audio response flow every 20 audio deltas (less verbose)
	if (audioResponseCount % 20 === 0) {
		console.log(
			`[${callSession.sessionId}] OpenAI audio response: packet ${audioResponseCount + 1}, item_id: ${audioDeltaEvent.item_id}, delta length: ${audioDeltaEvent.delta?.length || 0}`,
		);
	}

	if (callSession.twilioConn && callSession.streamSid) {
		if (callSession.responseStartTimestamp === undefined) {
			callSession.responseStartTimestamp =
				callSession.latestMediaTimestamp || 0;
			console.log(
				`[${callSession.sessionId}] Started AI audio response at timestamp: ${callSession.responseStartTimestamp}`,
			);
		}
		if (audioDeltaEvent.item_id) {
			callSession.lastAssistantItem = audioDeltaEvent.item_id;
		}

		try {
			jsonSend(callSession.twilioConn, {
				event: "media",
				streamSid: callSession.streamSid,
				media: { payload: audioDeltaEvent.delta },
			});

			jsonSend(callSession.twilioConn, {
				event: "mark",
				streamSid: callSession.streamSid,
			});

			// ALSO broadcast OpenAI AI audio responses to frontend listeners (peer participant architecture)
			if (audioDeltaEvent.delta) {
				broadcastCallAudioToListeners(
					callSession.sessionId,
					audioDeltaEvent.delta,
					"openai",
				);
			}

			// Log successful audio forward every 50 responses
			if (audioResponseCount % 50 === 0) {
				console.log(
					`[${callSession.sessionId}] 📢 Audio response ${audioResponseCount + 1} sent to Twilio + Frontend listeners`,
				);
			}
		} catch (error) {
			console.error(
				`[${callSession.sessionId}] ERROR sending audio response to Twilio:`,
				{
					error: error instanceof Error ? error.message : "unknown error",
					itemId: audioDeltaEvent.item_id,
					deltaLength: audioDeltaEvent.delta?.length || 0,
					streamSid: callSession.streamSid,
				},
			);
		}
	} else {
		// Critical issue - OpenAI is sending audio but we can't forward it to Twilio
		console.error(
			`[${callSession.sessionId}] CRITICAL: OpenAI sending audio but Twilio connection unavailable!`,
			{
				twilioConnState: callSession.twilioConn
					? "exists but not open"
					: "undefined",
				streamSid: callSession.streamSid || "undefined",
				itemId: audioDeltaEvent.item_id,
				deltaLength: audioDeltaEvent.delta?.length || 0,
			},
		);
	}
}

function handleFunctionCallComplete(
	callSession: CallSession,
	event: OpenAIEvent,
) {
	if (event.type !== "response.output_item.done") {
		return;
	}

	// Type assertion after type guard to help TypeScript
	const outputItemEvent = event as Extract<
		OpenAIEvent,
		{ type: "response.output_item.done" }
	>;
	const { item } = outputItemEvent;

	if (item && item.type === "function_call") {
		handleFunctionCall(callSession.sessionId, item)
			.then((output) => {
				// Only send response if we got output (backend functions)
				// Frontend input functions return null and will send response later
				if (output !== null && callSession.modelConn) {
					jsonSend(callSession.modelConn, {
						type: "conversation.item.create",
						item: {
							type: "function_call_output",
							call_id: item.call_id,
							output: JSON.stringify(output),
						},
					});
					jsonSend(callSession.modelConn, { type: "response.create" });
				}
			})
			.catch((err) => {
				console.error("Error handling function call:", err);
				// Send error response to OpenAI
				if (callSession.modelConn) {
					jsonSend(callSession.modelConn, {
						type: "conversation.item.create",
						item: {
							type: "function_call_output",
							call_id: item.call_id,
							output: JSON.stringify({
								error: `Function call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
							}),
						},
					});
					jsonSend(callSession.modelConn, { type: "response.create" });
				}
			});
	}
}
function handleTruncation(sessionId: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		console.warn(`handleTruncation called for unknown session: ${sessionId}`);
		return;
	}

	if (
		!callSession.lastAssistantItem ||
		callSession.responseStartTimestamp === undefined
	) {
		return;
	}

	const elapsedMs =
		(callSession.latestMediaTimestamp || 0) -
		(callSession.responseStartTimestamp || 0);
	const audio_end_ms = elapsedMs > 0 ? elapsedMs : 0;

	if (isOpen(callSession.modelConn)) {
		jsonSend(callSession.modelConn, {
			type: "conversation.item.truncate",
			item_id: callSession.lastAssistantItem,
			content_index: 0,
			audio_end_ms,
		});
	}

	if (callSession.twilioConn && callSession.streamSid) {
		jsonSend(callSession.twilioConn, {
			event: "clear",
			streamSid: callSession.streamSid,
		});
	}

	callSession.lastAssistantItem = undefined;
	callSession.responseStartTimestamp = undefined;
}

function closeModel(sessionId: string) {
	const callSession = callSessions.get(sessionId);
	if (!callSession) {
		return;
	}

	console.log(`Closing OpenAI connection for session ${sessionId}`);
	cleanupConnection(callSession.modelConn);
	callSession.modelConn = undefined;

	notifyFrontend({
		type: "session_updated",
		sessionId,
		session: getSessionInfo(callSession),
	});
}

// Export function to get all active sessions (for monitoring)
export function getActiveSessions() {
	return Array.from(callSessions.values()).map(getSessionInfo);
}
function cleanupConnection(ws?: WebSocket) {
	if (isOpen(ws)) {
		ws.close();
	}
}

function parseMessage(data: RawData): unknown {
	try {
		return JSON.parse(data.toString());
	} catch {
		return null;
	}
}

function jsonSend(ws: WebSocket | undefined, obj: unknown) {
	if (!ws) {
		console.error("jsonSend: WebSocket is undefined");
		return;
	}

	if (ws.readyState !== WebSocket.OPEN) {
		const stateNames = {
			[WebSocket.CONNECTING]: "CONNECTING",
			[WebSocket.OPEN]: "OPEN",
			[WebSocket.CLOSING]: "CLOSING",
			[WebSocket.CLOSED]: "CLOSED",
		};

		console.error("jsonSend: WebSocket not open, readyState:", {
			readyState: ws.readyState,
			currentState: stateNames[ws.readyState] || "UNKNOWN",
		});
		return;
	}

	try {
		const jsonString = JSON.stringify(obj);
		ws.send(jsonString);

		// Log large messages that might cause issues
		if (jsonString.length > 10000) {
			console.warn("jsonSend: Large message sent:", {
				size: jsonString.length,
				type: (obj as any)?.type || "unknown",
				preview: jsonString.substring(0, 200) + "...",
			});
		}
	} catch (error) {
		console.error("jsonSend: Error sending message:", {
			error: error instanceof Error ? error.message : "unknown error",
			objectType: typeof obj,
			objectKeys:
				obj && typeof obj === "object"
					? Object.keys(obj as Record<string, unknown>)
					: "not object",
			wsReadyState: ws.readyState,
		});
	}
}

function isOpen(ws?: WebSocket): ws is WebSocket {
	return !!ws && ws.readyState === WebSocket.OPEN;
}
