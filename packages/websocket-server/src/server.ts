import { readFileSync } from 'node:fs';
import http, { type IncomingMessage } from 'node:http';
import { join } from 'node:path';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { type WebSocket, WebSocketServer } from 'ws';
import functions from './functionHandlers';
import {
  getActiveSessions,
  handleCallConnection,
  handleFrontendConnection,
} from './sessionManager';

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || '8081', 10);
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Twilio client
let twilioClient: any = null;
try {
  // Dynamically import Twilio to handle cases where it might not be installed
  const twilio = require('twilio');
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized for outbound calls');
  } else {
    console.warn('Twilio credentials not provided - outbound calling disabled');
  }
} catch (error) {
  console.warn(
    'Twilio package not found - outbound calling disabled. Run: bun add twilio'
  );
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const twimlPath = join(__dirname, 'twiml.xml');
const twimlTemplate = readFileSync(twimlPath, 'utf-8');

app.get('/public-url', (req, res) => {
  res.json({ publicUrl: PUBLIC_URL });
});

app.all('/twiml', (req, res) => {
  const wsUrl = new URL(PUBLIC_URL);
  wsUrl.protocol = 'wss:';
  wsUrl.pathname = '/call';

  const twimlContent = twimlTemplate.replace('{{WS_URL}}', wsUrl.toString());
  res.type('text/xml').send(twimlContent);
});

// New endpoint to list available tools (schemas)
app.get('/tools', (req, res) => {
  res.json(functions.map((f) => f.schema));
});

// Endpoint to get active call sessions
app.get('/sessions', (req, res) => {
  res.json({ sessions: getActiveSessions() });
});

// Endpoint to make outbound calls
app.post('/make-call', async (req, res) => {
  const { to } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  if (!twilioClient) {
    return res.status(503).json({
      error:
        'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables and install the twilio package.',
    });
  }

  if (!TWILIO_PHONE_NUMBER) {
    return res.status(503).json({
      error: 'TWILIO_PHONE_NUMBER environment variable is required',
    });
  }

  try {
    console.log(`Making outbound call from ${TWILIO_PHONE_NUMBER} to: ${to}`);

    // Create the webhook URL that Twilio will call
    const webhookUrl = new URL('/twiml', PUBLIC_URL).toString();

    // Make the outbound call using Twilio
    const call = await twilioClient.calls.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      url: webhookUrl,
      statusCallback: `${PUBLIC_URL}/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: false, // Disable recording for privacy
      timeout: 30, // Ring for 30 seconds before giving up
    });

    console.log(`Outbound call initiated successfully. Call SID: ${call.sid}`);

    res.json({
      success: true,
      message: `Call initiated to ${to}`,
      callSid: call.sid,
      status: call.status,
      from: TWILIO_PHONE_NUMBER,
      to,
    });
  } catch (error) {
    console.error('Error making outbound call:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to initiate call',
      details: errorMessage,
    });
  }
});

// Endpoint to handle call status callbacks from Twilio
app.post('/call-status', (req, res) => {
  const { CallSid, CallStatus, From, To } = req.body;
  console.log(
    `Call status update - SID: ${CallSid}, Status: ${CallStatus}, From: ${From}, To: ${To}`
  );
  res.status(200).send('OK');
});

// Track active call connections
const activeCallConnections = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length < 1) {
    ws.close();
    return;
  }

  const type = parts[0];
  if (type === 'call') {
    // Allow multiple simultaneous call connections
    activeCallConnections.add(ws);
    const sessionId = handleCallConnection(ws, OPENAI_API_KEY);
    console.log(`New call connection established, session: ${sessionId}`);

    ws.on('close', () => {
      activeCallConnections.delete(ws);
      console.log(`Call connection closed, session: ${sessionId}`);
    });
  } else if (type === 'logs') {
    // Still only allow one monitoring connection for simplicity
    handleFrontendConnection(ws);
    console.log('Frontend monitoring connection established');
  } else {
    console.log(`Unknown connection type: ${type}`);
    ws.close();
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
