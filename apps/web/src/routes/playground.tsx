import { createFileRoute } from "@tanstack/react-router";
import CallInterface from "@/components/call-interface";

export const Route = createFileRoute("/playground")({
	component: PlaygroundPage,
});

function PlaygroundPage() {
	return <CallInterface />;
}
