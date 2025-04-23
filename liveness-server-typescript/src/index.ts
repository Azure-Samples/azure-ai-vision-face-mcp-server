import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { randomInt } from "crypto"; // Use crypto for random number generation in Node.js
import express from "express"; // Import express for server functionality
const port = process.env.PORT || 3000

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
    const url = "https://liveness.session.test.com/?sessionId=28472mic82nmx";

    return {
      content: [
        {
          type: "text",
          text: `Show the following url to the user to perform the liveness session. 
                  The user will needs to be instructed to visit the url and perform the liveness authentication session. 
                  After the user perform the authentication, call getLivenessResult to retrieve the result. ${url}`,
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
    let resultText: string;
    // const getLivenessSessionResultResponse = await client.path(
    //   '/detectLiveness/singleModal/sessions/{sessionId}', 
    //   createLivenessSessionResponse.body.sessionId).get();

    // const livenessDecisiondecision = getLivenessSessionResultResponse.body.result?.response.body.livenessDecision;

    if (true) {
      resultText = `${sessionId} is a real person.`
    }
    else {
      resultText = `${sessionId} failed the liveness check.`
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

let transport: SSEServerTransport | null = null;
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World! This is a liveness server.");
}
);

app.get("/sse", (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  server.connect(transport);
});

app.post("/messages", (req, res) => {
  if (transport) {
    transport.handlePostMessage(req, res);
  }
});

app.listen(port);