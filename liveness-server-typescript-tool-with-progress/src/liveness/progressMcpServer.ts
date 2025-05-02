import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { CallToolRequestSchema, CallToolResult, ErrorCode, ListToolsRequestSchema, ListToolsResult, McpError, ServerNotification, ServerRequest, Tool } from "@modelcontextprotocol/sdk/types.js";
import { AnyZodObject, z, ZodRawShape, ZodType, ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
const EMPTY_OBJECT_JSON_SCHEMA = {
  type: "object" as const,
};
export type ToolCallbackWithProgress<Args extends undefined | ZodRawShape = undefined> = Args extends ZodRawShape ? (args: z.objectOutputType<Args, ZodTypeAny>, progressToken: string|number| undefined, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => CallToolResult | Promise<CallToolResult> : (progressToken: string|number| undefined, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => CallToolResult | Promise<CallToolResult>;
export type RegisteredToolWithProgress = {
  description?: string;
  inputSchema?: AnyZodObject;
  annotations?: ToolAnnotations;
  callback: ToolCallbackWithProgress<undefined | ZodRawShape>;
  enabled: boolean;
  enable(): void;
  disable(): void;
  update<Args extends ZodRawShape>(updates: { name?: string | null, description?: string, paramsSchema?: Args, callback?: ToolCallbackWithProgress<Args>, annotations?: ToolAnnotations, enabled?: boolean }): void
  remove(): void
};

export class ProgressMcpServer extends McpServer {
  
  private _registeredToolsProgressServer: { [name: string]: RegisteredToolWithProgress } = {};
  private _toolHandlersInitializedProgressServer = false;
  toolWithProgress(name: string, ...rest: unknown[]): RegisteredToolWithProgress {
    if (this._registeredToolsProgressServer[name]) {
      throw new Error(`Tool ${name} is already registered`);
    }
    
    // Helper to check if an object is a Zod schema (ZodRawShape)
    const isZodRawShape = (obj: unknown): obj is ZodRawShape => {
      if (typeof obj !== "object" || obj === null) return false;
      // Check that at least one property is a ZodType instance
      return Object.values(obj as object).some(v => v instanceof ZodType);
    };

    let description: string | undefined;
    if (typeof rest[0] === "string") {
      description = rest.shift() as string;
    }

    let paramsSchema: ZodRawShape | undefined;
    let annotations: ToolAnnotations | undefined;
    
    // Handle the different overload combinations
    if (rest.length > 1) {
      // We have at least two more args before the callback
      const firstArg = rest[0];
      
      if (isZodRawShape(firstArg)) {
        // We have a params schema as the first arg
        paramsSchema = rest.shift() as ZodRawShape;
        
        // Check if the next arg is potentially annotations  
        if (rest.length > 1 && typeof rest[0] === "object" && rest[0] !== null && !(isZodRawShape(rest[0]))) {
          // Case: tool(name, paramsSchema, annotations, cb)
          // Or: tool(name, description, paramsSchema, annotations, cb)
          annotations = rest.shift() as ToolAnnotations;
        }
      } else if (typeof firstArg === "object" && firstArg !== null) {
        // Not a ZodRawShape, so must be annotations in this position
        // Case: tool(name, annotations, cb)
        // Or: tool(name, description, annotations, cb)
        annotations = rest.shift() as ToolAnnotations;
      }
    }

    const cb = rest[0] as ToolCallbackWithProgress<ZodRawShape | undefined>;
    const registeredTool: RegisteredToolWithProgress = {
      description,
      inputSchema:
        paramsSchema === undefined ? undefined : z.object(paramsSchema),
      annotations,
      callback: cb,
      enabled: true,
      disable: () => registeredTool.update({ enabled: false }),
      enable: () => registeredTool.update({ enabled: true }),
      remove: () => registeredTool.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          delete this._registeredToolsProgressServer[name]
          if (updates.name) this._registeredToolsProgressServer[updates.name] = registeredTool
        }
        if (typeof updates.description !== "undefined") registeredTool.description = updates.description
        if (typeof updates.paramsSchema !== "undefined") registeredTool.inputSchema = z.object(updates.paramsSchema)
        if (typeof updates.callback !== "undefined") registeredTool.callback = updates.callback
        if (typeof updates.annotations !== "undefined") registeredTool.annotations = updates.annotations
        if (typeof updates.enabled !== "undefined") registeredTool.enabled = updates.enabled
        this.sendToolListChanged()
      },
    };
    this._registeredToolsProgressServer[name] = registeredTool;

    this.setToolRequestHandlersProgressServer();
    this.sendToolListChanged()

    return registeredTool
  }
  private setToolRequestHandlersProgressServer() {
    if (this._toolHandlersInitializedProgressServer) {
      return;
    }
    
    this.server.assertCanSetRequestHandler(
      ListToolsRequestSchema.shape.method.value,
    );
    this.server.assertCanSetRequestHandler(
      CallToolRequestSchema.shape.method.value,
    );

    this.server.registerCapabilities({
      tools: {
        listChanged: true
      }
    })

    this.server.setRequestHandler(
      ListToolsRequestSchema,
      (): ListToolsResult => ({
        tools: Object.entries(this._registeredToolsProgressServer).filter(
          ([, tool]) => tool.enabled,
        ).map(
          ([name, tool]): Tool => {
            return {
              name,
              description: tool.description,
              inputSchema: tool.inputSchema
                ? (zodToJsonSchema(tool.inputSchema, {
                    strictUnions: true,
                  }) as Tool["inputSchema"])
                : EMPTY_OBJECT_JSON_SCHEMA,
              annotations: tool.annotations,
            };
          },
        ),
      }),
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request, extra): Promise<CallToolResult> => {
        const tool = this._registeredToolsProgressServer[request.params.name];
        if (!tool) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Tool ${request.params.name} not found`,
          );
        }

        if (!tool.enabled) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Tool ${request.params.name} disabled`,
          );
        }

        if (tool.inputSchema) {
          const parseResult = await tool.inputSchema.safeParseAsync(
            request.params.arguments,
          );
          if (!parseResult.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid arguments for tool ${request.params.name}: ${parseResult.error.message}`,
            );
          }

          const args = parseResult.data;
          const cb = tool.callback as ToolCallbackWithProgress<ZodRawShape>;
          try {
            return await Promise.resolve(cb(args, request.params._meta?.progressToken, extra));
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : String(error),
                },
              ],
              isError: true,
            };
          }
        } else {
          const cb = tool.callback as ToolCallbackWithProgress<undefined>;
          try {
            return await Promise.resolve(cb(request.params._meta?.progressToken, extra));
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : String(error),
                },
              ],
              isError: true,
            };
          }
        }
      },
    );
    this._toolHandlersInitializedProgressServer = true;
  }

}
