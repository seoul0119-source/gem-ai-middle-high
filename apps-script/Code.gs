const SPREADSHEET_ID =
  "1P0DEDlZgVxwRAtTKSto4OOj3TOfZknbHvjGNPbHeyxc";

const STUDENT_SHEET_NAME = "시트1";
const LOG_SHEET_NAME = "수업기록";
const CLASS_URL =
  "https://gem-ai-middle-high.vercel.app/class.html";

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || "login").trim();

    if (action === "start") {
      return startLesson_(params);
    }

    if (action === "end") {
      return endLesson_(params);
    }

    if (!params.id) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: "GEM Student Manager is running."
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return loginStudent_(String(params.id).trim());

  } catch (error) {
    return createMessagePage_(
      error.message || "학생 정보를 확인하지 못했습니다."
    );
  }
}

function legacyLoginStudent_(studentId) {
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  const studentSheet =
    spreadsheet.getSheetByName(STUDENT_SHEET_NAME);

  if (!studentSheet) {
    throw new Error("학생관리 시트를 찾을 수 없습니다.");
  }

  const lastRow = studentSheet.getLastRow();

  if (lastRow < 2) {
    return createMessagePage_("등록된 학생이 없습니다.");
  }

  const rows = studentSheet
    .getRange(2, 2, lastRow - 1, 8)
    .getDisplayValues();

  for (let i = 0; i < rows.length; i++) {
    const id = String(rows[i][0]).trim();

    if (id === studentId) {
      const name = String(rows[i][1]).trim();
      const grade = String(rows[i][2]).trim();
      const status = String(rows[i][4]).trim();

      if (status !== "등록") {
        return createMessagePage_(
          "현재 이용할 수 없는 학생 ID입니다."
        );
      }

      const logSheet = getOrCreateLogSheet_(spreadsheet);
      const sessionId = Utilities.getUuid();

      logSheet.appendRow([
        sessionId,
        new Date(),
        studentId,
        name,
        grade,
        "",
        "",
        "",
        "",
        "",
        "입장"
      ]);

      SpreadsheetApp.flush();

      const targetUrl =
        CLASS_URL +
        "?id=" + encodeURIComponent(studentId) +
        "&name=" + encodeURIComponent(name) +
        "&session=" + encodeURIComponent(sessionId);

      return createRedirectPage_(
        targetUrl,
        name + " 학생, 환영합니다."
      );
    }
  }

  return createMessagePage_(
    "등록되지 않은 학생 ID입니다."
  );
}

function legacyStartLesson_(params) {
  const sessionId = String(params.session || "").trim();
  const subject = String(params.subject || "").trim();
  const level = String(params.level || "").trim();
  const target = String(params.target || "").trim();

  if (!sessionId || !subject || !level) {
    throw new Error("수업 시작 정보가 부족합니다.");
  }

  if (
    target &&
    !/^https:\/\/(chatgpt\.com|sites\.google\.com)\//i.test(target)
  ) {
    throw new Error("수업 주소가 올바르지 않습니다.");
  }

  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  const logSheet = getOrCreateLogSheet_(spreadsheet);
  const row = findSessionRow_(logSheet, sessionId);

  if (!row) {
    throw new Error("수업 입장 기록을 찾을 수 없습니다.");
  }

  logSheet.getRange(row, 6).setValue(subject);
  logSheet.getRange(row, 7).setValue(level);
  logSheet.getRange(row, 8).setValue(new Date());
  logSheet.getRange(row, 11).setValue("수업 중");

  SpreadsheetApp.flush();

  if (target) {
    return createRedirectPage_(
      target,
      subject + " " + level + " 수업을 시작합니다."
    );
  }

  return createMessagePage_("수업 시작이 기록되었습니다.");
}

function endLesson_(params) {
  const sessionId = String(params.session || "").trim();

  if (!sessionId) {
    throw new Error("수업 종료 정보가 부족합니다.");
  }

  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  const logSheet = getOrCreateLogSheet_(spreadsheet);
  const row = findSessionRow_(logSheet, sessionId);

  if (!row) {
    throw new Error("수업 기록을 찾을 수 없습니다.");
  }

  const endTime = new Date();
  const startTime = logSheet.getRange(row, 8).getValue();

  let minutes = "";

  if (startTime instanceof Date) {
    minutes = Math.max(
      0,
      Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    );
  }

  logSheet.getRange(row, 9).setValue(endTime);
  logSheet.getRange(row, 10).setValue(minutes);
  logSheet.getRange(row, 11).setValue("완료");

  SpreadsheetApp.flush();

  return createMessagePage_(
    "수업이 종료되었습니다. 학습 기록이 저장되었습니다."
  );
}

function getOrCreateLogSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(LOG_SHEET_NAME);

    sheet.appendRow([
      "세션 ID",
      "입장 시간",
      "학생 ID",
      "이름",
      "학년",
      "과목",
      "레벨",
      "수업 시작",
      "수업 종료",
      "학습 시간(분)",
      "상태"
    ]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}

function findSessionRow_(sheet, sessionId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const sessions = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues();

  for (let i = sessions.length - 1; i >= 0; i--) {
    if (String(sessions[i][0]).trim() === sessionId) {
      return i + 2;
    }
  }

  return 0;
}

function createRedirectPage_(targetUrl, message) {
  const safeUrl = escapeHtml_(targetUrl);
  const safeMessage = escapeHtml_(message);

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GEM AI CLASS</title>
  <meta http-equiv="refresh" content="1;url=${safeUrl}">
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      background: #f3f6fb;
      color: #173d70;
      text-align: center;
    }
    .box {
      width: 90%;
      max-width: 440px;
      background: white;
      padding: 38px 25px;
      border-radius: 16px;
      box-shadow: 0 5px 18px rgba(0,0,0,.12);
    }
  </style>
</head>
<body>
  <div class="box">
    <h2>${safeMessage}</h2>
    <p>잠시 후 GEM AI CLASS로 이동합니다.</p>
  </div>
  <script>
    setTimeout(function () {
      window.top.location.replace("${safeUrl}");
    }, 500);
  </script>
</body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createMessagePage_(message) {
  const safeMessage = escapeHtml_(message);

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GEM AI CLASS</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      background: #f3f6fb;
      color: #173d70;
      text-align: center;
    }
    .box {
      width: 90%;
      max-width: 440px;
      background: white;
      padding: 35px;
      border-radius: 16px;
      box-shadow: 0 5px 18px rgba(0,0,0,.12);
    }
  </style>
</head>
<body>
  <div class="box">
    <h2>GEM AI CLASS</h2>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function legacyDoPost_(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    if (!e || !e.parameter) {
      throw new Error("학생 정보가 전달되지 않았습니다.");
    }

    const name =
      String(e.parameter.name || "").trim();

    const grade =
      String(e.parameter.grade || "").trim();

    const registrationType =
      String(e.parameter.registrationType || "").trim();

    if (!name) {
      throw new Error("이름을 입력해 주세요.");
    }

    if (!grade) {
      throw new Error("학년을 입력해 주세요.");
    }

    const allowedTypes = [
      "체험",
      "1개월 무료",
      "정규 등록"
    ];

    if (!allowedTypes.includes(registrationType)) {
      throw new Error("등록 유형이 올바르지 않습니다.");
    }

    const spreadsheet =
      SpreadsheetApp.openById(SPREADSHEET_ID);

    const sheet =
      spreadsheet.getSheetByName(STUDENT_SHEET_NAME);

    if (!sheet) {
      throw new Error(
        `"${STUDENT_SHEET_NAME}" 시트를 찾을 수 없습니다.`
      );
    }

    const studentId =
      createStudentId_(registrationType);

    sheet.appendRow([
      new Date(),
      studentId,
      name,
      grade,
      registrationType,
      "등록",
      "",
      "",
      ""
    ]);

    SpreadsheetApp.flush();

    return createResponse_({
      success: true,
      studentId: studentId,
      name: name,
      grade: grade,
      registrationType: registrationType
    });

  } catch (error) {
    console.error(error);

    return createResponse_({
      success: false,
      message:
        error.message || "학생 등록에 실패했습니다."
    });

  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function createStudentId_(registrationType) {
  const codeMap = {
    "체험": "T",
    "1개월 무료": "F",
    "정규 등록": "R"
  };

  const typeCode = codeMap[registrationType];
  const year =
    String(new Date().getFullYear()).slice(-2);

  const properties =
    PropertiesService.getScriptProperties();

  const counterKey =
    `STUDENT_COUNTER_${year}`;

  const nextNumber =
    Number(
      properties.getProperty(counterKey) || "0"
    ) + 1;

  properties.setProperty(
    counterKey,
    String(nextNumber)
  );

  const sequence =
    String(nextNumber).padStart(4, "0");

  return `${typeCode}${year}${sequence}`;
}

function createResponse_(payload) {
  const safeJson =
    JSON.stringify(payload).replace(/</g, "\\u003c");

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
</head>
<body>
  <script>
    window.top.postMessage(
      ${safeJson},
      "*"
    );
  </script>
</body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function testConnection_() {
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  const studentSheet =
    spreadsheet.getSheetByName(STUDENT_SHEET_NAME);

  if (!studentSheet) {
    throw new Error(
      `"${STUDENT_SHEET_NAME}" 시트를 찾을 수 없습니다.`
    );
  }

  const logSheet =
    getOrCreateLogSheet_(spreadsheet);

  console.log(
    `연결 성공: ${spreadsheet.getName()} / ${studentSheet.getName()} / ${logSheet.getName()}`
  );
}
// GEM membership extension. Public issuance excludes the representative plan.
var GEM_PLANS = {
  trial: {prefix:'T', label:'1일 체험', hours:24, amount:0},
  month1: {prefix:'M', label:'1개월 회원', months:1, amount:100000},
  month2: {prefix:'N', label:'2개월 회원', months:2, amount:150000},
  month3: {prefix:'P', label:'3개월 회원', months:3, amount:200000},
  lifetime: {prefix:'L', label:'평생회원', amount:null},
  representative: {prefix:'D', label:'대표', amount:0},
  free1: {prefix:'F', label:'1개월 무료', months:1, amount:0},
  legacy: {prefix:'R', label:'기존 정규 등록', amount:0}
};
var GEM_COLUMNS = ['회원구분','이용시작일','이용만료시각','후원약정금액','발급요청키'];
function gemExpiry_(plan, start) {
  var p = GEM_PLANS[plan];
  if (!p) throw new Error('회원 구분을 확인해 주세요.');
  if (p.hours) return new Date(start.getTime() + p.hours * 3600000);
  if (!p.months) return null;
  var local = new Date(start.getTime() + 9*3600000);
  var y = local.getUTCFullYear(), m = local.getUTCMonth()+p.months;
  var day = Math.min(local.getUTCDate(), new Date(Date.UTC(y,m+1,0)).getUTCDate());
  return new Date(Date.UTC(y,m,day+1)-9*3600000);
}
function gemColumns_(sheet, create) {
  var headers = sheet.getRange(1,1,1,Math.max(9,sheet.getLastColumn())).getDisplayValues()[0];
  return GEM_COLUMNS.map(function(name) {
    var index=headers.indexOf(name);
    if(index<0 && create) { index=headers.length; headers.push(name); sheet.getRange(1,index+1).setValue(name); }
    return index;
  });
}
function gemSheet_() {
  var sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if(!sheet)throw new Error('학생관리 시트를 찾을 수 없습니다.');
  return sheet;
}
function gemMembership_(sheet,row,values) {
  var cols=gemColumns_(sheet,false), id=String(values[1]).trim().toUpperCase();
  var plan=cols[0]>=0 ? String(values[cols[0]]||'') : '';
  if(!plan)plan=id.charAt(0)==='T'?'trial':id.charAt(0)==='F'?'free1':'legacy';
  if(!GEM_PLANS[plan])throw new Error('회원 정보를 확인해 주세요.');
  var start=cols[1]>=0 && values[cols[1]] ? new Date(values[cols[1]]) : new Date(values[0]);
  var expiry=cols[2]>=0 && values[cols[2]] ? new Date(values[cols[2]]) : gemExpiry_(plan,start);
  if((expiry && !isFinite(expiry.getTime())) || (!isFinite(start.getTime()) && plan!=='legacy'))throw new Error('이용 기간을 확인하지 못했습니다. 선교사무실에 문의해 주세요.');
  return {plan:plan,label:GEM_PLANS[plan].label,startsAt:isFinite(start.getTime())?start.toISOString():null,expiresAt:expiry?expiry.toISOString():null};
}
function gemFindStudent_(id) {
  var sheet=gemSheet_(), rows=sheet.getDataRange().getValues();
  for(var i=1;i<rows.length;i++)if(String(rows[i][1]).trim().toUpperCase()===id)return {sheet:sheet,row:i+1,values:rows[i],membership:gemMembership_(sheet,i+1,rows[i])};
  throw new Error('등록되지 않은 학생 ID입니다.');
}
function gemRequireActive_(student) {
  if(String(student.values[1]).trim().toUpperCase()==='R260001' || String(student.values[5]).trim()!=='등록')throw new Error('현재 이용할 수 없는 학생 ID입니다.');
  if(student.membership.expiresAt && new Date(student.membership.expiresAt).getTime()<=Date.now())throw new Error('학생 ID의 이용 기간이 만료되었습니다. 후원 안내에서 새 회원 ID를 발급받아 주세요.');
}
function loginStudent_(studentId) {
  studentId=String(studentId).trim().toUpperCase();
  if(!/^[A-Z][0-9]{6}$/.test(studentId))throw new Error('학생 ID 형식을 확인해 주세요.');
  var student=gemFindStudent_(studentId); gemRequireActive_(student);
  var name=String(student.values[2]).trim(), grade=String(student.values[3]).trim();
  var logSheet=getOrCreateLogSheet_(SpreadsheetApp.openById(SPREADSHEET_ID));
  var sessionId=Utilities.getUuid();
  logSheet.appendRow([sessionId,new Date(),studentId,name,grade,'','','','','','입장']);
  SpreadsheetApp.flush();
  var url=CLASS_URL+'?id='+encodeURIComponent(studentId)+'&name='+encodeURIComponent(name)+'&session='+encodeURIComponent(sessionId)+'&membership='+encodeURIComponent(JSON.stringify(student.membership));
  return createRedirectPage_(url,name+' 학생, 환영합니다.');
}
function startLesson_(params) {
  var log=getOrCreateLogSheet_(SpreadsheetApp.openById(SPREADSHEET_ID));
  var row=findSessionRow_(log,String(params.session||'').trim());
  if(!row)throw new Error('수업 입장 기록을 찾을 수 없습니다.');
  gemRequireActive_(gemFindStudent_(String(log.getRange(row,3).getValue()).trim().toUpperCase()));
  return legacyStartLesson_(params);
}
function gemValidateRegistration_(params) {
  var name=String(params.name||'').trim(), grade=String(params.grade||'').trim();
  if(!name || name.length>40 || /^[=+@-]/.test(name) || /[<>\x00-\x1f]/.test(name))throw new Error('이름을 40자 이내로 입력해 주세요.');
  if(!grade || grade.length>40 || /^[=+@-]/.test(grade) || /[<>\x00-\x1f]/.test(grade))throw new Error('학년을 확인해 주세요.');
  var plan=String(params.plan||'');
  if(!plan) { if(params.registrationType!=='체험')throw new Error('후원 안내에서 회원 구분을 선택해 주세요.'); plan='trial'; }
  if(['trial','month1','month2','month3','lifetime'].indexOf(plan)<0)throw new Error('발급할 수 없는 회원 구분입니다.');
  var amount=plan==='trial'?0:Number(params.amount);
  if(plan!=='trial' && (String(params.pledgeConfirmed)!=='true' || !Number.isSafeInteger(amount) || amount<1 || amount>1000000000 || (GEM_PLANS[plan].amount!==null && amount!==GEM_PLANS[plan].amount)))throw new Error('후원 약정과 회원 구분을 확인해 주세요.');
  var key=String(params.requestKey||'');
  if(key && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(key))throw new Error('발급 요청을 확인해 주세요.');
  if(plan!=='trial' && !key)throw new Error('발급 요청키가 필요합니다.');
  return {name:name,grade:grade,plan:plan,amount:amount,key:key};
}
function gemIssue_(params, representative) {
  var data=representative || gemValidateRegistration_(params), sheet=gemSheet_(), cols=gemColumns_(sheet,true);
  var rows=sheet.getDataRange().getValues();
  if(data.key)for(var i=1;i<rows.length;i++)if(String(rows[i][cols[4]])===data.key) {
    if(rows[i][2]!==data.name || rows[i][3]!==data.grade || rows[i][cols[0]]!==data.plan || Number(rows[i][cols[3]])!==data.amount)throw new Error('이미 처리된 요청입니다. 입력 내용을 확인해 주세요.');
    return {success:true,studentId:rows[i][1],name:data.name,grade:data.grade,membership:gemMembership_(sheet,i+1,rows[i])};
  }
  var properties=PropertiesService.getScriptProperties();
  var year=Utilities.formatDate(new Date(),'Asia/Seoul','yy'), counterKey='STUDENT_COUNTER_'+year;
  var seq=Number(properties.getProperty(counterKey)||'0');
  var ids=rows.map(function(row){return String(row[1]);});
  var id;
  do { seq++; if(seq>9999)throw new Error('올해 발급 가능한 ID 수를 초과했습니다. 선교사무실에 문의해 주세요.'); id=GEM_PLANS[data.plan].prefix+year+String(seq).padStart(4,'0'); }while(ids.indexOf(id)>=0);
  properties.setProperty(counterKey,String(seq));
  var start=new Date(), expiry=gemExpiry_(data.plan,start), rowValues=new Array(Math.max(sheet.getLastColumn(),9)).fill('');
  rowValues[0]=start; rowValues[1]=id; rowValues[2]=data.name; rowValues[3]=data.grade; rowValues[4]=GEM_PLANS[data.plan].label; rowValues[5]='등록';
  rowValues[cols[0]]=data.plan; rowValues[cols[1]]=start.toISOString(); rowValues[cols[2]]=expiry?expiry.toISOString():''; rowValues[cols[3]]=data.amount; rowValues[cols[4]]=data.key;
  sheet.appendRow(rowValues); SpreadsheetApp.flush();
  return {success:true,studentId:id,name:data.name,grade:data.grade,membership:{plan:data.plan,label:GEM_PLANS[data.plan].label,startsAt:start.toISOString(),expiresAt:expiry?expiry.toISOString():null}};
}
function doPost(e) {
  var lock=LockService.getScriptLock();
  try {lock.waitLock(15000); return createResponse_(gemIssue_(e && e.parameter || {}));}
  catch(error){console.error(error.message);return createResponse_({success:false,message:error.message||'학생 등록에 실패했습니다.'});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function issueGemRepresentative_() {
  var lock=LockService.getScriptLock();
  try {lock.waitLock(15000);var result=gemIssue_({}, {name:'GEM 대표',grade:'GEM 대표',plan:'representative',amount:0,key:'gem-representative-owner-v1'}); console.log(JSON.stringify(result));}
  finally{if(lock.hasLock())lock.releaseLock();}
}
