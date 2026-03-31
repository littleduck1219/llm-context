# API 명세

## 공통

### 응답 형식

**성공 응답**
```json
{
  "success": true,
  "data": { ... }
}
```

**에러 응답**
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

---

## Projects API

### GET /api/projects
모든 프로젝트 목록을 조회합니다.

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "프로젝트 이름",
      "path": "/path/to/project",
      "description": "설명",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/projects?id={projectId}
특정 프로젝트를 조회합니다.

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | string | O | 프로젝트 ID |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "프로젝트 이름",
    "path": "/path/to/project",
    "description": "설명",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/projects
새 프로젝트를 생성합니다.

**Request Body**
```json
{
  "name": "프로젝트 이름",
  "path": "/path/to/project",
  "description": "설명"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | O | 프로젝트 이름 |
| path | string | X | 프로젝트 경로 |
| description | string | X | 프로젝트 설명 |

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "프로젝트 이름",
    "path": "/path/to/project",
    "description": "설명",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /api/projects
프로젝트를 수정합니다.

**Request Body**
```json
{
  "id": "uuid",
  "name": "새 이름",
  "path": "/new/path",
  "description": "새 설명"
}
```

### DELETE /api/projects?id={projectId}
프로젝트를 삭제합니다. (연관된 세션, 메시지도 함께 삭제)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | string | O | 프로젝트 ID |

---

## Sessions API

### GET /api/sessions?projectId={projectId}
프로젝트의 세션 목록을 조회합니다.

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| projectId | string | O | 프로젝트 ID |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectId": "project-uuid",
      "title": "세션 제목",
      "summary": "세션 요약",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/sessions
새 세션을 생성합니다.

**Request Body**
```json
{
  "projectId": "project-uuid",
  "title": "세션 제목"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectId | string | O | 프로젝트 ID |
| title | string | O | 세션 제목 |

### PUT /api/sessions
세션을 수정합니다.

**Request Body**
```json
{
  "id": "session-uuid",
  "title": "새 제목",
  "summary": "새 요약"
}
```

### DELETE /api/sessions?id={sessionId}
세션을 삭제합니다. (연관된 메시지도 함께 삭제)

---

## Messages API

### GET /api/messages?sessionId={sessionId}
세션의 메시지 목록을 조회합니다.

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| sessionId | string | O | 세션 ID |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sessionId": "session-uuid",
      "role": "user",
      "content": "메시지 내용",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/messages
새 메시지를 추가합니다.

**Request Body**
```json
{
  "sessionId": "session-uuid",
  "role": "user",
  "content": "메시지 내용"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| sessionId | string | O | 세션 ID |
| role | string | O | 'user' \| 'assistant' \| 'system' |
| content | string | O | 메시지 내용 |

---

## Search API

### GET /api/search?q={query}&projectId={projectId}
메시지 내용을 검색합니다.

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| q | string | O | 검색어 |
| projectId | string | X | 프로젝트 필터링 |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sessionId": "session-uuid",
      "role": "user",
      "content": "...검색어가 포함된 내용...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "projectName": "프로젝트명",
      "sessionTitle": "세션 제목"
    }
  ]
}
```

---

## Export API

### GET /api/export?projectId={projectId}&format={format}&maxTokens={maxTokens}
프로젝트 컨텍스트를 내보냅니다.

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| projectId | string | O | 프로젝트 ID |
| format | string | X | 'markdown' (기본) \| 'json' |
| maxTokens | number | X | 최대 토큰 수 (기본: 50000) |

**Response (Markdown)**
```markdown
# 프로젝트: [프로젝트명]

## 기술 스택
- React
- TypeScript
- ...

## 아키텍처 노트
...

## 중요 결정사항
### 1. TypeScript 사용
이유: 타입 안정성 향상
...

## 세션 요약
### 세션 1: 초기 설정
...

## 최근 대화
[User]: ...
[Assistant]: ...
```

**Response (JSON)**
```json
{
  "success": true,
  "data": {
    "project": { ... },
    "memory": { ... },
    "decisions": [ ... ],
    "patterns": [ ... ],
    "sessions": [ ... ],
    "messages": [ ... ]
  }
}
```
