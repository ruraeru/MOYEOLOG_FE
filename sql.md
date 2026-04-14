# MOYEOLOG (모여로그) 데이터베이스 테이블 명세 및 SQL DDL

본 문서는 모여로그 서비스에 적합한 데이터베이스 테이블(ERD) 구조와 생성용 SQL 스크립트를 포함하고 있습니다.

## 1. 테이블 명세 (ERD)

### 1. 사용자 및 소셜 (User & Social)

**`users` (사용자)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | 고유 식별자 |
| `kakao_id` | VARCHAR | UNIQUE, NOT NULL | 카카오 고유 ID |
| `email` | VARCHAR | UNIQUE | 사용자 이메일 |
| `nickname` | VARCHAR | NOT NULL | 닉네임 |
| `profile_image` | VARCHAR | | 프로필 이미지 URL |
| `bio` | TEXT | | 자기소개 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 가입일시 |

**`friendships` (친구 관계)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `user_id` | UUID | FK (`users.id`) | 요청한 사용자 ID |
| `friend_id` | UUID | FK (`users.id`) | 요청받은 사용자 ID |
| `status` | ENUM | 'PENDING', 'ACCEPTED' | 친구 상태 |
| `created_at`| TIMESTAMP | DEFAULT NOW() | 생성일시 |

### 2. 모임 및 그룹 (Group)

**`groups` (모임)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | 고유 식별자 |
| `name` | VARCHAR | NOT NULL | 모임 이름 |
| `description` | TEXT | | 모임 설명 |
| `color` | VARCHAR | | 모임 고유 색상 |
| `theme` | VARCHAR | | 모임 테마 |
| `created_by` | UUID | FK (`users.id`) | 모임 생성자 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 생성일시 |

**`group_members` (모임 멤버)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `group_id` | UUID | FK (`groups.id`) | 모임 ID |
| `user_id` | UUID | FK (`users.id`) | 사용자 ID |
| `role` | ENUM | 'ADMIN', 'MEMBER' | 그룹 내 권한 |
| `joined_at` | TIMESTAMP | DEFAULT NOW() | 참여일시 |

### 3. 메모 및 AI 기능 (Memo & AI Insights)

**`memos` (메모 본체)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | 고유 식별자 |
| `author_id` | UUID | FK (`users.id`) | 작성자 ID |
| `group_id` | UUID | FK (`groups.id`), NULL | 모임 ID (NULL이면 개인) |
| `title` | VARCHAR | NOT NULL | 메모 제목 |
| `content` | TEXT | | 본문 내용 |
| `image_url` | VARCHAR | | 첨부 이미지 URL |
| `target_date` | DATE | | 메모 연관 날짜 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 작성일시 |
| `updated_at` | TIMESTAMP | | 수정일시 |

**`memo_tags` (메모 태그)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `memo_id` | UUID | FK (`memos.id`) | 메모 ID |
| `name` | VARCHAR | NOT NULL | 태그 이름 |

**`memo_ai_insights` (AI 분석 데이터)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `memo_id` | UUID | PK, FK (`memos.id`) | 대상 메모 ID |
| `ocr_text` | TEXT | | 추출된 이미지 텍스트 |
| `summary` | TEXT | | AI 요약 |
| `emotion` | VARCHAR | | 감정 분석 |
| `keywords` | JSON | | 키워드 배열 |
| `analyzed_at`| TIMESTAMP | | 분석 일시 |

### 4. 일정 및 추천 장소 (Schedule & Location)

**`schedules` (일정)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | 고유 식별자 |
| `author_id` | UUID | FK (`users.id`) | 등록자 ID |
| `group_id` | UUID | FK (`groups.id`), NULL | 그룹 일정 시 그룹 ID |
| `title` | VARCHAR | NOT NULL | 일정 제목 |
| `description` | TEXT | | 일정 내용/메모 |
| `start_time` | TIMESTAMP | NOT NULL | 시작 시간 |
| `end_time` | TIMESTAMP | NOT NULL | 종료 시간 |
| `location_name`| VARCHAR | | 장소 이름 |
| `location_addr`| VARCHAR | | 장소 주소 |
| `lat` | DECIMAL | | 위도 |
| `lng` | DECIMAL | | 경도 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 생성일시 |

**`schedule_participants` (일정 참여자)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `schedule_id`| UUID | FK (`schedules.id`) | 일정 ID |
| `user_id` | UUID | FK (`users.id`) | 참여자 ID |
| `status` | ENUM | 'PENDING', 'ACCEPTED' | 수락 여부 |

### 5. 알림 (Notification)

**`notifications` (알림 및 활동 기록)**
| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | 고유 식별자 |
| `user_id` | UUID | FK (`users.id`) | 수신자 ID |
| `type` | ENUM | 'SCHEDULE', 'FRIEND', 'GROUP', 'MEMO' | 알림 유형 |
| `message` | VARCHAR | NOT NULL | 알림 메시지 |
| `related_id` | UUID | | 연관 엔티티 ID |
| `is_read` | BOOLEAN | DEFAULT FALSE | 읽음 여부 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 발생일시 |

## 2. SQL DDL 스크립트 (PostgreSQL 기준)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kakao_id VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE,
    nickname VARCHAR NOT NULL,
    profile_image VARCHAR,
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Friendships
CREATE TYPE friend_status AS ENUM ('PENDING', 'ACCEPTED');
CREATE TABLE friendships (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status friend_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- 3. Groups
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    description TEXT,
    color VARCHAR,
    theme VARCHAR,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Group Members
CREATE TYPE group_role AS ENUM ('ADMIN', 'MEMBER');
CREATE TABLE group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role group_role DEFAULT 'MEMBER',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- 5. Memos
CREATE TABLE memos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    content TEXT,
    image_url VARCHAR,
    target_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Memo Tags
CREATE TABLE memo_tags (
    id BIGSERIAL PRIMARY KEY,
    memo_id UUID REFERENCES memos(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL
);

-- 7. Memo AI Insights
CREATE TABLE memo_ai_insights (
    memo_id UUID PRIMARY KEY REFERENCES memos(id) ON DELETE CASCADE,
    ocr_text TEXT,
    summary TEXT,
    emotion VARCHAR,
    keywords JSONB,
    analyzed_at TIMESTAMP DEFAULT NOW()
);

-- 8. Schedules
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location_name VARCHAR,
    location_addr VARCHAR,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Schedule Participants
CREATE TYPE schedule_status AS ENUM ('PENDING', 'ACCEPTED');
CREATE TABLE schedule_participants (
    id BIGSERIAL PRIMARY KEY,
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status schedule_status DEFAULT 'PENDING',
    UNIQUE(schedule_id, user_id)
);

-- 10. Notifications
CREATE TYPE notification_type AS ENUM ('SCHEDULE', 'FRIEND', 'GROUP', 'MEMO');
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message VARCHAR NOT NULL,
    related_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```