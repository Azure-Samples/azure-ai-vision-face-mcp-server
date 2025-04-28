import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { File } from 'fetch-blob/from.js';

const randomGuidID = uuidv4();

const FACEAPI_ENDPOINT = process.env.FACEAPI_ENDPOINT??"";
const FACEAPI_KEY = process.env.FACEAPI_KEY?? "";
const FACEAPI_WEBSITE = process.env.FACEAPI_WEBSITE??"";
//By default, the session image will be saved in the current user directory (~ or C:\Users\username). You can change it by setting the SESSION_IMAGE_DIR environment variable.
const sessionImageDir = process.env.SESSION_IMAGE_DIR??"";
const verifyImageFile = process.env.VERIFY_IMAGE_FILE_NAME??"";

enum LivenessMode {
  DetectLiveness = 'detectLiveness',
  DetectLivenessWithVerify = 'detectLivenessWithVerify'
}

const getLivenessResultDict: Record<LivenessMode, string> = {
  [LivenessMode.DetectLiveness]: "getLivenessResult",
  [LivenessMode.DetectLivenessWithVerify]: "getLivenessResultWithVerify",
};


const server = new McpServer({
  name: "liveness-server",
  version: "0.0.1",
});



const startLivenessFunc = async (action: LivenessMode, verifyImageFileName?: string): Promise<CallToolResult> => {
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
  let sessionBody;
  var sessionBodyBase = {
    authTokenTimeToLiveInSeconds: 600,
    livenessOperationMode: "PassiveActive",
    sendResultsToClient: false,
    deviceCorrelationId: randomGuidID,
    enableSessionImage: true
  } as any;
  
  if (action == LivenessMode.DetectLivenessWithVerify) {
    if (verifyImageFileName == undefined || verifyImageFileName == "") {
      return {
        content: [
          {
            type: "text",
            text: `Please provide the VERIFY_IMAGE_FILE_NAME.`,
          },
        ],
      };
    }
    var sessionCreationBody = new FormData();
    for (const key in sessionBodyBase) {
      sessionCreationBody.append(key, sessionBodyBase[key]);
    }
    const data = await readFile(verifyImageFileName);
    const file = new File([data], verifyImageFileName, {
      type: "application/octet-stream",
      lastModified: Date.now()
    });
    sessionCreationBody.append("VerifyImage", file, verifyImageFileName);
    sessionBody = sessionCreationBody;
  }
  else {
    sessionBody = JSON.stringify(sessionBodyBase);
  }

  let headers = {
    'Ocp-Apim-Subscription-Key': FACEAPI_KEY,
  } as any;
  if(action == LivenessMode.DetectLiveness) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`https://${FACEAPI_ENDPOINT}.cognitiveservices.azure.com/face/v1.2/${action}-sessions`, {
    method: 'POST',
    headers: headers,
    body: sessionBody,
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
        text: `Show the following url to the user to perform the liveness session. \n \
              The user will needs to be instructed to visit the url ${finalUrl} and perform the liveness authentication session. 
              After the user perform the authentication, call ${getLivenessResultDict[action]} with the session ID ${sessionId} to retrieve the result.`,
      },
    ],
  };
};


const getLivenessResultFunc = async (sessionId: string, action: LivenessMode): Promise<CallToolResult> =>  {
  const res = await fetch(`https://${FACEAPI_ENDPOINT}.cognitiveservices.azure.com/face/v1.2/${action}-sessions/${sessionId}`, {
    method: 'GET',
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
 const sessionImageId = json.results?.attempts[0]?.result?.sessionImageId??"";
 if(sessionImageId != ""){
  const resImage = await fetch(`https://${FACEAPI_ENDPOINT}.cognitiveservices.azure.com/face/v1.2/sessionImages/${sessionImageId}`, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': FACEAPI_KEY,
    }
  });
  if (resImage.ok) {
    if(sessionImageDir != "") {
      const buffer = await resImage.arrayBuffer();
      const writeFile = promisify(fs.writeFile);      
      const fileDir = sessionImageDir + "/" + sessionId;
      fs.mkdirSync(fileDir, { recursive: true });
      await writeFile(fileDir + "/sessionImage.jpg", Buffer.from(buffer));
    }
  }
 }
 
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
  if(action == LivenessMode.DetectLivenessWithVerify) {
    const verifyDecision = json.results?.attempts[0]?.result?.verifyResult?.isIdentical??"";
    if(verifyDecision == true) {
      resultText += `\n The verify image is a match.`
    }
    else if(verifyDecision == false) {
      resultText += `\n The verify image is not a match.`
    }
    else {
      resultText += `\n Failed to get the verify result. Please check the session ID.`
    }
  }
  return {
    content: [
      {
        type: "text",
        text: resultText,
      },
    ],
  };
};

if(verifyImageFile == "") {
  server.tool(
    "startLivenessAuthentication",
    "Start new a liveness face authentication session without verify.  \n \
    @return {string} the url generated for the user to perform the authentication session without verify.",
    {
    },
    async () => {return await startLivenessFunc(LivenessMode.DetectLiveness);},
  );

  server.tool(
    `${getLivenessResultDict[LivenessMode.DetectLiveness]}`,
    `Get the result of liveness session without verify. \n \
     @param sessionId {string} the session id in the url. \n \
     @return {string} if the person is real or spoof.`,
    {
      sessionId: z.string().describe("sessionId: the session id in the url"),
    },
    async ({ sessionId}) =>{return await getLivenessResultFunc(sessionId, LivenessMode.DetectLiveness);},
  );
}
else {
  server.tool(
    "startLivenessAuthenticationWithVerify",
    "Start new a liveness face authentication session with verify.  \n \
    @return {string} the url generated for the user to perform the authentication session with verify.",
    {
    },
    async () => {return await startLivenessFunc(LivenessMode.DetectLivenessWithVerify, verifyImageFile);},
  );

  server.tool(
    `${getLivenessResultDict[LivenessMode.DetectLivenessWithVerify]}`,
    `Get the result of liveness session with verify. \n \
     @param sessionId {string} the session id in the url. \n \
     @return {string} if the person is real or spoof with verify scores.`,
    {
      sessionId: z.string().describe("sessionId: the session id in the url"),
    },
    async ({ sessionId}) =>{return await getLivenessResultFunc(sessionId, LivenessMode.DetectLivenessWithVerify);},
  );
}






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