import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

const CONFIG_DIR = path.join(os.homedir(), '.llm-context-manager');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

export interface GistConfig {
  githubToken?: string;
  projects: Record<string, { name: string; gistId: string; lastSync: string }>;
}

export interface CloudSession {
  date: string;
  title: string;
  tasks?: string[];
  codeChanges?: Array<{ file: string; change: string }>;
  errors?: Array<{ error: string; solution: string }>;
  decisions?: string[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  gistId: string;
  lastSync: string;
}

// 설정 로드/저장
export function loadGistConfig(): GistConfig {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      return { projects: {} };
    }
  }
  return { projects: {} };
}

export function saveGistConfig(cfg: GistConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export function getCachePath(gistId: string) {
  return path.join(CACHE_DIR, `${gistId}.md`);
}

// GitHub API 요청
export async function githubRequest(method: string, apiPath: string, token: string, body?: any): Promise<any> {
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

// Gist CRUD
export async function getGist(token: string, gistId: string): Promise<string> {
  const response = await githubRequest('GET', `/gists/${gistId}`, token);
  return response.files['context.md']?.content || '';
}

export async function updateGist(token: string, gistId: string, content: string): Promise<void> {
  await githubRequest('PATCH', `/gists/${gistId}`, token, {
    files: { 'context.md': { content } }
  });
}

export async function createGist(token: string, projectName: string, content: string): Promise<string> {
  const response = await githubRequest('POST', '/gists', token, {
    description: `LLM Context: ${projectName}`,
    public: false,
    files: { 'context.md': { content } }
  });
  return response.id;
}

// 컨텍스트 파싱
export function parseCloudContext(content: string): { projectName: string; sessions: CloudSession[]; summary?: string } {
  const lines = content.split('\n');
  const result = { projectName: '', sessions: [] as CloudSession[], summary: '' };
  let currentSession: CloudSession | null = null;
  let currentSection = '';
  let inSummary = false;

  for (const line of lines) {
    // 프로젝트 이름
    if (line.startsWith('# Project:')) {
      result.projectName = line.replace('# Project:', '').trim();
    }
    // 요약 섹션
    else if (line.startsWith('## Summary')) {
      inSummary = true;
      continue;
    }
    else if (inSummary && line.startsWith('## ')) {
      inSummary = false;
    }
    else if (inSummary && line.startsWith('> ')) {
      continue; // 자동 생성된 요약 문구 건너뛰기
    }
    else if (inSummary && line.startsWith('마지막 업데이트:')) {
      continue; // 업데이트 시간 건너뛰기
    }
    else if (inSummary && line.trim()) {
      result.summary += line + '\n';
    }
    // 세션 시작
    else if (line.startsWith('## Session:')) {
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
      inSummary = false;
    }
    // 섹션 변경
    else if (line.startsWith('### Tasks')) currentSection = 'tasks';
    else if (line.startsWith('### Code Changes')) currentSection = 'code';
    else if (line.startsWith('### Errors')) currentSection = 'errors';
    else if (line.startsWith('### Decisions')) currentSection = 'decisions';
    // 아이템 파싱
    else if (line.startsWith('- ') && currentSession) {
      const item = line.slice(2);
      if (currentSection === 'tasks') currentSession.tasks!.push(item);
      else if (currentSection === 'code') {
        const [file, ...rest] = item.split(': ');
        currentSession.codeChanges!.push({ file: file || '', change: rest.join(': ') });
      } else if (currentSection === 'errors') {
        const [error, solution] = item.split(' → ');
        currentSession.errors!.push({ error: error || '', solution: solution || '' });
      } else if (currentSection === 'decisions') {
        currentSession.decisions!.push(item);
      }
    }
  }
  if (currentSession) result.sessions.push(currentSession);

  // 요약 trim
  result.summary = result.summary.trim();

  return result;
}

// 마크다운 생성
export function generateCloudMarkdown(projectName: string, sessions: CloudSession[], summary?: string): string {
  let md = `# Project: ${projectName}\n\n## Summary\n\n`;
  md += summary || '> 자동 생성된 개발 컨텍스트';
  md += `\n\n마지막 업데이트: ${new Date().toLocaleString('ko-KR')}\n\n`;

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

// 프로젝트 목록 가져오기 (UI용)
export function getProjects(): Project[] {
  const cfg = loadGistConfig();
  return Object.entries(cfg.projects).map(([projectPath, p]) => ({
    id: projectPath, // 경로를 ID로 사용
    name: p.name,
    path: projectPath,
    gistId: p.gistId,
    lastSync: p.lastSync
  }));
}

// 프로젝트 컨텍스트 가져오기 (캐시 우선)
export function getProjectContent(gistId: string, token?: string): string {
  const cachePath = getCachePath(gistId);

  // 캐시에서 먼저 읽기
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf-8');
  }

  return '';
}

// 프로젝트 컨텍스트 동기화
export async function syncProjectContent(gistId: string, token: string): Promise<string> {
  const content = await getGist(token, gistId);
  fs.writeFileSync(getCachePath(gistId), content);
  return content;
}
