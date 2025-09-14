import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({
			to: "/conversation/$conversationId",
			params: { conversationId: "1" },
		});
	},
});
