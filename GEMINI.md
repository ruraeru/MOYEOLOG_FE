# 🚀 MOYEOLOG (모여로그) Project Documentation

이 파일은 **Gemini CLI** 에이전트가 프로젝트의 현재 상태, 구현된 기능, 아키텍처 결정을 기록하여 다른 에이전트나 개발자가 프로젝트 흐름을 쉽게 파악할 수 있도록 돕기 위해 작성되었습니다.

## 📌 프로젝트 개요
**모여로그**는 일정 관리, 메모 공유, 그룹 모임을 지원하는 협업 및 개인 관리 플랫폼입니다. 사용자 친화적인 UI와 AI 기반의 스마트 기능을 특징으로 합니다.

## 🛠 기술 스택
- **Frontend Framework:** Next.js 15 (App Router)
- **Backend Framework:** Spring Boot 4.x, Spring Data JPA, Spring Security
- **Database:** MySQL 8.x
- **Language:** TypeScript, Java 25
- **Styling:** Tailwind CSS
- **Auth:** Next-Auth & JWT Token (Kakao OAuth 연동)
- **Image Storage:** Local File System (`/uploads/`)

## ✨ 구현된 주요 기능

### 1. 네비게이션 및 공통 UI
- **GNB (Navbar):** 홈, 일정, 메모, 모임, 친구, 알림, 설정 탭 연동. 현재 활성 탭 하이라이트 및 알림 배지(3개) 표시.
- **프로필 모달:** GNB 우측 프로필 클릭 시 나타나는 드롭다운 모달. 프로필 관리, 앱 설정, 도움말 링크 및 로그아웃 기능 포함.

### 2. 메모 보관함 (`/memo`)
- **멀티 뷰 지원:** 그리드(Grid) 뷰와 리스트(List) 뷰 전환 기능.
- **메모 상세 보기:** 클릭 시 나타나는 상세 모달. AI 인사이트(요약, 키워드, 감정 분석), 그룹 멤버, OCR 추출 텍스트 영역 포함.
- **새 메모 작성:** 제목 입력, 이미지 업로드(드래그 앤 드롭 UI), 내용 작성(Rich Text 툴바).

### 3. 모임 관리 (`/groups`)
- **모임 목록:** 내 모임 카드 그리드 레이아웃. 각 모임별 고유 컬러와 테마 적용.
- **모임 생성:** 화면 중앙에 위치한 직관적인 '새로운 모임 만들기' 버튼.

### 4. 홈 화면 (`/home`)
- **캘린더:** 4월 일정 표시 및 날짜별 이벤트 배지. 날짜 클릭 시 일정 생성 모달 연동.
- **메모/모임 섹션:** 최신 메모 및 참여 중인 모임 리스트 표시.

### 5. 백엔드 API 및 연동 (`moyelog_BE` & `capstone-design`)
- **카카오 소셜 로그인 연동:** 프론트엔드 NextAuth에서 획득한 사용자 프로필(실명, 이메일, 프로필 이미지 등)을 백엔드 `/api/auth/sync` API를 통해 MySQL `users` 테이블과 동기화.
- **보안 및 JWT 발급:** Spring Security 기반으로, 사용자 식별을 위한 자체 JWT(Access Token)를 발급하여 NextAuth 세션에 저장 및 활용.
- **메모 CRUD API:** 메모 작성(`POST /api/memos`), 조회(`GET /api/memos`), 삭제(`DELETE /api/memos/{id}`) 엔드포인트 구현 완료.
- **파일 스토리지:** 메모 작성 시 첨부된 이미지 파일을 데이터베이스에 Base64로 저장하지 않고 서버 로컬 파일 시스템(`uploads` 폴더)에 저장 및 서빙(`WebConfig` 설정).

## 📐 주요 구현 가이드라인

### 모달 시스템 (Modal System)
- 모든 모달은 `isOpen`, `onClose` props를 기본으로 가집니다.
- **닫기 기능:** 우측 상단 X 버튼, 하단 취소 버튼, 그리고 **배경(Backdrop) 클릭 시 닫기** 기능이 전역 적용되어 있습니다. (`e.stopPropagation()` 사용)

### 이미지 최적화 (Image Optimization)
- `Next.js Image` 컴포넌트 사용 시 `fill` 속성을 활용하며, LCP 성능 향상을 위해 반드시 `sizes` 속성을 명시합니다.
- 외부 이미지 소스(`images.unsplash.com`, 카카오 프로필, 로컬 업로드 파일)는 `next.config.ts`에 허용 설정이 되어 있습니다.

### UI/UX 스타일
- **Color Palette:** 메인 인디고(`indigo-600`), 배경(`F8F9FB`), 카드 배경(`white`), 테두리(`gray-100`).
- **Layout:** `h-screen`과 `flex flex-col`을 사용하여 내부 스크롤을 관리하는 모던한 대시보드 구조를 지향합니다.

## 🚀 향후 작업 예정 (Next Steps)
- [ ] 모임(Groups) 생성 및 멤버 관리 API 구현 및 연동
- [ ] 일정(Schedules) 등록 및 캘린더 라이브러리 연동
- [ ] AI 기능(요약, OCR, 장소 추천) 백엔드 실제 로직 적용

---
*Last Updated: 2026-05-17 by Gemini CLI*

## 📝 Session Handover (인수인계 노트)

다음 세션의 원활한 진행을 위해 지금까지의 핵심 작업과 결정 사항을 기록합니다.

### ✅ 완료된 작업
1.  **인증 시스템 통합**:
    *   프론트엔드(NextAuth)와 백엔드(Spring Boot) 연동 완료.
    *   카카오 로그인 시 백엔드 `/api/auth/sync`를 호출하여 사용자 정보를 DB(`users` 테이블)에 동기화.
    *   백엔드 전용 JWT를 발급받아 NextAuth 세션에 `accessToken`으로 저장 및 API 호출 시 활용.
2.  **메모 기능 (CRUD) 구현**:
    *   메모 생성(`POST`), 목록 조회(`GET`), 상세 조회(`GET /{id}`), 삭제(`DELETE`) API 및 프론트 연동 완료.
    *   이미지 업로드 방식을 **Base64에서 로컬 파일 시스템(`uploads/`)** 저장 방식으로 전환.
    *   메모 태그(`memo_tags` 테이블) 연동 완료.
3.  **환경 설정 및 보안**:
    *   백엔드 CORS 설정 완료 (`localhost:3000` 허용).
    *   Spring Security에서 `/uploads/**` 경로 익명 접근 허용.
    *   서버 요청 크기 제한(10MB) 및 DB `LONGTEXT` 컬럼 적용.

### 📌 기술적 결정 사항 (Context)
*   **이미지 처리**: DB 부하를 줄이기 위해 파일로 저장하며, 프론트엔드에서 `/uploads/` 경로 접근 시 백엔드 주소를 Prefix로 붙여 처리함.
*   **타입 안정성**: 프론트엔드의 `KakaoProfile` 인터페이스를 정의하여 `id`, `name`, `email` 추출 로직을 정교화함.
*   **인증 흐름**: NextAuth의 `jwt` 콜백에서 백엔드 동기화를 수행하며, 이후 모든 메모 API 요청은 Bearer 토큰을 포함함.

### 🏃 다음 세션에서 바로 시작할 작업
- [ ] **모임(Groups) 기능**: 현재 프론트엔드 UI만 있는 상태이며, 백엔드 Entity/API 구축 및 연동 필요.
- [ ] **일정(Schedules) 기능**: 캘린더 라이브러리와 백엔드 데이터 연동.
- [ ] **AI 인사이트**: 현재는 프론트엔드에서 모의(Mock)로 수행 중이나, 백엔드에서 실제 OCR 및 요약 로직 구현 필요.

### ⚠️ 주의 사항
*   백엔드 실행 시 `uploads` 폴더가 프로젝트 루트에 자동 생성됩니다.
*   프론트엔드 `.env.local`에 `NEXT_PUBLIC_API_URL=http://localhost:8080`이 설정되어 있어야 합니다.
*   데이터베이스는 MySQL `moyeolog`를 사용합니다.
