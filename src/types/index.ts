// 핵심 타입 정의

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    files?: string[];
  };
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
  tags: string[];
  metadata?: {
    totalTokens?: number;
    keyDecisions?: string[];
    filesModified?: string[];
    pendingTasks?: string[];
  };
  // CLI에서 저장한 데이터
  tasks?: string[];
  codeChanges?: Array<{ file: string; change: string }>;
  errors?: Array<{ error: string; solution: string }>;
  decisions?: string[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  sessions?: Session[];
  memory?: ProjectMemory;
  settings?: ProjectSettings;
  // Gist 기반 필드
  gistId?: string;
  lastSync?: string;
}

export interface ProjectMemory {
  // 프로젝트 컨텍스트
  techStack: string[];
  conventions: CodeConvention[];
  architectureNotes: string[];

  // 중요한 결정사항
  decisions: Decision[];

  // 자주 사용하는 패턴
  patterns: CodePattern[];

  // 파일 구조 이해
  fileStructure?: string;

  // 현재 진행 상황
  currentFocus?: string;
  pendingTasks: string[];
}

export interface CodeConvention {
  id: string;
  category: 'naming' | 'structure' | 'style' | 'testing' | 'other';
  description: string;
  examples?: string[];
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  rationale: string;
  alternatives?: string[];
  madeAt: Date;
  relatedFiles?: string[];
}

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  code?: string;
  usage: string;
  tags: string[];
}

export interface ProjectSettings {
  autoSummarize: boolean;
  summaryThreshold: number; // 메시지 수 임계값
  keepFullHistory: boolean;
  contextWindowTokens: number;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  createdAt: Date;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  nextSteps: string[];
}

// 검색 및 필터링
export interface SearchFilters {
  query?: string;
  projectId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  hasCode?: boolean;
}

// 내보내기 형식
export interface ExportFormat {
  type: 'markdown' | 'json' | 'html';
  includeMessages: boolean;
  includeSummary: boolean;
  includeMemory: boolean;
}

// === 새로운 기능: 첨부 파일, 스냅샷, Git diff ===

// 메시지 첨부 파일
export interface MessageAttachment {
  id: string;
  messageId: string;
  filename: string;
  filepath?: string;        // 원본 파일 경로 (프로젝트 내)
  content: string;          // 파일 내용
  language?: string;        // 코드 언어 (typescript, python 등)
  createdAt: Date;
}

// 파일 스냅샷
export interface FileSnapshot {
  id: string;
  projectId: string;
  sessionId?: string;       // 연결된 세션 (선택)
  label: string;            // 스냅샷 이름 (예: "초기 설정 완료")
  description?: string;
  files: SnapshotFile[];    // 포함된 파일들
  createdAt: Date;
}

export interface SnapshotFile {
  path: string;             // 프로젝트 내 상대 경로
  content: string;          // 파일 내용
  hash: string;             // 내용 해시 (변경 감지용)
  language?: string;
}

// Git 변경 사항 추적
export interface GitDiff {
  id: string;
  projectId: string;
  sessionId: string;
  fromCommit?: string;      // 시작 커밋 (없으면 워킹 디렉토리)
  toCommit?: string;        // 끝 커밋 (없으면 워킹 디렉토리)
  diff: string;             // git diff 출력
  summary: GitDiffSummary;
  createdAt: Date;
}

export interface GitDiffSummary {
  filesAdded: string[];
  filesModified: string[];
  filesDeleted: string[];
  insertions: number;
  deletions: number;
}

// === 개발 컨텍스트 (v3) ===

// 코드 변경 사항
export interface CodeChange {
  id: string;
  sessionId: string;
  messageId: string;         // 관련 메시지
  filepath: string;          // 수정된 파일 경로
  changeType: 'created' | 'modified' | 'deleted';
  beforeCode?: string;       // 변경 전 코드 (있으면)
  afterCode?: string;        // 변경 후 코드 (있으면)
  description?: string;      // 변경 설명
  lineStart?: number;
  lineEnd?: number;
  createdAt: Date;
}

// 에러/해결 이력
export interface ErrorLog {
  id: string;
  sessionId: string;
  messageId: string;         // 에러가 발생한 메시지
  errorType: string;         // 에러 타입 (TypeError, SyntaxError 등)
  errorMessage: string;      // 에러 메시지
  stackTrace?: string;       // 스택 트레이스
  relatedFile?: string;      // 관련 파일
  relatedLine?: number;      // 관련 라인
  solution?: string;         // 해결 방법
  solvedAt?: Date;           // 해결 시간
  solvedByMessageId?: string; // 해결한 메시지 ID
  createdAt: Date;
}

// 개발 컨텍스트 요약
export interface DevelopmentContext {
  sessionId: string;
  summary: string;           // 세션 전체 요약
  tasksCompleted: string[];  // 완료된 작업 목록
  filesModified: string[];   // 수정된 파일 목록
  errorsResolved: ErrorResolution[]; // 해결된 에러
  keyDecisions: string[];    // 주요 결정사항
  codeSnippets: CodeSnippet[]; // 중요 코드 스니펫
  pendingWork?: string;      // 남은 작업
  generatedAt: Date;
}

export interface ErrorResolution {
  error: string;             // 에러 내용
  solution: string;          // 해결 방법
  file?: string;             // 관련 파일
}

export interface CodeSnippet {
  description: string;       // 코드 설명
  code: string;              // 코드 내용
  language?: string;         // 언어
  file?: string;             // 파일 경로
}
