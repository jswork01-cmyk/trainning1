
// ==================================================================
// [중요] 권한 승인 및 배포 절차
// 1. 코드를 붙여넣은 후, 상단 툴바의 함수 선택 메뉴에서 '_1_GRANT_PERMISSIONS'를 선택하세요.
// 2. [실행] 버튼을 누르세요.
// 3. '권한 검토' 창이 뜨면 [권한 허용]을 진행해주세요.
// 4. 실행이 완료되면 다시 [배포] -> [관리] -> [새 버전으로 배포]를 눌러 업데이트하세요.
// 5. 배포 시 '웹 앱을 실행할 사용자'는 반드시 '나 (Me)'여야 합니다.
// ==================================================================
var SCRIPT_VERSION = "v4.7"; // v4.7: Strict Column I/J enforcement & Upload fix

function _1_GRANT_PERMISSIONS() {
  // 이 함수를 실행하여 스크립트가 DriveApp 및 SpreadsheetApp 권한을 요청하도록 합니다.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  console.log("시트 접근 권한 확인됨: " + ss.getName());
  
  // 드라이브 권한 트리거 (파일 생성 테스트)
  var root = DriveApp.getRootFolder();
  var tempFile = root.createFile("temp_permission_check.txt", "This is a temp file to check permissions.");
  var fileId = tempFile.getId();
  tempFile.setTrashed(true); // 바로 삭제
  
  console.log("드라이브 접근 권한 확인됨. (File ID created & deleted: " + fileId + ")");
  console.log("✅ 권한 승인이 완료되었습니다.");
  console.log("⚠️ 반드시 [배포] -> [관리] -> [새 버전으로 배포]를 진행하세요.");
}

// === 설정 영역 ===
var TARGET_SPREADSHEET_ID = "1Q0grV5mDDwCaRWjAWXSNp6-KQRwe4m9Pa1Lb37Ez0nw"; 
var DATA_SHEET_NAME = "data"; 
var BACKUP_SHEET_NAME = "DATAbase"; 
var APPROVAL_SHEET_NAME = "approvals"; 

function doGet(e) {
  return HtmlService.createHtmlOutput('<h1>✅ 스마트 훈련일지 서버 ' + SCRIPT_VERSION + ' 정상 작동 중</h1><p>설정: I열=사진(고정), J열=기록일시(고정)</p>');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  
  try {
    if (!lock.tryLock(45000)) {
      return createJsonResponse({ status: 'error', message: '서버 혼잡 (Lock Timeout)' });
    }

    if (!e || !e.postData) {
      return createJsonResponse({ status: 'error', message: '요청 데이터가 비어있습니다.' });
    }

    var data;
    try {
      var contents = e.postData.contents || "{}";
      data = JSON.parse(contents);
    } catch (parseError) {
      return createJsonResponse({ status: 'error', message: 'JSON 파싱 실패: ' + parseError.toString() });
    }

    var action = data.action;

    // [Fix for 'No data to save']: If action is missing but imageBytes exists, force upload_image
    if (!action && data.imageBytes) {
       action = 'upload_image';
    }

    // Prioritize Image Upload - Process immediately
    if (action === 'upload_image') {
       var result = uploadImage(data);
       return createJsonResponse(result);
    }

    var result;

    switch(action) {
      case 'export_data':
        result = appendToDataSheet(data.payload);
        break;
      
      case 'get_sheet_data': 
        result = getDataSheetRows();
        break;

      case 'get_employees': 
        result = getEmployeeData();
        break;

      case 'save_employees': 
        result = saveEmployees(data);
        break;

      case 'save_pdf':
        result = savePdf(data);
        break;
      
      case 'test_drive_folder': 
        result = testDriveFolder(data.folderId);
        break;
      
      case 'save_backup':
        result = saveBackup(data.payload);
        break;
      
      case 'load_backup':
        result = loadBackup();
        break;

      case 'save_approval': 
        result = saveApproval(data);
        break;

      case 'save_approval_batch': 
        result = saveApprovalBatch(data.payload);
        break;

      case 'get_approvals': 
        result = getApprovals();
        break;
      
      case 'test':
        var ss = getSpreadsheet();
        result = { status: 'success', message: '연결 성공 (' + SCRIPT_VERSION + '): ' + ss.getName() };
        break;
      
      default:
        // Handle payload without action as export_data (legacy support)
        var payload = Array.isArray(data) ? data : (data.payload || []);
        
        if (!payload || (Array.isArray(payload) && payload.length === 0)) {
           result = { status: 'error', message: 'Action not found or No Data: ' + (action || 'undefined') };
        } else {
           if (!Array.isArray(payload) && typeof payload === 'object') {
             payload = [payload];
           }
           result = appendToDataSheet(payload);
        }
    }

    return createJsonResponse(result);

  } catch (error) {
    logError('Error', error);
    return createJsonResponse({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------
// 1. 일지 데이터 저장 (Strict Column Mapping)
// ------------------------------------------------------------------
function appendToDataSheet(dataList) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(DATA_SHEET_NAME);
  
  if (!sheet) sheet = ss.insertSheet(DATA_SHEET_NAME);

  // Force Headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    var headers = ["날짜", "날씨", "직무", "담당자", "이용인", "점수", "특이사항", "훈련총평", "사진", "기록일시"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#EFEFEF");
  }

  var newRows = [];
  var timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  if (dataList && Array.isArray(dataList)) {
    dataList.forEach(function(row) {
      // Create a fixed-size array for 10 columns
      // 0:Date, 1:Weather, 2:Job, 3:Instructor, 4:Trainee, 5:Score, 6:Note, 7:Summary, 8:Images, 9:Timestamp
      var rowData = ["", "", "", "", "", "", "", "", "", ""]; 

      rowData[0] = row.date || "";
      rowData[1] = row.weather || "";
      rowData[2] = row.job || "";
      rowData[3] = row.instructor || "";
      rowData[4] = row.trainee || "";
      rowData[5] = row.score || "";
      rowData[6] = row.note || "";
      rowData[7] = row.summary || "";

      // [STRICT FIX] Column I (Index 8) is ALWAYS Images
      if (row.images) {
         if (Array.isArray(row.images)) {
             rowData[8] = JSON.stringify(row.images);
         } else {
             rowData[8] = String(row.images);
         }
      } else {
         rowData[8] = ""; // Ensure it's empty string, not undefined
      }

      // [STRICT FIX] Column J (Index 9) is ALWAYS Timestamp
      rowData[9] = timestamp;

      newRows.push(rowData);
    });
  }

  if (newRows.length > 0) {
    // Determine the range to write to.
    // getRange(row, column, numRows, numColumns)
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, 10).setValues(newRows);
  }

  return { status: 'success', message: newRows.length + "건 저장 완료 (" + SCRIPT_VERSION + ")" };
}

function getDataSheetRows() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return { status: 'success', data: [] };
  
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  data.shift(); // Remove header
  
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0]) {
      result.push({
        date: formatDate(row[0]), 
        weather: row[1] || '',
        job: row[2] || '',
        instructor: row[3] || '',
        trainee: row[4] || '',
        score: row[5] || '',
        note: row[6] || '',
        summary: row[7] || '',
        images: row[8] || '' // Column I
      });
    }
  }
  return { status: 'success', data: result };
}

// ------------------------------------------------------------------
// 2. 이미지 업로드 (권한 처리 강화)
// ------------------------------------------------------------------
function uploadImage(data) {
  try {
    if (!data.folderId) return { status: 'error', message: '폴더 ID가 없습니다.' };
    if (!data.imageBytes) return { status: 'error', message: '이미지 데이터가 없습니다.' };
    
    var folder;
    try {
       folder = DriveApp.getFolderById(data.folderId);
    } catch(e) {
       return { status: 'error', message: 'Exception: 액세스가 거부됨: DriveApp. (스크립트 권한 승인 필요)' };
    }
    
    var blob = Utilities.newBlob(Utilities.base64Decode(data.imageBytes), data.mimeType, data.filename);
    var file = folder.createFile(blob);
    
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      console.log("Sharing setup failed: " + e.toString());
    }
    
    return { 
      status: 'success', 
      url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000"
    };
  } catch (e) {
    return { status: 'error', message: 'Upload Failed: ' + e.toString() };
  }
}

// ------------------------------------------------------------------
// 3. 기타 유틸리티 및 함수들
// ------------------------------------------------------------------
function getEmployeeData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("info");
  
  if (!sheet) {
     var sheets = ss.getSheets();
     for (var i = 0; i < sheets.length; i++) {
       if (sheets[i].getSheetId() == 1482171667) {
         sheet = sheets[i];
         break;
       }
     }
  }
  if (!sheet) return { status: 'error', message: 'info 시트 없음' };
  
  var rows = sheet.getDataRange().getValues();
  if (rows.length > 0 && (rows[0][0] == '이름' || rows[0][0] == 'Name')) rows.shift();
  var validRows = rows.filter(function(r) { return r[0] && r[0] !== ""; });
  
  return { status: 'success', data: validRows };
}

function saveEmployees(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("info");
  if (!sheet) sheet = ss.insertSheet("info");
  sheet.clear();
  
  var headers = ["이름", "직위", "이메일", "연락처", "비밀번호", "서명URL"];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

  var payload = data.payload;
  if (payload && Array.isArray(payload)) {
    var newRows = payload.map(function(e) {
       return [e.name, e.position, e.email, e.phone, e.password, e.signature];
    });
    if (newRows.length > 0) sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
  }
  return { status: 'success', message: '직원 명단 저장됨' };
}

function formatDate(dateVal) {
  if (Object.prototype.toString.call(dateVal) === '[object Date]') {
    return Utilities.formatDate(dateVal, "Asia/Seoul", "yyyy-MM-dd");
  }
  return String(dateVal);
}

function savePdf(data) {
  try {
    var folder = DriveApp.getFolderById(data.folderId);
    var blob = Utilities.newBlob(data.html, "text/html;charset=UTF-8", (data.filename || "doc") + ".html");
    var pdfBlob = blob.getAs("application/pdf").setName(data.filename || "doc.pdf");
    var file = folder.createFile(pdfBlob);
    return { status: 'success', message: "PDF Saved: " + file.getUrl() };
  } catch(e) {
    return { status: 'error', message: 'PDF 저장 실패: ' + e.toString() };
  }
}

function testDriveFolder(folderId) {
  try {
    var id = folderId ? folderId.toString().trim() : "";
    if (!id) return { status: 'error', message: 'No Folder ID' };
    var folder = DriveApp.getFolderById(id);
    return { status: 'success', message: 'Folder: ' + folder.getName() };
  } catch (e) {
    return { status: 'error', message: 'Error: ' + e.toString() };
  }
}

function saveBackup(jsonString) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(BACKUP_SHEET_NAME);

  var chunkSize = 50000;
  var chunks = [];
  for (var i = 0; i < jsonString.length; i += chunkSize) {
    chunks.push([jsonString.substring(i, i + chunkSize)]);
  }
  sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
  return { status: 'success' };
}

function loadBackup() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!sheet) return { status: 'error', message: "No Backup" };
  var data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var fullString = data.map(function(r){ return r[0]; }).join("");
  return { status: 'success', payload: fullString };
}

function saveApproval(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(APPROVAL_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(APPROVAL_SHEET_NAME);
    sheet.appendRow(["LogID", "Role", "Status", "ApproverName", "SignatureUrl", "ApprovedAt", "Comment", "RejectReason"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }

  var logIdStr = "'" + String(data.logId);
  var sig = data.signatureUrl || "";
  if (sig.length > 45000) sig = "Signature_Too_Large";

  sheet.appendRow([logIdStr, data.role, data.status, data.approverName, sig, data.approvedAt, data.comment, data.rejectReason]);
  return { status: 'success', message: 'Approval Saved' };
}

function saveApprovalBatch(approvals) {
  if (!approvals || !Array.isArray(approvals) || approvals.length === 0) return { status: 'success', message: 'No data' };

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(APPROVAL_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(APPROVAL_SHEET_NAME);
    sheet.appendRow(["LogID", "Role", "Status", "ApproverName", "SignatureUrl", "ApprovedAt", "Comment", "RejectReason"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }

  var newRows = approvals.map(function(d) {
    var logIdStr = "'" + String(d.logId);
    var sig = d.signatureUrl || "";
    if (sig.length > 45000) sig = "Signature_Too_Large";
    return [logIdStr, d.role, d.status, d.approverName, sig, d.approvedAt, d.comment || '', d.rejectReason || ''];
  });

  if (newRows.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 8).setValues(newRows);
  return { status: 'success', message: 'Batch Saved' };
}

function getApprovals() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(APPROVAL_SHEET_NAME);
  if (!sheet) return { status: 'success', data: [] };
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  values.shift(); 
  
  var result = values.map(function(row) {
    return {
      logId: String(row[0]),
      role: row[1],
      status: row[2],
      approverName: row[3],
      signatureUrl: row[4],
      approvedAt: row[5],
      comment: row[6],
      rejectReason: row[7]
    };
  });
  return { status: 'success', data: result };
}

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function logError(msg, err) {
  console.error(msg + ': ' + err);
}
