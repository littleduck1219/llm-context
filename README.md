# LLM Context Manager

LLM 기반 개발(Vibe Coding)에서 세션 종료 후에도 히스토리를 기억하고 효율적으로 관리할 수 있는 도구입니다.

## 기능

- **세션 저장/복원**: 대화 히스토리를 저장하고 이어서 작업
- **프로젝트 메모리**: 프로젝트별 컨텍스트, 결정사항, 패턴 저장
- **스마트 요약**: 긴 히스토리를 자동 요약해서 컨텍스트 최적화
- **검색**: 모든 대화 내용에서 키워드 검색
- **내보내기**: Markdown/JSON 형식으로 프로젝트 내보내기

## 설치

```bash
cd llm-context-manager
npm install
```

## 사용법

### 웹 대시보드

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### CLI 도구

```bash
# 프로젝트 생성
npm run cli project create -n "My Project" -p "/path/to/project" -d "프로젝트 설명"

# 프로젝트 목록
npm run cli project list

# 세션 생성
npm run cli session create -p <projectId> -t "새 세션"

# 메시지 추가
npm run cli message add -s <sessionId> -r user -c "질문 내용"
npm run cli message add -s <sessionId> -r assistant -c "응답 내용"

# 결정사항 추가
npm run cli decision add -p <projectId> -t "TypeScript 사용" -r "타입 안정성 향상"

# 컨텍스트 생성 (LLM에 입력용)
npm run cli context <projectId> -m 50000 -o context.md
```

## 워크플로우

### 1. 새 프로젝트 시작

```
1. 웹 대시보드에서 새 프로젝트 생성
2. 기술 스택, 아키텍처 노트 등 기본 정보 입력
```

### 2. 개발 세션 진행

```
1. 새 세션 생성
2. LLM과 대화하며 메시지 기록
3. 중요한 결정을 하면 decision 추가
4. 자주 쓰는 패턴을 pattern으로 저장
```

### 3. 세션 재개

```
1. CLI로 컨텍스트 생성: npm run cli context <projectId>
2. 생성된 컨텍스트를 새 LLM 세션에 붙여넣기
3. 이전 대화 내용을 바탕으로 작업 계속
```

## 데이터 저장

모든 데이터는 `~/.llm-context-manager/context.db` (SQLite)에 저장됩니다.

## 구조

```
src/
├── app/              # Next.js App Router
│   ├── api/          # API 라우트
│   └── page.tsx      # 메인 페이지
├── components/       # React 컴포넌트
├── lib/
│   ├── database.ts   # SQLite 데이터베이스
│   └── summarizer.ts # 요약 생성
├── types/            # TypeScript 타입
└── cli/              # CLI 도구
```

## 라이선스

MIT
