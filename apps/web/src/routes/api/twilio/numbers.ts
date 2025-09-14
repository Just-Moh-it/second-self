import { createServerFileRoute } from '@tanstack/react-start/server';
import twilioClient from '@/lib/twilio';

export const ServerRoute = createServerFileRoute('/api/twilio/numbers').methods(
  {
    GET: async () => {
      if (!twilioClient) {
        return Response.json(
          { error: 'Twilio client not initialized' },
          { status: 500 }
        );
      }

      const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list(
        {
          limit: 20,
        }
      );

      return Response.json(incomingPhoneNumbers);
    },
    POST: async ({ request }) => {
      if (!twilioClient) {
        return Response.json(
          { error: 'Twilio client not initialized' },
          { status: 500 }
        );
      }

      const { phoneNumberSid, voiceUrl } = await request.json();
      const incomingPhoneNumber = await twilioClient
        .incomingPhoneNumbers(phoneNumberSid)
        .update({ voiceUrl });

      return Response.json(incomingPhoneNumber);
    },
  }
);
