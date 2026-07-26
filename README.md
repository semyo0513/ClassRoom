# 클래스룸 통합 대시보드 (Classroom Hub)

> Google Apps Script와 Classroom API를 연동하여 교사와 학생을 연결해 주는 프리미엄 글래스모피즘 테마의 클래스룸 통합 모니터링 대시보드 웹앱입니다.

---

## 🌟 주요 기능

1. **실시간 과제 제출 분석**
   - 구글 클래스룸의 학급 목록과 과제 목록을 불러와 전체 제출 비율을 SVG 도넛 차트 및 수치로 시각화합니다.
   - 각 과제 카드마다 실시간 제출 진행률 미니 프로그레스 바를 표시하여 직관적인 진단을 돕습니다.
2. **원클릭 미제출자 독촉 메일**
   - 현재 과제를 완료하지 않은 학생 목록을 실시간 필터링하여 일괄 경고 이메일 리마인더를 Gmail을 통해 자동 발송합니다.
3. **피드백 & 성적 매트릭스**
   - 전체 학생과 모든 과제의 상태(제출함, 채점대기, 미제출, 점수/만점)를 격자형 행렬로 표현하여 한눈에 관리할 수 있습니다.
4. **구글 스프레드시트 DB 자동 동기화**
   - 최초 로그인 시 구글 드라이브 내에 `Classroom Dashboard DB` 스프레드시트를 자동으로 검색 또는 신규 생성하여, 가입 유저 목록을 동시성 제어가 보장된 형태로 기록합니다.

---

## 🛠 기술 스택

- **Backend**: Google Apps Script (V8 Engine, Apps Script Advanced Services)
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Glassmorphism, Responsive Grid, Flexbox, UI Micro-animations), Vanilla JavaScript (google.script.run API Dispatcher, SVG Circle Arc manipulation)
- **Deploy & Sync**: Node.js, `@google/clasp`, Git & GitHub

---

## 🚀 로컬 미리보기 검증 (Mock Test)

개발 환경에서 UI 및 기능 테스트를 수행하기 위해 모의 API가 장착된 HTML 컴파일본을 제공합니다. 아래 파일을 브라우저로 더블클릭하여 바로 실행해보실 수 있습니다:

- **[로컬 미리보기 테스트 파일 열기](file:///Users/parkchangsoon/.gemini/antigravity/brain/edb6de28-f8ea-4dee-a0f1-51e8f019e915/scratch/preview.html)**

---

## 📦 배포 및 설정 가이드 (Deployment)

### 1단계. Apps Script 고급 서비스 및 Classroom API 활성화
1. [구글 클라우드 콘솔 (Google Cloud Console)](https://console.cloud.google.com/)에 접속하여 사용할 구글 계정으로 로그인합니다.
2. 우측 상단의 **프로젝트 선택** -> **새 프로젝트**를 생성합니다.
3. 왼쪽 메뉴에서 **API 및 서비스** -> **라이브러리**로 이동합니다.
4. 검색창에 **Google Classroom API**를 검색하고 **사용 (Enable)** 버튼을 클릭하여 활성화합니다.
5. (필수) **OAuth 동의 화면**을 구성하고 테스트 사용자로 본인 이메일을 등록해 둡니다.

### 2단계. 로컬 개발 환경 로그인 (OAuth)
로컬 터미널에서 Apps Script 배포 도구인 Clasp를 로그인합니다:
```bash
npx clasp login
```
*브라우저가 열리면 개발을 진행할 Google 계정으로 로그인하고 액세스 권한을 승인해주시기 바랍니다.*

### 3단계. Apps Script 프로젝트 생성 또는 연결
**옵션 A: 완전히 새로운 스크립트 프로젝트 생성 (추천)**
```bash
npx clasp create --type webapp --title "Classroom Dashboard Webapp"
```
*생성이 완료되면 루트 폴더에 `.clasp.json` 파일이 자동 생성됩니다.*

**옵션 B: 기존 스크립트에 연결**
이미 구글 드라이브에서 만든 Apps Script가 존재한다면, 스크립트 ID를 `.clasp.json`에 기입합니다:
```json
{
  "scriptId": "YOUR_APPS_SCRIPT_ID_HERE",
  "rootDir": "/Users/parkchangsoon/Downloads/클래스룸 대시보드"
}
```

### 4단계. 소스 코드 동기화 (Push)
로컬에 작성된 HTML, CSS, JavaScript 및 매니페스트 설정을 구글 서버로 푸시합니다:
```bash
npx clasp push
```
*정상 업로드 완료 시 Apps Script 콘솔에서 코드가 동기화된 것을 확인할 수 있습니다.*

### 5단계. 웹앱 배포 (Deployment)
1. 구글 Apps Script 편집기 화면으로 이동합니다.
2. 우측 상단 **배포 (Deploy)** -> **새 배포 (New deployment)**를 선택합니다.
3. 배포 유형을 **웹 앱 (Web app)**으로 지정합니다.
4. 설정을 다음과 같이 지정하고 배포 버튼을 누릅니다:
   - **웹앱 실행 사용자 (Execute as)**: `웹앱에 액세스하는 사용자 (User accessing the web app)`
   - **액세스 권한이 있는 사용자 (Who has access)**: `모든 사용자 (Anyone)`
5. 첫 배포 시 발생하는 구글의 OAuth **승인 대화상자(Authorize access)**를 완료하고 생성된 웹앱 URL로 접속합니다.

---

## 📂 Git & GitHub 저장소 반영

현재 작업 공간을 로컬 Git 저장소로 관리하고 GitHub으로 반영하는 방법입니다.

```bash
# 로컬 Git 초기 설정
git add .
git commit -m "feat: 클래스룸 대시보드 웹앱 신규 구현 완료 및 UI/UX 개선"

# GitHub 원격 저장소 주소 연동 (원하는 Repository URL을 대입하세요)
git remote add origin <GITHUB_REPOSITORY_URL>
git branch -M main

# GitHub로 푸시
git push -u origin main
```
