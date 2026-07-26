# 클래스룸 통합 대시보드 — Google Antigravity 제작 계획

## 0. 배경 및 목표
- 이미 설계된 Code.gs / appsscript.json / Index.html / Stylesheet.html / JavaScript.html을
  Google Antigravity(에이전트 기반 개발 플랫폼)를 통해 실제 프로젝트 폴더로 구성하고,
  clasp 연동 → 배포 → 검증까지 에이전트에게 위임하는 것이 목표다.
- Antigravity는 "계획 제시 → 사람 승인 → 실행 → 검증(Artifacts)" 단계로 동작하므로,
  각 Phase는 그대로 에이전트에게 줄 "작업 지시문(prompt)" 단위로 쪼개 놓았다.
- Apps Script는 Antigravity 로컬 환경에서 직접 실행되지 않는다(구글 서버에서 실행).
  따라서 로컬에서는 **코드 작성/정적 검증**까지만 에이전트가 하고,
  **clasp push, 배포, OAuth 로그인**은 사람이 브라우저 팝업으로 직접 승인해야 하는 구간으로 분리한다.

## 1. 사전 준비 (사람이 먼저 할 일)
- [ ] Node.js 설치 확인 (clasp 구동용)
- [ ] Google Cloud 콘솔에서 프로젝트 생성 + **Classroom API** 활성화
- [ ] `clasp login` 1회 실행 (브라우저 OAuth 동의 — 에이전트가 대신할 수 없는 구간)
- [ ] 로컬에 빈 프로젝트 폴더 생성 후 Antigravity로 해당 폴더 열기

## 2. Antigravity 작업 브레이크다운 (Phase별 에이전트 지시문)

### Phase 1 — 프로젝트 스캐폴딩
> 지시문 예시: "이 폴더에 clasp 기반 Google Apps Script 프로젝트를 초기화해줘.
> .clasp.json, .claspignore, appsscript.json 매니페스트 뼈대를 만들고
> Classroom 고급서비스(v1)와 필요한 oauthScopes를 appsscript.json에 넣어줘."
- 산출물(Artifact): `.clasp.json`, `.claspignore`, `appsscript.json` 초안
- 검증: 에이전트가 `clasp create --type webapp` 실행 결과를 로그로 첨부하도록 요청

### Phase 2 — 백엔드(Code.gs) 구현
> 지시문 예시: "Code.gs에 dispatch(action, payload) 단일 진입점 패턴으로
> ① getInitData(회원가입 여부 확인), ② registerUser(시트에 프로필 저장),
> ③ getCourseWork/getSubmissionStatus(제출현황), ④ sendMissingNotifications(미제출자 메일),
> ⑤ getFeedbackDashboard(과제x학생 매트릭스)를 구현해줘.
> LockService로 동시성 제어하고, 시트 DB는 최초 실행 시 자동 생성해줘."
- 검증: 에이전트가 각 함수에 대해 자체 정적 분석 + 문법 오류 체크 결과 보고
- 주의: Classroom API는 이 환경에서 목업(mock) 응답으로만 단위 테스트 가능 (실제 호출은 배포 후에만 검증됨)

### Phase 3 — 프론트엔드(Index/Stylesheet/JavaScript.html) 구현
> 지시문 예시: "Index.html, Stylesheet.html, JavaScript.html을 만들어줘.
> 회원가입 뷰 / 대시보드 뷰(제출현황 탭, 피드백 대시보드 탭)로 구성하고
> google.script.run.withSuccessHandler/withFailureHandler로 dispatch()를 호출해줘.
> 모바일 퍼스트로 디자인해줘."
- 검증: Antigravity의 **브라우저 내장 에이전트**로 로컬 정적 HTML 미리보기를 열어
  레이아웃/반응형 여부를 스크린샷 Artifact로 남기도록 지시

### Phase 4 — clasp push 및 배포 (사람 승인 필요 구간)
> 지시문 예시: "clasp push를 실행하고, 결과 로그를 보여줘. 이후 배포 절차와
> 웹앱 실행권한(USER_ACCESSING) 설정 방법을 안내해줘."
- 사람이 직접 수행: Apps Script 편집기에서 배포 → 웹 앱 → 실행 사용자/액세스 권한 설정
  (Antigravity가 브라우저 클릭까지 대신할 수도 있으나, 구글 계정 보안 동의 단계는 사람이 확인 권장)

### Phase 5 — 배포 후 검증 (browser-in-the-loop)
> 지시문 예시: "배포된 `.../exec` URL을 브라우저로 열어서
> 1) 최초 접속 시 회원가입 폼이 뜨는지 2) 등록 후 대시보드로 전환되는지
> 3) 과목/과제 선택 시 제출현황 표가 렌더링되는지 스크린샷으로 검증해줘."
- 산출물(Artifact): 단계별 스크린샷 + 콘솔 에러 로그
- 실제 Classroom 데이터가 있는 테스트 계정으로 로그인해야 의미 있는 검증 가능

### Phase 6 — 깃허브 반영
> 지시문 예시: "현재 폴더를 git 저장소로 초기화하고 origin을 <레포 URL>로 설정한 뒤
> 첫 커밋/푸시까지 해줘. README.md에 배포 절차를 정리해줘."
- 이후 코드 변경 시: `수정 → clasp push → git commit/push` 순서를 각 세션 마지막에 반복 지시

## 3. 검증 체크리스트 (최종 승인 전)
- [ ] 미등록 계정 최초 접속 → 회원가입 폼 정상 노출
- [ ] 등록 후 실제 담당 클래스룸 목록이 뜨는지
- [ ] 특정 과제 선택 시 미제출자 수가 클래스룸 실제 화면과 일치하는지
- [ ] 미제출 알림 메일이 실제로 학생 계정에 도착하는지 (테스트 학생 1명으로 먼저 확인)
- [ ] 피드백 대시보드 매트릭스의 점수가 클래스룸 성적과 일치하는지

## 4. 향후 확장 (다음 세션 지시문 후보)
- ② 학기말 수업 일괄복사 (CourseWork 복제 + 기한 자동 shift)
- ④ AI 자동채점 연동 (제출 텍스트 → LLM 채점 → StudentSubmissions.patch)
- ⑤ 게이미피케이션 포인트/뱃지 시스템 (시간 트리거 기반 XP 집계)

각 확장 기능도 동일하게 "Phase 2 방식(dispatch에 case 추가) → Phase 5 방식(browser-in-the-loop 검증)"
패턴을 그대로 반복하면 된다.
