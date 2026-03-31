#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

// 설정
const CONFIG_DIR = path.join(os.homedir(), '.llm-context-manager');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

const DB_PATH = path.join(CONFIG_DIR, 'context.db');

interface Config {
  githubToken?: string;
  projects: Record<string, { name: string; gistId: string; lastSync: string }>;
}

interface Session {
  date: string;
  title: string;
  tasks?: string[];
  codeChanges?: Array<{ file: string; change: string }>;
  errors?: Array<{ error: string; solution: string }>;
  decisions?: string[];
}

// 설정 로드/져장
function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  const defaultConfig: Config = { projects: {} };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  return defaultConfig;
}

function saveConfig(cfg: Config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getCachePath(gistId: string) {
  return path.join(CACHE_DIR, `${gistId}.md`);
}

// DB
function initDatabase() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, project_path TEXT, title TEXT. date TEXT,
    tasks TEXT, code_changes TEXT. errors TEXT. decisions TEXT. created_at TEXT
  )`);
  return db;
}

let _db: ReturnType<typeof initDatabase> | null = null;
function getDb() {
  if (!_db) _db = initDatabase();
  return _db;
}

let config = loadConfig();

// GitHub API
async function githubRequest(method: string, apiPath: string, token: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'LLM-Context-Manager',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createGist(token: string, projectName: string, content: string): Promise<string> {
  const response = await githubRequest('POST', '/gists', token, {
    description: `LLM Context: ${projectName}`,
    public: false,
    files: { 'context.md': { content } }
  });
  return response.id;
}

async function getGist(token: string, gistId: string): Promise<string> {
  const response = await githubRequest('GET', `/gists/${gistId}`, token);
  return response.files['context.md']?.content || '';
}
async function updateGist(token: string, gistId: string, content: string): Promise<void> {
  await githubRequest('PATCH', `/gists/${gistId}`, token, {
    files: { 'context.md': { content } }
  });
}

// 컨텍스트 파싱
function parseContext(content: string): { projectName: string; sessions: Session[] } {
  const lines = content.split('\n');
  const result = { projectName: '', sessions: [] as Session[] };
  let currentSession: Session | null = null;
  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('# Project:')) {
      result.projectName = line.replace('# Project:', '').trim();
    } else if (line.startsWith('## Session:')) {
      if (currentSession) result.sessions.push(currentSession);
      const match = line.match(/## Session:\s*(.+?)\s*\[(.+?)\]/);
      currentSession = {
        date: match?.[2] || new Date().toISOString().split('T')[0],
        title: match?.[1].trim() || 'Untitled',
        tasks: [],
        codeChanges: [],
        errors: [],
        decisions: []
      };
      currentSection = 'session';
    } else if (line.startsWith('### Tasks')) currentSection = 'tasks';
    else if (line.startsWith('### Code Changes')) currentSection = 'code';
    else if (line.startsWith('### Errors')) currentSection = 'errors';
    else if (line.startsWith('### Decisions')) currentSection = 'decisions';
    else if (line.startsWith('- ') && currentSession) {
      const item = line.slice(2);
      if (currentSection === 'tasks') currentSession.tasks!.push(item);
      else if (currentSection === 'code') {
        const [file, ...rest] = item.split(': ');
        currentSession.codeChanges!.push({ file: file || '', change: rest.join('') });
      } else if (currentSection === 'errors') {
        const [error, solution] = item.split(' → ');
        currentSession.errors!.push({ error: error || '', solution: solution || '' });
      } else if (currentSection === 'decisions') {
        currentSession.decisions!.push(item);
      }
    }
  }
  if (currentSession) result.sessions.push(currentSession);
  return result;
}

// 마크다운 생성
function generateMarkdown(projectName: string, sessions: Session[]): string {
  let md = `# Project: ${projectName}\n\n## Summary\n\n> 자동 생성된 개발 컨텍스트\n\n`;
  md += `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}\n\n`;

  for (const session of sessions.slice(-10)) {
    md += `---\n\n## Session: ${session.title || 'Untitled'} [${session.date}]\n\n`;
    if (session.tasks?.length) {
      md += `### Tasks\n${session.tasks.map(t => `- ${t}`).join('\n')}\n\n`;
    }
    if (session.codeChanges?.length) {
      md += `### Code Changes\n${session.codeChanges.map(c => `- ${c.file}: ${c.change}`).join('\n')}\n\n`;
    }
    if (session.errors?.length) {
      md += `### Errors & Solutions\n${session.errors.map(e => `- ${e.error} → ${e.solution}`).join('\n')}\n\n`;
    }
    if (session.decisions?.length) {
      md += `### Decisions\n${session.decisions.map(d => `- ${d}`).join('\n')}\n\n`;
    }
  }
  return md;
}

// MCP 서버
const server = new McpServer({ name: 'llm-context-manager', version: '2.0.0' });

// ============================================
// 도구들
// ============================================

// @ts-ignore
server.tool('set_github_token', 'GitHub Personal Access Token 설정 (gist 권한 필요)',
  { token: z.string() },
  async ({ token }) => {
    config.githubToken = token;
    saveConfig(config);
    return { content: [{ type: 'text', text: 'GitHub 토큰이 저장되었습니다.' }] };
  }
);

// @ts-ignore
server.tool('init_project', '새 프로젝트 컨텍스트 초기화',
  { projectPath: z.string(), projectName: z.string() },
  async ({ projectPath, projectName }) => {
    if (!config.githubToken) {
      return { content: [{ type: 'text', text: '먼저 set_github_token으로 토큰을 설정해주세요.' }] };
    }

    const initialContent = generateMarkdown(projectName, []);
    const gistId = await createGist(config.githubToken, projectName, initialContent);
    if (!gistId) {
      return { content: [{ type: 'text', text: 'Gist 생성 실패' }] };
    }

    config.projects[projectPath] = { name: projectName, gistId, lastSync: new Date().toISOString() };
    saveConfig(config);
    fs.writeFileSync(getCachePath(gistId), initialContent);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          projectName,
          gistId,
          message: '프로젝트 초기화 완료. gistId를 다른 컴퓨터에서 connect_project로 연결하세요.',
          gistUrl: `https://gist.github.com/${gistId}`
        }, null, 2)
      }]
    };
  }
);

// @ts-ignore
server.tool('connect_project', '기존 Gist ID로 프로젝트 연결',
  { projectPath: z.string(), gistId: z.string() },
  async ({ projectPath, gistId }) => {
    if (!config.githubToken) {
      return { content: [{ type: 'text', text: '먼저 set_github_token으로 토큰을 설정해주세요.' }] };
    }

    let content: string;
    try {
      content = await getGist(config.githubToken, gistId);
      fs.writeFileSync(getCachePath(gistId), content);
    } catch {
      const cachePath = getCachePath(gistId);
      if (!fs.existsSync(cachePath)) {
        return { content: [{ type: 'text', text: 'Gist를 찾을 수 없고 캐시도 없습니다.' }] };
      }
      content = fs.readFileSync(cachePath, 'utf-8');
    }

    const parsed = parseContext(content);
    config.projects[projectPath] = {
      name: parsed.projectName || 'Unknown',
      gistId,
      lastSync: new Date().toISOString()
    };
    saveConfig(config);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          projectName: parsed.projectName,
          sessionCount: parsed.sessions.length,
          gistUrl: `https://gist.github.com/${gistId}`
        }, null, 2)
      }]
    };
  }
);

// @ts-ignore
server.tool('get_context', '프로젝트 컨텍스트 조회',
  { projectPath: z.string() },
  async ({ projectPath }) => {
    const project = config.projects[projectPath];
    if (!project) {
      return { content: [{ type: 'text', text: '프로젝트를 찾을 수 없습니다.' }] };
    }

    let content: string;
    try {
      if (config.githubToken) {
        content = await getGist(config.githubToken, project.gistId);
        fs.writeFileSync(getCachePath(project.gistId), content);
      } else {
        content = fs.readFileSync(getCachePath(project.gistId), 'utf-8');
      }
    } catch {
      const cachePath = getCachePath(project.gistId);
      content = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf-8') : '# 컨텍스트 없음';
    }

    return { content: [{ type: 'text', text: content }] };
  }
);

// @ts-ignore
server.tool('add_session', '새 개발 세션 추가',
  {
    projectPath: z.string(),
    title: z.string(),
    tasks: z.array(z.string()).optional(),
    codeChanges: z.array(z.object({ file: z.string(), change: z.string() })).optional(),
    errors: z.array(z.object({ error: z.string(), solution: z.string() })).optional(),
    decisions: z.array(z.string()).optional()
  },
  async ({ projectPath, title, tasks = [], codeChanges = [], errors = [], decisions = [] }) => {
    const project = config.projects[projectPath];
    if (!project) {
      return { content: [{ type: 'text', text: '프로젝트를 찾을 수 없습니다.' }] };
    }
    if (!config.githubToken) {
      return { content: [{ type: 'text', text: 'GitHub 토큰이 없습니다.' }] };
    }

    const content = await getGist(config.githubToken, project.gistId);
    const parsed = parseContext(content);

    const newSession: Session = {
      date: new Date().toISOString().split('T')[0],
      title,
      tasks,
      codeChanges,
      errors,
      decisions
    };
    parsed.sessions.push(newSession);

    const newContent = generateMarkdown(project.name, parsed.sessions);
    await updateGist(config.githubToken, project.gistId, newContent);
    fs.writeFileSync(getCachePath(project.gistId), newContent);

    project.lastSync = new Date().toISOString();
    saveConfig(config);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          sessionTitle: title,
          totalSessions: parsed.sessions.length,
          gistUrl: `https://gist.github.com/${project.gistId}`
        }, null, 2)
      }]
    };
  }
);

// @ts-ignore
server.tool('update_summary', '프로젝트 요약 업데이트',
  { projectPath: z.string(), summary: z.string() },
  async ({ projectPath, summary }) => {
    const project = config.projects[projectPath];
    if (!project || !config.githubToken) {
      return { content: [{ type: 'text', text: '프로젝트를 찾을 수 없거나 토큰이 없습니다.' }] };
    }

    let content = await getGist(config.githubToken, project.gistId);
    const lines = content.split('\n');
    const newLines: string[] = [];
    let inSummary = false;

    for (const line of lines) {
      if (line.startsWith('## Summary')) {
        inSummary = true;
        newLines.push(line, '', summary);
        continue;
      }
      if (inSummary && line.startsWith('## ')) inSummary = false;
      if (!inSummary) newLines.push(line);
    }
    content = newLines.join('\n');
    await updateGist(config.githubToken, project.gistId, content);
    fs.writeFileSync(getCachePath(project.gistId), content);
    return { content: [{ type: 'text', text: '요약이 업데이트되었습니다.' }] };
  }
);

// @ts-ignore
server.tool('list_projects', '등록된 프로젝트 목록 조회', {},
  async () => {
    const projects = Object.entries(config.projects).map(([path, p]) => ({
      path,
      name: p.name,
      gistId: p.gistId,
      lastSync: p.lastSync,
      gistUrl: `https://gist.github.com/${p.gistId}`
    }));
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
  }
);

// @ts-ignore
server.tool('sync_context', '모든 프로젝트 동기화', {},
  async () => {
    if (!config.githubToken) {
      return { content: [{ type: 'text', text: 'GitHub 토큰이 없습니다.' }] };
    }
    const results = [];
    for (const [projectPath, project] of Object.entries(config.projects)) {
      try {
        const content = await getGist(config.githubToken, project.gistId);
        fs.writeFileSync(getCachePath(project.gistId), content);
        project.lastSync = new Date().toISOString();
        results.push({ projectPath, status: 'success' });
      } catch (e) {
        results.push({ projectPath, status: 'failed', error: String(e) });
      }
    }
    saveConfig(config);
    return { content: [{ type: 'text', text: JSON.stringify({ syncedAt: new Date().toISOString(), results }, null, 2) }] };
  }
);

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LLM Context Manager MCP Server v2.0.0 started');
}

main().catch(console.error);
