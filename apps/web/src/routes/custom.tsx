import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import {
	COMPONENT_POSITIONS,
	ReactInfiniteCanvas,
	type ReactInfiniteCanvasHandle,
} from "react-infinite-canvas";
import { Controls } from "@/components/controls";
import { Workflow } from "@/components/workflow";

export const Route = createFileRoute("/custom")({
	component: App,
});

function App() {
	const canvasRef = useRef<ReactInfiniteCanvasHandle | null>(null);

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
				]}
			>
				<Workflow />
			</ReactInfiniteCanvas>
		</div>
	);
}

export default App;
