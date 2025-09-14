// LOW-LATENCY audio streaming processor for real-time call audio
// Optimized for minimal delay with small circular buffer

class AudioStreamProcessor extends AudioWorkletProcessor {
	constructor() {
		super();

		// Optimized circular buffer for handling both Twilio chunks and OpenAI deltas
		this.bufferSize = 48000; // 1 second at 48kHz
		this.circularBuffer = new Float32Array(this.bufferSize);
		this.writePosition = 0;
		this.readPosition = 0;
		this.isPlaying = false;
		this.samplesAvailable = 0;

		// Smart pre-buffering for OpenAI deltas to prevent cut-off and choppiness
		this.minBufferSize = 4800; // 100ms minimum buffer before starting playback
		this.isPreBuffering = false;
		this.lastChunkSize = 0;

		// Enhanced buffering stats for debugging different audio sources
		this.chunkCount = 0;
		this.totalSamples = 0;

		// Listen for audio data from main thread
		this.port.onmessage = (event) => {
			const { type, data } = event.data;

			switch (type) {
				case "audio-chunk":
					this.addAudioChunk(data);
					break;
				case "start":
					this.isPlaying = true;
					this.port.postMessage({ type: "started" });
					break;
				case "stop":
					this.isPlaying = false;
					this.writePosition = 0;
					this.readPosition = 0;
					this.samplesAvailable = 0;
					this.isPreBuffering = false;
					this.circularBuffer.fill(0);
					this.port.postMessage({ type: "stopped" });
					break;
				case "clear":
					this.writePosition = 0;
					this.readPosition = 0;
					this.samplesAvailable = 0;
					this.isPreBuffering = false;
					this.circularBuffer.fill(0);
					break;
			}
		};
	}

	// Add PCM data with smart pre-buffering for OpenAI deltas
	addAudioChunk(pcmData) {
		const samplesToWrite = pcmData.length;
		this.chunkCount++;
		this.totalSamples += samplesToWrite;
		this.lastChunkSize = samplesToWrite;

		// Prevent buffer overflow - drop old data if needed
		if (this.samplesAvailable + samplesToWrite > this.bufferSize) {
			const overflow = this.samplesAvailable + samplesToWrite - this.bufferSize;
			this.readPosition = (this.readPosition + overflow) % this.bufferSize;
			this.samplesAvailable -= overflow;

			this.port.postMessage({
				type: "buffer-overflow",
				droppedSamples: overflow,
				latencyMs: ((this.samplesAvailable / sampleRate) * 1000).toFixed(1),
				chunkPattern: `${this.chunkCount} chunks, avg ${(this.totalSamples / this.chunkCount).toFixed(0)} samples/chunk`,
			});
		}

		// Write to circular buffer
		for (let i = 0; i < samplesToWrite; i++) {
			this.circularBuffer[this.writePosition] = pcmData[i];
			this.writePosition = (this.writePosition + 1) % this.bufferSize;
		}

		this.samplesAvailable += samplesToWrite;

		// Smart pre-buffering logic for OpenAI deltas
		const isSmallChunk = samplesToWrite < 500; // Likely OpenAI delta
		const isLargeChunk = samplesToWrite > 1000; // Likely Twilio chunk

		// If we get a small chunk and we're not playing, start pre-buffering
		if (
			isSmallChunk &&
			!this.isPlaying &&
			this.samplesAvailable < this.minBufferSize
		) {
			this.isPreBuffering = true;
			this.port.postMessage({
				type: "pre-buffering",
				samplesAvailable: this.samplesAvailable,
				minBufferSize: this.minBufferSize,
				progress: ((this.samplesAvailable / this.minBufferSize) * 100).toFixed(
					1,
				),
			});
		}

		// If we have enough buffer OR we get a large chunk, we can start playing
		if (
			this.isPreBuffering &&
			(this.samplesAvailable >= this.minBufferSize || isLargeChunk)
		) {
			this.isPreBuffering = false;
			this.port.postMessage({
				type: "pre-buffer-complete",
				samplesBuffered: this.samplesAvailable,
				readyToPlay: true,
			});
		}

		// Enhanced reporting with chunk pattern analysis
		const latencyMs = ((this.samplesAvailable / sampleRate) * 1000).toFixed(1);
		const avgChunkSize = (this.totalSamples / this.chunkCount).toFixed(0);

		// Determine likely audio source based on chunk size patterns
		let likelySource = "unknown";
		if (isSmallChunk) {
			likelySource = "openai"; // Small deltas
		} else if (isLargeChunk) {
			likelySource = "twilio"; // Larger chunks
		}

		this.port.postMessage({
			type: "chunk-added",
			samplesAvailable: this.samplesAvailable,
			chunkSize: samplesToWrite,
			latencyMs: latencyMs,
			avgChunkSize: avgChunkSize,
			likelySource: likelySource,
			totalChunks: this.chunkCount,
			isPreBuffering: this.isPreBuffering,
			bufferHealth:
				this.samplesAvailable >= this.minBufferSize ? "healthy" : "low",
		});
	}

	// Process audio with smart pre-buffering to prevent cut-off and choppiness
	process(inputs, outputs, parameters) {
		const output = outputs[0];
		const channelData = output[0];
		const bufferSize = channelData.length;

		// Don't play during pre-buffering phase OR if not enough samples
		if (!this.isPlaying || this.isPreBuffering || this.samplesAvailable === 0) {
			channelData.fill(0);
			return true;
		}

		// Additional safety check: maintain minimum buffer level during playback
		const minPlaybackBuffer = 2400; // 50ms safety buffer during playback
		if (this.samplesAvailable < minPlaybackBuffer) {
			// If buffer gets too low during playback, output silence to let it recover
			channelData.fill(0);
			return true;
		}

		// Fill output with available samples
		for (let i = 0; i < bufferSize; i++) {
			if (this.samplesAvailable > minPlaybackBuffer) {
				channelData[i] = this.circularBuffer[this.readPosition];
				this.readPosition = (this.readPosition + 1) % this.bufferSize;
				this.samplesAvailable--;
			} else {
				// Stop consuming if we're getting too close to empty
				channelData[i] = 0;
			}
		}

		return true;
	}

	static get parameterDescriptors() {
		return [];
	}
}

registerProcessor("audio-stream-processor", AudioStreamProcessor);
