# LLM Context Manager Specification

프로젝트 명세서 목록입니다.

## 문서 목록

| 파일 | 설명 |
|------|------|
| [overview.md](./overview.md) | 프로젝트 개요, 문제 정의, 솔루션, 핵심 기능 |
| [architecture.md](./architecture.md) | 시스템 구조, 디렉토리 구조, 컴포넌트 다이어그램 |
| [data-model.md](./data-model.md) | ER 다이어그램, 테이블 정의, TypeScript 타입 |
| [api.md](./api.md) | REST API 엔드포인트 명세 |
| [cli.md](./cli.md) | CLI 명령어 사용법 |

## 빠른 참조

### 기술 스택
- Frontend: Next.js 14, React 18, TypeScript
- Styling: Tailwind CSS 4.x
- Database: SQLite (better-sqlite3)
- CLI: Commander.js

### 데이터 저장 위치
```
~/.llm-context-manager/context.db
```

### 실행 방법
```bash
# 웹 대시보드
npm run dev

# CLI
npm run cli -- <command>
```
