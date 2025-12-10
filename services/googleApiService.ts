
export interface GoogleScriptResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  payload?: any;
  url?: string; // For image upload response
}

export const processSignatureUrl = (url: string): string => {
  if (!url) return '';
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith('data:image')) return trimmedUrl;
  
  // Google Drive Link Conversion
  if (trimmedUrl.includes('drive.google.com') || trimmedUrl.includes('docs.google.com')) {
    let id = '';
    const idMatch1 = trimmedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch2 = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch1 && idMatch1[1]) id = idMatch1[1];
    else if (idMatch2 && idMatch2[1]) id = idMatch2[1];
    
    // Convert to thumbnail link for better embedding reliability
    // 'uc?export=view' often fails due to 302 redirects and cross-site cookie blocking
    // 'thumbnail' endpoint is generally more permissive for <img> tags
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }
  
  // Dropbox Link Conversion
  if (trimmedUrl.includes('dropbox.com') && trimmedUrl.includes('dl=0')) {
    return trimmedUrl.replace('dl=0', 'raw=1');
  }
  
  return trimmedUrl;
};

export const executeGoogleScript = async (
  scriptUrl: string, 
  action: string, 
  payload?: any
): Promise<GoogleScriptResponse> => {
  if (!scriptUrl) throw new Error('구글 스크립트 URL이 설정되지 않았습니다.');
  
  const url = scriptUrl.trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") === -1) {
    const text = await response.text();
    if (text.includes("Google") || text.includes("Sign in") || text.includes("html")) {
      throw new Error("권한 오류: 스크립트 배포 시 '액세스 권한'을 '모든 사용자(Anyone)'로 설정하지 않았습니다.");
    }
    throw new Error("서버에서 올바르지 않은 응답 형식이 반환되었습니다. URL을 확인해주세요.");
  }

  return await response.json();
};

export const fetchGVizData = async (spreadsheetId: string, sheetName?: string, gid?: string) => {
  let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
  if (gid) url += `&gid=${gid}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
  
  const text = await response.text();
  const jsonText = text.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
  
  if (!jsonText || jsonText.length < 2) throw new Error("구글 시트 응답 형식이 올바르지 않습니다.");
  
  const data = JSON.parse(jsonText[1]);
  if (!data.table || !data.table.cols || !data.table.rows) throw new Error("데이터 구조가 올바르지 않습니다.");
  
  const headers = data.table.cols.map((col: any) => col.label || col.id);
  const rows = data.table.rows.map((row: any) => 
     row.c.map((cell: any) => 
        cell && cell.f !== undefined ? cell.f : (cell && cell.v !== undefined ? cell.v : '')
     )
  );
  return { headers, rows };
};

// --- Google Drive Logic ---
export const savePdfToDrive = async (
  scriptUrl: string,
  folderId: string,
  htmlContent: string,
  filename: string
): Promise<GoogleScriptResponse> => {
    return await executeGoogleScript(scriptUrl, 'save_pdf', {
        folderId,
        html: htmlContent,
        filename
    });
};

export const uploadImageToDrive = async (
  scriptUrl: string,
  folderId: string,
  base64Data: string,
  filename: string
): Promise<string> => {
  // Extract pure base64 if it has prefix
  let mimeType = 'image/jpeg';
  let imageBytes = base64Data;
  
  if (base64Data.includes('base64,')) {
    const parts = base64Data.split('base64,');
    mimeType = parts[0].replace('data:', '').replace(';', '');
    imageBytes = parts[1];
  }

  const result = await executeGoogleScript(scriptUrl, 'upload_image', {
    folderId,
    imageBytes,
    mimeType,
    filename
  });

  if (result.status === 'success' && result.url) {
    return result.url;
  } else {
    console.error("Image Upload Script Error Result:", JSON.stringify(result)); 
    
    let msg = result.message || '이미지 업로드 실패';

    if (msg.includes('DriveApp') || msg.includes('액세스') || msg.includes('Access denied')) {
        throw new Error('🛑 구글 스크립트 권한 오류: 스크립트 편집기에서 "_1_GRANT_PERMISSIONS" 함수를 실행하여 DriveApp 권한을 허용해주세요.');
    }

    // [중요] 구버전 스크립트의 Default 응답 감지
    // v4.3 부터는 'Action not found'로 에러를 반환하므로, '저장할 데이터 없음'이 뜨면 100% 구버전임.
    if (msg.includes('0건 저장 완료') || msg.includes('저장할 데이터 없음')) {
       throw new Error('구글 스크립트가 구버전입니다. 구글 스크립트 편집기에서 [배포]->[새 배포]를 눌러 업데이트를 반영해주세요.');
    }
    
    if (msg.includes('폴더 ID')) {
       throw new Error('구글 드라이브 폴더 ID가 유효하지 않습니다. 설정을 확인해주세요.');
    }

    throw new Error(msg);
  }
};

// --- Approval Logic ---
export const saveApproval = async (
  scriptUrl: string,
  data: any
): Promise<GoogleScriptResponse> => {
  return await executeGoogleScript(scriptUrl, 'save_approval', data);
};

export const saveApprovalBatch = async (
  scriptUrl: string,
  approvals: any[]
): Promise<GoogleScriptResponse> => {
  return await executeGoogleScript(scriptUrl, 'save_approval_batch', { payload: approvals });
};
