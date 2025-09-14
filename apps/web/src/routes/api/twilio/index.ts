import { createServerFileRoute } from '@tanstack/react-start/server';

export const ServerRoute = createServerFileRoute('/api/twilio/').methods({
  GET: () => {
    const credentialsSet = Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    );
    return Response.json({ credentialsSet });
  },
});
