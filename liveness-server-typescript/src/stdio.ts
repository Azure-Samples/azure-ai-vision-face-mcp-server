import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { livenessServer } from "./mcpServer.js";
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await livenessServer.connect(transport);
    console.error("Liveness MCP Server running on stdio");
  }
  
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });