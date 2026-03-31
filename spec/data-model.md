# 데이터 모델

## ER 다이어그램

```
┌─────────────────┐       ┌─────────────────┐
│    Project      │       │  ProjectMemory  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ project_id (FK) │
│ name            │  │    │ tech_stack      │
│ path            │  │    │ architecture    │
│ description     │  │    │ notes           │
│ created_at      │  │    │ pending_tasks   │
│ updated_at      │  │    └─────────────────┘
└─────────────────┘  │
        │            │
        │ 1:N        │
        ▼            │
┌─────────────────┐  │
│    Session      │  │
├─────────────────┤  │
│ id (PK)         │  │
│ project_id (FK) │──┘
│ title           │
│ summary         │
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│    Message      │
├─────────────────┤
│ id (PK)         │
│ session_id (FK) │
│ role            │
│ content         │
│ created_at      │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│    Decision     │       │    Pattern      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ project_id (FK) │       │ project_id (FK) │
│ title           │       │ name            │
│ rationale       │       │ description     │
│ alternatives    │       │ code_example    │
│ created_at      │       │ created_at      │
└─────────────────┘       └─────────────────┘
```

## 테이블 정의

### projects
프로젝트 정보를 저장하는 메인 테이블입니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| name | TEXT | 프로젝트 이름 |
| path | TEXT | 프로젝트 경로 (선택) |
| description | TEXT | 프로젝트 설명 |
| created_at | TEXT | ISO 8601 생성 시간 |
| updated_at | TEXT | ISO 8601 수정 시간 |

### sessions
개발 세션을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| project_id | TEXT | Foreign Key (projects.id) |
| title | TEXT | 세션 제목 |
| summary | TEXT | 세션 요약 (자동 생성) |
| created_at | TEXT | ISO 8601 생성 시간 |
| updated_at | TEXT | ISO 8601 수정 시간 |

### messages
대화 메시지를 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| session_id | TEXT | Foreign Key (sessions.id) |
| role | TEXT | 'user' \| 'assistant' \| 'system' |
| content | TEXT | 메시지 내용 |
| created_at | TEXT | ISO 8601 생성 시간 |

### decisions
프로젝트의 중요한 기술적 결정사항을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| project_id | TEXT | Foreign Key (projects.id) |
| title | TEXT | 결정 제목 |
| rationale | TEXT | 결정 이유 |
| alternatives | TEXT | 고려했던 대안들 |
| created_at | TEXT | ISO 8601 생성 시간 |

### patterns
자주 사용하는 코드 패턴을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| project_id | TEXT | Foreign Key (projects.id) |
| name | TEXT | 패턴 이름 |
| description | TEXT | 패턴 설명 |
| code_example | TEXT | 코드 예시 |
| created_at | TEXT | ISO 8601 생성 시간 |

## TypeScript 타입 정의

```typescript
interface Project {
  id: string;
  name: string;
  path?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Session {
  id: string;
  projectId: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface Decision {
  id: string;
  projectId: string;
  title: string;
  rationale: string;
  alternatives?: string;
  createdAt: string;
}

interface CodePattern {
  id: string;
  projectId: string;
  name: string;
  description: string;
  codeExample?: string;
  createdAt: string;
}

interface ProjectMemory {
  techStack: string[];
  architectureNotes: string;
  pendingTasks: string[];
  conventions: CodeConvention[];
}

interface CodeConvention {
  name: string;
  description: string;
  example?: string;
}

interface SessionSummary {
  sessionId: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  nextSteps: string[];
}
```

## 추가 테이블 (v2 - 개선된 기능)

### message_attachments
메시지에 첨부된 코드 파일을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| message_id | TEXT | Foreign Key (messages.id) |
| filename | TEXT | 파일 이름 |
| filepath | TEXT | 프로젝트 내 상대 경로 |
| content | TEXT | 파일 전체 내용 |
| language | TEXT | 코드 언어 (typescript 등) |
| created_at | TEXT | ISO 8601 생성 시간 |

### file_snapshots
프로젝트 파일 상태 스냅샷을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| project_id | TEXT | Foreign Key (projects.id) |
| session_id | TEXT | Foreign Key (sessions.id), 선택 |
| label | TEXT | 스냅샷 이름 |
| description | TEXT | 설명 |
| files | TEXT | JSON 배열 (SnapshotFile[]) |
| created_at | TEXT | ISO 8601 생성 시간 |

### git_diffs
세션 간 Git 변경 사항을 저장합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | UUID, Primary Key |
| project_id | TEXT | Foreign Key (projects.id) |
| session_id | TEXT | Foreign Key (sessions.id) |
| from_commit | TEXT | 시작 커밋 해시 |
| to_commit | TEXT | 끝 커밋 해시 |
| diff | TEXT | git diff 출력 |
| summary | TEXT | JSON (GitDiffSummary) |
| created_at | TEXT | ISO 8601 생성 시간 |

## 인덱스 전략

```sql
-- 세션 조회 최적화
CREATE INDEX idx_sessions_project_id ON sessions(project_id);

-- 메시지 조회 최적화
CREATE INDEX idx_messages_session_id ON messages(session_id);

-- 검색 최적화
CREATE INDEX idx_messages_content ON messages(content);

-- 결정사항/패턴 조회 최적화
CREATE INDEX idx_decisions_project_id ON decisions(project_id);
CREATE INDEX idx_patterns_project_id ON patterns(project_id);

-- 새로운 인덱스
CREATE INDEX idx_attachments_message ON message_attachments(message_id);
CREATE INDEX idx_snapshots_project ON file_snapshots(project_id);
CREATE INDEX idx_snapshots_session ON file_snapshots(session_id);
CREATE INDEX idx_diffs_session ON git_diffs(session_id);
```

## TypeScript 타입 정의 (v2 추가)

```typescript
// 메시지 첨부 파일
interface MessageAttachment {
  id: string;
  messageId: string;
  filename: string;
  filepath?: string;
  content: string;
  language?: string;
  createdAt: Date;
}

// 파일 스냅샷
interface FileSnapshot {
  id: string;
  projectId: string;
  sessionId?: string;
  label: string;
  description?: string;
  files: SnapshotFile[];
  createdAt: Date;
}

interface SnapshotFile {
  path: string;
  content: string;
  hash: string;
  language?: string;
}

// Git 변경 사항
interface GitDiff {
  id: string;
  projectId: string;
  sessionId: string;
  fromCommit?: string;
  toCommit?: string;
  diff: string;
  summary: GitDiffSummary;
  createdAt: Date;
}

interface GitDiffSummary {
  filesAdded: string[];
  filesModified: string[];
  filesDeleted: string[];
  insertions: number;
  deletions: number;
}
```
