// Since types.ts was reverted, we need to define the types here temporarily
type FunctionSchema = {
  name: string;
  type: 'function';
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
};

type FunctionHandler = {
  schema: FunctionSchema;
  callType: 'backend' | 'frontend_input';
  handler?: (
    args: unknown,
    context?: { sessionId: string }
  ) => Promise<string> | string;
};

const functions: FunctionHandler[] = [];

// Backend-only functions (execute immediately without user input)
functions.push({
  schema: {
    name: 'end_call',
    type: 'function',
    description: 'End the current phone call',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for ending the call',
        },
      },
      required: [],
    },
  },
  callType: 'backend',
  handler: async (
    args: { reason?: string },
    context?: { sessionId: string }
  ) => {
    console.log(
      'Ending call with reason:',
      args.reason || 'No reason provided'
    );

    if (context?.sessionId) {
      // Import the session termination function
      const { terminateCall } = await import('./sessionManager');
      await terminateCall(
        context.sessionId,
        args.reason || 'Call completed successfully'
      );
    }

    return JSON.stringify({
      status: 'call_ended',
      reason: args.reason || 'Call completed successfully',
    });
  },
});

// Backend function for pressing keypad buttons (DTMF navigation)
functions.push({
  schema: {
    name: 'press_keypad',
    type: 'function',
    description:
      'Press a keypad button to navigate phone menus or automated systems. Use this when prompted to "press 1 for English", "press 0 for operator", etc. Common in phone menu navigation.',
    parameters: {
      type: 'object',
      properties: {
        digit: {
          type: 'string',
          description:
            'The keypad button to press. Valid options: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, *, #. Examples: "1" for English, "0" for operator, "*" to go back, "#" to confirm',
        },
      },
      required: ['digit'],
    },
  },
  callType: 'backend',
  handler: async (args: { digit: string }, context?: { sessionId: string }) => {
    const validDigits = [
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '*',
      '#',
    ];

    if (!validDigits.includes(args.digit)) {
      return JSON.stringify({
        error: `Invalid keypad digit "${args.digit}". Valid options: ${validDigits.join(', ')}`,
      });
    }

    if (!context?.sessionId) {
      return JSON.stringify({
        error: 'Session ID required to send keypad input',
      });
    }

    try {
      // Import sendDTMF function from sessionManager
      const { sendDTMF } = await import('./sessionManager');
      await sendDTMF(context.sessionId, args.digit);

      console.log(
        `Sent DTMF digit "${args.digit}" for session ${context.sessionId}`
      );

      return JSON.stringify({
        status: 'success',
        message: `Pressed keypad button "${args.digit}"`,
        digit: args.digit,
      });
    } catch (error) {
      console.error('Error sending DTMF:', error);
      return JSON.stringify({
        error: `Failed to press keypad button: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

// Frontend-input functions (require user input before execution)
functions.push({
  schema: {
    name: 'get_more_information',
    type: 'function',
    description:
      "Call this function when the other person on the call asks for information that you don't have or need to confirm with your customer. This will pause the conversation while you get the information from your customer, then you can continue the call with the provided information.",
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description:
            'The exact piece of information you need to ask your customer for. Be specific and clear. Examples: "Social Security number", "Date of birth", "Full legal name", "Previous address", "Phone number", "Email address", "Driver license number"',
        },
        context: {
          type: 'string',
          description:
            'Explain to your customer why this information is needed and who is asking for it. Examples: "Austin Energy needs this to set up your account", "Required for identity verification", "The utility company needs this for billing purposes", "This is needed to complete your service application"',
        },
      },
      required: ['question', 'context'],
    },
  },
  callType: 'frontend_input',
  // No handler - frontend will collect input and send back response
});

export default functions;
