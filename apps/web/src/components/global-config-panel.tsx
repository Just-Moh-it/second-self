"use client";

import { DEFAULT_SESSION_CONFIG } from "@second-self/websocket-server/src/constants";
import { useId, useState } from "react";
import type { SessionConfig } from "@/components/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type GlobalConfigPanelProps = {
	onSave: (config: SessionConfig) => void;
	ws: WebSocket | null;
};

// Use the shared default configuration from backend

const GlobalConfigPanel = ({ onSave, ws }: GlobalConfigPanelProps) => {
	const instructionsId = useId();
	const voiceId = useId();
	const [config, setConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);

	const handleSave = () => {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		setIsSaving(true);

		try {
			// Send to backend
			onSave(config);
			setLastSaved(new Date());
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Card className="mb-4">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="font-semibold text-lg">
							Global Agent Configuration
						</CardTitle>
						<p className="mt-1 text-gray-600 text-sm">
							This configuration applies to all new incoming calls
						</p>
					</div>
					<div className="flex items-center gap-3">
						{lastSaved && (
							<span className="text-gray-500 text-sm">
								Last saved: {lastSaved.toLocaleTimeString()}
							</span>
						)}
						<Button
							className="bg-blue-600 hover:bg-blue-700"
							disabled={isSaving || !ws || ws.readyState !== WebSocket.OPEN}
							onClick={handleSave}
						>
							{isSaving ? "Saving..." : "Save Global Config"}
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div>
						<label
							className="mb-2 block font-medium text-sm"
							htmlFor={instructionsId}
						>
							Agent Instructions
						</label>
						<Textarea
							className="h-32 font-mono text-sm"
							id={instructionsId}
							onChange={(e) =>
								setConfig((prev) => ({ ...prev, instructions: e.target.value }))
							}
							placeholder="Enter instructions for the AI agent..."
							value={config.instructions}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								className="mb-2 block font-medium text-sm"
								htmlFor={voiceId}
							>
								Voice
							</label>
							<select
								className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								id={voiceId}
								onChange={(e) =>
									setConfig((prev) => ({ ...prev, voice: e.target.value }))
								}
								value={config.voice}
							>
								<option value="alloy">Alloy</option>
								<option value="ash">Ash</option>
								<option value="ballad">Ballad</option>
								<option value="coral">Coral</option>
								<option value="echo">Echo</option>
								<option value="fable">Fable</option>
								<option value="onyx">Onyx</option>
								<option value="nova">Nova</option>
								<option value="sage">Sage</option>
								<option value="shimmer">Shimmer</option>
								<option value="verse">Verse</option>
							</select>
						</div>

						<div>
							<span className="mb-2 block font-medium text-sm">
								Available Tools
							</span>
							<div className="rounded bg-muted p-2 text-muted-foreground text-sm">
								{config.tools.join(", ")}
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default GlobalConfigPanel;
