# CLI 명세

## 개요

CLI 도구는 터미널에서 빠르게 프로젝트, 세션, 메시지를 관리하고 LLM에 입력할 컨텍스트를 생성하는 기능을 제공합니다.

## 사용법

```bash
npm run cli -- <command> [options]
# 또는
npx ts-node src/cli/index.ts <command> [options]
```

---

## 프로젝트 명령어

### project create
새 프로젝트를 생성합니다.

```bash
npm run cli -- project create -n "프로젝트명" -p "/path/to/project" -d "설명"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --name | -n | O | 프로젝트 이름 |
| --path | -p | X | 프로젝트 경로 |
| --description | -d | X | 프로젝트 설명 |

**출력 예시**
```
✓ 프로젝트 생성 완료
ID: 550e8400-e29b-41d4-a716-446655440000
이름: My Project
```

### project list
모든 프로젝트 목록을 조회합니다.

```bash
npm run cli -- project list
```

**출력 예시**
```
┌──────────────────────────────────────┬─────────────┬─────────────────────┐
│ ID                                   │ Name        │ Created             │
├──────────────────────────────────────┼─────────────┼─────────────────────┤
│ 550e8400-e29b-41d4-a716-446655440000 │ My Project  │ 2024-01-01 10:00:00 │
│ 660e8400-e29b-41d4-a716-446655440001 │ Another     │ 2024-01-02 14:30:00 │
└──────────────────────────────────────┴─────────────┴─────────────────────┘
```

### project delete
프로젝트를 삭제합니다.

```bash
npm run cli -- project delete -i <projectId>
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --id | -i | O | 프로젝트 ID |

---

## 세션 명령어

### session create
새 세션을 생성합니다.

```bash
npm run cli -- session create -p <projectId> -t "세션 제목"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --project | -p | O | 프로젝트 ID |
| --title | -t | O | 세션 제목 |

### session list
프로젝트의 세션 목록을 조회합니다.

```bash
npm run cli -- session list -p <projectId>
```

### session delete
세션을 삭제합니다.

```bash
npm run cli -- session delete -i <sessionId>
```

---

## 메시지 명령어

### message add
메시지를 추가합니다.

```bash
npm run cli -- message add -s <sessionId> -r user -c "질문 내용"
npm run cli -- message add -s <sessionId> -r assistant -c "응답 내용"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --session | -s | O | 세션 ID |
| --role | -r | O | 'user' \| 'assistant' \| 'system' |
| --content | -c | O | 메시지 내용 |

### message list
세션의 메시지 목록을 조회합니다.

```bash
npm run cli -- message list -s <sessionId>
```

**출력 예시**
```
Session: 초기 설정 (abc-123)

[2024-01-01 10:00:00] USER:
안녕하세요, 새 프로젝트를 시작하려고 합니다.

[2024-01-01 10:00:05] ASSISTANT:
안녕하세요! 어떤 프로젝트인지 말씀해 주시면...

---
Total: 2 messages
```

---

## 결정사항 명령어

### decision add
중요한 기술적 결정을 추가합니다.

```bash
npm run cli -- decision add -p <projectId> -t "TypeScript 사용" -r "타입 안정성 향상" -a "JavaScript, Flow"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --project | -p | O | 프로젝트 ID |
| --title | -t | O | 결정 제목 |
| --rationale | -r | O | 결정 이유 |
| --alternatives | -a | X | 고려했던 대안들 |

### decision list
프로젝트의 결정사항 목록을 조회합니다.

```bash
npm run cli -- decision list -p <projectId>
```

---

## 패턴 명령어

### pattern add
코드 패턴을 추가합니다.

```bash
npm run cli -- pattern add -p <projectId> -n "Error Handling" -d "에러 처리 패턴" -c "try { ... } catch (e) { ... }"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --project | -p | O | 프로젝트 ID |
| --name | -n | O | 패턴 이름 |
| --description | -d | O | 패턴 설명 |
| --code | -c | X | 코드 예시 |

### pattern list
프로젝트의 패턴 목록을 조회합니다.

```bash
npm run cli -- pattern list -p <projectId>
```

---

## 컨텍스트 명령어

### context
LLM에 입력할 컨텍스트를 생성합니다.

```bash
npm run cli -- context <projectId> [options]
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --max-tokens | -m | X | 최대 토큰 수 (기본: 50000) |
| --output | -o | X | 출력 파일 경로 |
| --format | -f | X | 'markdown' (기본) \| 'json' |

**사용 예시**
```bash
# 콘솔에 출력
npm run cli -- context abc-123

# 파일로 저장
npm run cli -- context abc-123 -o context.md

# 토큰 제한 설정
npm run cli -- context abc-123 -m 30000 -o context.md
```

**출력 예시 (Markdown)**
```markdown
# 프로젝트 컨텍스트: My Project

## 프로젝트 정보
- **경로**: /path/to/project
- **설명**: 웹 애플리케이션 개발

## 기술 스택
- React 18
- TypeScript 5
- Tailwind CSS

## 아키텍처 노트
- App Router 사용
- SQLite 로컬 저장

## 중요 결정사항

### 1. TypeScript 사용 (2024-01-01)
**이유**: 타입 안정성 향상
**대안**: JavaScript, Flow

## 자주 사용하는 패턴

### Error Handling
에러 처리 표준 패턴
```typescript
try {
  // 비즈니스 로직
} catch (error) {
  console.error(error);
  throw new AppError(error.message);
}
```

## 세션 히스토리

### 세션 1: 초기 설정 (2024-01-01)
요약: 프로젝트 구조 설계 및 초기 설정 완료

### 세션 2: 기능 구현 (2024-01-02)
요약: 핵심 기능 구현 및 테스트 작성

---

## 최근 대화 (요약됨)

[User]: 인증 기능을 추가하고 싶습니다.
[Assistant]: JWT 기반 인증을 추천합니다...

---
*생성 일시: 2024-01-03 15:30:00*
*예상 토큰: ~5,000*
```

---

## 검색 명령어

### search
모든 메시지에서 검색합니다.

```bash
npm run cli -- search "검색어" -p <projectId>
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| query | (위치) | O | 검색어 |
| --project | -p | X | 프로젝트 필터링 |

---

## 첨부 파일 명령어 (v2新增)

### attach add
메시지에 파일을 첨부합니다. **실제 파일 내용을 저장합니다.**

```bash
# 단일 파일 첨부
npm run cli -- attach add -m <messageId> -f src/App.tsx

# 여러 파일 첨부
npm run cli -- attach add -m <messageId> -f "src/**/*.tsx"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --message | -m | O | 메시지 ID |
| --file | -f | O | 파일 경로 (glob 패턴 지원) |
| --project-root | -p | X | 프로젝트 루트 경로 |

**사용 예시**
```bash
# LLM이 작성한 코드를 첨부 파일로 저장
npm run cli -- attach add -m msg-123 -f src/components/LoginForm.tsx -p /path/to/project
```

### attach list
메시지의 첨부 파일 목록을 조회합니다.

```bash
npm run cli -- attach list -m <messageId>
```

---

## 스냅샷 명령어 (v2新增)

### snapshot create
현재 프로젝트 파일 상태를 스냅샷으로 저장합니다.

```bash
npm run cli -- snapshot create -p <projectId> -l "기능 구현 완료" -f "src/**/*.ts"
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --project | -p | O | 프로젝트 ID |
| --label | -l | O | 스냅샷 이름 |
| --files | -f | X | 포함할 파일 패턴 (기본: 모든 소스) |
| --session | -s | X | 연결할 세션 ID |
| --description | -d | X | 설명 |

**사용 예시**
```bash
# 개발 세션 종료 시 스냅샷 생성
npm run cli -- snapshot create -p abc-123 -l "인증 기능 완료" -s sess-456 -f "src/auth/**/*"
```

### snapshot list
프로젝트의 스냅샷 목록을 조회합니다.

```bash
npm run cli -- snapshot list -p <projectId>
```

### snapshot show
특정 스냅샷의 파일 내용을 조회합니다.

```bash
npm run cli -- snapshot show -i <snapshotId>
```

---

## Git Diff 명령어 (v2新增)

### git diff
세션 시작/종료 시 Git 변경 사항을 저장합니다.

```bash
# 워킹 디렉토리 변경 사항 저장
npm run cli -- git diff -p <projectId> -s <sessionId>

# 두 커밋 간 변경 사항 저장
npm run cli -- git diff -p <projectId> -s <sessionId> --from abc123 --from def456
```

| 옵션 | 약자 | 필수 | 설명 |
|------|------|------|------|
| --project | -p | O | 프로젝트 ID |
| --session | -s | O | 세션 ID |
| --from | -f | X | 시작 커밋 |
| --to | -t | X | 끝 커밋 |

**사용 예시**
```bash
# 세션 시작 시 베이스라인 저장
npm run cli -- git diff -p abc-123 -s sess-456

# 세션 종료 시 변경 사항 저장
npm run cli -- git diff -p abc-123 -s sess-456 --from HEAD~1 --to HEAD
```

### git history
세션의 Git 변경 이력을 조회합니다.

```bash
npm run cli -- git history -s <sessionId>
```

---

## 워크플로우 예시

### 새 프로젝트 시작
```bash
# 1. 프로젝트 생성
npm run cli -- project create -n "My App" -p "/home/user/myapp" -d "새로운 웹앱"

# 2. 첫 세션 생성
npm run cli -- session create -p <projectId> -t "프로젝트 설정"

# 3. 대화 기록
npm run cli -- message add -s <sessionId> -r user -c "Next.js로 시작하고 싶어"
npm run cli -- message add -s <sessionId> -r assistant -c "Next.js 14 App Router를 추천합니다..."

# 4. 결정사항 기록
npm run cli -- decision add -p <projectId> -t "Next.js 14 사용" -r "SSR 및 최신 기능"
```

### 세션 재개
```bash
# 1. 컨텍스트 생성
npm run cli -- context <projectId> -o context.md

# 2. 새 LLM 세션에서 context.md 내용을 붙여넣기

# 3. 새 세션 생성하여 계속 작업
npm run cli -- session create -p <projectId> -t "이어서 작업"
```
