// Download the helper library from https://www.twilio.com/docs/node/install
import twilio from 'twilio'; // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createCall() {
  const call = await client.calls.create({
    from: '+15403854019',
    to: '+15409984745',
    twiml: `
      <Response>
        <Pause length="60"/>
        <Say>Thank you for calling. Please wait while we connect you to an agent. This is a test. Please hold on, and we will connect you right away. Please stay on the line, please stay on the line, please stay on the line</Say>
        <Hangup/>
      </Response>
    `,
  });

  console.log(call.sid);
}

createCall();
