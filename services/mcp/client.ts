/**
 * MCP (Model Context Protocol) Client Manager
 * 
 * This is a foundation stub for future MCP integration.
 * The actual SDK will be installed when we begin Phase 3.
 */

interface MCPServer {
    id: string;
    name: string;
    command: string;
    args: string[];
    enabled: boolean;
}

interface MCPResource {
    uri: string;
    name: string;
    mimeType?: string;
}

class MCPManager {
    private servers: Map<string, MCPServer> = new Map();

    async connectServer(server: MCPServer): Promise<void> {
        // Stub: Will use @modelcontextprotocol/sdk when installed
        console.log(`[MCP] Server registered: ${server.name} (stub mode)`);
        this.servers.set(server.id, server);
    }

    async listResources(_serverId: string): Promise<MCPResource[]> {
        // Stub: Returns empty array until SDK is installed
        console.log('[MCP] listResources called (stub mode)');
        return [];
    }

    async readResource(_serverId: string, _uri: string): Promise<string> {
        // Stub: Returns empty content until SDK is installed
        console.log('[MCP] readResource called (stub mode)');
        return '';
    }

    async callTool(_serverId: string, _toolName: string, _args: any): Promise<any> {
        // Stub: Returns null until SDK is installed
        console.log('[MCP] callTool called (stub mode)');
        return null;
    }

    isConnected(serverId: string): boolean {
        return this.servers.has(serverId);
    }
}

export const mcpManager = new MCPManager();
