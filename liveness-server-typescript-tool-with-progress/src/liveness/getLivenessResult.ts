import { LivenessMode, LivenessResult } from "./common.js";
import { promisify } from 'util';
import fs from 'fs';

export async function getLivenessResult(
  faceapiEndpoint: string, 
  faceapiKey: string, 
  sessionImageDir: string,
  sessionId: string, 
  action: LivenessMode): Promise<LivenessResult>{
    const res = await fetch(`https://${faceapiEndpoint}.cognitiveservices.azure.com/face/v1.2/${action}-sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': faceapiKey,
      },
    });
    const json = await res.json();
    const status = json.status??"";
    if (status != "Succeeded") {
      return {sessionId: sessionId, status: status};
    }
    
  const livenessDecision = json.results?.attempts[0]?.result?.livenessDecision??"";
  const sessionImageId = json.results?.attempts[0]?.result?.sessionImageId??"";
  if(sessionImageId != ""){
    const resImage = await fetch(`https://${faceapiEndpoint}.cognitiveservices.azure.com/face/v1.2/sessionImages/${sessionImageId}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': faceapiKey,
      },
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
  if(action == LivenessMode.DetectLivenessWithVerify) {
    const verifyDecision = json.results?.attempts[0]?.result?.verifyResult?.isIdentical??"";
    return {sessionId: sessionId, status: status, livenessDecision: livenessDecision, verifyMatchDecision: verifyDecision};
  }
  else{
    return {sessionId: sessionId, status: status, livenessDecision: livenessDecision};
  }
};