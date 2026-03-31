# LLM Context Manager

LLM 기반 개발(Vibe Coding)에서 세션 종료 후에도 히스토리를 기억하고 효율적으로 관리할 수 있는 도구입니다.

GitHub Gist를 기반으로 클라우드에 컨텍스트를 저장하여 어디서든 동일한 개발 컨텍스트를 불러올 수 있습니다.

## 기능

- **클라우드 저장**: GitHub Gist에 컨텍스트 저장
- **세션 저장/복원**: 대화 히스토리를 저장하고 이어서 작업
- **프로젝트 메모리**: 프로젝트별 컨텍스트, 결정사항, 패턴 저장
- **간편한 워크플로우**: `start` 한 번으로 초기화 + 로드
- **웹 대시보드**: 시각적으로 컨텍스트 관리

## 설치

```bash
cd llm-context-manager
npm install
npm run build
npm link  # 전역 CLI 설치
```

## 빠른 시작

### 1. GitHub 토큰 설정

GitHub Personal Access Token (gist 권한 필요)을 설정합니다:

```bash
llm-context set-token ghp_xxxxxxxxxxxx
```

토큰 생성: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic) → **gist** 체크

### 2. 프로젝트 시작

```bash
llm-context start
```

이 명령어 하나로:
- 프로젝트가 없으면 자동 초기화
- 이전 컨텍스트 로드
- 세션 시작 기록

### 3. 개발 진행

평소처럼 Claude Code와 함께 개발합니다.

### 4. 세션 종료

```bash
# 기본 저장
llm-context end "기능 구현 완료"

# 작업 내역과 함께 저장
llm-context end -t "로그인 기능 구현" -t "API 연동" --title "인증 시스템 개발"
```

## CLI 명령어

### 필수 명령어

| 명령어 | 설명 |
|--------|------|
| `llm-context set-token <token>` | GitHub 토큰 설정 |
| `llm-context start [path] [name]` | 프로젝트 시작 (자동 초기화 + 로드) |
| `llm-context end [title]` | 세션 종료 및 저장 |

### 세션 종료 옵션

```bash
llm-context end [title] \
  -t "작업1" -t "작업2"           # 완료한 작업
  -c "file.ts:변경내용"           # 코드 변경
  -e "에러→해결방법"              # 에러 및 해결
  -d "결정사항"                   # 내린 결정
```

### 빠른 추가

개발 중간에 바로 추가:

```bash
llm-context add task "사용자 인증 구현"
llm-context add change "auth.ts:JWT 토큰 로직 추가"
llm-context add error "Type error→타입 단언 추가"
llm-context add decision "PostgreSQL 사용 결정"
```

### 기타 명령어

| 명령어 | 설명 |
|--------|------|
| `llm-context init [path] [name]` | 새 프로젝트 초기화 |
| `llm-context load [path]` | 컨텍스트 로드만 |
| `llm-context save [path] [title]` | 수동 저장 |
| `llm-context list` | 등록된 프로젝트 목록 |
| `llm-context sync` | 모든 프로젝트 동기화 |
| `llm-context connect <path> <gistId>` | 기존 Gist 연결 |

## 웹 대시보드

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속하면 시각적으로 컨텍스트를 관리할 수 있습니다.

## 워크플로우 예시

### 새 프로젝트 시작

```bash
cd my-project
llm-context set-token ghp_xxxx  # 최초 1회
llm-context start
```

### 매일 개발 시작

```bash
cd my-project
llm-context start
# ... 개발 ...
llm-context end "오늘 작업 완료"
```

### 다른 컴퓨터에서 작업

```bash
# 새 컴퓨터에서
git clone my-project
cd my-project
llm-context set-token ghp_xxxx
llm-context connect . <gist-id>  # 기존 Gist 연결
llm-context start
```

## 데이터 저장

모든 데이터는 GitHub Gist에 저장됩니다:
- **URL**: https://gist.github.com/<gist-id>
- **포맷**: Markdown
- **로컬 캐시**: `~/.llm-context-manager/cache/`

## Claude Code Hooks 연동

`.claude/settings.json`에 추가:

```json
{
  "hooks": {
    "session-start": "llm-context start",
    "session-end": "llm-context end"
  }
}
```

이렇게 하면 Claude Code 세션이 시작/종료될 때 자동으로 컨텍스트가 로드/저장됩니다.

## 프로젝트 구조

```
src/
├── app/              # Next.js App Router (웹 대시보드)
│   ├── api/          # API 라우트
│   └── page.tsx      # 메인 페이지
├── components/       # React 컴포넌트
├── lib/
│   ├── gist.ts       # Gist API 라이브러리
│   └── summarizer.ts # 요약 생성
├── types/            # TypeScript 타입
├── cli/              # CLI 도구
└── mcp-server/       # MCP 서버
```

## 라이선스

MIT
