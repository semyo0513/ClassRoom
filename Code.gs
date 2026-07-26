/**
 * Classroom Dashboard Backend (Code.gs)
 * Powered by Google Apps Script & Classroom API
 */

// --- Apps Script Web App API Entrypoints ---
function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var result = dispatch(req.action, req.payload);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : null;
    var result = dispatch(action, payload);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- API Dispatcher ---
function dispatch(action, payload) {
  try {
    switch (action) {
      case 'getInitData':
        return getInitData();
      case 'registerUser':
        return registerUser(payload);
      case 'getCourseWork':
        return getCourseWork(payload.courseId);
      case 'getSubmissionStatus':
        return getSubmissionStatus(payload.courseId, payload.courseWorkId);
      case 'sendMissingNotifications':
        return sendMissingNotifications(payload.courseId, payload.courseWorkId, payload.studentEmails, payload.messageBody);
      case 'getFeedbackDashboard':
        return getFeedbackDashboard(payload.courseId);
      default:
        throw new Error('Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in dispatch: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// --- Database (Google Sheets) Integration ---
function getDbSpreadsheet() {
  var properties = PropertiesService.getUserProperties();
  var sheetId = properties.getProperty('DB_SHEET_ID');
  
  if (sheetId) {
    try {
      var existingSs = SpreadsheetApp.openById(sheetId);
      ensureHeaders(existingSs);
      return existingSs;
    } catch (e) {
      Logger.log('Previously stored sheet not found, recreating...');
    }
  }
  
  // Find or create sheet
  var files = DriveApp.getFilesByName('Classroom Dashboard DB');
  var ss;
  if (files.hasNext()) {
    var file = files.next();
    properties.setProperty('DB_SHEET_ID', file.getId());
    ss = SpreadsheetApp.openById(file.getId());
  } else {
    // Create brand new sheet
    ss = SpreadsheetApp.create('Classroom Dashboard DB');
    properties.setProperty('DB_SHEET_ID', ss.getId());
  }
  
  ensureHeaders(ss);
  return ss;
}

function ensureHeaders(ss) {
  var usersSheet = ss.getSheetByName('Users');
  if (!usersSheet) {
    var sheets = ss.getSheets();
    if (sheets[0].getName() === 'Sheet1' || sheets[0].getName() === '시트1') {
      usersSheet = sheets[0].setName('Users');
    } else {
      usersSheet = ss.insertSheet('Users');
    }
  }
  
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['Email', 'Name', 'Role', 'Department', 'CreatedAt']);
  }
}

// --- Dispatch Implementation Functions ---

/**
 * Checks if the current user is registered, and returns initial dashboard data (courses)
 * payload: { email: string } - 프론트엔드에서 localStorage의 이메일을 전달 (USER_DEPLOYING 환경 대응)
 */
function getInitData(payload) {
  // USER_DEPLOYING 환경에서는 Session.getActiveUser().getEmail()이 빈값 반환
  // 따라서 프론트엔드에서 localStorage에 저장한 이메일을 payload로 받아 사용
  var email = Session.getActiveUser().getEmail();
  if (!email && payload && payload.email) {
    email = payload.email;
  }
  if (!email) email = '';
  
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  var isRegistered = false;
  var userProfile = null;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === email.toLowerCase()) {
      isRegistered = true;
      userProfile = {
        email: data[i][0],
        name: data[i][1],
        role: data[i][2],
        department: data[i][3]
      };
      break;
    }
  }
  
  var coursesList = [];
  if (isRegistered) {
    coursesList = fetchClassroomCourses();
  }
  
  return {
    success: true,
    email: email,
    isRegistered: isRegistered,
    userProfile: userProfile,
    courses: coursesList,
    dbUrl: ss.getUrl()
  };
}

/**
 * Registers a new user into the database
 * profile.email: 프론트엔드 폼에서 직접 입력한 이메일 (세션 이메일이 없을 때 사용)
 */
function registerUser(profile) {
  var lock = LockService.getUserLock();
  try {
    if (lock.tryLock(5000)) {
      // USER_DEPLOYING 환경에서는 세션 이메일이 비어있으므로 payload의 이메일을 우선 사용
      var email = profile.email || Session.getActiveUser().getEmail();
      if (!email) {
        throw new Error('이메일을 확인할 수 없습니다. 이메일을 입력해주세요.');
      }
      
      var ss = getDbSpreadsheet();
      var sheet = ss.getSheetByName('Users');
      var data = sheet.getDataRange().getValues();
      
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toLowerCase() === email.toLowerCase()) {
          return { success: true, message: '이미 가입된 사용자입니다.' };
        }
      }
      
      sheet.appendRow([
        email,
        profile.name,
        profile.role, // 'Teacher' or 'Student'
        profile.department,
        new Date().toISOString()
      ]);
      
      return { success: true, message: '회원 등록이 완료되었습니다.' };
    } else {
      throw new Error('서버가 혼잡합니다. 잠시 후 다시 시도해주세요.');
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fetches courses from Google Classroom
 */
function fetchClassroomCourses() {
  try {
    var response = Classroom.Courses.list({
      courseStates: ['ACTIVE'],
      teacherId: 'me'
    });
    return response.courses || [];
  } catch (error) {
    Logger.log('Error listing courses: ' + error.toString());
    // If not a teacher, try fetching student courses
    try {
      var response = Classroom.Courses.list({
        courseStates: ['ACTIVE'],
        studentId: 'me'
      });
      return response.courses || [];
    } catch (studentErr) {
      Logger.log('Error listing courses as student: ' + studentErr.toString());
      return [];
    }
  }
}

/**
 * Fetches course work for a specific course
 */
function getCourseWork(courseId) {
  try {
    var response = Classroom.Courses.CourseWork.list(courseId);
    var courseWorks = response.courseWork || [];
    
    // For each coursework, get submission stats for real-time progress bars
    var enrichedWorks = courseWorks.map(function(work) {
      var submittedCount = 0;
      var totalCount = 0;
      try {
        var subs = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, work.id);
        var submissions = subs.studentSubmissions || [];
        totalCount = submissions.length;
        submittedCount = submissions.filter(function(s) {
          return s.state === 'TURNED_IN' || s.state === 'RETURNED';
        }).length;
      } catch (e) {
        Logger.log('Error counting submissions for ' + work.id + ': ' + e.toString());
      }
      return {
        id: work.id,
        title: work.title,
        creationTime: work.creationTime,
        maxPoints: work.maxPoints,
        submittedCount: submittedCount,
        totalCount: totalCount
      };
    });
    
    return {
      success: true,
      courseWork: enrichedWorks
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Fetches rosters (students) and coursework submissions status
 */
function getSubmissionStatus(courseId, courseWorkId) {
  try {
    // 1. Get Students (Roster)
    var studentResponse = [];
    try {
      var roster = Classroom.Courses.Students.list(courseId);
      studentResponse = roster.students || [];
    } catch (e) {
      Logger.log('Could not fetch student roster: ' + e.toString());
    }

    // 2. Get Submissions for this coursework
    var submissionsResponse = [];
    try {
      var subs = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, courseWorkId);
      submissionsResponse = subs.studentSubmissions || [];
    } catch (e) {
      Logger.log('Could not fetch student submissions: ' + e.toString());
    }

    // Map profile/email using Google Apps Script Directory if roster API lacks detailed profile
    var studentMap = {};
    studentResponse.forEach(function(student) {
      var userId = student.userId;
      var email = student.profile && student.profile.emailAddress ? student.profile.emailAddress : '';
      var name = student.profile && student.profile.name && student.profile.name.fullName ? student.profile.name.fullName : ('학생 (' + userId.substring(0,6) + ')');
      studentMap[userId] = {
        userId: userId,
        email: email,
        name: name
      };
    });

    var submissions = submissionsResponse.map(function(sub) {
      var studentInfo = studentMap[sub.userId] || { userId: sub.userId, email: '', name: '미등록 사용자 (' + sub.userId + ')' };
      return {
        id: sub.id,
        userId: sub.userId,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        state: sub.state, // 'NEW', 'CREATED', 'TURNED_IN', 'RETURNED', 'RECLAIMED_BY_STUDENT'
        assignedGrade: sub.assignedGrade || null,
        draftGrade: sub.draftGrade || null,
        late: sub.late || false,
        updateTime: sub.updateTime
      };
    });

    return {
      success: true,
      submissions: submissions,
      studentsCount: studentResponse.length
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Sends notifications to missing students
 */
function sendMissingNotifications(courseId, courseWorkId, studentEmails, messageBody) {
  try {
    var course = Classroom.Courses.get(courseId);
    var courseWork = Classroom.Courses.CourseWork.get(courseId, courseWorkId);
    
    var subject = '[미제출 알림] ' + course.name + ' - ' + courseWork.title;
    var senderName = Session.getActiveUser().getEmail() || '클래스룸 대시보드';
    
    studentEmails.forEach(function(email) {
      if (email) {
        GmailApp.sendEmail(email, subject, messageBody, {
          name: '클래스룸 대시보드 알림'
        });
      }
    });
    
    return {
      success: true,
      sentCount: studentEmails.length
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Generates data for the feedback/grades matrix dashboard
 */
function getFeedbackDashboard(courseId) {
  try {
    // 1. Get Courseworks
    var workResp = Classroom.Courses.CourseWork.list(courseId);
    var courseWorks = workResp.courseWork || [];

    // Sort by creation time (oldest first)
    courseWorks.sort(function(a, b) {
      return new Date(a.creationTime) - new Date(b.creationTime);
    });

    // 2. Get Students
    var studentResp = Classroom.Courses.Students.list(courseId);
    var students = studentResp.students || [];

    var studentMap = {};
    students.forEach(function(s) {
      var email = s.profile && s.profile.emailAddress ? s.profile.emailAddress : '';
      var name = s.profile && s.profile.name && s.profile.name.fullName ? s.profile.name.fullName : s.userId;
      studentMap[s.userId] = {
        name: name,
        email: email,
        grades: {} // courseworkId -> grade
      };
    });

    // 3. Populate grades for each coursework
    courseWorks.forEach(function(work) {
      try {
        var subResp = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, work.id);
        var submissions = subResp.studentSubmissions || [];
        
        submissions.forEach(function(sub) {
          if (studentMap[sub.userId]) {
            studentMap[sub.userId].grades[work.id] = {
              state: sub.state,
              assignedGrade: sub.assignedGrade !== undefined ? sub.assignedGrade : null,
              maxPoints: work.maxPoints !== undefined ? work.maxPoints : null
            };
          }
        });
      } catch (e) {
        Logger.log('Could not get submissions for coursework ' + work.id + ': ' + e.toString());
      }
    });

    // Format grid
    var gridData = [];
    for (var userId in studentMap) {
      gridData.push({
        userId: userId,
        name: studentMap[userId].name,
        email: studentMap[userId].email,
        grades: studentMap[userId].grades
      });
    }

    // Sort students by name
    gridData.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      courseWorks: courseWorks.map(function(w) {
        return { id: w.id, title: w.title, maxPoints: w.maxPoints || 100 };
      }),
      students: gridData
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
