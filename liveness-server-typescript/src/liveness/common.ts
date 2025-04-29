export enum LivenessMode {
    DetectLiveness = 'detectLiveness',
    DetectLivenessWithVerify = 'detectLivenessWithVerify'
  }
  
export type LivenessResult = {
  sessionId: string;
  status: string;
  livenessDecision?: string;
  verifyMatchDecision?: boolean;
};