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
  "start_livenss_authentication",
  "Start new a liveness face authentication session.  \
  Return the url for user to perform the authentication session.  The user will needs to be instructed to visit the url and perform the session on their phone. \
  After the user perform the session, call get_liveness_result to retrieve the result.",
  {
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "Please visit url to continue: https://liveness.session.test.com/?sessionId=28472mic82nmx",
        },
      ],
    };
  },
);

server.tool(
  "get_liveness_result",
  "Get the result of liveness session",
  {
    sessionId: z.string().describe("sessionId: the session id in the url"),
  },
  async ({ sessionId }) => {
    const randomNumber = randomInt(0, 4); // Generates a random number between 0 and 3
    let resultText: string;
    if (randomNumber > 0) {
      resultText = `${sessionId} not performed yet. Please visit the URL and perform the session.`;
    } else {
      resultText = `${sessionId} is a real person.`;
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