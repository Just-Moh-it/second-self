import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/conversation/$conversationId")({
	component: ConversationPage,
});

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<
		Array<{ id: string; content: string; sender: "user" | "assistant" }>
	>([]);

	const handleSendMessage = () => {
		if (message.trim()) {
			const newMessage = {
				id: Date.now().toString(),
				content: message,
				sender: "user" as const,
			};
			setMessages((prev) => [...prev, newMessage]);
			setMessage("");

			// TODO: Integrate with your AI backend here
			// For now, just add a mock response
			setTimeout(() => {
				const response = {
					id: (Date.now() + 1).toString(),
					content: "I'm an AI assistant. How can I help you today?",
					sender: "assistant" as const,
				};
				setMessages((prev) => [...prev, response]);
			}, 1000);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const isNewConversation = conversationId === "new" || messages.length === 0;

	return (
		<div className="flex flex-col h-screen">
			{/* Main content area */}
			<div className="flex-1 overflow-hidden">
				{isNewConversation ? (
					<div className="h-full flex items-center justify-center p-8">
						<div className="text-center">
							<h2 className="text-2xl font-semibold text-foreground mb-2">
								Hey, let's start with your chat
							</h2>
							<p className="text-muted-foreground">
								{conversationId === "new"
									? "Start a new conversation below"
									: "Type a message to begin"}
							</p>
						</div>
					</div>
				) : (
					<div className="h-full overflow-y-auto p-4 space-y-4">
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
							>
								<div
									className={`max-w-[70%] rounded-lg px-4 py-2 ${
										msg.sender === "user"
											? "bg-primary text-primary-foreground"
											: "bg-muted text-foreground"
									}`}
								>
									{msg.content}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Input area at bottom */}
			<div className="border-t p-4 bg-background/80 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto">
					<div className="flex gap-2">
						<input
							type="text"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Type your message..."
							className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						/>
						<button
							type="button"
							onClick={handleSendMessage}
							disabled={!message.trim()}
							className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm font-medium"
						>
							Send
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
