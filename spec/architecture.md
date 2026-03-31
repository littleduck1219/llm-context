# 아키텍처

## 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
├─────────────────────────────┬───────────────────────────────┤
│      Web Dashboard          │         CLI Tool              │
│      (Next.js/React)        │      (Commander.js)           │
├─────────────────────────────┴───────────────────────────────┤
│                      API Layer                               │
│              (Next.js API Routes)                            │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic                            │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │   Database      │  │        Summarizer               │  │
│  │   (SQLite)      │  │   (Context Compression)         │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Data Storage                              │
│              ~/.llm-context-manager/context.db               │
└─────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── projects/         # 프로젝트 CRUD
│   │   ├── sessions/         # 세션 CRUD
│   │   ├── messages/         # 메시지 CRUD
│   │   ├── search/           # 검색 기능
│   │   └── export/           # 내보내기
│   ├── globals.css           # 전역 스타일
│   ├── layout.tsx            # 루트 레이아웃
│   └── page.tsx              # 메인 페이지
│
├── components/               # React 컴포넌트
│   ├── Sidebar.tsx           # 사이드바 (프로젝트 목록)
│   ├── ProjectList.tsx       # 프로젝트 그리드
│   ├── SessionView.tsx       # 세션 메시지 뷰
│   ├── MemoryPanel.tsx       # 메모리 패널
│   └── SearchBar.tsx         # 검색 바
│
├── lib/                      # 핵심 로직
│   ├── database.ts           # SQLite 데이터베이스 레이어
│   └── summarizer.ts         # 요약 및 압축 로직
│
├── types/                    # TypeScript 타입 정의
│   └── index.ts
│
└── cli/                      # CLI 도구
    └── index.ts              # Commander.js 진입점
```

## 컴포넌트 다이어그램

```
┌──────────────────────────────────────────────────────────┐
│                        page.tsx                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                    State                             │ │
│  │  - projects, selectedProject                        │ │
│  │  - sessions, selectedSession                        │ │
│  │  - activeView: 'projects' | 'sessions' | 'memory'  │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
│  ┌───────────────────────┼───────────────────────────┐  │
│  │                       ▼                           │  │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │  │
│  │  │ Sidebar  │  │ SearchBar │  │ MemoryPanel  │  │  │
│  │  └────┬─────┘  └───────────┘  └──────────────┘  │  │
│  │       │                                          │  │
│  │       ▼                                          │  │
│  │  ┌──────────────┐    ┌─────────────────────┐   │  │
│  │  │ ProjectList  │ or │    SessionView      │   │  │
│  │  └──────────────┘    └─────────────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## 데이터 흐름

### 1. 프로젝트 생성 흐름
```
User Input → Sidebar.tsx → POST /api/projects
    → database.createProject() → SQLite INSERT
    → Response → State Update → UI Refresh
```

### 2. 메시지 추가 흐름
```
User Input → SessionView.tsx → POST /api/messages
    → database.addMessage() → SQLite INSERT
    → Response → State Update → Message List Refresh
```

### 3. 컨텍스트 생성 흐름 (CLI)
```
CLI Command → database.getProject()
    → database.getSessions() → database.getMessages()
    → summarizer.compressHistory()
    → Markdown Generation → File Output
```

## API 엔드포인트 구조

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/projects | 프로젝트 목록 |
| POST | /api/projects | 프로젝트 생성 |
| GET | /api/projects/[id] | 프로젝트 상세 |
| PUT | /api/projects/[id] | 프로젝트 수정 |
| DELETE | /api/projects/[id] | 프로젝트 삭제 |
| GET | /api/sessions | 세션 목록 |
| POST | /api/sessions | 세션 생성 |
| GET | /api/messages | 메시지 목록 |
| POST | /api/messages | 메시지 추가 |
| GET | /api/search | 검색 |
| GET | /api/export | 내보내기 |
