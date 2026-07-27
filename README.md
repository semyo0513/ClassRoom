# 창순기획 클래스룸 대시보드 — 배포 가이드

여러 학교 교사가 각자 자신의 구글 계정으로 로그인해 사용할 수 있는
Google Classroom 대시보드입니다. GitHub 저장소로 코드를 관리하고,
push 하면 자동으로 Apps Script에 배포되도록 구성합니다.

## 0. 준비물
- 관리자(제작자) 본인의 구글 계정
- Node.js (clasp 설치용)
- GitHub 계정

## 1. Apps Script 프로젝트 최초 생성

```bash
npm install -g @google/clasp
clasp login                     # 관리자 본인 구글 계정으로 로그인
mkdir classroom-dashboard && cd classroom-dashboard
clasp create --type webapp --title "창순기획 클래스룸 대시보드"
```

`Code.gs`, `index.html`, `appsscript.json`을 이 폴더에 이 저장소의 내용으로 덮어씁니다.

## 2. 관리자 이메일 설정 (필수)

`Code.gs` 상단의 다음 줄을 **본인의 실제 관리자 구글 계정**으로 바꿉니다.

```js
const ADMIN_EMAIL = 'changsoon.example@gmail.com';
```

## 3. Classroom API 서비스 활성화

- `clasp push` 후 `clasp open`으로 편집기를 열고, 좌측 **서비스(Services) → +** 에서
  **Google Classroom API**(Advanced Service)를 추가합니다.
- 연결된 GCP 프로젝트 콘솔에서도 **Google Classroom API**를 사용 설정합니다.
  (Apps Script 편집기의 "Google Cloud Platform 프로젝트" 링크로 바로 이동 가능)

## 4. 사용자 등록부 최초 생성 (관리자 1회 실행)

Apps Script 편집기 상단 함수 선택 드롭다운에서 **initRegistry**를 선택하고
▶ 실행 버튼을 누릅니다. (반드시 관리자 본인이 편집기에서 직접 실행 — 이 함수는
웹앱 API로는 노출되어 있지 않습니다) 최초 실행 시 권한 승인 화면이 뜨면 동의합니다.

이 단계로 "사용자_등록부" 스프레드시트가 관리자 소유로 생성되고, 다른 학교 교사들도
자신의 접속 기록을 남길 수 있도록 공유 설정이 자동으로 구성됩니다.

## 5. 웹앱 배포

편집기 우측 상단 **배포(Deploy) → 새 배포**:
- 유형: 웹앱
- 실행 계정: **나**
- 액세스 권한: **Google 계정이 있는 모든 사용자**

배포 후 나오는 **웹앱 URL**과 **배포 ID**를 기록해둡니다. (배포 ID는 6번 GitHub Actions
설정에 필요합니다 — 배포 목록에서 확인 가능: `clasp deployments`)

## 6. GitHub 저장소 생성 및 최초 push

```bash
git init
git add .
git commit -m "초기 커밋: 클래스룸 대시보드"
gh repo create classroom-dashboard --private --source=. --push
# (gh CLI가 없다면 github.com에서 직접 저장소를 만든 뒤)
# git remote add origin https://github.com/<본인계정>/classroom-dashboard.git
# git branch -M main
# git push -u origin main
```

`.clasp.json`의 `scriptId`를 실제 스크립트 ID로 채운 뒤 커밋하세요 (민감정보 아님).
`.clasprc.json`(로그인 토큰)은 `.gitignore`에 이미 포함되어 있어 커밋되지 않습니다.

## 7. GitHub Actions 자동 배포 설정 (push하면 자동 배포)

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
에서 아래 두 개를 등록합니다.

| Secret 이름 | 값 |
|---|---|
| `CLASPRC_JSON` | 로컬의 `~/.clasprc.json` 파일 내용 전체 (clasp login 직후 생성됨) |
| `CLASP_DEPLOYMENT_ID` | 5번에서 배포 후 확인한 배포 ID (`clasp deployments`로 조회 가능) |

이후 `main` 브랜치에 push할 때마다 `.github/workflows/deploy.yml`이 자동으로
`clasp push` → `clasp deploy`를 실행해 **같은 웹앱 URL을 유지한 채** 최신 코드가 반영됩니다.

## 8. 교사들에게 배포된 URL 안내

교사들은 5번에서 받은 웹앱 URL로 접속 → 자신의 구글 계정으로 로그인 →
최초 1회 권한 동의만 하면, 이후에는 재인증 없이 바로 사용할 수 있습니다.
각 교사의 출석부/티켓 발송이력/활동로그는 본인 소유의 개인 스프레드시트에
저장되며, 관리자는 앱의 **설정 탭 → 관리자 · 전체 사용자 현황**에서 전체 학교의
사용 현황(이메일, 최초/최근 접속일, 접속 횟수, 개인 시트 링크)을 확인할 수 있습니다.

## 참고: 보안 트레이드오프

사용자 등록부 스프레드시트는 "링크가 있는 모든 사용자 편집 가능"으로 공유되어
있어야 여러 학교의 각기 다른 계정이 자신의 접속 기록을 쓸 수 있습니다. 이 시트의
ID는 클라이언트(브라우저)에는 절대 노출되지 않고 서버 코드 내부에서만 사용되므로
일반적인 사용 시나리오에서는 안전하지만, 더 엄격한 통제가 필요하다면 별도의
"쓰기 전용 프록시 웹앱(관리자 권한으로 실행)" 구조로 업그레이드할 수 있습니다.
필요하시면 말씀해주세요.
