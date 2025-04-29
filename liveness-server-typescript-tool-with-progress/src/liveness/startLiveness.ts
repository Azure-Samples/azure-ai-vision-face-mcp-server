import { LivenessMode, LivenessResult } from "./common.js";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from 'fs/promises';
import { File } from 'fetch-blob/from.js';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {getLivenessResult} from "./getLivenessResult.js";

type LivenessPage = {
  sessionId: string;
  url: string;
};

async function getLivenessPageUrl(
  faceapiEndpoint: string, 
  faceapiKey: string, 
  faceapiWebsite: string, 
  action: LivenessMode, 
  deviceCorrelationId: string, 
  verifyImageFileName: string,
  abortSignal: AbortSignal): Promise<LivenessPage> {
    if(faceapiEndpoint == "" || faceapiKey == "" || faceapiWebsite == "") {
      throw new Error("Please set the FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE environment variables for the liveness server.");
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
        throw new Error("Please provide the VERIFY_IMAGE_FILE_NAME");
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
      signal: abortSignal,
    });
  
    
    const json = await res.json();
    const sessionId = json.sessionId?? "";
    const authToken = json.authToken?? "";
  
    if(sessionId == "" || authToken == "") {
      throw new Error("Failed to create liveness session. Please check the FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE environment variables.");
    }
  
    const res2 = await fetch(`${faceapiWebsite}/api/s`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      signal: abortSignal,
    });
  
    const json2 = await res2.json();
    const shortUrlPostfix = json2.url?? "";
  
    if(shortUrlPostfix == "") {
      throw new Error("Failed to create liveness session url. Please check the FACEAPI_ENDPOINT, FACEAPI_KEY, FACEAPI_WEBSITE environment variables.");
    }
  
    const finalUrl = faceapiWebsite + shortUrlPostfix;
    return {sessionId: sessionId, url: finalUrl};
}

export async function startLivenessFunc(
  faceapiEndpoint: string, 
  faceapiKey: string, 
  faceapiWebsite: string, 
  action: LivenessMode, 
  deviceCorrelationId: string, 
  verifyImageFileName: string,
  sessionImageDir: string,
  progressToken: string|number|undefined,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<LivenessResult> {
if(progressToken == undefined) {
  throw new Error("The client doesn't support MCP progress notifications.  Please use a supported client.");
};

let livenessPage: LivenessPage;
livenessPage = await getLivenessPageUrl(faceapiEndpoint, faceapiKey, faceapiWebsite, action, deviceCorrelationId, verifyImageFileName, extra.signal);

const returnTextProgress = `Please visit the url and perform the liveness authentication session:  ${livenessPage.url}`;
const notification: ServerNotification = {method: "notifications/progress", params: {progressToken: progressToken, progress: 0, message: returnTextProgress}};
extra.sendNotification(notification);

const wait = async(ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const maxTries = 600;//600 seconds if wait time is 1 second
const waitTime = 1000; //1 seconds
let livenessResult;
for(let i = 0; i < maxTries; i++) {
  await wait(waitTime);
  livenessResult = await getLivenessResult(faceapiEndpoint, faceapiKey, sessionImageDir, livenessPage.sessionId, action, extra.signal); 
  if(livenessResult.status == "Succeeded") {
    break;
  }
  if(extra.signal.aborted) {
    throw new Error("Aborted by the user.");
  }
  if((i+1) % 30 == 0) {
    const notification: ServerNotification = {method: "notifications/progress", params: {progressToken: progressToken, progress: 0, message: `${i}: Waiting for the liveness authentication session to complete.  ${livenessPage.url}`}};
    extra.sendNotification(notification).catch((error) => {
      console.error("Error sending notification:", error);
    });
  }
}

if(livenessResult?.status != "Succeeded") {
  throw new Error("Session time out or error");
}
else {
  return livenessResult;
}
};
