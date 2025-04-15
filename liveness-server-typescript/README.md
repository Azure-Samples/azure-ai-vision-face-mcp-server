# azure-ai-vision-face-mcp-server-preview
to use it:
go to liveness-server-typescript folder, run
$ npm run build

then in the build folder, you have index.js
there is a path issue in the built index.js, you need to change the first 2 lines to

import { McpServer } from "@modelcontextprotocol/sdk/esm/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/esm/server/sse.js";


Then you can right click liveness-server-typescript folder, select deploy to web app in visual studio code, and deploy it into a app service with node stack.



