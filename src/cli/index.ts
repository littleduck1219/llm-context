#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';
import * as readline from 'readline';

const CONFIG_DIR = path.join(os.homedir(), '.llm-context-manager');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

interface GistConfig {
  githubToken?: string;
  projects: Record<string, { name: string; gistId: string; lastSync: string }>;
}

interface CloudSession {
  date: string;
  title: string;
  tasks?: string[];
  codeChanges?: Array<{ file: string; change: string }>;
  errors?: Array<{ error: string; solution: string }>;
  decisions?: string[];
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

// 대화형 입력 유틸리티
function question(rl: readline.ReadLine, query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function promptForSessionContent(): Promise<{
  title: string;
  tasks: string[];
  changes: string[];
  errors: string[];
  decisions: string[];
}> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n📝 세션 내용 입력 (Enter로 건너뛰기)\n');

  const title = await question(rl, '세션 제목: ');

  console.log('\n작업 목록 입력 (빈 줄 입력 시 종료):');
  const tasks: string[] = [];
  let taskNum = 1;
  while (true) {
    const task = await question(rl, `  작업 ${taskNum}: `);
    if (!task.trim()) break;
    tasks.push(task.trim());
    taskNum++;
  }

  console.log('\n코드 변경 사항 (형식: 파일:설명, 빈 줄 입력 시 종료):');
  const changes: string[] = [];
  let changeNum = 1;
  while (true) {
    const change = await question(rl, `  변경 ${changeNum}: `);
    if (!change.trim()) break;
    changes.push(change.trim());
    changeNum++;
  }

  console.log('\n에러 및 해결 (형식: 에러→해결, 빈 줄 입력 시 종료):');
  const errors: string[] = [];
  let errorNum = 1;
  while (true) {
    const error = await question(rl, `  에러 ${errorNum}: `);
    if (!error.trim()) break;
    errors.push(error.trim());
    errorNum++;
  }

  console.log('\n기술적 결정 사항 (빈 줄 입력 시 종료):');
  const decisions: string[] = [];
  let decisionNum = 1;
  while (true) {
    const decision = await question(rl, `  결정 ${decisionNum}: `);
    if (!decision.trim()) break;
    decisions.push(decision.trim());
    decisionNum++;
  }

  rl.close();
  return { title: title.trim(), tasks, changes, errors, decisions };
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

async function updateGist(token: string, gistId: string, content: string): Promise<void> {
  await githubRequest('PATCH', `/gists/${gistId}`, token, {
    files: { 'context.md': { content } }
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

function parseCloudContext(content: string): { projectName: string; sessions: CloudSession[] } {
  const lines = content.split('\n');
  const result = { projectName: '', sessions: [] as CloudSession[] };
  let currentSession: CloudSession | null = null;
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

function generateCloudMarkdown(projectName: string, sessions: CloudSession[]): string {
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

// Git 정보 자동 수집
function collectGitInfo(projectPath: string): {
  commits: string[];
  changedFiles: string[];
  diffStat: string;
} {
  const result = { commits: [] as string[], changedFiles: [] as string[], diffStat: '' };

  try {
    // 프로젝트 경로가 git 저장소인지 확인
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir)) {
      return result;
    }

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
    } catch {
      // 커밋 없음
    }

    // 변경된 파일들
    try {
      const status = execSync(
        'git status --short',
        { cwd: projectPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (status) {
        result.changedFiles = status.split('\n').map(f => f.trim()).filter(Boolean);
      }
    } catch {
      // 변경 없음
    }

    // diff 통계
    try {
      const diff = execSync(
        'git diff --stat HEAD~1 2>/dev/null || git diff --stat',
        { cwd: projectPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (diff) {
        result.diffStat = diff;
      }
    } catch {
      // diff 없음
    }
  } catch (error) {
    // git 명령 실패 - 무시
  }

  return result;
}

const program = new Command();

program
  .name('llm-context')
  .description('LLM Context Manager CLI - Claude Code Hooks용 Cloud 컨텍스트 관리')
  .version('2.0.0');

// ============================================
// Cloud 컨텍스트 명령어 (Gist 기반)
// ============================================

// 토큰 설정
program.command('set-token <token>')
  .description('GitHub Personal Access Token 설정')
  .action((token) => {
    const cfg = loadGistConfig();
    cfg.githubToken = token;
    saveGistConfig(cfg);
    console.log('✅ GitHub 토큰이 저장되었습니다.');
  });

// 컨텍스트 로드 (session-start hook용)
program.command('load [projectPath]')
  .description('프로젝트 컨텍스트 로드 (session-start용)')
  .action(async (projectPath) => {
    const cfg = loadGistConfig();
    const cwd = projectPath || process.cwd();

    const project = cfg.projects[cwd];
    if (!project) {
      console.log('ℹ️ 등록된 프로젝트가 없습니다. init 명령어로 먼저 초기화하세요.');
      console.log(`   사용법: llm-context init "${cwd}" "프로젝트명"`);
      return;
    }

    let content: string;
    try {
      if (cfg.githubToken) {
        content = await getGist(cfg.githubToken, project.gistId);
        fs.writeFileSync(getCachePath(project.gistId), content);
      } else {
        content = fs.readFileSync(getCachePath(project.gistId), 'utf-8');
      }
      console.log('\n📋 === 이전 개발 컨텍스트 ===\n');
      console.log(content);
      console.log('\n📋 === 컨텍스트 끝 ===\n');
    } catch {
      const cachePath = getCachePath(project.gistId);
      if (fs.existsSync(cachePath)) {
        content = fs.readFileSync(cachePath, 'utf-8');
        console.log('\n📋 === 이전 개발 컨텍스트 (캐시) ===\n');
        console.log(content);
      } else {
        console.log('⚠️ 컨텍스트를 불러올 수 없습니다.');
      }
    }
  });

// 세션 저장 (session-end hook용)
program.command('save [projectPath] [title]')
  .option('-t, --tasks <tasks...>', '완료한 작업 목록')
  .option('-c, --changes <changes...>', '코드 변경 (형식: file:description)')
  .option('-e, --errors <errors...>', '에러 (형식: error→solution)')
  .option('-d, --decisions <decisions...>', '결정사항')
  .action(async (projectPath, title, options) => {
    const cfg = loadGistConfig();
    const cwd = projectPath || process.cwd();

    const project = cfg.projects[cwd];
    if (!project) {
      console.log('ℹ️ 등록된 프로젝트가 없습니다.');
      return;
    }

    if (!cfg.githubToken) {
      console.log('⚠️ GitHub 토큰이 없습니다. set-token 명령어로 설정하세요.');
      return;
    }

    try {
      const content = await getGist(cfg.githubToken, project.gistId);
      const parsed = parseCloudContext(content);

      const newSession: CloudSession = {
        date: new Date().toISOString().split('T')[0],
        title: title || `개발 세션 ${parsed.sessions.length + 1}`,
        tasks: options.tasks || [],
        codeChanges: (options.changes || []).map((c: string) => {
          const [file, ...rest] = c.split(':');
          return { file, change: rest.join(':') };
        }),
        errors: (options.errors || []).map((e: string) => {
          const [error, solution] = e.split('→');
          return { error, solution: solution || '' };
        }),
        decisions: options.decisions || []
      };

      parsed.sessions.push(newSession);

      const newContent = generateCloudMarkdown(project.name, parsed.sessions);
      await updateGist(cfg.githubToken, project.gistId, newContent);
      fs.writeFileSync(getCachePath(project.gistId), newContent);

      project.lastSync = new Date().toISOString();
      saveGistConfig(cfg);
      console.log(`✅ 세션이 저장되었습니다: ${newSession.title}`);
      console.log(`📊 총 ${parsed.sessions.length}개 세션`);
    } catch (e) {
      console.log('❌ 저장 실패:', e);
    }
  });

// 프로젝트 초기화
program.command('init [projectPath] [projectName]')
  .description('새 프로젝트 초기화')
  .action(async (projectPath, projectName) => {
    const cfg = loadGistConfig();
    const cwd = projectPath || process.cwd();
    const name = projectName || path.basename(cwd);

    if (!cfg.githubToken) {
      console.log('❌ 먼저 set-token 명령어로 GitHub 토큰을 설정하세요.');
      return;
    }

    const initialContent = generateCloudMarkdown(name, []);
    try {
      const gistId = await createGist(cfg.githubToken, name, initialContent);
      cfg.projects[cwd] = { name, gistId, lastSync: new Date().toISOString() };
      saveGistConfig(cfg);
      fs.writeFileSync(getCachePath(gistId), initialContent);
      console.log(`✅ 프로젝트 초기화 완료: ${name}`);
      console.log(`📝 Gist ID: ${gistId}`);
      console.log(`🔗 URL: https://gist.github.com/${gistId}`);
    } catch (e) {
      console.log('❌ 초기화 실패:', e);
    }
  });

// 프로젝트 연결
program.command('connect <projectPath> <gistId>')
  .description('기존 Gist로 프로젝트 연결')
  .action(async (projectPath, gistId) => {
    const cfg = loadGistConfig();
    const cwd = projectPath || process.cwd();

    if (!cfg.githubToken) {
      console.log('❌ 먼저 set-token 명령어로 GitHub 토큰을 설정하세요.');
      return;
    }

    try {
      const content = await getGist(cfg.githubToken, gistId);
      fs.writeFileSync(getCachePath(gistId), content);
      const parsed = parseCloudContext(content);
      cfg.projects[cwd] = {
        name: parsed.projectName || 'Unknown',
        gistId,
        lastSync: new Date().toISOString()
      };
      saveGistConfig(cfg);
      console.log(`✅ 프로젝트 연결 완료: ${parsed.projectName}`);
      console.log(`📊 ${parsed.sessions.length}개 세션 로드됨`);
    } catch (e) {
      console.log('❌ 연결 실패:', e);
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
      console.log(`    Gist: https://gist.github.com/${proj.gistId}`);
      console.log(`    동기화: ${proj.lastSync}\n`);
    }
  });

// 동기화
program.command('sync')
  .description('모든 프로젝트 동기화')
  .action(async () => {
    const cfg = loadGistConfig();
    if (!cfg.githubToken) {
      console.log('❌ GitHub 토큰이 없습니다.');
      return;
    }
    for (const [projectPath, project] of Object.entries(cfg.projects)) {
      try {
        const content = await getGist(cfg.githubToken, project.gistId);
        fs.writeFileSync(getCachePath(project.gistId), content);
        project.lastSync = new Date().toISOString();
        console.log(`✅ ${project.name} 동기화 완료`);
      } catch {
        console.log(`❌ ${project.name} 동기화 실패`);
      }
    }
    saveGistConfig(cfg);
  });

// ============================================
// start 명령어 - 한 번에 초기화 + 로드
// ============================================
program.command('start [projectPath] [projectName]')
  .description('프로젝트 시작 - 초기화(필요시) + 컨텍스트 로드')
  .action(async (projectPath, projectName) => {
    const cfg = loadGistConfig();
    const cwd = projectPath || process.cwd();
    const name = projectName || path.basename(cwd);

    // 토큰 확인
    if (!cfg.githubToken) {
      console.log('❌ 먼저 set-token 명령어로 GitHub 토큰을 설정하세요.');
      console.log('   llm-context set-token ghp_xxxx');
      return;
    }

    let project = cfg.projects[cwd];

    // 프로젝트가 없으면 자동 초기화
    if (!project) {
      console.log(`🔄 프로젝트가 없습니다. 초기화 중...`);
      const initialContent = generateCloudMarkdown(name, []);
      try {
        const gistId = await createGist(cfg.githubToken, name, initialContent);
        cfg.projects[cwd] = { name, gistId, lastSync: new Date().toISOString() };
        saveGistConfig(cfg);
        fs.writeFileSync(getCachePath(gistId), initialContent);
        project = cfg.projects[cwd];
        console.log(`✅ 프로젝트 초기화 완료: ${name}`);
        console.log(`🔗 Gist: https://gist.github.com/${gistId}\n`);
      } catch (e) {
        console.log('❌ 초기화 실패:', e);
        return;
      }
    }

    // 컨텍스트 로드
    try {
      const content = await getGist(cfg.githubToken, project.gistId);
      fs.writeFileSync(getCachePath(project.gistId), content);

      console.log('\n' + '='.repeat(60));
      console.log('📋 이전 개발 컨텍스트');
      console.log('='.repeat(60) + '\n');
      console.log(content);
      console.log('\n' + '='.repeat(60));
      console.log('📋 컨텍스트 끝');
      console.log('='.repeat(60) + '\n');

      // 세션 시작 정보 저장
      const sessionFile = path.join(CONFIG_DIR, '.current-session');
      fs.writeFileSync(sessionFile, JSON.stringify({
        projectPath: cwd,
        startTime: new Date().toISOString()
      }));

      console.log('💡 세션 종료 시: llm-context end "세션 제목"');
      console.log('💡 또는: llm-context end -t "작업1" -t "작업2" --title "세션 제목"\n');
    } catch (e) {
      console.log('❌ 컨텍스트 로드 실패:', e);
    }
  });

// ============================================
// end 명령어 - 세션 종료 + 자동 저장 (대화형 개선)
// ============================================
program.command('end [title]')
  .description('세션 종료 - 작업 내용 저장')
  .option('-t, --tasks <tasks...>', '완료한 작업 목록')
  .option('-c, --changes <changes...>', '코드 변경 (형식: file:description)')
  .option('-e, --errors <errors...>', '에러 (형식: error→solution)')
  .option('-d, --decisions <decisions...>', '결정사항')
  .option('--title <title>', '세션 제목')
  .option('-i, --interactive', '대화형 모드로 실행')
  .action(async (titleArg, options) => {
    const cfg = loadGistConfig();
    const sessionFile = path.join(CONFIG_DIR, '.current-session');

    // 현재 세션 정보 확인
    let projectPath = process.cwd();
    if (fs.existsSync(sessionFile)) {
      try {
        const sessionInfo = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        projectPath = sessionInfo.projectPath;
      } catch {}
    }

    const project = cfg.projects[projectPath];
    if (!project) {
      console.log('❌ 등록된 프로젝트가 없습니다.');
      console.log('   먼저 llm-context start를 실행하세요.');
      return;
    }

    if (!cfg.githubToken) {
      console.log('❌ GitHub 토큰이 없습니다.');
      return;
    }

    // 대화형 모드 또는 옵션이 없을 때 대화형 입력
    let tasks = options.tasks || [];
    let codeChanges = (options.changes || []).map((c: string) => {
      const [file, ...rest] = c.split(':');
      return { file, change: rest.join(':') };
    });
    let errors = (options.errors || []).map((e: string) => {
      const [error, solution] = e.split('→');
      return { error, solution: solution || '' };
    });
    let decisions = options.decisions || [];
    let sessionTitle = options.title || titleArg || '';

    // 옵션이 없고 stdin이 TTY면 대화형 모드
    const hasOptions = options.tasks || options.changes || options.errors || options.decisions || options.title || titleArg;
    if (!hasOptions && process.stdin.isTTY) {
      console.log('\n📝 세션 종료 - 작업 내용을 입력하세요\n');
      try {
        const input = await promptForSessionContent();
        sessionTitle = input.title;
        tasks = input.tasks;
        codeChanges = input.changes.map(c => {
          const [file, ...rest] = c.split(':');
          return { file, change: rest.join(':') };
        });
        errors = input.errors.map(e => {
          const [error, solution] = e.split('→');
          return { error, solution: solution || '' };
        });
        decisions = input.decisions;
      } catch (e) {
        console.log('입력이 취소되었습니다.');
        return;
      }
    }

    try {
      const content = await getGist(cfg.githubToken, project.gistId);
      const parsed = parseCloudContext(content);

      if (!sessionTitle) {
        sessionTitle = `개발 세션 ${parsed.sessions.length + 1}`;
      }

      // Git 정보 자동 수집
      const gitInfo = collectGitInfo(projectPath);
      const autoTasks: string[] = [];
      const autoChanges: Array<{ file: string; change: string }> = [];

      // 커밋을 작업으로 변환
      if (gitInfo.commits.length > 0) {
        gitInfo.commits.forEach(c => {
          const msg = c.replace(/^[a-f0-9]+\s/, '').trim();
          autoTasks.push(`커밋: ${msg}`);
        });
      }

      // 변경된 파일들을 코드 변경에 추가
      if (gitInfo.changedFiles.length > 0) {
        gitInfo.changedFiles.forEach(f => {
          const status = f.substring(0, 2).trim();
          const fileName = f.substring(3).trim();
          const statusText = status === 'M' ? '수정' : status === 'A' ? '추가' : status === 'D' ? '삭제' : '변경';
          autoChanges.push({ file: fileName, change: statusText });
        });
      }

      // 사용자가 입력한 작업과 병합 (중복 제거)
      const allTasks = [...tasks, ...autoTasks.filter(t => !tasks.some(ut => ut === t))];
      const allCodeChanges = [
        ...codeChanges,
        ...autoChanges.filter(ac => !codeChanges.some(cc => cc.file === ac.file))
      ];

      const newSession: CloudSession = {
        date: new Date().toISOString().split('T')[0],
        title: sessionTitle,
        tasks: allTasks,
        codeChanges: allCodeChanges,
        errors,
        decisions
      };

      // 세션 저장
      parsed.sessions.push(newSession);

      const newContent = generateCloudMarkdown(project.name, parsed.sessions);
      await updateGist(cfg.githubToken, project.gistId, newContent);
      fs.writeFileSync(getCachePath(project.gistId), newContent);

      project.lastSync = new Date().toISOString();
      saveGistConfig(cfg);

      // 세션 파일 삭제
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }

      console.log(`\n✅ 세션 저장 완료: ${sessionTitle}`);
      // 저장된 내용 요약
      if (allTasks.length) console.log(`📋 작업: ${allTasks.length}개`);
      if (allCodeChanges.length) console.log(`📝 코드 변경: ${allCodeChanges.length}개`);
      if (errors.length) console.log(`⚠️ 에러 해결: ${errors.length}개`);
      if (decisions.length) console.log(`💡 결정 사항: ${decisions.length}개`);
      console.log(`📊 총 ${parsed.sessions.length}개 세션`);
      console.log(`🔗 https://gist.github.com/${project.gistId}`);
    } catch (e) {
      console.log('❌ 저장 실패:', e);
    }
  });

// ============================================
// quick 명령어 - 빠른 작업 추가
// ============================================
program.command('add <type> <content>')
  .description('빠르게 작업/변경/에러 추가 (type: task|change|error|decision)')
  .action(async (type, content) => {
    const cfg = loadGistConfig();
    const sessionFile = path.join(CONFIG_DIR, '.current-session');

    let projectPath = process.cwd();
    if (fs.existsSync(sessionFile)) {
      try {
        const sessionInfo = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        projectPath = sessionInfo.projectPath;
      } catch {}
    }

    const project = cfg.projects[projectPath];
    if (!project || !cfg.githubToken) {
      console.log('❌ 먼저 llm-context start를 실행하세요.');
      return;
    }

    // 오늘 세션 찾기 또는 생성
    const today = new Date().toISOString().split('T')[0];
    const gistContent = await getGist(cfg.githubToken, project.gistId);
    const parsed = parseCloudContext(gistContent);

    let todaySession = parsed.sessions.find(s => s.date === today);
    if (!todaySession) {
      todaySession = {
        date: today,
        title: `개발 세션 ${parsed.sessions.length + 1}`,
        tasks: [],
        codeChanges: [],
        errors: [],
        decisions: []
      };
      parsed.sessions.push(todaySession);
    }

    // 타입별 추가
    switch (type) {
      case 'task':
        todaySession.tasks = todaySession.tasks || [];
        todaySession.tasks.push(content);
        console.log(`✅ 작업 추가: ${content}`);
        break;
      case 'change':
        const [file, ...rest] = content.split(':');
        todaySession.codeChanges = todaySession.codeChanges || [];
        todaySession.codeChanges.push({ file, change: rest.join(':') });
        console.log(`✅ 변경 추가: ${file} - ${rest.join(':')}`);
        break;
      case 'error':
        const [error, solution] = content.split('→');
        todaySession.errors = todaySession.errors || [];
        todaySession.errors.push({ error, solution: solution || '' });
        console.log(`✅ 에러 추가: ${error}`);
        break;
      case 'decision':
        todaySession.decisions = todaySession.decisions || [];
        todaySession.decisions.push(content);
        console.log(`✅ 결정 추가: ${content}`);
        break;
      default:
        console.log('❌ 타입은 task, change, error, decision 중 하나여야 합니다.');
        return;
    }

    // 저장
    const newContent = generateCloudMarkdown(project.name, parsed.sessions);
    await updateGist(cfg.githubToken, project.gistId, newContent);
    fs.writeFileSync(getCachePath(project.gistId), newContent);
  });

program.parse();
