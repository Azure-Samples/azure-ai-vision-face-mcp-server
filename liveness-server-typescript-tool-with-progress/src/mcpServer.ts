import { v4 as uuidv4 } from 'uuid';
import { LivenessMode } from "./liveness/common.js";
import { startLivenessFunc } from "./liveness/startLiveness.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { livenessResultToText, livenessVerificationSuccess } from './liveness/utils.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export const livenessServer = new McpServer({
  name: "liveness-server",
  version: "0.0.1",
});

const deviceCorrelationId = uuidv4();
const FACEAPI_ENDPOINT = process.env.FACEAPI_ENDPOINT??"";
const FACEAPI_KEY = process.env.FACEAPI_KEY?? "";
const FACEAPI_WEBSITE = process.env.FACEAPI_WEBSITE??"";
const sessionImageDir = process.env.SESSION_IMAGE_DIR??"";
const verifyImageFile = process.env.VERIFY_IMAGE_FILE_NAME??"";

let action: LivenessMode;
if(verifyImageFile == "") {
  action = LivenessMode.DetectLiveness;
}
else {
  action = LivenessMode.DetectLivenessWithVerify;
}


livenessServer.tool(
  "startLivenessAuthentication",
`Start a new liveness face authentication session.`,
{},
    async (extra: any) => {
    console.warn("startLivenessAuthentication called with extra: ", extra);
    try {
      const livenessResult = await startLivenessFunc(FACEAPI_ENDPOINT, 
        FACEAPI_KEY, 
        FACEAPI_WEBSITE, 
        action, 
        deviceCorrelationId,
        verifyImageFile, 
        sessionImageDir,
        extra);

        if(livenessVerificationSuccess(livenessResult, action)) {
          //can have additional logic here to do something with the result
        }

        let resultText = livenessResultToText(livenessResult, action);
        return {
          content: [
            {
              type: "text",
              text: resultText,
            },
          ],
        };
    }
    catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error}`,
          },
        ],
      }
    }
    
    },
);