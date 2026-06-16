# 🚀 MOYEOLOG x ECC Project Documentation

This file serves as the master top-level document for the **Gemini CLI** agent. It defines the project's current state, core development workflows (based on ECC - Everything Claude Code), review standards, security checklists, and architectural guidelines.

**Last Updated:** 2026-06-01 (by Gemini CLI)

---

## 🛑 0. Agent Core Rules (Language Policy)

When operating within this project, the Gemini CLI MUST strictly adhere to the following language policies:

1. **Korean Only for Responses:** All outputs, explanations, code review feedback, planning, and communication with the user **MUST be written in Korean**.
2. **Korean Commit Messages:** When generating Git commit messages, the description and body **MUST be written in Korean** (See section 4.2 for formatting details).

---

## 📌 1. Project Overview & Tech Stack

### 1.1 Overview

**MOYEOLOG** is a collaborative and personal management platform that supports schedule management, memo sharing, and group meetings. It features a user-friendly UI integrated with AI-driven smart functionalities.

### 1.2 Tech Stack

- **Frontend Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend Framework:** Spring Boot 4.x, Java 25, Spring Data JPA, Spring Security
- **Database & Storage:** MySQL 8.x, Local File System (`/uploads/`)
- **Authentication:** Next-Auth & JWT Token (Kakao OAuth & 8-character Custom User ID system)
- **AI Engine:** Google Gemini API (gemini-3.1-flash-lite / advanced models for insights)
- **Markdown Editor:** `@uiw/react-md-editor`

---

## 🛠 2. Core Workflow & Coding Standards (ECC Baseline)

Gemini CLI must strictly follow these processes and standards for all tasks.

### 2.1 Core Workflow

1. **Plan Before Execute:** For large features or refactoring, plan the structure and dependencies before writing code (utilize the `planner` agent).
2. **Test-Driven Development (TDD):** Write tests first before implementing bug fixes or new features. Target a **minimum 80% coverage**.
3. **Self Code Review:** Review your own code for quality, readability, and maintainability before committing.
4. **Self Security Review:** Validate sensitive code against the security checklist before deployment.
5. **Self-Contained Changes:** Keep code modular, readable, and easy to revert in case of issues.

### 2.2 Coding Standards

- **Immutability:** Always create new objects/states rather than mutating existing ones.
- **Single Responsibility:** Keep functions small (<50 lines) and files focused (200-400 lines, max 800 lines).
- **Fail Loudly:** Do not silently swallow errors. Fail fast with clear, contextual error messages (user-friendly on the frontend, detailed context logging on the backend).
- **Input Validation:** Validate all external data and user inputs at system boundaries using schema-based validation.

---

## ✨ 3. Implemented Features & Architecture

### 3.1 Core Features

- **Home (`/home`):** An integrated dashboard fetching recent memos, calendar schedules, and active group lists in real-time.
- **Memo Storage (`/memo`):** \* Grid/List view toggling and Markdown editor support with real-time preview.
  - **AI Insights:** Gemini-powered OCR (text extraction from images), 3-line summaries, and key keyword extraction.
  - **AI Tag Recommendation:** 1-click addition of extracted keywords to memo tags and real-time tag management UI/API.
  - **Favorites:** Star functionality to mark and filter important memos.
  - **Drafting:** Supports up to 50MB image uploads and tag configurations.
- **Schedule Management (`/schedule`):** \* Unified calendar for personal and group schedules.
  - **Authorization:** UI gating and backend validation ensuring only the schedule creator can edit/delete their events.
  - **Place Recommendations:** Nearby restaurant/cafe suggestions and Kakao Map integration when searching for meeting locations.
- **Group Management (`/groups`):** Friend-list based invitation system (`GroupInvitation`). Users must accept the invite via notifications to join. 
  - **Spaces:** Includes group-specific memos, calendars, and **Topics**.
  - **Topics:** Markdown-based discussion threads with single image support, commenting system, and AI insights (OCR & Summary).

### 3.2 Architecture & System Rules

- **Custom ID System:** Automatically assigns an 8-character alphanumeric ID (`customId`) upon registration to allow friend searches without exposing emails.
- **Repository Pattern:** Encapsulates database access behind standard interfaces to decouple business logic from storage mechanisms.
- **Standard API Envelope:** Consistent API response format containing Success indicator, Data payload, Error message, and Pagination metadata.
- **Infrastructure & Timeouts:** \* Timeouts extended to **60 seconds** across all layers (Spring, Next.js) to ensure sufficient time for AI analysis.
  - Image upload limit increased to **50MB** (configured across Nginx, Spring, and Tomcat).

---

## 🔒 4. Security & Delivery Standards

### 4.1 Security Checklist

Gemini CLI must automatically verify the following before ANY commit or code generation:

- [ ] **Secret Management:** NEVER hardcode API keys (e.g., Gemini), passwords, or tokens. Use environment variables or `application.yml` (only share `application.yml.example`).
- [ ] **Data Validation:** All external inputs and request parameters are validated.
- [ ] **Injection Prevention:** Parameterized queries (or JPA Repositories) are used for all database interactions.
- [ ] **XSS & CSRF Prevention:** Markdown/HTML outputs (e.g., `@uiw/react-md-editor`) are sanitized, and CSRF protection is enabled.
- [ ] **Authn/Authz Checks:** Sensitive API routes (e.g., `PUT /api/schedules/{id}`) verify that the logged-in session user is the authorized creator.
- [ ] **No Information Leakage:** Global Exception Handlers scrub internal error stacks from being exposed to the client.

### 4.2 Delivery & Commit Rules

- **Conventional Commits (Korean Enforced):** Use standard English prefixes (`feat:`, `fix:`, `refactor:`, etc.), but **the description and body MUST be written in Korean.**
  - ❌ Bad: `feat: add ai insight feature`
  - ✅ Good: `feat: AI 인사이트 기능 연동 완료`
  - ✅ Good: `fix: 로그아웃 시 세션 초기화 버그 수정`
- **Minimize Dependencies:** Before adding new third-party runtime libraries, evaluate if a local implementation is feasible to keep the bundle lightweight.

---

## 📅 5. Session Handover & Next Steps

### 📊 Completed Work History

- **2026-06-16 (배포 환경 최적화 및 모니터링 구축):**
  - **보안 및 리소스 최적화**: MySQL 외부 포트 차단 및 루프백(`127.0.0.1`) 격리. JVM 힙 메모리 최적화(`JAVA_TOOL_OPTIONS`)로 OOM 방지. Nginx 프록시 버퍼 튜닝 및 gzip MIME 타입 확장.
  - **Next.js 최적화**: `unoptimized: true` 해제 및 이미지 최적화 활성화. 이미지 캐시 영구화를 위해 `fe_image_cache` 도커 볼륨 마운트. Nginx 레벨에서 `/_next/static/` 정적 번들 자원 1년 장기 브라우저 캐싱 적용. `remotePatterns` 화이트리스트 정교화(카카오/자사 도메인 추가).
  - **통합 모니터링 구축**: Prometheus, Grafana, cAdvisor, Node Exporter 연동 완료 (포트 3000). 실시간 컨테이너 로그 조회 및 보안 인증이 연동된 Dozzle 뷰어 도입 (포트 8888).
  - **헬스체크 및 자가 복구**: 컨테이너 루프백 연결 이슈(Alpine IPv6 오류) 해결을 위해 헬스체크 주소를 `127.0.0.1`로 변경하여 자가 치유(Self-healing) 인프라 구축 완료.
  - **부하 테스트**: k6 시나리오 스크립트(`load-test.js`) 작성 및 카카오 API 쿼리 파라미터 누락 버그 수정.
- **2026-06-01 (Part 2):**
  - **Group Topics:** Implemented full-stack support for topics within groups.
  - **@Mentions:** Added ability to mention group members and memos in topic content and comments.
  - **Backend:** Created `GroupTopic`, `GroupTopicComment`, and `GroupTopicInsight` entities/APIs. Integrated Gemini for topic analysis. Updated `GroupTopicResponse` to include `groupId`.
  - **Frontend:** Added "토픽" tab to group detail page, built `GroupTopicCreateModal` (markdown editor) and `GroupTopicDetailModal` (comments/AI section). Extracted `Mentions` components for reuse.
  - **Refactoring:** Completed major frontend refactor by decomposing `AppointmentModal` into custom hooks (`useKakaoMap`, `usePlaceSearch`, `useMentions`) and smaller components.
- **2026-06-01 (Part 1):**
  - Implemented `PUT /api/schedules/{id}` endpoint with backend creator authorization.
  - Added edit mode to `AppointmentModal` and an edit button to `AppointmentDetailModal` (visible only to creators).
  - Added `isFavorite` field to the `Memo` entity, built the toggle API, and linked the Star icon in the frontend.
  - Verified successful full builds for both Frontend (Next.js) and Backend (Gradle).
- **2026-05-25:**
  - Completed `GroupInvitation` system (invite/accept/reject flows).
  - Transitioned to the 8-character Custom ID system for friend searches.
  - Advanced Gemini API integration (OCR, 3-line summaries, keyword extraction, and clickable recommended tags).
  - Integrated `@uiw/react-md-editor` with live preview.
  - Upgraded infrastructure settings (50MB upload limit, 60s timeouts including Nginx).
- **2026-06-02:**
  - **Group UI Redesign:** Implemented a modern Discord-style sidebar navigation and Glassmorphism dashboard for the Group Detail page. Removed focus outlines and borders for a cleaner aesthetic.
  - **Browse (Activity Feed):** Developed a centralized timeline on the `/groups` landing page showing recent memos, topics, schedules, and comments from all joined groups.
  - **Author/Modifier Tracking:** Enhanced memo system to display the original creator and the latest modifier. Allowed all group members to edit group memos.
  - **Image Proxy:** Implemented a server-side proxy (`/api/proxy-image`) and frontend fallback to fix 403 Forbidden errors when loading external images from Kakao search.
  - **Group Schedule Fix:** Resolved a bug where clicking a date in the group calendar wouldn't display its schedules.
  - **Code Cleanup:** Removed legacy `memo-storage.ts` and unified shared utilities in `src/lib/utils.ts`.
- **2026-06-01 (Part 2):**
...
### 🏃 Next Steps

- [ ] **Real-time Notifications (SSE/WebSocket):** Build a global notification hub for instant push popups.
- [ ] **AI Smart Place Recommendations:** Implement an algorithm to suggest locations based on group memos and characteristics.
- [ ] **Mobile Optimization:** Refine the new sidebar layout for smaller screens.
### ⚠️ Infrastructure Warnings

- **Nginx Configuration:** To apply changes to `client_max_body_size`, you must run `docker compose up --build -d` in local/production environments.
- **Environment Variables:** Upon starting a new session, ensure the latest Gemini API Key is properly bound in the local `application.yml`.
