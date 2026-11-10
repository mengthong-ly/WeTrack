import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { connection } from "next/server"

import { asAgent } from "@/lib/agent"
import { mcpServer } from "@/lib/mcp-tools"

// The agent API as a stateless Streamable HTTP MCP server: a fresh server per request, JSON replies, no session id.
export async function POST(req: Request) {
  return asAgent(req, async () => {
    const server = mcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    try {
      return await transport.handleRequest(req)
    } finally {
      await server.close()
    }
  })
}

// No SSE stream and no sessions to end. connection() keeps this out of the build-time prerender.
async function notAllowed() {
  await connection()
  return Response.json(
    { error: "Method not allowed. POST JSON-RPC to /api/mcp." },
    { status: 405, headers: { Allow: "POST" } }
  )
}
export const GET = notAllowed
export const DELETE = notAllowed
