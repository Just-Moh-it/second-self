"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CallListenerProps = {
	sessionId: string;
	ws: WebSocket | null;
	hasActiveCall: boolean;
};

const CallListener = ({ sessionId, ws, hasActiveCall }: CallListenerProps) => {
	const [isListening, setIsListening] = useState(false);
	const [isMicOn, setIsMicOn] = useState(false);
	const [isMuted, setIsMuted] = useState(true); // Start muted by default
	const [audioLevel, setAudioLevel] = useState(0);

	const mediaStreamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | undefined>(undefined);

	// LOW-LATENCY AudioWorklet streaming (direct to destination)
	const playbackContextRef = useRef<AudioContext | null>(null);
	const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
	const isAudioInitializedRef = useRef(false);

	const keypadButtons = [
		["1", "2", "3"],
		["4", "5", "6"],
		["7", "8", "9"],
		["*", "0", "#"],
	];

	// G.711 μ-law decoding for call audio playback
	const muLawDecode = useCallback((muLawValue: number): number => {
		const CLIP = 8159;
		muLawValue = ~muLawValue;
		const sign = muLawValue & 0x80;
		const exponent = (muLawValue >> 4) & 0x07;
		const mantissa = muLawValue & 0x0f;
		let sample = mantissa + 16;

		if (exponent !== 0) {
			sample += 16;
			sample <<= exponent + 2;
		} else {
			sample <<= 3;
		}

		sample -= 132;
		if (sign) sample = -sample;
		return Math.max(-CLIP, Math.min(CLIP, sample));
	}, []);

	// Convert G.711 μ-law bytes to Float32Array PCM
	const convertMuLawToPCM = useCallback(
		(muLawData: Uint8Array): Float32Array => {
			const pcmData = new Float32Array(muLawData.length);
			for (let i = 0; i < muLawData.length; i++) {
				const pcm16 = muLawDecode(muLawData[i]);
				pcmData[i] = pcm16 / 32768; // Convert to float (-1 to 1)
			}
			return pcmData;
		},
		[muLawDecode],
	);

	// Initialize LOW-LATENCY AudioWorklet streaming (direct to destination)
	const initializeAudioStreaming = useCallback(async () => {
		if (isAudioInitializedRef.current || !playbackContextRef.current) return;

		console.log(
			`[${sessionId}] ⚡ Initializing LOW-LATENCY AudioWorklet streaming`,
		);

		try {
			const audioContext = playbackContextRef.current;

			// Resume context if suspended (handle autoplay policy)
			if (audioContext.state === "suspended") {
				await audioContext.resume();
				console.log(
					`[${sessionId}] ⚡ AudioContext resumed (${audioContext.sampleRate}Hz)`,
				);
			}

			// Load AudioWorklet processor
			await audioContext.audioWorklet.addModule("/audio-stream-processor.js");
			console.log(
				`[${sessionId}] ⚡ Low-latency AudioWorklet processor loaded`,
			);

			// Create AudioWorklet node with minimal latency settings
			const workletNode = new AudioWorkletNode(
				audioContext,
				"audio-stream-processor",
				{
					numberOfInputs: 0,
					numberOfOutputs: 1,
					outputChannelCount: [1], // Mono output
				},
			);

			// DIRECT CONNECTION: AudioWorklet -> Speakers (no buffering!)
			workletNode.connect(audioContext.destination);

			// Store refs (no HTML audio element needed!)
			audioWorkletRef.current = workletNode;
			isAudioInitializedRef.current = true;

			// Set up enhanced audio monitoring with smart pre-buffering detection
			workletNode.port.onmessage = (event) => {
				const {
					type,
					samplesAvailable,
					chunkSize,
					latencyMs,
					avgChunkSize,
					likelySource,
					totalChunks,
					isPreBuffering,
					bufferHealth,
				} = event.data;

				if (type === "chunk-added") {
					const bufferStatus = isPreBuffering
						? "🔄 PRE-BUFFERING"
						: `🔊 ${bufferHealth?.toUpperCase()}`;
					console.log(
						`[${sessionId}] ⚡ ${likelySource?.toUpperCase() || "UNKNOWN"} | ${bufferStatus} | Latency ${latencyMs}ms | +${chunkSize} samples | Buffer: ${samplesAvailable} | Avg: ${avgChunkSize}`,
					);
				} else if (type === "pre-buffering") {
					console.log(
						`[${sessionId}] 🔄 Pre-buffering OpenAI audio: ${event.data.progress}% (${samplesAvailable}/${event.data.minBufferSize} samples)`,
					);
				} else if (type === "pre-buffer-complete") {
					console.log(
						`[${sessionId}] ✅ Pre-buffer complete! ${event.data.samplesBuffered} samples ready - starting smooth playback`,
					);
				} else if (type === "buffer-overflow") {
					console.warn(
						`[${sessionId}] ⚠️ Audio buffer overflow! Dropped ${event.data.droppedSamples} samples | ${event.data.chunkPattern || ""} | Latency: ${event.data.latencyMs}ms`,
					);
				}
			};

			console.log(
				`[${sessionId}] ✅ LOW-LATENCY audio streaming ready (direct to speakers)`,
			);
		} catch (error) {
			console.error(
				`[${sessionId}] ❌ Error initializing low-latency streaming:`,
				error,
			);
		}
	}, [sessionId]);

	// Initialize audio context with native browser sample rate
	const initializePlaybackContext = useCallback(async () => {
		if (playbackContextRef.current) return;

		console.log(`[${sessionId}] 🔧 Initializing LOW-LATENCY AudioContext`);

		try {
			// Use browser's NATIVE sample rate for best performance
			// Typical: 44100Hz or 48000Hz (much lower latency than forcing 8000Hz)
			const audioContext = new (
				window.AudioContext || (window as any).webkitAudioContext
			)({
				latencyHint: "interactive", // Absolute minimum latency
			});

			console.log(
				`[${sessionId}] 🔧 AudioContext created: ${audioContext.sampleRate}Hz (native rate)`,
			);

			playbackContextRef.current = audioContext;

			// Initialize the low-latency AudioWorklet system
			await initializeAudioStreaming();
		} catch (error) {
			console.error(
				`[${sessionId}] ❌ Error initializing low-latency context:`,
				error,
			);
		}
	}, [sessionId, initializeAudioStreaming]);

	// Start AudioWorklet streaming
	const startAudioStreaming = useCallback(() => {
		if (!audioWorkletRef.current) {
			console.warn(
				`[${sessionId}] ⚠️ Cannot start streaming - AudioWorklet not initialized`,
			);
			return;
		}

		console.log(`[${sessionId}] ▶️ Starting low-latency AudioWorklet streaming`);

		// Tell AudioWorklet to start processing (direct to speakers!)
		audioWorkletRef.current.port.postMessage({ type: "start" });

		console.log(
			`[${sessionId}] ⚡ AudioWorklet connected directly to destination - minimal latency!`,
		);
	}, [sessionId]);

	// Resample from 8kHz to browser's native sample rate
	const resampleAudio = useCallback(
		(pcmData: Float32Array, targetSampleRate: number): Float32Array => {
			const sourceSampleRate = 8000; // g711 is always 8kHz
			const ratio = targetSampleRate / sourceSampleRate;
			const outputLength = Math.ceil(pcmData.length * ratio);
			const resampled = new Float32Array(outputLength);

			// Simple linear interpolation resampling (fast and good quality for voice)
			for (let i = 0; i < outputLength; i++) {
				const sourceIndex = i / ratio;
				const leftIndex = Math.floor(sourceIndex);
				const rightIndex = Math.min(leftIndex + 1, pcmData.length - 1);
				const fraction = sourceIndex - leftIndex;

				// Linear interpolation
				resampled[i] =
					pcmData[leftIndex] * (1 - fraction) + pcmData[rightIndex] * fraction;
			}

			return resampled;
		},
		[],
	);

	// Add audio chunk to AudioWorklet with automatic resampling
	const addAudioChunk = useCallback(
		(base64Audio: string) => {
			if (!audioWorkletRef.current || !playbackContextRef.current) {
				console.warn(
					`[${sessionId}] ⚠️ Cannot add audio chunk - AudioWorklet not ready`,
				);
				return;
			}

			try {
				// Decode base64 to binary
				const binaryString = atob(base64Audio);
				const muLawData = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					muLawData[i] = binaryString.charCodeAt(i);
				}

				// Convert μ-law to 8kHz PCM
				const pcm8k = convertMuLawToPCM(muLawData);

				// Resample to browser's native sample rate for low latency
				const targetSampleRate = playbackContextRef.current.sampleRate;
				const resampledPCM = resampleAudio(pcm8k, targetSampleRate);

				// Send resampled data to AudioWorklet
				audioWorkletRef.current.port.postMessage({
					type: "audio-chunk",
					data: resampledPCM,
				});

				console.log(
					`[${sessionId}] ⚡ Resampled ${pcm8k.length}→${resampledPCM.length} samples (8k→${targetSampleRate}Hz)`,
				);
			} catch (error) {
				console.error(`[${sessionId}] ❌ Error processing audio chunk:`, error);
			}
		},
		[sessionId, convertMuLawToPCM, resampleAudio],
	);

	// Stop low-latency AudioWorklet streaming
	const stopAudioStreaming = useCallback(() => {
		console.log(`[${sessionId}] ⏹️ Stopping low-latency streaming`);

		if (audioWorkletRef.current) {
			audioWorkletRef.current.port.postMessage({ type: "stop" });
		}
	}, [sessionId]);

	// Cleanup low-latency AudioWorklet streaming
	const cleanupPlaybackContext = useCallback(() => {
		console.log(`[${sessionId}] 🧹 Cleaning up low-latency streaming`);

		// Stop streaming first
		stopAudioStreaming();

		// Clean up AudioWorklet
		if (audioWorkletRef.current) {
			audioWorkletRef.current.port.postMessage({ type: "clear" });
			audioWorkletRef.current.disconnect();
			audioWorkletRef.current = null;
		}

		// Clean up AudioContext
		if (
			playbackContextRef.current &&
			playbackContextRef.current.state !== "closed"
		) {
			playbackContextRef.current.close();
			playbackContextRef.current = null;
		}

		isAudioInitializedRef.current = false;
		console.log(`[${sessionId}] ✅ Low-latency audio cleanup complete`);
	}, [sessionId, stopAudioStreaming]);

	// Start listening to the call (receive audio from backend)
	const startListening = useCallback(async () => {
		console.log(`[${sessionId}] 🎧 START LISTENING - Button clicked`, {
			hasActiveCall,
			wsExists: !!ws,
			wsReadyState: ws?.readyState,
			currentlyListening: isListening,
		});

		if (!hasActiveCall) {
			console.warn(`[${sessionId}] 🎧 Cannot start listening - no active call`);
			return;
		}

		try {
			// Initialize audio playback context first
			await initializePlaybackContext();

			// Request to join call as listener
			if (ws && ws.readyState === WebSocket.OPEN) {
				console.log(
					`[${sessionId}] 🎧 Sending join_call_listener message to backend`,
				);
				ws.send(
					JSON.stringify({
						type: "join_call_listener",
						sessionId,
						timestamp: Date.now(),
					}),
				);

				setIsListening(true);

				// Start the AudioWorklet streaming
				startAudioStreaming();

				console.log(
					`[${sessionId}] 🎧 Started listening to call with AudioWorklet streaming`,
				);
			} else {
				console.error(
					`[${sessionId}] 🎧 Cannot start listening - WebSocket not open:`,
					{
						wsExists: !!ws,
						wsReadyState: ws?.readyState,
					},
				);
			}
		} catch (error) {
			console.error(`[${sessionId}] 🎧 Error starting call listener:`, error);
		}
	}, [
		hasActiveCall,
		sessionId,
		ws,
		isListening,
		initializePlaybackContext,
		startAudioStreaming,
	]);

	// Stop listening to the call
	const stopListening = useCallback(() => {
		console.log(`[${sessionId}] 🔇 STOP LISTENING - Button clicked`);

		if (ws && ws.readyState === WebSocket.OPEN) {
			console.log(
				`[${sessionId}] 🔇 Sending leave_call_listener message to backend`,
			);
			ws.send(
				JSON.stringify({
					type: "leave_call_listener",
					sessionId,
					timestamp: Date.now(),
				}),
			);
		} else {
			console.warn(
				`[${sessionId}] 🔇 Cannot send leave message - WebSocket not open:`,
				{
					wsExists: !!ws,
					wsReadyState: ws?.readyState,
				},
			);
		}

		setIsListening(false);
		cleanupPlaybackContext();
		console.log(`[${sessionId}] 🔇 Stopped listening to call (state updated)`);
	}, [sessionId, ws, cleanupPlaybackContext]);

	// Start microphone (send audio to backend)
	const startMicrophone = useCallback(async () => {
		console.log(`[${sessionId}] 🎤 START MICROPHONE - Button clicked`);

		try {
			console.log(
				`[${sessionId}] 🎤 Requesting microphone access with constraints:`,
				{
					sampleRate: 24000,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			);

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 24000, // Match OpenAI's expected format
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});

			console.log(`[${sessionId}] 🎤 Microphone access granted:`, {
				streamId: stream.id,
				trackCount: stream.getTracks().length,
				audioTracks: stream.getAudioTracks().map((track) => ({
					id: track.id,
					kind: track.kind,
					enabled: track.enabled,
					readyState: track.readyState,
				})),
			});

			mediaStreamRef.current = stream;

			// Create audio context for processing
			const audioContext = new (
				window.AudioContext || (window as any).webkitAudioContext
			)({
				sampleRate: 24000,
			});
			audioContextRef.current = audioContext;

			console.log(`[${sessionId}] 🎤 AudioContext created:`, {
				state: audioContext.state,
				sampleRate: audioContext.sampleRate,
			});

			// Create analyser for visual feedback
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			analyserRef.current = analyser;

			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);

			// Create ScriptProcessorNode for actual audio capture and streaming
			// Note: ScriptProcessorNode is deprecated but still widely supported
			// In production, we should migrate to AudioWorklet
			const processor = audioContext.createScriptProcessor(4096, 1, 1);
			source.connect(processor);
			processor.connect(audioContext.destination);

			console.log(
				`[${sessionId}] 🎤 Audio processing nodes connected (including processor for streaming)`,
			);

			// Handle audio processing for streaming to backend
			processor.onaudioprocess = (event) => {
				if (!isMuted && ws && ws.readyState === WebSocket.OPEN) {
					const inputData = event.inputBuffer.getChannelData(0);

					// Convert Float32Array PCM to base64 for WebSocket transmission
					// For now, sending raw PCM - we should implement g711_ulaw encoding like before
					const audioBuffer = new ArrayBuffer(inputData.length * 4);
					const view = new Float32Array(audioBuffer);
					view.set(inputData);

					// Convert to base64
					const uint8Array = new Uint8Array(audioBuffer);
					const base64Audio = btoa(
						String.fromCharCode.apply(null, Array.from(uint8Array)),
					);

					// Send audio to backend
					ws.send(
						JSON.stringify({
							type: "user_audio",
							sessionId,
							audio: base64Audio,
							format: "pcm_f32le", // 32-bit float PCM, little endian
							sampleRate: 24000,
							timestamp: Date.now(),
						}),
					);

					// Log first few audio packets
					const audioSentCount = (window as any)[`audioSent_${sessionId}`] || 0;
					if (audioSentCount < 5 || audioSentCount % 50 === 0) {
						console.log(
							`[${sessionId}] 🎤 FRONTEND: Sent audio packet ${audioSentCount + 1} to backend`,
							{
								audioLength: base64Audio.length,
								inputLevel: Math.max(...inputData.map(Math.abs)),
								isMuted,
								format: "pcm_f32le",
							},
						);
					}
					(window as any)[`audioSent_${sessionId}`] = audioSentCount + 1;
				}
			};

			// Store processor reference for cleanup
			(window as any)[`processor_${sessionId}`] = processor;

			// Visual feedback for audio levels
			const updateAudioLevel = () => {
				if (!analyserRef.current) return;

				const bufferLength = analyserRef.current.frequencyBinCount;
				const dataArray = new Uint8Array(bufferLength);
				analyserRef.current.getByteFrequencyData(dataArray);

				const average =
					dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
				setAudioLevel(average / 255); // Normalize to 0-1

				animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
			};

			updateAudioLevel();
			setIsMicOn(true);
			console.log(
				`[${sessionId}] 🎤 Microphone started successfully - ready for call participation`,
			);
		} catch (error) {
			console.error(`[${sessionId}] 🎤 Error starting microphone:`, error);
			alert("Could not access microphone. Please check permissions.");
		}
	}, [sessionId, isMuted, ws]);

	// Stop microphone
	const stopMicrophone = useCallback(() => {
		console.log(`[${sessionId}] 🎤 STOP MICROPHONE - Function called`);

		if (animationFrameRef.current !== undefined) {
			console.log(`[${sessionId}] 🎤 Canceling animation frame`);
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = undefined;
		}

		// Clean up ScriptProcessorNode
		const processor = (window as any)[`processor_${sessionId}`];
		if (processor) {
			console.log(
				`[${sessionId}] 🎤 Disconnecting and cleaning up ScriptProcessorNode`,
			);
			processor.disconnect();
			processor.onaudioprocess = null;
			delete (window as any)[`processor_${sessionId}`];
		}

		// Clean up audio sent counter
		if ((window as any)[`audioSent_${sessionId}`]) {
			delete (window as any)[`audioSent_${sessionId}`];
		}

		if (audioContextRef.current && audioContextRef.current.state !== "closed") {
			console.log(`[${sessionId}] 🎤 Closing AudioContext:`, {
				currentState: audioContextRef.current.state,
			});
			audioContextRef.current.close();
			audioContextRef.current = null;
		}

		if (mediaStreamRef.current) {
			const tracks = mediaStreamRef.current.getTracks();
			console.log(`[${sessionId}] 🎤 Stopping ${tracks.length} media tracks`);
			tracks.forEach((track, index) => {
				console.log(`[${sessionId}] 🎤 Stopping track ${index}:`, {
					id: track.id,
					kind: track.kind,
					readyState: track.readyState,
				});
				track.stop();
			});
			mediaStreamRef.current = null;
		}

		setIsMicOn(false);
		setAudioLevel(0);
		console.log(`[${sessionId}] 🎤 Microphone stopped successfully`);
	}, [sessionId]);

	const handleKeypadPress = (digit: string) => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(
				JSON.stringify({
					type: "user_dtmf",
					sessionId,
					digit,
					timestamp: Date.now(),
				}),
			);
			console.log(`[${sessionId}] User pressed keypad digit: ${digit}`);
		}
	};

	const toggleMute = () => {
		setIsMuted(!isMuted);
		console.log(`[${sessionId}] Microphone ${!isMuted ? "muted" : "unmuted"}`);
	};

	// Handle incoming call audio from backend
	useEffect(() => {
		if (!ws) {
			console.log(
				`[${sessionId}] 🔊 No WebSocket connection for call audio handler`,
			);
			return;
		}

		console.log(`[${sessionId}] 🔊 Setting up call audio message handler`, {
			wsReadyState: ws.readyState,
			isListening,
		});

		const handleBackendMessage = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data);

				// Handle call audio from backend with source-aware processing
				if (data.type === "call_audio" && data.sessionId === sessionId) {
					const audioSource = data.audioSource || "unknown";
					const audioSize = data.audioSize || data.audio?.length || 0;

					console.log(
						`[${sessionId}] 🔊 Received ${audioSource.toUpperCase()} call_audio:`,
						{
							audioSource,
							audioSize,
							timestamp: data.timestamp,
							currentlyListening: isListening,
						},
					);

					if (isListening && data.audio) {
						// Source-specific logging and processing
						if (audioSource === "openai") {
							console.log(
								`[${sessionId}] 🤖 OpenAI audio delta (${audioSize} bytes) - Smart buffering for smooth playback`,
							);
						} else if (audioSource === "twilio") {
							console.log(
								`[${sessionId}] 📞 Twilio call audio (${audioSize} bytes) - Direct streaming`,
							);
						}

						// Add audio chunk to smart-buffering stream (handles OpenAI deltas specially)
						addAudioChunk(data.audio);
					} else if (!isListening) {
						console.log(
							`[${sessionId}] 🔊 Ignoring ${audioSource} audio - not currently listening`,
						);
					} else {
						console.warn(
							`[${sessionId}] 🔊 Received ${audioSource} call_audio message but no audio data`,
						);
					}
				} else if (data.sessionId === sessionId) {
					// Log other session messages for debugging
					console.log(`[${sessionId}] 🔊 Received other session message:`, {
						type: data.type,
						timestamp: data.timestamp,
					});
				}
			} catch (error) {
				// Only log if it looks like it might be JSON
				const message = event.data?.toString() || "";
				if (message.startsWith("{")) {
					console.warn(`[${sessionId}] 🔊 Failed to parse backend message:`, {
						error: error instanceof Error ? error.message : "unknown",
						messagePreview: message.substring(0, 100),
					});
				}
			}
		};

		ws.addEventListener("message", handleBackendMessage);

		console.log(`[${sessionId}] 🔊 Call audio message handler attached`);

		return () => {
			console.log(`[${sessionId}] 🔊 Removing call audio message handler`);
			ws.removeEventListener("message", handleBackendMessage);
		};
	}, [ws, sessionId, isListening, addAudioChunk]);

	// Auto-start listening when call becomes active
	useEffect(() => {
		if (hasActiveCall && !isListening) {
			startListening();
		} else if (!hasActiveCall && isListening) {
			stopListening();
			stopMicrophone();
		}
	}, [
		hasActiveCall,
		isListening,
		startListening,
		stopListening,
		stopMicrophone,
	]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopListening();
			stopMicrophone();
			cleanupPlaybackContext();
		};
	}, [stopListening, stopMicrophone, cleanupPlaybackContext]);

	if (!hasActiveCall) {
		return (
			<Card className="mt-4 opacity-50">
				<CardContent className="p-4 text-center text-gray-500">
					<div className="space-y-2">
						<h3 className="font-medium">No Active Call</h3>
						<p className="text-sm">
							Call listening will be available when a call is active
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mt-4">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Call Audio</CardTitle>
					<div className="flex items-center gap-2">
						<Badge variant={isListening ? "default" : "secondary"}>
							{isListening ? "🎧 Listening" : "🔇 Not Listening"}
						</Badge>
						{isMicOn && (
							<Badge variant={isMuted ? "secondary" : "default"}>
								{isMuted ? "🔇 Muted" : "🎤 Live"}
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Audio Controls */}
				<div className="flex flex-wrap gap-2">
					{!isListening ? (
						<Button
							className="bg-blue-600 text-white hover:bg-blue-700"
							onClick={startListening}
						>
							🎧 Listen In
						</Button>
					) : (
						<Button onClick={stopListening} variant="outline">
							🔇 Stop Listening
						</Button>
					)}

					{isListening && (
						<>
							{!isMicOn ? (
								<Button
									className="bg-green-600 text-white hover:bg-green-700"
									onClick={startMicrophone}
								>
									🎤 Join Voice
								</Button>
							) : (
								<>
									<Button
										className={
											isMuted
												? "bg-yellow-500 text-white hover:bg-yellow-600"
												: ""
										}
										onClick={toggleMute}
										variant={isMuted ? "secondary" : "default"}
									>
										{isMuted ? "🔇 Unmute" : "🔊 Mute"}
									</Button>
									<Button onClick={stopMicrophone} variant="outline">
										📴 Leave Voice
									</Button>
								</>
							)}
						</>
					)}
				</div>

				{/* Audio Level Indicator */}
				{isMicOn && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="text-sm">Mic Level:</span>
							<div className="flex-1 bg-gray-200 rounded-full h-2">
								<div
									className="bg-green-500 h-2 rounded-full transition-all duration-100"
									style={{ width: `${audioLevel * 100}%` }}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Keypad */}
				{isListening && (
					<div>
						<h4 className="mb-2 text-sm font-medium">Keypad</h4>
						<div className="grid grid-cols-3 gap-2 w-fit">
							{keypadButtons.flat().map((digit) => (
								<Button
									className="w-12 h-12 text-lg font-mono"
									disabled={!ws || ws.readyState !== WebSocket.OPEN}
									key={digit}
									onClick={() => handleKeypadPress(digit)}
									variant="outline"
								>
									{digit}
								</Button>
							))}
						</div>
					</div>
				)}

				{/* Status */}
				<div className="text-xs text-gray-500">
					{isListening ? (
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
							<span>
								You are listening to the call
								{isMicOn && !isMuted && " and can speak"}
								{isMicOn && isMuted && " (microphone muted)"}
							</span>
						</div>
					) : (
						<span>Click "Listen In" to hear the call in real-time</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export default CallListener;
