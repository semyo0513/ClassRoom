const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxpymULI4fHyk5IXfG9PsolsA8SC2fEOZjOFsrq7fEhglWcPcRcGIjNjGkpkzirYXnw/exec";

// google.script.run → fetch GET 방식 (Apps Script 302 redirect 대응)
// POST는 리다이렉트 시 body가 소실되므로 GET + URLSearchParams 방식 사용
const google = {
  script: {
    get run() {
      return {
        _successFn: null,
        _failureFn: null,
        withSuccessHandler: function(fn) {
          this._successFn = fn;
          return this;
        },
        withFailureHandler: function(fn) {
          this._failureFn = fn;
          return this;
        },
        dispatch: function(action, payload) {
          const self = this;
          const params = new URLSearchParams({ action: action });
          if (payload !== null && payload !== undefined) {
            params.append('payload', JSON.stringify(payload));
          }
          const url = APPS_SCRIPT_URL + '?' + params.toString();

          fetch(url, { method: 'GET', redirect: 'follow' })
            .then(function(res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            })
            .then(function(text) {
              // Apps Script가 가끔 HTML 오류 페이지를 반환할 경우 처리
              try {
                const data = JSON.parse(text);
                if (self._successFn) self._successFn(data);
              } catch(e) {
                if (self._failureFn) self._failureFn(new Error('JSON 파싱 실패: ' + text.substring(0, 200)));
              }
            })
            .catch(function(err) {
              if (self._failureFn) self._failureFn(err);
            });
        }
      };
    }
  }
};

// --- Global Application State ---
const state = {
  currentUser: null,
  courses: [],
  selectedCourseId: null,
  courseWorks: [],
  selectedCourseWorkId: null,
  selectedCourseWorkTitle: '',
  submissions: [],
  filteredSubmissions: [],
  matrixData: null,
  activeTab: 'submission' // 'submission' or 'feedback'
};

// --- DOM Content Loaded / Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// --- Loader Management ---
function showLoader(text) {
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  if (loaderText) loaderText.textContent = text || '데이터를 가져오는 중...';
  if (loader) {
    loader.style.opacity = '1';
    loader.classList.remove('hidden');
  }
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 300);
  }
}

// --- Dynamic Toast System ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'danger') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-circle-exclamation';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4000);
}

// --- App Initialization ---
function initApp() {
  showLoader('대시보드 설정을 불러오는 중입니다...');
  
  // localStorage에 저장된 이메일을 payload로 전달 (USER_DEPLOYING 환경에서 세션 이메일이 빈값이기 때문)
  const storedEmail = localStorage.getItem('classroom_user_email') || '';
  
  google.script.run
    .withSuccessHandler((response) => {
      hideLoader();
      if (response.success) {
        state.currentUser = {
          email: response.email,
          profile: response.userProfile,
          isRegistered: response.isRegistered
        };
        
        if (!response.isRegistered) {
          // Show Registration Form
          document.getElementById('reg-email').value = response.email || storedEmail || '';
          document.getElementById('registration-screen').classList.remove('hidden');
          document.getElementById('dashboard-screen').classList.add('hidden');
          showToast('최초 접속 감지: 회원가입을 완료해주세요.', 'warning');
        } else {
          // Show Main Dashboard
          showDashboard(response);
        }
      } else {
        showToast('데이터 조회 중 오류: ' + response.error, 'danger');
      }
    })
    .withFailureHandler((err) => {
      hideLoader();
      showToast('구글 서버와 연결할 수 없습니다. 권한 승인이 필요할 수 있습니다.', 'danger');
    })
    .dispatch('getInitData', storedEmail ? { email: storedEmail } : null);
}

function showDashboard(response) {
  document.getElementById('registration-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  
  if (response.dbUrl) {
    document.getElementById('db-link').href = response.dbUrl;
  }
  
  if (response.userProfile) {
    document.getElementById('user-display-name').textContent = response.userProfile.name;
    document.getElementById('user-display-role').textContent = 
      response.userProfile.role === 'Teacher' ? '교사' : '학생';
    document.getElementById('user-avatar-char').textContent = 
      response.userProfile.name.charAt(0).toUpperCase();
  }
  
  state.courses = response.courses || [];
  populateCourses(state.courses);
  showToast(`${response.userProfile.name} 님, 환영합니다! 대시보드 로딩 완료.`, 'success');
}

// --- User Registration ---
function handleRegistration(event) {
  event.preventDefault();
  
  const name = document.getElementById('reg-name').value.trim();
  const role = document.getElementById('reg-role').value;
  const dept = document.getElementById('reg-dept').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  
  if (!name || !dept || !email) {
    showToast('모든 필수 항목을 입력해주세요.', 'warning');
    return;
  }
  
  const payload = {
    name: name,
    role: role,
    department: dept,
    email: email
  };
  
  showLoader('등록 정보를 제출하는 중입니다...');
  
  google.script.run
    .withSuccessHandler((response) => {
      hideLoader();
      if (response.success) {
        // localStorage에 이메일 저장 (다음 접속 시 세션 없이도 인식 가능)
        localStorage.setItem('classroom_user_email', email);
        showToast('신규 사용자 등록 성공!', 'success');
        // getInitData를 다시 호출하지 않고 직접 대시보드로 전환
        const mockResponse = {
          success: true,
          email: email,
          isRegistered: true,
          userProfile: { name: name, role: role, department: dept },
          courses: [],
          dbUrl: ''
        };
        showDashboard(mockResponse);
        // 백그라운드에서 클래스룸 목록 로드
        loadCourseWorkAfterRegister();
      } else {
        showToast('등록 에러: ' + response.error, 'danger');
      }
    })
    .withFailureHandler((err) => {
      hideLoader();
      showToast('네트워크 통신 중 오류가 발생했습니다.', 'danger');
    })
    .dispatch('registerUser', payload);
}

function loadCourseWorkAfterRegister() {
  const storedEmail = localStorage.getItem('classroom_user_email') || '';
  google.script.run
    .withSuccessHandler((response) => {
      if (response.success && response.courses) {
        state.courses = response.courses;
        populateCourses(state.courses);
        if (response.dbUrl) {
          document.getElementById('db-link').href = response.dbUrl;
        }
      }
    })
    .withFailureHandler(() => {})
    .dispatch('getInitData', storedEmail ? { email: storedEmail } : null);
}

// --- Populate Course selector ---
function populateCourses(courses) {
  const selector = document.getElementById('course-selector');
  selector.innerHTML = '';
  
  if (courses.length === 0) {
    selector.innerHTML = '<option value="" disabled selected>참여 중인 수업이 없습니다</option>';
    return;
  }
  
  let html = '<option value="" disabled selected>학급 수업을 선택하세요</option>';
  courses.forEach(course => {
    html += `<option value="${course.id}">${course.name}</option>`;
  });
  selector.innerHTML = html;
}

// --- Selector Change Handler ---
function handleCourseChange() {
  const selector = document.getElementById('course-selector');
  const courseId = selector.value;
  if (!courseId) return;
  
  state.selectedCourseId = courseId;
  state.selectedCourseWorkId = null;
  state.courseWorks = [];
  state.submissions = [];
  
  // Visual effects trigger
  const emptyState = document.getElementById('empty-state');
  emptyState.style.opacity = '0';
  setTimeout(() => {
    emptyState.classList.add('hidden');
  }, 200);
  
  document.getElementById('submission-details-container').classList.add('hidden');
  
  if (state.activeTab === 'submission') {
    loadCourseWorkList();
  } else if (state.activeTab === 'feedback') {
    loadFeedbackMatrix();
  }
}

// --- Fetch Courseworks ---
function loadCourseWorkList() {
  document.getElementById('tab-content-submission').classList.remove('hidden');
  showLoader('수업에 등록된 과제를 분석하고 있습니다...');
  
  google.script.run
    .withSuccessHandler((response) => {
      hideLoader();
      if (response.success) {
        state.courseWorks = response.courseWork || [];
        renderCourseWorkGrid(state.courseWorks);
        showToast(`총 ${state.courseWorks.length}개의 과제가 확인되었습니다.`, 'success');
      } else {
        showToast('과제 목록 분석 실패: ' + response.error, 'danger');
      }
    })
    .withFailureHandler((err) => {
      hideLoader();
      showToast('네트워크 오류가 발생했습니다.', 'danger');
    })
    .dispatch('getCourseWork', { courseId: state.selectedCourseId });
}

// --- Render Coursework Grid Cards with Progress Bars ---
function renderCourseWorkGrid(courseworks) {
  const container = document.getElementById('coursework-list');
  container.innerHTML = '';
  
  if (courseworks.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;"><i class="fa-regular fa-folder-open" style="font-size:2.5rem; margin-bottom:12px; display:block;"></i>아직 등록된 과제가 없습니다.</div>';
    return;
  }
  
  courseworks.forEach((work, index) => {
    const maxPoints = work.maxPoints !== undefined ? `${work.maxPoints}점 만점` : '배점 없음';
    const pct = work.totalCount > 0 ? Math.round((work.submittedCount / work.totalCount) * 100) : 0;
    
    const card = document.createElement('div');
    card.className = 'coursework-item animate-scale-in';
    card.style.animationDelay = `${index * 0.05}s`;
    card.id = `cw-card-${work.id}`;
    card.onclick = () => selectCourseWork(work.id, work.title);
    
    card.innerHTML = `
      <div>
        <div class="coursework-title" title="${work.title}">${work.title}</div>
        <div class="coursework-progress-wrapper">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="progress-fill-${work.id}" style="width: 0%"></div>
          </div>
          <div class="coursework-meta" style="border:none; padding-top:6px; margin-top:0;">
            <span style="color:var(--text-secondary); font-weight:500;">제출 ${work.submittedCount}/${work.totalCount}명</span>
            <span style="color:var(--success); font-weight:700;">${pct}%</span>
          </div>
        </div>
      </div>
      <div class="coursework-meta">
        <span class="coursework-pts">${maxPoints}</span>
        <span><i class="fa-regular fa-calendar-days"></i> ${formatShortDate(work.creationTime)}</span>
      </div>
    `;
    container.appendChild(card);
    
    // Trigger animation for the card progress bar width
    setTimeout(() => {
      const fill = document.getElementById(`progress-fill-${work.id}`);
      if (fill) fill.style.width = `${pct}%`;
    }, 100);
  });
}

// --- Select Coursework & Render stats ---
function selectCourseWork(courseWorkId, title) {
  state.courseWorks.forEach(work => {
    const card = document.getElementById(`cw-card-${work.id}`);
    if (card) {
      if (work.id === courseWorkId) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    }
  });
  
  state.selectedCourseWorkId = courseWorkId;
  state.selectedCourseWorkTitle = title;
  
  document.getElementById('selected-work-title').innerHTML = `
    <i class="fa-solid fa-square-poll-vertical text-indigo mr-2"></i> ${title} 분석 현황
  `;
  
  showLoader('개별 제출 기록을 상세 조회 중입니다...');
  
  google.script.run
    .withSuccessHandler((response) => {
      hideLoader();
      if (response.success) {
        state.submissions = response.submissions || [];
        state.filteredSubmissions = [...state.submissions];
        
        const detailsContainer = document.getElementById('submission-details-container');
        detailsContainer.classList.remove('hidden');
        detailsContainer.classList.add('animate-slide-up');
        
        calculateAndRenderStats();
        renderSubmissionsTable();
        
        document.querySelectorAll('.table-filter-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('filter-all').classList.add('active');
        
        showToast('제출 현황 상세 보고서 업데이트 완료.', 'success');
      } else {
        showToast('상세 데이터 로딩 에러: ' + response.error, 'danger');
      }
    })
    .withFailureHandler((err) => {
      hideLoader();
      showToast('상세 제출 정보 로딩 중 네트워크 오류.', 'danger');
    })
    .dispatch('getSubmissionStatus', { courseId: state.selectedCourseId, courseWorkId: courseWorkId });
}

// --- Draw SVG Circular Progress Donut Chart ---
function calculateAndRenderStats() {
  const total = state.submissions.length;
  const submitted = state.submissions.filter(s => s.state === 'TURNED_IN' || s.state === 'RETURNED').length;
  const missing = total - submitted;
  
  document.getElementById('count-total').textContent = total;
  document.getElementById('count-submitted').textContent = submitted;
  document.getElementById('count-missing').textContent = missing;
  
  const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0;
  
  // Animate text count
  animateNumberText('donut-percent', percentage);
  
  const circ = 251.2;
  const segmentSubmitted = document.getElementById('donut-segment-submitted');
  const segmentMissing = document.getElementById('donut-segment-missing');
  
  if (total === 0) {
    segmentSubmitted.setAttribute('stroke-dasharray', `0 ${circ}`);
    segmentMissing.setAttribute('stroke-dasharray', `0 ${circ}`);
    return;
  }
  
  const submittedStroke = (submitted / total) * circ;
  const missingStroke = (missing / total) * circ;
  
  // Reset dash array before animating
  segmentSubmitted.setAttribute('stroke-dasharray', `0 ${circ}`);
  segmentMissing.setAttribute('stroke-dasharray', `0 ${circ}`);
  
  setTimeout(() => {
    segmentSubmitted.setAttribute('stroke-dasharray', `${submittedStroke} ${circ}`);
    segmentSubmitted.setAttribute('stroke-dashoffset', '0');
    
    segmentMissing.setAttribute('stroke-dasharray', `${missingStroke} ${circ}`);
    segmentMissing.setAttribute('stroke-dashoffset', `-${submittedStroke}`);
  }, 150);
}

// Helper to animate numbers
function animateNumberText(id, targetVal) {
  const el = document.getElementById(id);
  if (!el) return;
  
  let currentVal = 0;
  const increment = Math.ceil(targetVal / 20) || 1;
  const timer = setInterval(() => {
    currentVal += increment;
    if (currentVal >= targetVal) {
      currentVal = targetVal;
      clearInterval(timer);
    }
    el.textContent = `${currentVal}%`;
  }, 30);
}

// --- Render Table ---
function renderSubmissionsTable() {
  const tbody = document.getElementById('submissions-list-body');
  tbody.innerHTML = '';
  
  if (state.filteredSubmissions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;"><i class="fa-solid fa-users-slash" style="font-size:2rem; display:block; margin-bottom:12px;"></i>조건에 맞는 학생 정보가 존재하지 않습니다.</td></tr>';
    return;
  }
  
  state.filteredSubmissions.forEach((sub, index) => {
    const row = document.createElement('tr');
    row.style.animation = `fadeInUp 0.3s ease forwards`;
    row.style.animationDelay = `${index * 0.03}s`;
    
    let statusBadge = '';
    switch (sub.state) {
      case 'TURNED_IN':
        statusBadge = '<span class="badge badge-success"><i class="fa-solid fa-circle-notch fa-spin"></i> 검토대기</span>';
        break;
      case 'RETURNED':
        statusBadge = '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 채점완료</span>';
        break;
      case 'NEW':
      case 'CREATED':
      case 'RECLAIMED_BY_STUDENT':
        statusBadge = '<span class="badge badge-danger"><i class="fa-solid fa-circle-exclamation"></i> 미제출</span>';
        break;
      default:
        statusBadge = `<span class="badge badge-muted">${sub.state}</span>`;
    }
    
    const gradeVal = sub.assignedGrade !== null ? `${sub.assignedGrade}점` : '<span style="color: var(--text-muted)">-</span>';
    const lateBadge = sub.late 
      ? '<span class="badge badge-warning"><i class="fa-solid fa-circle-exclamation"></i> 지각</span>' 
      : '<span class="badge badge-muted">-</span>';
      
    row.innerHTML = `
      <td><strong>${sub.studentName}</strong></td>
      <td><span style="font-family: monospace; font-size: 0.88em; color: var(--text-secondary);">${sub.studentEmail || '정보 없음'}</span></td>
      <td>${statusBadge}</td>
      <td><strong>${gradeVal}</strong></td>
      <td>${lateBadge}</td>
      <td><span style="font-size: 0.85em; color: var(--text-muted);">${formatDate(sub.updateTime)}</span></td>
    `;
    tbody.appendChild(row);
  });
}

// --- Table Filters ---
function filterSubmissions(type) {
  document.querySelectorAll('.table-filter-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`filter-${type}`).classList.add('active');
  
  if (type === 'all') {
    state.filteredSubmissions = [...state.submissions];
  } else if (type === 'submitted') {
    state.filteredSubmissions = state.submissions.filter(s => s.state === 'TURNED_IN' || s.state === 'RETURNED');
  } else if (type === 'missing') {
    state.filteredSubmissions = state.submissions.filter(s => s.state !== 'TURNED_IN' && s.state !== 'RETURNED');
  }
  
  renderSubmissionsTable();
  showToast(`필터가 적용되었습니다: ${state.filteredSubmissions.length}명 조회됨`, 'info');
}

// --- Warning Emails Modal Handler ---
function openMailModal() {
  const missingStudents = state.submissions.filter(s => s.state !== 'TURNED_IN' && s.state !== 'RETURNED');
  
  if (missingStudents.length === 0) {
    showToast('미제출 학생이 존재하지 않습니다!', 'success');
    return;
  }
  
  document.getElementById('mail-recipient-count').textContent = missingStudents.length;
  
  const pillsContainer = document.getElementById('mail-recipient-pills');
  pillsContainer.innerHTML = '';
  
  const validEmails = [];
  missingStudents.forEach(student => {
    if (student.studentEmail) {
      validEmails.push(student.studentEmail);
      const pill = document.createElement('span');
      pill.className = 'recipient-pill animate-scale-in';
      pill.innerHTML = `<i class="fa-regular fa-envelope"></i> ${student.studentName}`;
      pillsContainer.appendChild(pill);
    }
  });
  
  if (validEmails.length === 0) {
    pillsContainer.innerHTML = '<span class="badge badge-danger"><i class="fa-solid fa-circle-exclamation"></i> 수신 가능한 이메일 정보가 없습니다.</span>';
  }
  
  const template = `안녕하세요.
클래스룸에 등록된 아래 과제가 아직 제출되지 않았습니다. 기한 내에 과제를 완료해주시기 바랍니다.

- 과목명: ${state.courses.find(c => c.id === state.selectedCourseId).name}
- 과제명: ${state.selectedCourseWorkTitle}

질문 사항이 있는 경우 이메일 또는 클래스룸 댓글로 남겨주세요.
감사합니다.`;
  
  document.getElementById('mail-body-template').value = template;
  
  // Animation block
  const modal = document.getElementById('mail-modal');
  modal.style.opacity = '0';
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.style.opacity = '1';
  }, 50);
}

function closeMailModal() {
  const modal = document.getElementById('mail-modal');
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

function sendNotifications() {
  const missingStudents = state.submissions.filter(s => s.state !== 'TURNED_IN' && s.state !== 'RETURNED');
  const emails = missingStudents.map(s => s.studentEmail).filter(Boolean);
  
  if (emails.length === 0) {
    showToast('수신 이메일 목록이 비어있습니다.', 'warning');
    return;
  }
  
  const textBody = document.getElementById('mail-body-template').value;
  
  showLoader('미제출자 전원에게 알림 이메일을 전송 중입니다...');
  
  google.script.run
    .withSuccessHandler((response) => {
      hideLoader();
      closeMailModal();
      if (response.success) {
        showToast(`${response.sentCount}명의 학생에게 리마인더 메일을 발송했습니다.`, 'success');
      } else {
        showToast('메일 발송 에러: ' + response.error, 'danger');
      }
    })
    .withFailureHandler((err) => {
      hideLoader();
      showToast('이메일 대량 발송 실패.', 'danger');
    })
    .dispatch('sendMissingNotifications', {
      courseId: state.selectedCourseId,
      courseWorkId: state.selectedCourseWorkId,
      studentEmails: emails,
      messageBody: textBody
    });
}

// --- Tab Router ---
function switchTab(tabId) {
  state.activeTab = tabId;
  
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-btn-${tabId}`).classList.add('active');
  
  const subContent = document.getElementById('tab-content-submission');
  const feedContent = document.getElementById('tab-content-feedback');
  
  subContent.classList.add('hidden');
  feedContent.classList.add('hidden');
  
  if (!state.selectedCourseId) {
    document.getElementById('empty-state').classList.remove('hidden');
    return;
  }
  
  document.getElementById('empty-state').classList.add('hidden');
  
  if (tabId === 'submission') {
    if (state.courseWorks.length === 0) {
      loadCourseWorkList();
    } else {
      subContent.classList.remove('hidden');
      subContent.classList.add('animate-fade-in');
    }
  } else if (tabId === 'feedback') {
    loadFeedbackMatrix();
  }
}

// --- Feedback Matrix Loader & Renderer ---
function loadFeedbackMatrix() {
  document.getElementById('tab-content-feedback').classList.remove('hidden');
  showLoader('성적 & 피드백 격자 행렬 데이터를 생성 중입니다...');
  
  google.script.run
    .withSuccessHandler((response) => {
      hideLoader();
      if (response.success) {
        state.matrixData = response;
        renderFeedbackMatrix(response);
        showToast('피드백 매트릭스 리포트 생성 완료.', 'success');
      } else {
        showToast('성적 정보 생성 실패: ' + response.error, 'danger');
      }
    })
    .withFailureHandler((err) => {
      hideLoader();
      showToast('매트릭스 렌더링 중 오류 발생.', 'danger');
    })
    .dispatch('getFeedbackDashboard', { courseId: state.selectedCourseId });
}

function renderFeedbackMatrix(data) {
  const table = document.getElementById('matrix-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  
  thead.innerHTML = '';
  tbody.innerHTML = '';
  
  if (data.courseWorks.length === 0) {
    thead.innerHTML = '<tr><th>학생 목록</th></tr>';
    tbody.innerHTML = '<tr><td style="color: var(--text-muted); text-align: center; padding: 40px;"><i class="fa-regular fa-folder-open" style="font-size:2rem; display:block; margin-bottom:12px;"></i>과제가 발견되지 않았습니다.</td></tr>';
    return;
  }
  
  // Header Columns
  let headerHtml = '<tr><th class="student-col">학생명 / 이메일</th>';
  data.courseWorks.forEach(work => {
    headerHtml += `<th title="${work.title}">${work.title}</th>`;
  });
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;
  
  // Body Rows
  if (data.students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${data.courseWorks.length + 1}" style="text-align: center; color: var(--text-muted); padding: 40px;">이 수업에 수강 중인 학생이 없습니다.</td></tr>`;
    return;
  }
  
  data.students.forEach((student, rIdx) => {
    const row = document.createElement('tr');
    row.style.animation = `fadeInUp 0.3s ease forwards`;
    row.style.animationDelay = `${rIdx * 0.03}s`;
    
    let rowHtml = `<td class="student-col">
      <strong style="color:var(--text-primary); font-size: 0.95rem;">${student.name}</strong><br>
      <span style="font-size:0.78em; color:var(--text-muted); font-family: monospace;">${student.email || '이메일 없음'}</span>
    </td>`;
    
    data.courseWorks.forEach(work => {
      const submission = student.grades[work.id];
      let displayContent = '';
      let cellStyle = '';
      
      if (!submission) {
        displayContent = '<span class="matrix-score">-</span><span class="matrix-percent">확인 불가</span>';
        cellStyle = 'background: rgba(244, 63, 94, 0.03); color: var(--text-muted);';
      } else {
        switch (submission.state) {
          case 'RETURNED':
            const score = submission.assignedGrade;
            const max = submission.maxPoints;
            const percent = max > 0 ? Math.round((score / max) * 100) : 100;
            displayContent = `<span class="matrix-score">${score}/${max}</span><span class="matrix-percent">${percent}%</span>`;
            cellStyle = 'background: rgba(16, 185, 129, 0.06); color: var(--success);';
            break;
          case 'TURNED_IN':
            displayContent = '<span class="matrix-score"><i class="fa-solid fa-clock-rotate-left"></i></span><span class="matrix-percent">제출함 (채점대기)</span>';
            cellStyle = 'background: rgba(99, 102, 241, 0.08); color: var(--primary);';
            break;
          case 'NEW':
          case 'CREATED':
          case 'RECLAIMED_BY_STUDENT':
            displayContent = '<span class="matrix-score"><i class="fa-solid fa-circle-xmark"></i></span><span class="matrix-percent">미제출</span>';
            cellStyle = 'background: rgba(244, 63, 94, 0.08); color: var(--danger);';
            break;
          default:
            displayContent = `<span class="matrix-score">${submission.state}</span>`;
            cellStyle = 'color: var(--text-secondary);';
        }
      }
      
      rowHtml += `<td class="matrix-grade-cell" style="${cellStyle}">${displayContent}</td>`;
    });
    
    row.innerHTML = rowHtml;
    tbody.appendChild(row);
  });
}

// --- Date Formatter Helpers ---
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  return `${mm}/${dd}`;
}
