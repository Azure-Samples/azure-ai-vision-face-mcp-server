import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
import { LivenessMode } from "./common.js";
import { startLivenessFunc } from "./startLiveness.js";
import { getLivenessResultFunc } from "./getLivenessResult.js";

const randomGuidID = uuidv4();

const FACEAPI_ENDPOINT = process.env.FACEAPI_ENDPOINT??"";
const FACEAPI_KEY = process.env.FACEAPI_KEY?? "";
const FACEAPI_WEBSITE = process.env.FACEAPI_WEBSITE??"";
const sessionImageDir = process.env.SESSION_IMAGE_DIR??"";
const verifyImageFile = process.env.VERIFY_IMAGE_FILE_NAME??"";

const server = new McpServer({
  name: "liveness-server",
  version: "0.0.1",
});

let startLivenessToolName = "startLivenessAuthentication";
let getLivenessResultToolName = "getLivenessResult";

let action: LivenessMode;
if(verifyImageFile == "") {
  action = LivenessMode.DetectLiveness;
}
else {
  action = LivenessMode.DetectLivenessWithVerify;
}

server.tool(
  startLivenessToolName,
  "Start new a liveness face authentication session without verify.  \n \
  @return {string} the url generated for the user to perform the authentication session without verify.",
  {
  },
  async () => {return await startLivenessFunc(FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE, action, randomGuidID, getLivenessResultToolName, verifyImageFile);},
);

server.tool(
  getLivenessResultToolName,
  `Get the result of liveness session without verify. \n \
   @param sessionId {string} the session id in the url. \n \
   @return {string} if the person is real or spoof.`,
  {
    sessionId: z.string().describe("sessionId: the session id in the url"),
  },
  async ({ sessionId}) =>{return await getLivenessResultFunc(FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE, sessionImageDir, sessionId, action);},
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