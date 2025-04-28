import { LivenessMode } from "./common.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from 'fs/promises';
import { File } from 'fetch-blob/from.js';
//start the liveness result of the session.  Waiting for the Progress tracking in the MCP protocol to be implemented in the MCP clients so this method can also track the result.
//https://modelcontextprotocol.io/specification/2025-03-26#overview
export const startLivenessFunc = async (faceapiEndpoint: string, faceapiKey: string, faceapiWebsite: string, action: LivenessMode, deviceCorrelationId: string, getLivenessResultToolName:string, verifyImageFileName?: string): Promise<CallToolResult> => {
  if(faceapiEndpoint == "" || faceapiKey == "" || faceapiWebsite == "") {
    return {
      content: [
        {
          type: "text",
          text: `Please set the faceapiEndpoint, faceapiKey, faceapiWebsite environment variables for the liveness server.`,
        },
      ],
    };
  }
  let sessionBody;
  var sessionBodyBase = {
    authTokenTimeToLiveInSeconds: 600,
    livenessOperationMode: "PassiveActive",
    sendResultsToClient: false,
    deviceCorrelationId: deviceCorrelationId,
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
    'Ocp-Apim-Subscription-Key': faceapiKey,
  } as any;
  if(action == LivenessMode.DetectLiveness) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`https://${faceapiEndpoint}.cognitiveservices.azure.com/face/v1.2/${action}-sessions`, {
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
          text: `Failed to create liveness session. Please check the faceapiEndpoint, faceapiKey, faceapiWebsite environment variables.`,
        },
      ],
    };
  }

  const res2 = await fetch(`${faceapiWebsite}/api/s`, {
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
          text: `Failed to create liveness session url. Please check the faceapiEndpoint, faceapiKey, faceapiWebsite environment variables.`,
        },
      ],
    };
  }

  const finalUrl = faceapiWebsite + shortUrlPostfix;

  return {
    content: [
      {
        type: "text",
        text: `Show the following url to the user to perform the liveness session. \n \
              The user will needs to be instructed to visit the url ${finalUrl} and perform the liveness authentication session. 
              After the user perform the authentication, call ${getLivenessResultToolName} with the session ID ${sessionId} in the tools to retrieve the result.`,
      },
    ],
  };
};
