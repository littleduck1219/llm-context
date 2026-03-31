# 프로젝트: LLM Context Manager

**경로:** C:/Users/User/develop/llm-context-manager

**설명:** LLM 개발 세션 히스토리 관리 도구

## 주요 결정사항

### Next.js 14 App Router 사용
SSR 지원, 최신 기능, 파일 기반 라우팅

**이유:** Pages Router, Remix

## 최근 대화 히스토리

### 초기 개발 세션

**사용자:**
프로젝트에서 개발하면서 LLM모델을 사용해서 바이브 코딩을 할때 컴퓨터를 끄거나 세션을 종료하면 모델들은 히스토리를 기억못하는데 히스토리를 기억하면서 효율적으로 관리 할 수 있는 프로그램을 만들고 싶어

**어시스턴트:**
LLM Context Manager 프로젝트를 만들겠습니다. 기술 스택: Next.js 14, React 18, TypeScript, Tailwind CSS 4, SQLite(better-sqlite3). 주요 기능: 세션 저장/복원, 프로젝트 메모리, 스마트 요약. 컨텍스트 내보내기. 데이터는 ~/.llm-context-manager/context.db에 저장됩니다.

**어시스턴트:**
프로젝트 구조를 설계하겠습니다:

**어시스턴트:**
데이터베이스 레이어를 구현합니다. SQLite(better-sqlite3) 사용:

**어시스턴트:**
API 라우트 구현 완료:

**어시스턴트:**
프론트엔드 컴포넌트들을 구현했습니다:

**컴포넌트 구조:**
- Sidebar.tsx: 프로젝트 목록, 새 프로젝트 생성 폼
- ProjectList.tsx: 프로젝트 그리드 뷰
- SessionView.tsx: 메시지 목록. 복사 기능. 요약 생성
- MemoryPanel.tsx: 탭 인터페이스 (세션/메모리/결정사항/패턴)
- SearchBar.tsx: 검색 입력. 결과 드롭다운

**상태 관리:**
- projects, selectedProject
- sessions, selectedSession
- activeView: 'projects' | 'sessions' | 'memory'

모든 컴포넌트는 Lucide React 아이콘 사용.

**어시스턴트:**
요약 및 컨텍스트 압축 기능을 구현합니다 (src/lib/summarizer.ts):

**어시스턴트:**
CLI 도구 구현 (src/cli/index.ts):

**사용자:**
spec 폴더를 만들어서 프로젝트 내용을 작성해줘

**사용자:**
Tailwind 4.x PostCSS 설정 에러가 발생했. @tailwindcss/postcss 플러그인이 별 수가 직접 @import tailwindcss를 globals.css로 변경

**어시스턴트:**
해결: @tailwindcss/postcss 패키지 설치 및 postcss.config.js 업데이트:

**사용자:**
spec 폴더를 만들어서 프로젝트 내용을 작성해줘

**어시스턴트:**
spec 폴더 생성 및 프로젝트 명세서 작성:

