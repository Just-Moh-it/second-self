import { createServerFileRoute } from '@tanstack/react-start/server';

export const ServerRoute = createServerFileRoute('/api/twilio/webhook-local').methods({
  GET: () => {
    return Response.json({ webhookUrl: process.env.TWILIO_WEBHOOK_URL });
  },
});
