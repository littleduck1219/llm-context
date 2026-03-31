import Database from 'better-sqlite3';
import { Project, Session, Message, ProjectMemory, Decision, CodePattern, CodeConvention, MessageAttachment, FileSnapshot, SnapshotFile, GitDiff, GitDiffSummary, CodeChange, ErrorLog, DevelopmentContext, ErrorResolution, CodeSnippet } from '../types';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.llm-context-manager');
const DB_PATH = path.join(DB_DIR, 'context.db');

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // 테이블 생성
  db.exec(`
    -- 프로젝트 테이블
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      memory TEXT,
      settings TEXT
    );

    -- 세션 테이블
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      summary TEXT,
      tags TEXT,
      metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 메시지 테이블
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- 결정사항 테이블
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      rationale TEXT,
      alternatives TEXT,
      made_at TEXT NOT NULL,
      related_files TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 코드 패턴 테이블
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      code TEXT,
      usage TEXT,
      tags TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 인덱스 생성
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
    CREATE INDEX IF NOT EXISTS idx_patterns_project ON patterns(project_id);

    -- 메시지 첨부 파일 테이블 (v2)
    CREATE TABLE IF NOT EXISTS message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT,
      content TEXT NOT NULL,
      language TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    -- 파일 스냅샷 테이블 (v2)
    CREATE TABLE IF NOT EXISTS file_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      session_id TEXT,
      label TEXT NOT NULL,
      description TEXT,
      files TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    );

    -- Git diff 테이블 (v2)
    CREATE TABLE IF NOT EXISTS git_diffs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      from_commit TEXT,
      to_commit TEXT,
      diff TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- 추가 인덱스
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_project ON file_snapshots(project_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_session ON file_snapshots(session_id);
    CREATE INDEX IF NOT EXISTS idx_diffs_session ON git_diffs(session_id);

    -- 코드 변경 사항 테이블 (v3)
    CREATE TABLE IF NOT EXISTS code_changes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      filepath TEXT NOT NULL,
      change_type TEXT NOT NULL,
      before_code TEXT,
      after_code TEXT,
      description TEXT,
      line_start INTEGER,
      line_end INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    -- 에러 로그 테이블 (v3)
    CREATE TABLE IF NOT EXISTS error_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      related_file TEXT,
      related_line INTEGER,
      solution TEXT,
      solved_at TEXT,
      solved_by_message_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    -- v3 인덱스
    CREATE INDEX IF NOT EXISTS idx_code_changes_session ON code_changes(session_id);
    CREATE INDEX IF NOT EXISTS idx_code_changes_file ON code_changes(filepath);
    CREATE INDEX IF NOT EXISTS idx_error_logs_session ON error_logs(session_id);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// 프로젝트 관련 함수들
export function createProject(name: string, projectPath: string, description?: string): Project {
  const database = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const defaultMemory: ProjectMemory = {
    techStack: [],
    conventions: [],
    architectureNotes: [],
    decisions: [],
    patterns: [],
    pendingTasks: []
  };

  const defaultSettings = {
    autoSummarize: true,
    summaryThreshold: 50,
    keepFullHistory: true,
    contextWindowTokens: 128000
  };

  const stmt = database.prepare(`
    INSERT INTO projects (id, name, path, description, created_at, updated_at, memory, settings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, name, projectPath, description || null, now, now, JSON.stringify(defaultMemory), JSON.stringify(defaultSettings));

  return {
    id,
    name,
    path: projectPath,
    description,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    sessions: [],
    memory: defaultMemory,
    settings: defaultSettings
  };
}

export function getProject(id: string): Project | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM projects WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return mapRowToProject(row);
}

export function getProjectByPath(projectPath: string): Project | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM projects WHERE path = ?');
  const row = stmt.get(projectPath) as any;

  if (!row) return null;

  return mapRowToProject(row);
}

export function getAllProjects(): Project[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(mapRowToProject);
}

export function updateProjectMemory(projectId: string, memory: Partial<ProjectMemory>): void {
  const database = getDatabase();
  const project = getProject(projectId);
  if (!project) return;

  const updatedMemory = { ...project.memory, ...memory };
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    UPDATE projects SET memory = ?, updated_at = ? WHERE id = ?
  `);

  stmt.run(JSON.stringify(updatedMemory), now, projectId);
}

function mapRowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    memory: JSON.parse(row.memory || '{}'),
    settings: JSON.parse(row.settings || '{}'),
    sessions: []
  };
}

// 세션 관련 함수들
export function createSession(projectId: string, title: string): Session {
  const database = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO sessions (id, project_id, title, created_at, updated_at, tags, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, projectId, title, now, now, '[]', '{}');

  // 프로젝트 업데이트 시간 갱신
  const updateProjectStmt = database.prepare('UPDATE projects SET updated_at = ? WHERE id = ?');
  updateProjectStmt.run(now, projectId);

  return {
    id,
    projectId,
    title,
    messages: [],
    createdAt: new Date(now),
    updatedAt: new Date(now),
    tags: []
  };
}

export function getSession(id: string): Session | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  const messagesStmt = database.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC');
  const messages = (messagesStmt.all(id) as any[]).map(mapRowToMessage);

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    summary: row.summary,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    messages
  };
}

export function getSessionsByProject(projectId: string): Session[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC');
  const rows = stmt.all(projectId) as any[];

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    summary: row.summary,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    messages: []
  }));
}

export function updateSessionSummary(sessionId: string, summary: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    UPDATE sessions SET summary = ?, updated_at = ? WHERE id = ?
  `);

  stmt.run(summary, now, sessionId);
}

// 메시지 관련 함수들
export function addMessage(sessionId: string, message: Omit<Message, 'id' | 'timestamp'>): Message {
  const database = getDatabase();
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, sessionId, message.role, message.content, timestamp, JSON.stringify(message.metadata || {}));

  // 세션 업데이트 시간 갱신
  const updateSessionStmt = database.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
  updateSessionStmt.run(timestamp, sessionId);

  return {
    id,
    ...message,
    timestamp: new Date(timestamp)
  };
}

export function getMessages(sessionId: string): Message[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC');
  const rows = stmt.all(sessionId) as any[];

  return rows.map(mapRowToMessage);
}

function mapRowToMessage(row: any): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.timestamp),
    metadata: JSON.parse(row.metadata || '{}')
  };
}

// 결정사항 관련 함수들
export function addDecision(projectId: string, decision: Omit<Decision, 'id' | 'madeAt'>): Decision {
  const database = getDatabase();
  const id = uuidv4();
  const madeAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO decisions (id, project_id, title, description, rationale, alternatives, made_at, related_files)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    projectId,
    decision.title,
    decision.description,
    decision.rationale,
    JSON.stringify(decision.alternatives || []),
    madeAt,
    JSON.stringify(decision.relatedFiles || [])
  );

  return {
    id,
    ...decision,
    madeAt: new Date(madeAt)
  };
}

export function getDecisions(projectId: string): Decision[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM decisions WHERE project_id = ? ORDER BY made_at DESC');
  const rows = stmt.all(projectId) as any[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    rationale: row.rationale,
    alternatives: JSON.parse(row.alternatives || '[]'),
    madeAt: new Date(row.made_at),
    relatedFiles: JSON.parse(row.related_files || '[]')
  }));
}

// 패턴 관련 함수들
export function addPattern(projectId: string, pattern: Omit<CodePattern, 'id'>): CodePattern {
  const database = getDatabase();
  const id = uuidv4();

  const stmt = database.prepare(`
    INSERT INTO patterns (id, project_id, name, description, code, usage, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    projectId,
    pattern.name,
    pattern.description,
    pattern.code,
    pattern.usage,
    JSON.stringify(pattern.tags || [])
  );

  return {
    id,
    ...pattern
  };
}

export function getPatterns(projectId: string): CodePattern[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM patterns WHERE project_id = ?');
  const rows = stmt.all(projectId) as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    usage: row.usage,
    tags: JSON.parse(row.tags || '[]')
  }));
}

// 검색 함수
export function searchMessages(query: string, projectId?: string): Array<Message & { sessionId: string; sessionTitle: string }> {
  const database = getDatabase();

  let sql = `
    SELECT m.*, s.title as session_title, s.project_id
    FROM messages m
    JOIN sessions s ON m.session_id = s.id
    WHERE m.content LIKE ?
  `;

  const params: any[] = [`%${query}%`];

  if (projectId) {
    sql += ' AND s.project_id = ?';
    params.push(projectId);
  }

  sql += ' ORDER BY m.timestamp DESC LIMIT 100';

  const stmt = database.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.timestamp),
    metadata: JSON.parse(row.metadata || '{}')
  }));
}

// 내보내기 함수
export function exportProject(projectId: string, format: 'json' | 'markdown'): string {
  const project = getProject(projectId);
  if (!project) throw new Error('Project not found');

  const sessions = getSessionsByProject(projectId);
  const decisions = getDecisions(projectId);
  const patterns = getPatterns(projectId);

  // 각 세션의 메시지도 가져오기
  const sessionsWithMessages = sessions.map(session => ({
    ...session,
    messages: getMessages(session.id)
  }));

  if (format === 'json') {
    return JSON.stringify({
      project,
      sessions: sessionsWithMessages,
      decisions,
      patterns
    }, null, 2);
  }

  // 마크다운 형식
  let md = `# ${project.name}\n\n`;
  md += `**경로:** ${project.path}\n`;
  if (project.description) md += `**설명:** ${project.description}\n\n`;

  md += `## 기술 스택\n${project.memory.techStack.map(t => `- ${t}`).join('\n')}\n\n`;

  if (decisions.length > 0) {
    md += `## 주요 결정사항\n\n`;
    decisions.forEach(d => {
      md += `### ${d.title}\n`;
      md += `${d.description}\n\n`;
      md += `**이유:** ${d.rationale}\n\n`;
    });
  }

  if (patterns.length > 0) {
    md += `## 코드 패턴\n\n`;
    patterns.forEach(p => {
      md += `### ${p.name}\n`;
      md += `${p.description}\n\n`;
      if (p.code) md += `\`\`\`\n${p.code}\n\`\`\`\n\n`;
    });
  }

  md += `## 세션 히스토리\n\n`;
  sessionsWithMessages.forEach(session => {
    md += `### ${session.title}\n`;
    md += `*${session.createdAt.toLocaleString()}*\n\n`;
    if (session.summary) md += `**요약:** ${session.summary}\n\n`;

    session.messages.forEach(msg => {
      const role = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
      md += `${role} **${msg.role}:**\n${msg.content}\n\n`;
    });
    md += `---\n\n`;
  });

  return md;
}

// === 첨부 파일 관련 함수 (v2) ===

export function addAttachment(
  messageId: string,
  file: { filename: string; filepath?: string; content: string; language?: string }
): MessageAttachment {
  const database = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO message_attachments (id, message_id, filename, filepath, content, language, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, messageId, file.filename, file.filepath || null, file.content, file.language || null, createdAt);

  return {
    id,
    messageId,
    filename: file.filename,
    filepath: file.filepath,
    content: file.content,
    language: file.language,
    createdAt: new Date(createdAt)
  };
}

export function getAttachmentsByMessage(messageId: string): MessageAttachment[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM message_attachments WHERE message_id = ?');
  const rows = stmt.all(messageId) as any[];

  return rows.map(row => ({
    id: row.id,
    messageId: row.message_id,
    filename: row.filename,
    filepath: row.filepath,
    content: row.content,
    language: row.language,
    createdAt: new Date(row.created_at)
  }));
}

// === 파일 스냅샷 관련 함수 (v2) ===

export function createSnapshot(
  projectId: string,
  label: string,
  files: SnapshotFile[],
  options?: { sessionId?: string; description?: string }
): FileSnapshot {
  const database = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO file_snapshots (id, project_id, session_id, label, description, files, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    projectId,
    options?.sessionId || null,
    label,
    options?.description || null,
    JSON.stringify(files),
    createdAt
  );

  return {
    id,
    projectId,
    sessionId: options?.sessionId,
    label,
    description: options?.description,
    files,
    createdAt: new Date(createdAt)
  };
}

export function getSnapshotsByProject(projectId: string): FileSnapshot[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM file_snapshots WHERE project_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(projectId) as any[];

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    label: row.label,
    description: row.description,
    files: JSON.parse(row.files),
    createdAt: new Date(row.created_at)
  }));
}

export function getSnapshot(id: string): FileSnapshot | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM file_snapshots WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    label: row.label,
    description: row.description,
    files: JSON.parse(row.files),
    createdAt: new Date(row.created_at)
  };
}

// === Git Diff 관련 함수 (v2) ===

export function saveGitDiff(
  projectId: string,
  sessionId: string,
  diff: string,
  summary: GitDiffSummary,
  options?: { fromCommit?: string; toCommit?: string }
): GitDiff {
  const database = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO git_diffs (id, project_id, session_id, from_commit, to_commit, diff, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    projectId,
    sessionId,
    options?.fromCommit || null,
    options?.toCommit || null,
    diff,
    JSON.stringify(summary),
    createdAt
  );

  return {
    id,
    projectId,
    sessionId,
    fromCommit: options?.fromCommit,
    toCommit: options?.toCommit,
    diff,
    summary,
    createdAt: new Date(createdAt)
  };
}

export function getGitDiffsBySession(sessionId: string): GitDiff[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM git_diffs WHERE session_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    fromCommit: row.from_commit,
    toCommit: row.to_commit,
    diff: row.diff,
    summary: JSON.parse(row.summary),
    createdAt: new Date(row.created_at)
  }));
}

// === 유틸리티 함수 ===

export function computeFileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

// === 코드 변경사항 관련 함수 (v3) ===

export function addCodeChange(
  sessionId: string,
  messageId: string,
  change: {
    filepath: string;
    changeType: 'created' | 'modified' | 'deleted';
    beforeCode?: string;
    afterCode?: string;
    description?: string;
    lineStart?: number;
    lineEnd?: number;
  }
): CodeChange {
  const database = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO code_changes (id, session_id, message_id, filepath, change_type, before_code, after_code, description, line_start, line_end, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    sessionId,
    messageId,
    change.filepath,
    change.changeType,
    change.beforeCode || null,
    change.afterCode || null,
    change.description || null,
    change.lineStart || null,
    change.lineEnd || null,
    createdAt
  );

  return {
    id,
    sessionId,
    messageId,
    filepath: change.filepath,
    changeType: change.changeType,
    beforeCode: change.beforeCode,
    afterCode: change.afterCode,
    description: change.description,
    lineStart: change.lineStart,
    lineEnd: change.lineEnd,
    createdAt: new Date(createdAt)
  };
}

export function getCodeChangesBySession(sessionId: string): CodeChange[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM code_changes WHERE session_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    messageId: row.message_id,
    filepath: row.filepath,
    changeType: row.change_type,
    beforeCode: row.before_code,
    afterCode: row.after_code,
    description: row.description,
    lineStart: row.line_start,
    lineEnd: row.line_end,
    createdAt: new Date(row.created_at)
  }));
}

// === 에러 로그 관련 함수 (v3) ===

export function addErrorLog(
  sessionId: string,
  messageId: string,
  error: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    relatedFile?: string;
    relatedLine?: number;
  }
): ErrorLog {
  const database = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO error_logs (id, session_id, message_id, error_type, error_message, stack_trace, related_file, related_line, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    sessionId,
    messageId,
    error.errorType,
    error.errorMessage,
    error.stackTrace || null,
    error.relatedFile || null,
    error.relatedLine || null,
    createdAt
  );

  return {
    id,
    sessionId,
    messageId,
    errorType: error.errorType,
    errorMessage: error.errorMessage,
    stackTrace: error.stackTrace,
    relatedFile: error.relatedFile,
    relatedLine: error.relatedLine,
    createdAt: new Date(createdAt)
  };
}

export function resolveErrorLog(errorLogId: string, solution: string, solvedByMessageId: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    UPDATE error_logs SET solution = ?, solved_at = ?, solved_by_message_id = ? WHERE id = ?
  `);

  stmt.run(solution, now, solvedByMessageId, errorLogId);
}

export function getErrorLogsBySession(sessionId: string): ErrorLog[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM error_logs WHERE session_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    messageId: row.message_id,
    errorType: row.error_type,
    errorMessage: row.error_message,
    stackTrace: row.stack_trace,
    relatedFile: row.related_file,
    relatedLine: row.related_line,
    solution: row.solution,
    solvedAt: row.solved_at ? new Date(row.solved_at) : undefined,
    solvedByMessageId: row.solved_by_message_id,
    createdAt: new Date(row.created_at)
  }));
}

// === 개발 컨텍스트 생성 (v3) ===

export function generateDevelopmentContext(sessionId: string): DevelopmentContext {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const codeChanges = getCodeChangesBySession(sessionId);
  const errorLogs = getErrorLogsBySession(sessionId);

  // 수정된 파일 목록 (중복 제거)
  const filesModified = [...new Set(codeChanges.map(c => c.filepath))];

  // 완료된 작업 목록 (코드 변경 설명에서 추출)
  const tasksCompleted = codeChanges
    .filter(c => c.description)
    .map(c => c.description as string);

  // 해결된 에러 목록
  const errorsResolved: ErrorResolution[] = errorLogs
    .filter(e => e.solution)
    .map(e => ({
      error: e.errorMessage,
      solution: e.solution as string,
      file: e.relatedFile
    }));

  // 주요 결정사항 (세션 메타데이터에서)
  const keyDecisions = session.metadata?.keyDecisions || [];

  // 중요 코드 스니펫 추출 (메시지에서 코드 블록 추출)
  const codeSnippets = extractCodeSnippetsFromMessages(session.messages);

  // 세션 요약 생성
  const summary = generateSessionSummary(session, codeChanges, errorLogs);

  return {
    sessionId,
    summary,
    tasksCompleted,
    filesModified,
    errorsResolved,
    keyDecisions,
    codeSnippets,
    pendingWork: session.metadata?.pendingTasks?.join(', '),
    generatedAt: new Date()
  };
}

function extractCodeSnippetsFromMessages(messages: Message[]): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      let match;
      while ((match = codeBlockRegex.exec(msg.content)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        if (code.length > 20) { // 너무 짧은 코드는 제외
          snippets.push({
            description: `코드 (${language})`,
            code,
            language
          });
        }
      }
    }
  }

  // 중복 제거 및 최대 10개로 제한
  const uniqueSnippets = snippets.filter((snippet, index, self) =>
    index === self.findIndex(s => s.code === snippet.code)
  );

  return uniqueSnippets.slice(0, 10);
}

function generateSessionSummary(
  session: Session,
  codeChanges: CodeChange[],
  errorLogs: ErrorLog[]
): string {
  const parts: string[] = [];

  // 세션 제목
  parts.push(`## ${session.title}`);
  parts.push(`생성일: ${session.createdAt.toLocaleString()}`);
  parts.push('');

  // 작업 개요
  const createdFiles = codeChanges.filter(c => c.changeType === 'created').map(c => c.filepath);
  const modifiedFiles = codeChanges.filter(c => c.changeType === 'modified').map(c => c.filepath);
  const deletedFiles = codeChanges.filter(c => c.changeType === 'deleted').map(c => c.filepath);

  if (createdFiles.length > 0) {
    parts.push(`### 생성된 파일 (${createdFiles.length}개)`);
    createdFiles.forEach(f => parts.push(`- ${f}`));
    parts.push('');
  }

  if (modifiedFiles.length > 0) {
    parts.push(`### 수정된 파일 (${modifiedFiles.length}개)`);
    modifiedFiles.forEach(f => parts.push(`- ${f}`));
    parts.push('');
  }

  if (deletedFiles.length > 0) {
    parts.push(`### 삭제된 파일 (${deletedFiles.length}개)`);
    deletedFiles.forEach(f => parts.push(`- ${f}`));
    parts.push('');
  }

  // 에러 해결
  const resolvedErrors = errorLogs.filter(e => e.solution);
  if (resolvedErrors.length > 0) {
    parts.push(`### 해결된 에러 (${resolvedErrors.length}개)`);
    resolvedErrors.forEach(e => {
      parts.push(`- **에러**: ${e.errorMessage}`);
      parts.push(`  **해결**: ${e.solution}`);
    });
    parts.push('');
  }

  // 세션 요약 (있으면)
  if (session.summary) {
    parts.push('### 세션 요약');
    parts.push(session.summary);
  }

  return parts.join('\n');
}

// 개발 컨텍스트를 LLM 프롬프트용 텍스트로 변환
export function exportContextForLLM(sessionId: string): string {
  const context = generateDevelopmentContext(sessionId);

  const lines: string[] = [
    '# 이전 개발 세션 컨텍스트',
    '',
    `## 세션: ${context.summary.split('\n')[0].replace('## ', '')}`,
    '',
    '### 완료된 작업',
    ...context.tasksCompleted.map(t => `- ${t}`),
    '',
    '### 수정된 파일',
    ...context.filesModified.map(f => `- ${f}`),
    ''
  ];

  if (context.errorsResolved.length > 0) {
    lines.push('### 해결된 에러');
    context.errorsResolved.forEach(e => {
      lines.push(`- **에러**: ${e.error}`);
      lines.push(`  **해결**: ${e.solution}`);
      if (e.file) lines.push(`  **파일**: ${e.file}`);
    });
    lines.push('');
  }

  if (context.keyDecisions.length > 0) {
    lines.push('### 주요 결정사항');
    context.keyDecisions.forEach(d => lines.push(`- ${d}`));
    lines.push('');
  }

  if (context.codeSnippets.length > 0) {
    lines.push('### 주요 코드 스니펫');
    context.codeSnippets.forEach((snippet, i) => {
      lines.push(`#### ${i + 1}. ${snippet.description}`);
      if (snippet.file) lines.push(`파일: ${snippet.file}`);
      lines.push(`\`\`\`${snippet.language || ''}`);
      lines.push(snippet.code);
      lines.push('\`\`\`');
      lines.push('');
    });
  }

  if (context.pendingWork) {
    lines.push('### 남은 작업');
    lines.push(context.pendingWork);
    lines.push('');
  }

  return lines.join('\n');
}
