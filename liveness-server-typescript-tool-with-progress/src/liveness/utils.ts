import { LivenessMode, LivenessResult } from "./common.js";

export function livenessVerificationSuccess(livenessResult: LivenessResult, action: LivenessMode): boolean {
    let livenessDecision: boolean | undefined;
    let verifyDecision: boolean | undefined;
    if(livenessResult.livenessDecision == "realface") {
      livenessDecision = true;
    }
    else if(livenessResult.livenessDecision == "spoofface") {
      livenessDecision = false;
    }
    if(action == LivenessMode.DetectLivenessWithVerify) {
      verifyDecision = livenessResult.verifyMatchDecision;
    }
    if((livenessDecision) && (verifyDecision == undefined || verifyDecision == true)){
        return true;
    }
    return false;
}

export function livenessResultToText(livenessResult:LivenessResult, action: LivenessMode): string {
    let resultText: string;
    if(livenessVerificationSuccess(livenessResult, action)) {
        resultText = `${livenessResult.sessionId} is a real person.`
        if(action == LivenessMode.DetectLivenessWithVerify) {
            resultText += "\nThe verify image is a match."
        }
    }
    else {
        resultText = `${livenessResult.sessionId} failed the liveness check.`
    }
    return resultText;
}