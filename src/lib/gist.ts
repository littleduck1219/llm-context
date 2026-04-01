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
      continue;
    }

    // 세션 시작 (최우선 체크)
    if (line.startsWith('## Session:')) {
      inSummary = false; // 요약 섹션 종료
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
      continue;
    }

    // 요약 섹션
    if (line.startsWith('## Summary')) {
      inSummary = true;
      continue;
    }

    // 다른 ## 섹션이 나오면 요약 종료
    if (inSummary && line.startsWith('## ') && !line.startsWith('## Session:')) {
      inSummary = false;
      continue;
    }

    // 요약 섹션 내용 처리
    if (inSummary) {
      if (line.startsWith('> ')) continue; // 자동 생성된 요약 문구 건너뛰기
      if (line.startsWith('마지막 업데이트:')) continue; // 업데이트 시간 건너뛰기
      if (line.startsWith('---')) continue; // 구분자 건너뛰기
      if (line.trim()) {
        result.summary += line + '\n';
      }
      continue;
    }

    // 세션 내 섹션 변경
    if (line.startsWith('### Tasks')) {
      currentSection = 'tasks';
      continue;
    }
    if (line.startsWith('### Code Changes')) {
      currentSection = 'code';
      continue;
    }
    if (line.startsWith('### Errors')) {
      currentSection = 'errors';
      continue;
    }
    if (line.startsWith('### Decisions')) {
      currentSection = 'decisions';
      continue;
    }

    // 아이템 파싱
    if (line.startsWith('- ') && currentSession) {
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

// 모든 Gist 프로젝트 동기화 (다른 컴퓨터에서 생성한 프로젝트 포함)
export async function syncAllGistProjects(token: string): Promise<GistConfig> {
  const cfg = loadGistConfig();

  // 사용자의 모든 gist 목록 가져오기
  const gists = await githubRequest('GET', '/gists?per_page=100', token);

  // LLM Context 프로젝트인 gist 찾기
  for (const gist of gists) {
    // "LLM Context:" 로 시작하는 description을 가진 gist 찾기
    if (gist.description?.startsWith('LLM Context:')) {
      const projectName = gist.description.replace('LLM Context:', '').trim();
      const gistId = gist.id;

      // 이미 등록된 프로젝트인지 확인
      const existingProject = Object.values(cfg.projects).find(p => p.gistId === gistId);
      if (existingProject) {
        // 기존 프로젝트의 캐시 업데이트
        try {
          await syncProjectContent(gistId, token);
          const projectPath = Object.keys(cfg.projects).find(k => cfg.projects[k].gistId === gistId);
          if (projectPath) {
            cfg.projects[projectPath].lastSync = new Date().toISOString();
          }
        } catch {
          // 동기화 실패 시 무시
        }
      } else {
        // 새 프로젝트 발견 - config에 추가
        // 경로는 gist ID를 임시로 사용 (사용자가 나중에 수정 가능)
        const tempPath = `gist://${gistId}`;

        // gist 내용 가져와서 캐시에 저장
        try {
          const content = await syncProjectContent(gistId, token);
          const parsed = parseCloudContext(content);

          // 프로젝트 이름으로 경로 생성 (또는 사용자가 지정한 경로)
          // 여기서는 프로젝트 이름을 키로 사용
          const projectKey = parsed.projectName || projectName;

          cfg.projects[projectKey] = {
            name: projectKey,
            gistId,
            lastSync: new Date().toISOString()
          };
        } catch {
          // 동기화 실패 시 무시
        }
      }
    }
  }

  saveGistConfig(cfg);
  return cfg;
}
