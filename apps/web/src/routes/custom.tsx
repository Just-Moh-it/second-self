import { api } from "@second-self/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useRef, useState } from "react";
import {
	COMPONENT_POSITIONS,
	ReactInfiniteCanvas,
	type ReactInfiniteCanvasHandle,
} from "react-infinite-canvas";
import { Controls } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { Workflow } from "@/components/workflow";

export const Route = createFileRoute("/custom")({
	component: App,
});

function App() {
	const canvasRef = useRef<ReactInfiniteCanvasHandle | null>(null);
	const [isSending, setIsSending] = useState(false);
	const sendTest = useAction(api.sendblue.sendTest);

	return (
		<div className="h-svh w-svw">
			<ReactInfiniteCanvas
				ref={canvasRef}
				onCanvasMount={(canvasFunc) => {
					canvasFunc.fitContentToView({ scale: 0.5 });
				}}
				customComponents={[
					{
						component: (
							<Controls
								getCanvasState={() => {
									return canvasRef.current?.getCanvasState();
								}}
							/>
						),
						position: COMPONENT_POSITIONS.BOTTOM_LEFT,
						offset: { x: 20, y: 20 },
					},
					{
						component: (
							<div className="flex items-center gap-2">
								<Button
									type="button"
									disabled={isSending}
									onClick={async () => {
										setIsSending(true);
										try {
											await sendTest({ to: "craftymohit@gmail.com" });
										} catch (_err) {
											// Intentionally ignore to avoid console usage per lint rules
										} finally {
											setIsSending(false);
										}
									}}
								>
									{isSending ? "Sending..." : "Send Test Message"}
								</Button>
							</div>
						),
						position: COMPONENT_POSITIONS.TOP_RIGHT,
						offset: { x: 20, y: 20 },
					},
				]}
			>
				<Workflow />
			</ReactInfiniteCanvas>
		</div>
	);
}

export default App;
