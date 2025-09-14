import { Link } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

// Mock conversations data - this would come from your backend/state management
const conversations = [
	{ id: "1", name: "General Chat", lastMessage: "Hello there!" },
	{
		id: "2",
		name: "Project Discussion",
		lastMessage: "Let's talk about the new features",
	},
	{ id: "3", name: "Support Query", lastMessage: "I need help with..." },
];

export function AppSidebar() {
	return (
		<Sidebar variant="inset">
			<SidebarHeader>
				<div className="flex items-center gap-2 px-2 py-2">
					<MessageSquare className="h-6 w-6" />
					<span className="font-semibold text-lg">Panda Assist</span>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Conversations</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{conversations.map((conversation) => (
								<SidebarMenuItem key={conversation.id}>
									<SidebarMenuButton asChild>
										<Link
											to="/conversation/$conversationId"
											params={{ conversationId: conversation.id }}
											className="flex items-start gap-3"
										>
											<MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
											<div className="flex-1 min-w-0">
												<div className="font-medium truncate">
													{conversation.name}
												</div>
												<div className="text-sm text-muted-foreground truncate">
													{conversation.lastMessage}
												</div>
											</div>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link
								to="/conversation/$conversationId"
								params={{ conversationId: "new" }}
								className="flex items-center gap-2"
							>
								<Plus className="h-4 w-4" />
								New Conversation
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link to="/playground" className="flex items-center gap-2">
								Playground
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
