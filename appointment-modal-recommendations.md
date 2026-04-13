# Appointment Modal: 맞춤 장소 추천 기능 연동 (Kakao Maps API)

## Objective
사용자의 현재 위치를 기반으로 주변 모임 장소(카페 등)를 추천하고, 특정 장소를 검색하여 선택할 경우 해당 장소를 중심으로 추천 리스트를 동적으로 갱신합니다.

## Key Files & Context
- `src/components/AppointmentModal.tsx`: 장소 검색 및 모달 UI를 담당하는 주요 컴포넌트

## Implementation Steps
1. **상태 관리 추가:**
   - 추천 장소 리스트를 저장할 `recommendations` 상태 추가.
   - 추천 장소 로딩 상태를 관리할 `isRecommending` 상태 추가.
2. **초기 지도 중심점 설정 (Geolocation):**
   - 모달이 열릴 때 `navigator.geolocation.getCurrentPosition`을 호출하여 브라우저의 현재 위치 좌표를 가져옵니다.
   - 위치 정보를 가져오는 데 성공하면 해당 좌표로, 실패하거나 권한이 거부되면 기본 좌표(서울 시청)로 지도의 중심을 설정합니다.
3. **추천 장소 호출 로직 (`fetchRecommendations`):**
   - 위도(lat), 경도(lng)를 인자로 받아 카카오맵의 `categorySearch` API를 호출하는 함수를 만듭니다.
   - 반경 1km 이내의 카페(`CE7`) 카테고리를 검색합니다.
   - 카카오 API가 제공하지 않는 이미지와 평점 데이터는 UI 일관성을 위해 고품질 임시 데이터(Mock)로 맵핑합니다.
4. **검색 연동 (동적 갱신):**
   - 사용자가 검색 결과에서 장소를 선택(`handleLocationSelect`)할 때, 해당 장소의 좌표(`place.y`, `place.x`)를 `fetchRecommendations` 함수에 전달하여 추천 리스트를 갱신합니다.
5. **UI 업데이트:**
   - 기존의 하드코딩된 `recommendations` 배열을 상태 기반 동적 렌더링으로 변경합니다.
   - 데이터 로딩 중일 때는 로딩 스피너를, 데이터가 없을 때는 안내 메시지를 표시합니다.

## Verification & Testing
- 모달을 열었을 때 브라우저 위치 권한 요청 팝업이 뜨는지 확인합니다.
- 권한을 허용하면 현재 위치를 중심으로 지도가 표시되고 주변 카페 추천이 나타나는지 확인합니다.
- 장소 입력창에서 다른 지역(예: '강남역')을 검색하고 선택하면, 지도가 해당 위치로 이동하고 추천 리스트가 강남역 주변 카페로 갱신되는지 확인합니다.