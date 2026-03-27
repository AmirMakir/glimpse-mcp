#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { loadConfig } from './config.js';

async function main() {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Glimpse MCP server started');
  if (config.port) console.error(`  Configured port: ${config.port}`);
}

main().catch((error) => {
  console.error('Failed to start Glimpse:', error);
  process.exit(1);
});
