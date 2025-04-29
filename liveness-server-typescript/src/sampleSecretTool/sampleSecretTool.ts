
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ProgressMcpServer, RegisteredToolWithProgress } from "../liveness/progressMcpServer.js";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";

export function setupSampleSecretTool(livenessServer: ProgressMcpServer): RegisteredToolWithProgress {
    //sample secret tool
    let sampleSecretTool = livenessServer.toolWithProgress(
      "sampleSecretTool",
      `This is a sample secret tool. It hides behind a liveness authentication successful session.`,
      {},
      async({}: any, progressToken: string|number|undefined,extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        return {
          content: [
            {
              type: "text",
              text: `This is a sample secret tool. It hides behind a liveness authentication successful session.`,
            },
          ],
        };
      }
    );
    sampleSecretTool.disable();
    return sampleSecretTool;
}