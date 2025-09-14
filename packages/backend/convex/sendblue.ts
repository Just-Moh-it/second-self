"use node";

import { v } from "convex/values";
import Sendblue from "sendblue";
import { action } from "./_generated/server";

export const sendTest = action({
	args: {
		to: v.optional(v.string()),
		message: v.optional(v.string()),
	},
	handler: async (_ctx, args) => {
		const apiKey = process.env.SENDBLUE_API_KEY;
		const apiSecret = process.env.SENDBLUE_API_SECRET;
		const defaultTo = process.env.SENDBLUE_TEST_TO;

		if (!apiKey || !apiSecret) {
			throw new Error(
				"SENDBLUE_API_KEY and SENDBLUE_API_SECRET must be set in environment",
			);
		}

		const to = args.to ?? defaultTo;
		if (!to) {
			throw new Error(
				"Provide 'to' or set SENDBLUE_TEST_TO environment variable for test sends",
			);
		}

		const message = args.message ?? "Hello from SendBlue via Convex!";

		const client = new Sendblue({ apiKey, apiSecret });

		const response = await client.messages.send({
			from_number: "+1 656 252 4906",
			content: message,
			number: to,
		});

		return response;
	},
});
