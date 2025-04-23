import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
const randomGuidID = uuidv4();

const FACEAPI_ENDPOINT = process.env.FACEAPI_ENDPOINT??"";
const FACEAPI_KEY = process.env.FACEAPI_KEY?? "";
const FACEAPI_WEBSITE = process.env.FACEAPI_WEBSITE??"";

// Create server instance
const server = new McpServer({
  name: "liveness-server",
  version: "1.0.0",
});

server.tool(
  "startLivenssAuthentication",
  "Start new a liveness face authentication session.  \n \
  @return {string} the url generated for the user to perform the authentication session.",
  {
  },
  async () => {
    if(FACEAPI_ENDPOINT == "" || FACEAPI_KEY == "" || FACEAPI_WEBSITE == "") {
      return {
        content: [
          {
            type: "text",
            text: `Please set the FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE environment variables for the liveness server.`,
          },
        ],
      };
    }

    const res = await fetch(`https://${FACEAPI_ENDPOINT}.cognitiveservices.azure.com/face/v1.2/detectLiveness-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': FACEAPI_KEY,
      },
      body: JSON.stringify({
        authTokenTimeToLiveInSeconds: 600,
        livenessOperationMode: "PassiveActive",
        sendResultsToClient: false,
        deviceCorrelationId: randomGuidID,
        enableSessionImage: true
      }),
    });
  
    const json = await res.json();
    const sessionId = json.sessionId?? "";
    const authToken = json.authToken?? "";

    if(sessionId == "" || authToken == "") {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create liveness session. Please check the FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE environment variables.`,
          },
        ],
      };
    }

    const res2 = await fetch(`${FACEAPI_WEBSITE}/api/s`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      }
    });

    const json2 = await res2.json();
    const shortUrlPostfix = json2.url?? "";

    if(shortUrlPostfix == "") {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create liveness session url. Please check the FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE environment variables.`,
          },
        ],
      };
    }

    const finalUrl = FACEAPI_WEBSITE + shortUrlPostfix;

    return {
      content: [
        {
          type: "text",
          text: `Show the following url to the user to perform the liveness session. The assigned session ID is ${sessionId}. \n \
                The user will needs to be instructed to visit the url and perform the liveness authentication session. 
                After the user perform the authentication, call getLivenessResult to retrieve the result. ${finalUrl}`,
        },
      ],
    };
  },
);

server.tool(
  "getLivenessResult",
  "Get the result of liveness session. \n \
   @param sessionId {string} the session id in the url. \n \
   @return {string} if the person is real or spoof.",
  {
    sessionId: z.string().describe("sessionId: the session id in the url"),
  },
  async ({ sessionId }) => {
    
    const res = await fetch(`https://${FACEAPI_ENDPOINT}.cognitiveservices.azure.com/face/v1.2/detectLiveness-sessions/${sessionId}`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': FACEAPI_KEY,
      }
    });
    const json = await res.json();
    const status = json.status??"";
    if (status != "Succeeded") {
      return {
        content: [
          {
            type: "text",
            text: `The status of the session is ${status}. Please check the session ID.`,
          },
        ],
      };
    }
    
    const livenessDecisiondecision = json.results?.attempts[0]?.result?.livenessDecision??"";
    let resultText: string;
    if (livenessDecisiondecision == "realface") {
      resultText = `${sessionId} is a real person.`
    }
    else if(livenessDecisiondecision == "spoofface") {
      resultText = `${sessionId} failed the liveness check.`
    }
    else {
      resultText = `Failed to get the liveness result. Please check the session ID.`
    }
    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Liveness MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});