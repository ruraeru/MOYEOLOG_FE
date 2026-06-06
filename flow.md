# MOYEOLOG 서비스 흐름도 (Flowchart)

이 문서는 MOYEOLOG 프로젝트의 주요 사용자 시나리오 및 데이터 흐름을 Mermaid 다이어그램으로 정의합니다.

## 1. 회원가입 및 로그인 플로우
사용자가 카카오 로그인을 통해 서비스에 진입하고 커스텀 ID를 할당받는 과정입니다.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#ffffff', 'secondaryColor': '#ffffff', 'tertileColor': '#ffffff'}}}%%
graph TD
    A[사용자] --> B{로그인 버튼 클릭}
    B --> C[카카오 OAuth 인증]
    C --> D[Next-Auth 세션 생성]
    D --> E[백엔드 Auth Sync 요청]
    E --> F{기존 회원인가?}
    F -- No --> G[새 사용자 생성 및 8자리 Custom ID 할당]
    F -- Yes --> H[사용자 정보 반환]
    G --> I[홈 화면 진입]
    H --> I
```

## 2. 메모 작성 및 AI 분석 플로우
메모를 작성하고 Gemini AI를 통해 인사이트(요약, 태그 추천)를 얻는 과정입니다.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#ffffff', 'secondaryColor': '#ffffff', 'tertileColor': '#ffffff'}}}%%
graph TD
    A[메모 작성 시작] --> B[내용 입력 및 이미지 업로드]
    B --> C[저장 버튼 클릭]
    C --> D[백엔드 메모 저장]
    D --> E[Gemini AI 분석 요청]
    E --> F[텍스트 추출 및 3줄 요약 생성]
    F --> G[핵심 키워드 및 태그 추천]
    G --> H[사용자에게 AI 인사이트 표시]
    H --> I{추천 태그 수락?}
    I -- Yes --> J[메모 태그 업데이트]
    I -- No --> K[수동 태그 관리/종료]
```

## 3. 그룹 초대 및 활동 플로우
친구를 그룹에 초대하고 토픽(Topic)을 통해 소통하는 과정입니다.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#ffffff', 'secondaryColor': '#ffffff', 'tertileColor': '#ffffff'}}}%%
graph TD
    A[그룹 생성자] --> B[친구 검색 - Custom ID]
    B --> C[그룹 초대 발송]
    C --> D[초대받은 사용자 알림 수신]
    D --> E{초대 수락?}
    E -- No --> F[초대 거절 상태 변경]
    E -- Yes --> G[그룹 멤버 합류]
    G --> H[그룹 토픽/메모/일정 공유]
    H --> I[토픽 작성 및 @멘션 사용]
    I --> J[그룹 활동 피드 반영]
```

## 4. 일정 생성 및 장소 추천 플로우
일정을 등록하고 주변 장소를 추천받는 과정입니다.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#ffffff', 'secondaryColor': '#ffffff', 'tertileColor': '#ffffff'}}}%%
graph TD
    A[일정 생성 클릭] --> B[날짜 및 시간 선택]
    B --> C[장소 검색 - 카카오 맵]
    C --> D[장소 선택 및 상세 정보 입력]
    D --> E[일정 저장]
    E --> F[AI 기반 주변 맛집/카페 추천]
    F --> G[그룹원 공유 및 캘린더 반영]
```

## 5. 사이트 경로 (Site Map)

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#ffffff', 'secondaryColor': '#ffffff', 'tertileColor': '#ffffff'}}}%%
graph TD
    Root[/] --> Home[/home]
    
    Home --> Memo[/memo]
    Memo --> MemoDetail[/memo/id]
    
    Home --> Groups[/groups]
    Groups --> GroupDetail[/groups/id]
    
    Home --> Schedule[/schedule]
    Home --> Friends[/friends]
    Home --> Notifications[/notifications]
    Home --> Profile[/profile/id]
    Home --> Settings[/settings]
    
    Notifications --> InviteFriend[/invite/friend]
    Notifications --> InviteGroup[/invite/group]
```
