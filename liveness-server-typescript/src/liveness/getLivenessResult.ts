import { LivenessMode } from "./common.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { promisify } from 'util';
import fs from 'fs';

export const getLivenessResultFunc = async (faceapiEndpoint: string, faceapiKey: string, faceapiWebsite: string, sessionImageDir: string, sessionId: string, action: LivenessMode): Promise<CallToolResult> =>  {
    const res = await fetch(`https://${faceapiEndpoint}.cognitiveservices.azure.com/face/v1.2/${action}-sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': faceapiKey,
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
    const resImage = await fetch(`https://${faceapiEndpoint}.cognitiveservices.azure.com/face/v1.2/sessionImages/${sessionImageId}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': faceapiKey,
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
      resultText = "Failed to get the liveness result. Please check the session ID."
    }
    if(action == LivenessMode.DetectLivenessWithVerify) {
      const verifyDecision = json.results?.attempts[0]?.result?.verifyResult?.isIdentical??"";
      if(verifyDecision == true) {
        resultText += "\nThe verify image is a match."
      }
      else if(verifyDecision == false) {
        resultText = `${sessionId} authentication failed`
      }
      else {
        resultText = "Failed to get the verify result. Please check the session ID."
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