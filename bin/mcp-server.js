#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const mcpServerPath = path.join(__dirname, '..', 'dist', 'mcp-server', 'index.js');
const child = spawn('node', [mcpServerPath], { stdio: 'inherit' });

child.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
