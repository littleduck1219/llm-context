#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.llm-context-manager');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

interface GistConfig {
  githubToken?: string;
  projects: Record<string, { name: string; gistId: string; lastSync: string }>;
}

function loadGistConfig(): GistConfig {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  return { projects: {} };
}

function saveGistConfig(cfg: GistConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getCachePath(gistId: string) {
  return path.join(CACHE_DIR, `${gistId}.md`);
}

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

async function getGist(token: string, gistId: string): Promise<string> {
  const response = await githubRequest('GET', `/gists/${gistId}`, token);
  return response.files['context.md']?.content || '';
}

async function updateGist(token: string, gistId: string, newSessionContent: string): Promise<void> {
  // 기존 데이터 읽기
  const oldContent = await getGist(token, gistId);

  // 기존 세션 보존 + 새 세션 추가
  const lines = oldContent.split('\n');
  const preservedLines: string[] = [];
  let inSession = false;
  let sessionContent: string[] = [];
  let foundSessions: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## Session:')) {
      if (inSession && sessionContent.length > 0) {
        foundSessions.push(sessionContent.join('\n'));
      }
      inSession = true;
      sessionContent = [line];
    } else if (inSession) {
      sessionContent.push(line);
    } else {
      preservedLines.push(line);
    }
  }
  // 마지막 세션 추가
  if (inSession && sessionContent.length > 0) {
    foundSessions.push(sessionContent.join('\n'));
  }

  // 최근 10개 세션만 유지
  const recentSessions = foundSessions.slice(-10);

  // 최종 콘텐츠 생성
  let finalContent = preservedLines.join('\n');
  for (const session of recentSessions) {
    finalContent += '\n---\n\n' + session;
  }
  finalContent += '\n---\n\n' + newSessionContent;

  await githubRequest('PATCH', `/gists/${gistId}`, token, {
    files: { 'context.md': { content: finalContent } }
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

// Git 정보 자동 수집
function collectGitInfo(projectPath: string): {
  commits: string[];
  changedFiles: string[];
} {
  const result = { commits: [] as string[], changedFiles: [] as string[] };

  try {
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir)) return result;

    // 오늘 커밋 수집
    const today = new Date().toISOString().split('T')[0];
    try {
      const commits = execSync(
        `git log --oneline --since="${today} 00:00:00" --until="${today} 23:59:59"`,
        { cwd: projectPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (commits) {
        result.commits = commits.split('\n').map(c => c.trim()).filter(Boolean);
      }
    } catch {}

    // 변경된 파일들
    try {
      const status = execSync(
        'git status --short',
        { cwd: projectPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (status) {
        result.changedFiles = status.split('\n').map(f => f.trim()).filter(Boolean);
      }
    } catch {}
  } catch {}

  return result;
}

function generateContext(name: string, gitInfo: { commits: string[]; changedFiles: string[] }): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR');
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  let content = `# ${name} - 개발 컨텍스트\n\n`;
  content += `업데이트: ${dateStr} ${timeStr}\n\n`;

  if (gitInfo.commits.length > 0) {
    content += `## 오늘 커밋\n`;
    gitInfo.commits.forEach(c => {
      content += `- ${c}\n`;
    });
    content += '\n';
  }

  if (gitInfo.changedFiles.length > 0) {
    content += `## 변경된 파일\n`;
    gitInfo.changedFiles.forEach(f => {
      const status = f.substring(0, 2).trim();
      const fileName = f.substring(3).trim();
      const statusText = status === 'M' ? '수정' : status === 'A' ? '추가' : status === 'D' ? '삭제' : '변경';
      content += `- ${fileName} (${statusText})\n`;
    });
    content += '\n';
  }

  if (gitInfo.commits.length === 0 && gitInfo.changedFiles.length === 0) {
    content += `## 상태\n변경 사항 없음\n\n`;
  }

  return content;
}

const program = new Command();

program
  .name('llm-context')
  .description('LLM Context Manager - Git 변경사항 자동 저장')
  .version('3.0.0');

// 토큰 설정
program.command('set-token <token>')
  .description('GitHub Personal Access Token 설정')
  .action((token) => {
    const cfg = loadGistConfig();
    cfg.githubToken = token;
    saveGistConfig(cfg);
    console.log('✅ GitHub 토큰이 저장되었습니다.');
  });

// 기본 명령어 - 컨텍스트 로드 + 자동 저장
program.command('sync', { isDefault: true })
  .description('이전 컨텍스트 로드 + 현재 변경사항 저장 (기본 명령어)')
  .action(async () => {
    const cfg = loadGistConfig();
    const cwd = process.cwd();
    const projectName = path.basename(cwd);

    // 토큰 확인
    if (!cfg.githubToken) {
      console.log('❌ 먼저 토큰을 설정하세요:');
      console.log('   llm-context set-token ghp_xxxx');
      return;
    }

    // 기존 프로젝트 찾기 또는 생성
    let project = cfg.projects[cwd];

    // 경로로 못 찾으면 프로젝트 이름으로 찾기
    if (!project) {
      for (const [p, proj] of Object.entries(cfg.projects)) {
        if (proj.name === projectName) {
          project = proj;
          // 경로 업데이트
          cfg.projects[cwd] = project;
          delete cfg.projects[p];
          saveGistConfig(cfg);
          break;
        }
      }
    }

    // Git 정보 수집
    const gitInfo = collectGitInfo(cwd);

    if (!project) {
      // 새 프로젝트 생성
      console.log(`🔄 새 프로젝트 생성: ${projectName}`);
      const content = generateContext(projectName, gitInfo);
      try {
        const gistId = await createGist(cfg.githubToken, projectName, content);
        cfg.projects[cwd] = { name: projectName, gistId, lastSync: new Date().toISOString() };
        saveGistConfig(cfg);
        fs.writeFileSync(getCachePath(gistId), content);
        console.log(`✅ 프로젝트 생성 완료`);
        console.log(`🔗 https://gist.github.com/${gistId}\n`);
        console.log(content);
      } catch (e) {
        console.log('❌ 생성 실패:', e);
      }
    } else {
      // 기존 프로젝트 - 컨텍스트 로드 + 업데이트
      try {
        // 이전 컨텍스트 로드
        const oldContent = await getGist(cfg.githubToken, project.gistId);
        fs.writeFileSync(getCachePath(project.gistId), oldContent);

        console.log('\n' + '='.repeat(60));
        console.log('📋 이전 개발 컨텍스트');
        console.log('='.repeat(60) + '\n');
        console.log(oldContent);
        console.log('='.repeat(60) + '\n');

        // 새 세션 내용 생성
        const now = new Date();
        const dateStr = now.toLocaleDateString('ko-KR');
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        let newSessionContent = `## Session: ${dateStr} ${timeStr}\n\n`;

        if (gitInfo.commits.length > 0) {
          newSessionContent += `### 오늘 커밋\n`;
          gitInfo.commits.forEach(c => {
            newSessionContent += `- ${c}\n`;
          });
          newSessionContent += '\n';
        }

        if (gitInfo.changedFiles.length > 0) {
          newSessionContent += `### 변경된 파일\n`;
          gitInfo.changedFiles.forEach(f => {
            const status = f.substring(0, 2).trim();
            const fileName = f.substring(3).trim();
            const statusText = status === 'M' ? '수정' : status === 'A' ? '추가' : status === 'D' ? '삭제' : '변경';
            newSessionContent += `- ${fileName} (${statusText})\n`;
          });
        }

        if (gitInfo.commits.length === 0 && gitInfo.changedFiles.length === 0) {
          newSessionContent += `### 상태\n변경 사항 없음\n`;
        }

        // 기존 세션 보존하며 저장
        await updateGist(cfg.githubToken, project.gistId, newSessionContent);

        project.lastSync = new Date().toISOString();
        saveGistConfig(cfg);

        console.log('✅ 변경사항 저장 완료');
        if (gitInfo.commits.length) console.log(`📋 커밋: ${gitInfo.commits.length}개`);
        if (gitInfo.changedFiles.length) console.log(`📝 변경 파일: ${gitInfo.changedFiles.length}개`);
        console.log(`🔗 https://gist.github.com/${project.gistId}`);
      } catch (e) {
        console.log('❌ 동기화 실패:', e);
      }
    }
  });

// 프로젝트 목록
program.command('list')
  .description('등록된 프로젝트 목록')
  .action(() => {
    const cfg = loadGistConfig();
    const projects = Object.entries(cfg.projects);
    if (projects.length === 0) {
      console.log('등록된 프로젝트가 없습니다.');
      return;
    }
    console.log('\n📁 등록된 프로젝트:\n');
    for (const [p, proj] of projects) {
      console.log(`  • ${proj.name}`);
      console.log(`    경로: ${p}`);
      console.log(`    Gist: https://gist.github.com/${proj.gistId}\n`);
    }
  });

program.parse();
