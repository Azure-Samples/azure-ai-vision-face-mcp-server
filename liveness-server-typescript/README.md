# azure-ai-vision-face-mcp-server-preview
to use it:
go to liveness-server-typescript folder, run
```
$ npm run build
```
then in the build folder, you have index.js
VS Code is configured with mcp.json, just add the keys
Sample Claude config should be:


```
{
  "mcpServers": {
    "liveness-server": {
      "command": "node",
      "args": ["YOUR_PATH/build/index.js"],
      "env": {
                "FACEAPI_ENDPOINT": "apiendpoint",
                "FACEAPI_KEY": "apikey",
                "FACEAPI_WEBSITE": "https://yourexample.azurewebsites.net"
        }
    }
  }
}

```