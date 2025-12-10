
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MOCK_JOBS, MOCK_TRAINEES, MOCK_EMPLOYEES } from './constants';
import { DailyLog, Trainee, JobTask, Employee, ApprovalRole, Evaluation, ApprovalStep } from './types';
import { LogForm } from './components/LogForm';
import { Dashboard } from './components/Dashboard';
import { JobAnalytics } from './components/JobAnalytics';
import { TraineeManagement } from './components/TraineeManagement';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { ApprovalSystem } from './components/ApprovalSystem';
import { LayoutDashboard, PenTool, ClipboardList, Users, Settings as SettingsIcon, PieChart, Printer, CheckCircle, CloudUpload, Table, LogOut, UserCircle, Loader2, ChevronDown, ChevronUp, DownloadCloud, Cloud, Search, Filter, X, Database, RefreshCw, FileSpreadsheet, Globe, FileSignature, Menu } from 'lucide-react';
import { executeGoogleScript, fetchGVizData, savePdfToDrive, processSignatureUrl, saveApprovalBatch, saveApproval, uploadImageToDrive } from './services/googleApiService';

// Helper to load from storage
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (parsed === null) return fallback;
    return parsed;
  } catch (e) {
    console.error(`Failed to load ${key} from storage`, e);
    return fallback;
  }
};

const generateSharedJobId = (title: string): string => {
  if (!title) return 'unknown-job';
  const normalized = title.trim().replace(/\s+/g, '-');
  return `shared-job-${normalized}`;
};

const LIVE_SPREADSHEET_ID = '1Q0grV5mDDwCaRWjAWXSNp6-KQRwe4m9Pa1Lb37Ez0nw';
const INFO_SHEET_GID = '1482171667';

// --- Helper: Parse GViz Data to Logs ---
const parseSheetData = (headers: string[], rows: string[][], trainees: Trainee[]) => {
    if (rows.length === 0) return { sheetLogs: [], sheetJobs: [], sheetTrainees: [] };

    const idx = {
      date: headers.findIndex(h => h.includes('날짜') || h.includes('일자') || h.toLowerCase().includes('date')),
      job: headers.findIndex(h => h.includes('직무') || h.includes('작업') || h.toLowerCase().includes('job')),
      instructor: headers.findIndex(h => h.includes('담당자') || h.includes('교사') || h.includes('교사') || h.toLowerCase().includes('instructor')),
      trainee: headers.findIndex(h => h.includes('이용인') || h.includes('훈련생') || h.includes('이름') || h.includes('성명') || h.toLowerCase().includes('name')),
      score: headers.findIndex(h => h.includes('점수') || h.includes('평가') || h.toLowerCase().includes('score')),
      note: headers.findIndex(h => h.includes('특이') || h.includes('비고') || h.includes('메모') || h.toLowerCase().includes('note')),
      summary: headers.findIndex(h => h.includes('총평') || h.includes('요약') || h.toLowerCase().includes('summary')),
      weather: headers.findIndex(h => h.includes('날씨') || h.toLowerCase().includes('weather')),
      photo: headers.findIndex(h => h.includes('사진') || h.includes('이미지') || h.toLowerCase().includes('image') || h.toLowerCase().includes('photo'))
    };

    if (idx.date === -1 || idx.job === -1 || idx.trainee === -1) {
      console.warn("Required columns (Date, Job, Trainee) not found in sheet.");
      return { sheetLogs: [], sheetJobs: [], sheetTrainees: [] };
    }

    const groupedLogs = new Map<string, DailyLog>();
    const newJobsMap = new Map<string, JobTask>();
    const newTraineesMap = new Map<string, Trainee>();

    // Helper to check if string looks like an image URL or Data
    const isLikelyImage = (str: string) => {
       const s = str.trim();
       if (!s) return false;
       if (s.startsWith('http')) return true;
       if (s.startsWith('data:image')) return true;
       if (s.startsWith('[')) return true; // JSON array
       // Ignore random text, timestamps (e.g. 2025...), etc.
       return false;
    };

    rows.forEach((row, i) => {
      const date = row[idx.date];
      const rawJobTitle = row[idx.job];
      const traineeName = row[idx.trainee];
      const instructor = idx.instructor > -1 ? row[idx.instructor] : 'Unknown';

      if (!date || !rawJobTitle || !traineeName) return;

      const jobTitle = rawJobTitle.toString().trim();
      const taskId = generateSharedJobId(jobTitle);

      if (!newJobsMap.has(taskId)) {
          newJobsMap.set(taskId, {
            id: taskId,
            title: jobTitle,
            category: 'other',
            description: 'From Google Sheet'
          });
      }

      let traineeId = trainees.find(t => t.name === traineeName)?.id;
      if (!traineeId) {
        traineeId = `sheet-trainee-${traineeName}`;
        if (!newTraineesMap.has(traineeId)) {
          newTraineesMap.set(traineeId, {
            id: traineeId,
            name: traineeName,
            disabilityType: '기타',
            memo: 'From Google Sheet',
            jobRole: '',
            workLocation: '1층'
          });
        }
      }

      // Generate ID matching LogForm logic
      const key = `log-${date}-${jobTitle}-${instructor}`;
      
      if (!groupedLogs.has(key)) {
        // Parse images if available
        let images: string[] = [];
        if (idx.photo > -1 && row[idx.photo]) {
            try {
                const rawPhoto = row[idx.photo].toString();
                // STRICT CHECK: ignore if it's a timestamp or random text
                if (rawPhoto && isLikelyImage(rawPhoto)) {
                    if (rawPhoto.startsWith('[')) {
                        images = JSON.parse(rawPhoto);
                    } else {
                        // Fallback: comma separated urls
                        images = rawPhoto.split(',').map(s => s.trim()).filter(Boolean);
                    }
                }
            } catch(e) {
                // Ignore parsing errors
            }
        }

        groupedLogs.set(key, {
          id: key, // Use consistent ID
          date,
          taskId,
          weather: idx.weather > -1 ? (row[idx.weather] || '맑음') : '맑음',
          instructorName: instructor,
          aiSummary: idx.summary > -1 ? row[idx.summary] : '',
          images,
          evaluations: [],
          approvals: [
             { role: 'instructor', label: '담당자', status: 'approved', approverName: instructor, approvedAt: date },
             { role: 'manager', label: '사무국장', status: 'pending' },
             { role: 'director', label: '원장', status: 'pending' }
          ]
        });
      }

      const log = groupedLogs.get(key)!;
      let scoreVal = parseInt(row[idx.score]);
      if (isNaN(scoreVal) || scoreVal < 1 || scoreVal > 5) scoreVal = 3;

      if (!log.evaluations.find(e => e.traineeId === traineeId)) {
        log.evaluations.push({
          traineeId,
          score: scoreVal as 1|2|3|4|5,
          note: idx.note > -1 ? row[idx.note] : ''
        });
      }
    });

    return {
      sheetLogs: Array.from(groupedLogs.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      sheetJobs: Array.from(newJobsMap.values()),
      sheetTrainees: Array.from(newTraineesMap.values())
    };
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => loadFromStorage('app_currentUser', null));
  const [view, setView] = useState<'dashboard' | 'create' | 'history' | 'analytics' | 'management' | 'settings' | 'approval'>('dashboard');
  
  const [logs, setLogs] = useState<DailyLog[]>(() => loadFromStorage('app_logs', []));
  const [trainees, setTrainees] = useState<Trainee[]>(() => loadFromStorage('app_trainees', MOCK_TRAINEES));
  const [jobs, setJobs] = useState<JobTask[]>(() => loadFromStorage('app_jobs_v2', []));
  const [employees, setEmployees] = useState<Employee[]>(() => loadFromStorage('app_employees', MOCK_EMPLOYEES));
  
  const [approvalOverlays, setApprovalOverlays] = useState<Record<string, { approvals: any[] }>>(() => loadFromStorage('app_approvalOverlays', {}));
  const [facilityName, setFacilityName] = useState(() => loadFromStorage('app_facilityName_v3', '정심작업장'));
  
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState(() => loadFromStorage('app_googleDriveFolderId', '1gsh_-RFaGjf4endwWwoLLctqetYGLv02'));
  const [googleSheetUrl, setGoogleSheetUrl] = useState(() => loadFromStorage('app_googleSheetUrl', 'https://script.google.com/macros/s/AKfycbwY4BhpuCQDLjAdgcs3BlNvS3VJIi85mANkfE-Hjt87IvJgWIOMSEzwyzIAaUvPni-EbQ/exec'));
  const [googleSheetAutoSync, setGoogleSheetAutoSync] = useState(() => loadFromStorage('app_googleSheetAutoSync_v2', true));
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEmployeeSyncing, setIsEmployeeSyncing] = useState(false); 
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [historyFilter, setHistoryFilter] = useState({ date: '', term: '' });

  const [rawSheetData, setRawSheetData] = useState<{headers: string[], rows: string[][]}>({ headers: [], rows: [] });
  const [isRawSheetLoading, setIsRawSheetLoading] = useState(false);
  const [rawSheetError, setRawSheetError] = useState('');

  const [autoConnectionStatus, setAutoConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [autoConnectionMessage, setAutoConnectionMessage] = useState('');

  const [autoDriveStatus, setAutoDriveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [autoDriveMessage, setAutoDriveMessage] = useState('');

  const [programSheetJobs, setProgramSheetJobs] = useState<JobTask[]>([]);
  const hasSyncedRef = useRef(false);

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole: ApprovalRole = currentUser 
    ? (currentUser.position.includes('원장') || currentUser.position.includes('시설장') ? 'director' : 
       currentUser.position.includes('사무국장') || currentUser.position.includes('팀장') ? 'manager' : 'instructor')
    : 'instructor';

  useEffect(() => { localStorage.setItem('app_currentUser', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { localStorage.setItem('app_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('app_trainees', JSON.stringify(trainees)); }, [trainees]);
  useEffect(() => { localStorage.setItem('app_jobs_v2', JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem('app_employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('app_facilityName_v3', JSON.stringify(facilityName)); }, [facilityName]);
  useEffect(() => { localStorage.setItem('app_googleDriveFolderId', JSON.stringify(googleDriveFolderId)); }, [googleDriveFolderId]);
  useEffect(() => { localStorage.setItem('app_googleSheetUrl', JSON.stringify(googleSheetUrl)); }, [googleSheetUrl]);
  useEffect(() => { localStorage.setItem('app_googleSheetAutoSync_v2', JSON.stringify(googleSheetAutoSync)); }, [googleSheetAutoSync]);
  useEffect(() => { localStorage.setItem('app_approvalOverlays', JSON.stringify(approvalOverlays)); }, [approvalOverlays]);

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    setView('dashboard');
    hasSyncedRef.current = false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    hasSyncedRef.current = false;
    setRawSheetData({ headers: [], rows: [] }); 
    setProgramSheetJobs([]);
    setAutoConnectionStatus('idle');
    setAutoDriveStatus('idle');
    setIsMobileMenuOpen(false);
  };

  const handleResetData = () => {
    if (confirm('모든 데이터를 초기화하고 기본값(Mock Data)으로 되돌리시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      localStorage.removeItem('app_logs');
      localStorage.removeItem('app_trainees');
      localStorage.removeItem('app_jobs_v2');
      localStorage.removeItem('app_employees');
      localStorage.removeItem('app_facilityName_v3');
      localStorage.removeItem('app_googleDriveFolderId');
      localStorage.removeItem('app_approvalOverlays');
      
      setLogs([]);
      setTrainees(MOCK_TRAINEES);
      setJobs([]); 
      setEmployees(MOCK_EMPLOYEES);
      setFacilityName('정심작업장');
      setGoogleDriveFolderId('1gsh_-RFaGjf4endwWwoLLctqetYGLv02');
      setApprovalOverlays({});
      
      alert('모든 데이터가 초기화되었습니다.');
    }
  };

  const fetchApprovalsFromGoogleSheet = async (isAuto = false) => {
    // APPROVALS: Use GViz for reliable reading
    if (!isAuto) setIsLoading(true);

    try {
      const { rows } = await fetchGVizData(LIVE_SPREADSHEET_ID, 'approvals');
      
      const newOverlays: Record<string, { approvals: any[] }> = {};

      rows.forEach((row: any) => {
         // GViz cells: c[0] -> LogID, c[1] -> Role, ... 
         let logId = String(row[0]);
         logId = logId.replace(/,/g, '').replace(/^'/, '').trim();
         
         if (!logId) return;

         const role = row[1];
         const status = row[2];
         const approverName = row[3];
         const signatureUrl = row[4];
         const approvedAt = row[5];
         const comment = row[6];
         const rejectReason = row[7];

         if (!newOverlays[logId]) {
             newOverlays[logId] = { approvals: [] }; 
         }
         
         let idx = -1;
         if (role === 'instructor') idx = 0;
         else if (role === 'manager') idx = 1;
         else if (role === 'director') idx = 2;

         if (idx !== -1) {
             if (!newOverlays[logId].approvals[idx]) newOverlays[logId].approvals[idx] = {};
             
             newOverlays[logId].approvals[idx] = {
               role, status, approverName, signatureUrl, approvedAt, comment, rejectReason
             };
         }
      });
      
      setApprovalOverlays(prev => {
         const merged = { ...prev };
         Object.keys(newOverlays).forEach(logId => {
            if (!merged[logId]) merged[logId] = { approvals: [] };
            newOverlays[logId].approvals.forEach((step, idx) => {
               if (step) {
                  if (!merged[logId].approvals) merged[logId].approvals = [];
                  merged[logId].approvals[idx] = { ...merged[logId].approvals[idx], ...step };
               }
            });
         });
         return merged;
      });
      
      if (!isAuto && rows.length > 0) console.log(`✅ Loaded approvals from sheet.`);

    } catch (e) {
      console.error("Failed to fetch approvals via GViz:", e);
    } finally {
      if (!isAuto) setIsLoading(false);
    }
  };

  const syncToGoogleSheet = async (dataPayload: any[]) => {
    if (!googleSheetUrl) return;
    try {
        await executeGoogleScript(googleSheetUrl, 'export_data', { payload: dataPayload });
    } catch(e) {
        console.error("Sync Error", e);
    }
  };

  const prepareLogDataForExport = (log: DailyLog) => {
    const job = displayJobs.find(j => j.id === log.taskId)?.title || 'Unknown';
    // Convert images array to JSON string for sheet storage
    // Ensure it matches what script expects (JSON string) for Column I
    const imagesStr = (log.images && log.images.length > 0) ? JSON.stringify(log.images) : '';

    return log.evaluations.map(ev => {
      const trainee = trainees.find(t => t.id === ev.traineeId);
      return {
        date: log.date,
        weather: log.weather,
        job: job,
        instructor: log.instructorName,
        trainee: trainee ? trainee.name : 'Unknown',
        score: ev.score,
        note: ev.note,
        summary: log.aiSummary || '',
        images: imagesStr // This is critical for Column I
      };
    });
  };

  const fetchRawSheetData = async () => {
    setIsRawSheetLoading(true);
    setRawSheetError('');
    try {
      const { headers, rows } = await fetchGVizData(LIVE_SPREADSHEET_ID);
      setRawSheetData({ headers, rows });
    } catch (error: any) {
      console.error("GViz Load Error:", error);
      setRawSheetError(error.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsRawSheetLoading(false);
    }
  };

  const fetchTraineesFromGoogleSheet = async (isAuto = false) => {
    if (!isAuto) setIsLoading(true);
    try {
      const { headers, rows } = await fetchGVizData(LIVE_SPREADSHEET_ID, 'employee');

      const idx = {
        name: headers.findIndex((h: string) => h.includes('이름') || h.includes('성명') || h.toLowerCase().includes('name')),
        birth: headers.findIndex((h: string) => h.includes('생년') || h.includes('birth')),
        type: headers.findIndex((h: string) => h.includes('장애') || h.includes('유형')),
        job: headers.findIndex((h: string) => h.includes('직무') || h.includes('역할')),
        location: headers.findIndex((h: string) => h.includes('장소') || h.includes('1층')),
        residence: headers.findIndex((h: string) => h.includes('구분') || h.includes('거주') || h.includes('재가')),
        employ: headers.findIndex((h: string) => h.includes('직급') || h.includes('근로')),
        phone: headers.findIndex((h: string) => h.includes('전화') || h.includes('phone')),
        goal: headers.findIndex((h: string) => h.includes('목표') || h.includes('goal')),
        score: headers.findIndex((h: string) => h.includes('점수') || h.includes('target')),
        memo: headers.findIndex((h: string) => h.includes('메모') || h.includes('특이'))
      };

      if (idx.name === -1) throw new Error("'이름' 컬럼을 찾을 수 없습니다. (시트명: employee)");

      const newTrainees: Trainee[] = rows.map((row: any[], i: number) => {
        const name = row[idx.name];
        if (!name) return null;

        return {
          id: `sheet-t-${i}`,
          name: name,
          birthDate: idx.birth > -1 ? row[idx.birth] : '',
          disabilityType: idx.type > -1 ? row[idx.type] : '기타',
          jobRole: idx.job > -1 ? row[idx.job] : '',
          workLocation: (idx.location > -1 && row[idx.location] === '2층') ? '2층' : '1층',
          residenceType: (idx.residence > -1 && row[idx.residence] === '시설') ? '시설' : '재가',
          employmentType: (idx.employ > -1 && row[idx.employ] === '근로') ? '근로' : '훈련',
          phone: idx.phone > -1 ? row[idx.phone] : '',
          trainingGoal: idx.goal > -1 ? row[idx.goal] : '',
          targetScore: idx.score > -1 ? (parseInt(row[idx.score]) || 3) : 3,
          memo: idx.memo > -1 ? row[idx.memo] : ''
        };
      }).filter((t: Trainee | null) => t !== null);

      setTrainees(newTrainees);
      if (!isAuto) alert(`✅ 구글 시트(employee)에서 ${newTrainees.length}명의 이용인 정보를 동기화했습니다.`);

    } catch (e: any) {
      console.error(e);
      if (!isAuto) alert(`❌ 동기화 실패: ${e.message}`);
    } finally {
      if (!isAuto) setIsLoading(false);
    }
  };

  const fetchProgramsFromGoogleSheet = async (isAuto = false) => {
    try {
      const { rows } = await fetchGVizData(LIVE_SPREADSHEET_ID, 'program');
      const fetchedJobs: JobTask[] = [];

      rows.forEach((row: any, i: number) => {
          const title = row[0];
          
          if (!title || title === '직무' || title === '직무명' || title === '프로그램' || title === '프로그램명') return;
          
          const trimmedTitle = title.toString().trim();
          fetchedJobs.push({
              id: generateSharedJobId(trimmedTitle),
              title: trimmedTitle,
              category: 'other',
              description: '구글 시트(program) 연동'
          });
      });

      setProgramSheetJobs(fetchedJobs);
      if (!isAuto && fetchedJobs.length > 0) console.log(`✅ 구글 시트(program)에서 ${fetchedJobs.length}개 직무 동기화`);

    } catch (e: any) {
       console.error("Program sheet fetch error:", e);
    }
  };

  const fetchEmployeesFromGoogleSheet = async (isAuto = false) => {
    setIsEmployeeSyncing(true);
    if (!isAuto) setIsLoading(true);
    
    let newEmployees: Employee[] = [];

    try {
      let scriptSuccess = false;
      if (googleSheetUrl) {
        try {
          const result = await executeGoogleScript(googleSheetUrl, 'get_employees');
          if (result.status === 'success' && Array.isArray(result.data)) {
             const rows = result.data;
             newEmployees = rows.map((row: any[], i: number) => {
                if (!row[0] || !row[2]) return null;
                return {
                  id: `sheet-emp-${i}`,
                  name: row[0].toString().trim(),
                  position: (row[1] || '직업훈련교사').toString().trim(),
                  email: row[2].toString().trim(),
                  phone: (row[3] || '').toString().trim(),
                  password: (row[4] || '1234').toString().trim(),
                  signatureUrl: processSignatureUrl((row[5] || '').toString().trim())
                };
             }).filter((e: any): e is Employee => e !== null);
             
             if (newEmployees.length > 0) {
               scriptSuccess = true;
               if (!isAuto) console.log("Fetched employees via Apps Script");
             }
          }
        } catch (scriptError) {
          console.warn("Script fetch failed, falling back to GViz", scriptError);
        }
      }

      if (!scriptSuccess) {
        // Fallback to GViz using GID
        const { rows } = await fetchGVizData(LIVE_SPREADSHEET_ID, undefined, INFO_SHEET_GID);
        const idx = { name: 0, position: 1, email: 2, phone: 3, password: 4, signature: 5 };

        newEmployees = rows.map((row: any, i: number) => {
          const name = row[idx.name];
          if (!name || name === '이름' || name === '성명' || name === 'Name') return null;
          
          const email = row[idx.email];
          if (!email) return null;

          return {
            id: `sheet-emp-${i}`,
            name: name.toString().trim(),
            position: (row[idx.position] || '직업훈련교사').toString().trim(),
            email: email.toString().trim(),
            phone: (row[idx.phone] || '').toString().trim(),
            password: (row[idx.password] || '1234').toString().trim(),
            signatureUrl: processSignatureUrl((row[idx.signature] || '').toString().trim())
          };
        }).filter((e: any): e is Employee => e !== null);
      }

      if (newEmployees.length > 0) {
        setEmployees(newEmployees);
        if (!isAuto) alert(`✅ 구글 시트(info)에서 ${newEmployees.length}명의 직원 정보를 동기화했습니다.`);
      } else {
        if (!isAuto) alert('⚠️ 동기화되었으나 유효한 직원 데이터가 없습니다.');
      }

    } catch (e: any) {
      console.error(e);
      if (!isAuto) alert(`❌ 직원 동기화 실패: ${e.message}`);
    } finally {
      setIsEmployeeSyncing(false);
      if (!isAuto) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesFromGoogleSheet(true);
  }, []);

  const saveEmployeesToGoogleSheet = async () => {
    if (!googleSheetUrl) {
      alert('기관 정보 설정에서 구글 스크립트 URL을 먼저 등록해주세요.');
      return;
    }
    if (!confirm('현재 직원 목록을 구글 시트(info)로 내보내시겠습니까?\n기존 데이터는 덮어씌워집니다.')) return;

    setIsLoading(true);
    try {
      const payload = employees.map(e => ({
        name: e.name,
        position: e.position,
        email: e.email,
        phone: e.phone,
        password: e.password,
        signature: e.signatureUrl
      }));

      const result = await executeGoogleScript(googleSheetUrl, 'save_employees', { payload });
      if (result.status === 'success') {
        alert('✅ 직원 명단이 구글 시트(info)에 저장되었습니다.');
      } else {
        if (result.message && result.message.includes('Action not found')) {
             throw new Error("구글 스크립트에 'save_employees' 기능이 없습니다. 스크립트 업데이트가 필요합니다.");
        }
        throw new Error(result.message);
      }
    } catch (e: any) {
      console.error(e);
      alert(`❌ 내보내기 실패: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const { sheetLogs, sheetJobs, sheetTrainees } = useMemo(() => {
    if (rawSheetData.rows.length === 0) return { sheetLogs: [], sheetJobs: [], sheetTrainees: [] };
    return parseSheetData(rawSheetData.headers, rawSheetData.rows, trainees);
  }, [rawSheetData, trainees]);

  const isSheetMode = sheetLogs.length > 0;
  
  const displayLogs = useMemo(() => {
    // If in sheet mode, use sheetLogs but MERGE with local logs that haven't been synced yet or have newer images
    if (isSheetMode) {
        const merged = [...sheetLogs];
        // Check for local logs that are not in sheet logs (based on ID or key)
        logs.forEach(localLog => {
            const exists = merged.find(sl => sl.id === localLog.id || (sl.date === localLog.date && sl.taskId === localLog.taskId && sl.instructorName === localLog.instructorName));
            
            if (!exists) {
                merged.unshift(localLog); // Add new local logs to top
            } else if (exists && localLog.images && localLog.images.length > 0 && (!exists.images || exists.images.length === 0)) {
                // If sheet log exists but has no images, but local log does, use local images
                exists.images = localLog.images;
            }
        });
        
        return merged.map(log => {
            const overlay = approvalOverlays[log.id];
            if (overlay && overlay.approvals) {
                const mergedApprovals = log.approvals.map((step, idx) => {
                   if (overlay.approvals[idx] && overlay.approvals[idx].status !== 'pending') {
                      return { ...step, ...overlay.approvals[idx] };
                   }
                   return step;
                });
                return { ...log, approvals: mergedApprovals };
            }
            return log;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    // Local mode
    return logs.map(log => {
      const overlay = approvalOverlays[log.id];
      if (overlay && overlay.approvals) {
        const mergedApprovals = log.approvals.map((step, idx) => {
           if (overlay.approvals[idx] && overlay.approvals[idx].status !== 'pending') {
              return { ...step, ...overlay.approvals[idx] };
           }
           return step;
        });
        return { ...log, approvals: mergedApprovals };
      }
      return log;
    });
  }, [logs, sheetLogs, isSheetMode, approvalOverlays]);
  
  const displayJobs = useMemo(() => {
    const mergedJobs = new Map<string, JobTask>();
    const addJob = (job: JobTask) => {
       const id = generateSharedJobId(job.title);
       if (!mergedJobs.has(id)) {
         mergedJobs.set(id, { ...job, id });
       }
    };
    programSheetJobs.forEach(addJob);
    sheetJobs.forEach(addJob);
    trainees.forEach(t => {
      if(t.jobRole) t.jobRole.split(',').forEach(r => {
         const title = r.trim();
         if(title) addJob({ id: generateSharedJobId(title), title, category: 'other', description: 'From Trainee Data' });
      });
    });
    jobs.forEach(addJob);
    return Array.from(mergedJobs.values());
  }, [jobs, sheetJobs, trainees, programSheetJobs]);

  const displayTrainees = useMemo(() => {
    return isSheetMode ? [...trainees, ...sheetTrainees.filter(st => !trainees.some(t => t.name === st.name))] : trainees;
  }, [trainees, sheetTrainees, isSheetMode]);


  useEffect(() => {
    if (currentUser) {
      if (googleSheetUrl) {
        if (!hasSyncedRef.current) {
          hasSyncedRef.current = true;
          fetchRawSheetData(); 
          fetchTraineesFromGoogleSheet(true);
          fetchProgramsFromGoogleSheet(true);
          fetchEmployeesFromGoogleSheet(true);
          fetchApprovalsFromGoogleSheet(true);

          if (googleSheetAutoSync) {
            handleLoadFromGoogleSheet(true);
          }
        } else {
           fetchRawSheetData(); 
        }

        const runStartupConnectionTest = async () => {
            try {
                setAutoConnectionStatus('idle');
                const result = await executeGoogleScript(googleSheetUrl, 'test');
                if (result.status === 'success') {
                    setAutoConnectionStatus('success');
                    setAutoConnectionMessage('시스템 시작 시 자동 연결 확인됨');
                } else {
                    setAutoConnectionStatus('error');
                    setAutoConnectionMessage(result.message || '연결 실패');
                }
            } catch (e: any) {
                console.error("Auto connection test failed:", e);
                setAutoConnectionStatus('error');
                setAutoConnectionMessage(e.message || '네트워크 오류 또는 URL 설정 확인 필요');
            }
        };
        runStartupConnectionTest();

        if (googleDriveFolderId) {
             const runStartupDriveTest = async () => {
                 try {
                     setAutoDriveStatus('idle');
                     const result = await executeGoogleScript(googleSheetUrl, 'test_drive_folder', { folderId: googleDriveFolderId });
                     
                     if (result.status === 'success') {
                         setAutoDriveStatus('success');
                         setAutoDriveMessage(result.message || '드라이브 접근 성공');
                     } else {
                         setAutoDriveStatus('error');
                         setAutoDriveMessage(result.message || '접근 실패');
                     }
                 } catch (e: any) {
                     console.error("Auto drive test failed:", e);
                     setAutoDriveStatus('error');
                     setAutoDriveMessage(e.message || '오류 발생');
                 }
             };
             runStartupDriveTest();
        }
      }
    }
  }, [currentUser, googleSheetUrl, googleDriveFolderId]);

  // Updated Import function using GViz instead of script action
  const handleLoadFromGoogleSheet = async (isAuto = false) => {
    if (!googleSheetUrl && !isAuto) {
      alert('설정 메뉴에서 구글 스크립트 URL을 먼저 등록해주세요.');
      return;
    }
    if (!isAuto && !confirm('구글 시트(data)의 데이터를 불러와 현재 목록에 추가하시겠습니까?')) return;

    if (!isAuto) setIsLoading(true); 

    try {
      // Use GViz logic directly
      const { headers, rows } = await fetchGVizData(LIVE_SPREADSHEET_ID);
      const { sheetLogs: newLogs } = parseSheetData(headers, rows, trainees);
      
      if (newLogs.length > 0) {
        setLogs(prev => {
           // Merge: prevent duplicates based on ID
           const existingIds = new Set(prev.map(l => l.id));
           const filteredNew = newLogs.filter(l => !existingIds.has(l.id));
           return [...filteredNew, ...prev];
        });
        if (!isAuto) alert(`✅ ${newLogs.length}건의 데이터를 불러왔습니다.`);
      } else {
        if (!isAuto) alert('⚠️ 가져올 데이터가 없습니다.');
      }
    } catch (e: any) {
      console.error(e);
      if (!isAuto) alert(`❌ 불러오기 실패: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloudSave = async () => {
    if (!googleSheetUrl) {
      alert('기관 정보 설정에서 구글 스크립트 URL을 먼저 등록해주세요.');
      return;
    }
    if (!confirm('현재 앱의 모든 데이터를 구글 클라우드(DATABASE 시트)에 백업하시겠습니까?')) return;
    setIsLoading(true);
    try {
      const payloadData = JSON.stringify({
        logs,
        trainees,
        jobs,
        employees,
        facilityName,
        googleDriveFolderId,
        approvalOverlays
      });

      const result = await executeGoogleScript(googleSheetUrl, 'save_backup', { payload: payloadData });
      if (result.status === 'success') {
        alert('✅ 클라우드 백업 완료!');
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      console.error(e);
      alert(`❌ 백업 실패: ${e.message || e}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloudLoad = async () => {
    if (!googleSheetUrl) {
      alert('기관 정보 설정에서 구글 스크립트 URL을 먼저 등록해주세요.');
      return;
    }
    if (!confirm('클라우드에서 데이터를 불러오시겠습니까?')) return;
    setIsLoading(true);
    try {
      const result = await executeGoogleScript(googleSheetUrl, 'load_backup');
      if (result.status === 'success' && result.payload) {
        const data = JSON.parse(result.payload);
        if (data.logs) setLogs(data.logs);
        if (data.trainees) setTrainees(data.trainees);
        if (data.jobs) setJobs(data.jobs);
        if (data.employees) setEmployees(data.employees);
        if (data.approvalOverlays) setApprovalOverlays(data.approvalOverlays);
        
        alert('✅ 데이터 복원 완료!');
      } else {
         alert('⚠ 저장된 백업 데이터가 없습니다.');
      }
    } catch (e: any) {
      console.error(e);
      alert(`❌ 복원 실패: ${e.message || e}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLog = async (newLog: DailyLog) => {
    // 1. Process Images: Upload base64 images to Drive if needed
    let processedImages = newLog.images || [];
    let uploadSuccess = true;
    
    // Check if there are base64 images to upload
    if (processedImages.some(img => img.startsWith('data:'))) {
        if (!googleSheetUrl || !googleDriveFolderId) {
            if (!confirm("구글 드라이브 설정이 없어 이미지를 시트에 직접 저장할 수 없습니다 (오류 가능성 높음). 그래도 진행하시겠습니까?")) {
                return;
            }
        } else {
            setIsLoading(true);
            try {
                const uploadedUrls: string[] = [];
                for (let i = 0; i < processedImages.length; i++) {
                    const img = processedImages[i];
                    if (img.startsWith('data:')) {
                         const fileName = `${newLog.date}_${newLog.instructorName}_photo_${i+1}.jpg`;
                         const url = await uploadImageToDrive(googleSheetUrl, googleDriveFolderId, img, fileName);
                         uploadedUrls.push(url);
                    } else {
                         uploadedUrls.push(img);
                    }
                }
                processedImages = uploadedUrls;
            } catch (e: any) {
                console.error("Image Upload Failed", e);
                
                // Show a very clear message for permission errors
                if (e.message.includes('권한 오류') || e.message.includes('DriveApp') || e.message.includes('액세스')) {
                    alert(`🛑 [중요] 구글 스크립트 권한 승인 필요\n\n이미지 업로드를 위해 구글 드라이브 접근 권한이 필요합니다.\n\n[해결 방법]\n1. 구글 스크립트 편집기로 이동\n2. 상단 함수 목록에서 '_1_GRANT_PERMISSIONS' 선택 후 [실행]\n3. 권한 허용 후 [배포] -> [새 배포] 진행\n\n[★매우 중요] 배포 시 '웹 앱을 실행할 사용자'를 반드시 '나 (Me)'로 설정해야 합니다.`);
                } else if (e.message.includes('폴더 ID')) {
                    alert(`⚠️ 구글 드라이브 폴더 설정 오류\n\n설정 메뉴에서 '구글 드라이브 폴더 ID'가 정확한지 확인해주세요.`);
                } else if (e.message.includes('구버전') || e.message.includes('Action not found')) {
                     alert(`⚠️ 구글 스크립트 업데이트 필요\n\n현재 스크립트가 '이미지 업로드' 기능을 지원하지 않습니다.\n스크립트 편집기에서 [배포] -> [새 배포]를 진행해주세요.`);
                } else {
                    alert(`⚠️ 이미지 업로드 실패\n\n원인: ${e.message}\n\n혹시 스크립트 배포 시 '웹 앱을 실행할 사용자'를 '나 (Me)'로 설정하셨나요?`);
                }

                processedImages = [];
                uploadSuccess = false;
            } finally {
                setIsLoading(false);
            }
        }
    }

    const logToSave = { ...newLog, images: processedImages };

    const instructorEmp = employees.find(e => e.name === logToSave.instructorName);
    if (instructorEmp && instructorEmp.signatureUrl) {
      logToSave.approvals[0].signatureUrl = instructorEmp.signatureUrl;
    }

    setLogs(prev => [logToSave, ...prev]);
    
    if (googleSheetUrl && googleSheetAutoSync) {
      const exportData = prepareLogDataForExport(logToSave);
      syncToGoogleSheet(exportData)
        .then(() => {
             console.log('✅ Auto-sync sent');
             setTimeout(fetchRawSheetData, 2000); 
        })
        .catch(err => console.error('❌ Auto-sync failed', err));
    }
    
    if (uploadSuccess) {
       alert("✅ 일지가 저장되었습니다.");
    } 
    
    setView('history');
  };

  const handleApproveLog = (logId: string, comment?: string) => {
    if (!currentUser || !googleSheetUrl) return;
    
    const approverName = currentUser.name;
    const signatureUrl = currentUser.signatureUrl;
    const approvedAt = new Date().toISOString();

    const targetLog = displayLogs.find(l => l.id === logId);
    if (!targetLog) return;

    const newApprovals = targetLog.approvals.map(step => {
      if (step.role === userRole && step.status === 'pending') {
         return { 
           ...step, 
           status: 'approved' as const, 
           approverName, 
           signatureUrl, 
           approvedAt, 
           comment: comment || ''
         };
      }
      return step;
    });

    setLogs(prevLogs => prevLogs.map(log => 
       log.id === logId ? { ...log, approvals: newApprovals } : log
    ));

    setApprovalOverlays(prev => ({
      ...prev,
      [logId]: {
        approvals: newApprovals 
      }
    }));

    saveApproval(googleSheetUrl, {
      logId,
      role: userRole,
      status: 'approved',
      approverName,
      signatureUrl,
      approvedAt,
      comment
    }).catch(e => console.error("Approval Save Error:", e));
  };

  const handleRejectLog = (logId: string, reason: string) => {
    if (!currentUser || !googleSheetUrl) return;

    const approverName = currentUser.name;
    const approvedAt = new Date().toISOString();

    const targetLog = displayLogs.find(l => l.id === logId);
    if (!targetLog) return;

    const newApprovals = targetLog.approvals.map(step => {
      if (step.role === userRole && step.status === 'pending') {
        return { 
          ...step, 
          status: 'rejected' as const, 
          approverName, 
          approvedAt, 
          rejectReason: reason 
        };
      }
      return step;
    });

    setLogs(prevLogs => prevLogs.map(log => 
       log.id === logId ? { ...log, approvals: newApprovals } : log
    ));

    setApprovalOverlays(prev => ({
      ...prev,
      [logId]: { approvals: newApprovals }
    }));

    saveApproval(googleSheetUrl, {
      logId,
      role: userRole,
      status: 'rejected',
      approverName,
      approvedAt,
      rejectReason: reason
    }).catch(e => console.error("Approval Save Error:", e));
  };

  // Improved Bulk Approve: Uses batch processing and single API call
  const handleBulkApproveLog = async (logIds: string[]) => {
    if (!currentUser) return;
    if (!googleSheetUrl) {
        alert("구글 스크립트 URL이 설정되지 않았습니다.");
        return;
    }

    setIsLoading(true);

    try {
        const approverName = currentUser.name;
        const signatureUrl = currentUser.signatureUrl;
        const approvedAt = new Date().toISOString();
        
        const newOverlays = { ...approvalOverlays };
        const batchPayload: any[] = [];

        // 1. Update Local State & Prepare Payload
        setLogs(prevLogs => prevLogs.map(log => {
          if (logIds.includes(log.id)) {
            // Find current pending step for user
            const updatedApprovals = log.approvals.map(step => {
                if (step.role === userRole && step.status === 'pending') {
                    return { ...step, status: 'approved' as const, approverName, signatureUrl, approvedAt };
                }
                return step;
            });
            
            // Prepare for payload
            batchPayload.push({
                logId: log.id,
                role: userRole,
                status: 'approved',
                approverName,
                signatureUrl,
                approvedAt
            });

            // Update Overlay Map
            newOverlays[log.id] = { approvals: updatedApprovals };

            return { ...log, approvals: updatedApprovals };
          }
          return log;
        }));

        setApprovalOverlays(newOverlays);

        // 2. Send Single Batch Request
        if (batchPayload.length > 0) {
            await saveApprovalBatch(googleSheetUrl, batchPayload);
            alert(`✅ ${batchPayload.length}건의 문서가 일괄 승인되었습니다.`);
        }

    } catch (e: any) {
        console.error("Bulk Approve Error:", e);
        alert(`❌ 일괄 승인 중 오류가 발생했습니다: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const getLogHtml = (log: DailyLog) => {
    const job = displayJobs.find(j => j.id === log.taskId) || { title: 'Unknown' };
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>훈련일지 - ${log.date}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&display=swap');
            
            * {
                box-sizing: border-box;
            }
            
            body { 
                font-family: 'Noto Sans KR', sans-serif; 
                padding: 20px; 
                max-width: 210mm; 
                margin: 0 auto;
                color: #000;
            }
            
            h1 { 
                text-align: center; 
                font-size: 24pt; 
                margin-bottom: 20px; 
            }
            
            .approval-container {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 20px;
            }
            
            .approval-table {
                border-collapse: collapse;
                text-align: center;
                font-size: 10pt;
            }
            
            .approval-table th, .approval-table td {
                border: 1px solid #000;
                padding: 5px;
            }
            
            .approval-table .vertical-header {
                width: 25px;
                background-color: #f3f4f6;
                padding: 5px;
                vertical-align: middle;
            }
            
            .approval-table .role-header {
                background-color: #f3f4f6;
                width: 90px;
                padding: 5px;
            }
            
            .approval-table .sign-cell {
                height: 70px;
                width: 90px;
                vertical-align: middle;
                text-align: center;
                position: relative;
            }

            .digital-stamp {
              width: 60px;
              height: 60px;
              border: 3px solid #dc2626;
              border-radius: 50%;
              margin: 0 auto;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #dc2626;
              font-weight: bold;
              font-size: 14pt;
              font-family: "Gowun Batang", "Batang", serif; 
              white-space: nowrap;
              overflow: hidden;
              line-height: 1;
            }
            
            table.content-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px; 
                table-layout: fixed;
            }
            
            table.content-table th, table.content-table td { 
                border: 1px solid #000; 
                padding: 8px 12px; 
                font-size: 11pt;
                word-break: break-word;
            }
            
            .meta-table th { 
                background-color: #f3f4f6; 
                width: 15%; 
                text-align: center;
                font-weight: bold;
            }
            .meta-table td {
                text-align: center;
            }
            
            .section-title {
                font-size: 14pt;
                font-weight: bold;
                margin-top: 20px;
                margin-bottom: 10px;
                border-left: 5px solid #4F46E5;
                padding-left: 10px;
            }
            
            .summary-box { 
                width: 100%;
                min-height: 150px; 
                padding: 15px; 
                border: 1px solid #000; 
                white-space: pre-wrap; 
                line-height: 1.6;
                font-size: 11pt;
                overflow-wrap: break-word;
            }
            
            .eval-table th { 
                background-color: #f3f4f6; 
                text-align: center; 
                font-weight: bold;
            }
            .eval-table td.center { 
                text-align: center; 
            }

            .photo-grid {
               display: grid;
               grid-template-columns: repeat(2, 1fr);
               gap: 10px;
               margin-top: 10px;
               page-break-inside: avoid;
            }

            .photo-item {
               border: 1px solid #ccc;
               padding: 5px;
               text-align: center;
               display: flex;
               justify-content: center;
               align-items: center;
               height: 300px;
            }

            .photo-item img {
               max-width: 100%;
               max-height: 100%;
               object-fit: contain;
               display: block;
            }
            
            @media print {
                @page {
                    size: A4;
                    margin: 10mm;
                }
                body { 
                    padding: 0; 
                    margin: 0; 
                    width: 100%;
                }
                button { display: none; }
                
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        </style>
      </head>
      <body>
        <h1>${facilityName} 훈련일지</h1>

        <div class="approval-container">
            <table class="approval-table">
                <tr>
                    <th rowspan="2" class="vertical-header">결<br>재</th>
                    <th class="role-header">담당</th>
                    <th class="role-header">사무국장</th>
                    <th class="role-header">원장</th>
                </tr>
                <tr>
                    ${log.approvals.map((step: ApprovalStep) => {
                       // Signature Lookup Logic for Print View
                       let signatureUrl = step.signatureUrl;
                       if (!signatureUrl && step.approverName) {
                          const emp = employees.find(e => e.name === step.approverName);
                          if (emp) signatureUrl = emp.signatureUrl;
                       }
                       
                       return `
                        <td class="sign-cell">
                           ${step.status === 'approved' 
                              ? (signatureUrl 
                                  ? `<img src="${processSignatureUrl(signatureUrl)}" style="max-height:60px; max-width:80px;" />` 
                                  : `<div class="digital-stamp">
                                       ${step.approverName?.slice(0,3)}
                                     </div>`)
                              : step.status === 'rejected' ? '<span style="color:red; font-weight:bold;">반려</span>' : ''}
                        </td>
                    `}).join('')}
                </tr>
            </table>
        </div>
        
        <table class="content-table meta-table">
           <tr>
             <th>날짜</th>
             <td>${log.date}</td>
             <th>날씨</th>
             <td>${log.weather}</td>
           </tr>
           <tr>
             <th>훈련 직무</th>
             <td>${job.title}</td>
             <th>담당자</th>
             <td>${log.instructorName}</td>
           </tr>
        </table>

        <div class="section-title">1. 훈련 총평</div>
        <div class="summary-box">${log.aiSummary || '작성된 총평이 없습니다.'}</div>

        <div class="section-title">2. 참여 이용인 평가</div>
        <table class="content-table eval-table">
           <thead>
             <tr>
               <th style="width: 20%">이름</th>
               <th style="width: 15%">수행 점수</th>
               <th>비고 (관찰 내용)</th>
             </tr>
           </thead>
           <tbody>
             ${log.evaluations.map(ev => {
                 const t = displayTrainees.find(tr => tr.id === ev.traineeId) || { name: 'Unknown' };
                 return `
                   <tr>
                     <td class="center">${t.name}</td>
                     <td class="center" style="font-weight:bold;">${ev.score}점</td>
                     <td>${ev.note || '-'}</td>
                   </tr>
                 `;
             }).join('')}
           </tbody>
        </table>

        <div class="section-title">3. 활동 사진</div>
        <div class="photo-grid">
           ${log.images && log.images.length > 0 
               ? log.images.map(img => `
                   <div class="photo-item">
                      <img src="${processSignatureUrl(img)}" alt="활동 사진" onerror="this.style.display='none'; this.parentElement.innerText='이미지를 불러올 수 없습니다';" />
                   </div>
                 `).join('')
               : '<div style="padding: 20px; text-align: center; border: 1px solid #ccc; grid-column: 1 / -1; color: #888;">등록된 활동 사진이 없습니다.</div>'
           }
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = (log: DailyLog) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(getLogHtml(log));
        printWindow.document.close();
        // Allow time for images to load
        setTimeout(() => {
          printWindow.print();
        }, 500);
    }
  };

  const handleSaveToDrive = async (log: DailyLog) => {
     if (!googleDriveFolderId) {
        alert('설정 메뉴에서 구글 드라이브 폴더 ID를 먼저 등록해주세요.');
        return;
     }
     if (!confirm('이 훈련일지를 구글 드라이브에 PDF로 저장하시겠습니까?')) return;

     setIsLoading(true);
     try {
        const htmlContent = getLogHtml(log);
        const filename = `${log.date}_${log.instructorName}_훈련일지.pdf`;
        
        // Use the new service function
        const result = await savePdfToDrive(googleSheetUrl, googleDriveFolderId, htmlContent, filename);
        
        if (result.status === 'success') {
           alert('✅ 구글 드라이브에 저장되었습니다.');
        } else {
           throw new Error(result.message);
        }
     } catch (e: any) {
        console.error(e);
        alert(`❌ 저장 실패: ${e.message}`);
     } finally {
        setIsLoading(false);
     }
  };

  const handleExportToSheet = async (log: DailyLog) => {
     alert('Export 기능 (생략)');
  };
  const toggleExpand = (logId: string) => setExpandedLogId(expandedLogId === logId ? null : logId);

  const getFilteredLogs = () => {
    return displayLogs.filter(log => {
      if (historyFilter.date && log.date !== historyFilter.date) return false;
      if (historyFilter.term) {
        const term = historyFilter.term.toLowerCase();
        const job = displayJobs.find(j => j.id === log.taskId)?.title.toLowerCase() || '';
        const instructor = log.instructorName.toLowerCase();
        const hasTrainee = log.evaluations.some(ev => {
          const t = displayTrainees.find(tr => tr.id === ev.traineeId);
          return t?.name.toLowerCase().includes(term);
        });
        if (!job.includes(term) && !instructor.includes(term) && !hasTrainee) return false;
      }
      return true;
    });
  };

  const filteredLogs = getFilteredLogs();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  if (!currentUser) {
    return (
      <Login 
        employees={employees} 
        onLogin={handleLogin}
        facilityName={facilityName}
        onSyncEmployees={() => fetchEmployeesFromGoogleSheet(false)}
        isSyncing={isEmployeeSyncing}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100 relative">
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center text-white backdrop-blur-sm">
          <Loader2 size={50} className="animate-spin mb-4 text-white" />
          <p>처리 중...</p>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-indigo-900 text-white z-20 shadow-md">
        <div className="flex items-center gap-2">
           <h1 className="text-lg font-bold truncate">{facilityName}</h1>
        </div>
        <button onClick={toggleMobileMenu} className="p-1 rounded hover:bg-indigo-800">
           {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 text-white flex-col h-screen shadow-xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex`}>
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight hidden md:block">{facilityName}</h1>
          <p className="text-indigo-300 text-xs mt-1 hidden md:block">스마트 훈련일지 시스템</p>
          <div className="md:hidden text-lg font-bold mb-4">메뉴</div>
          {isSheetMode && (
             <div className="mt-3 px-3 py-1.5 bg-green-800 rounded-lg text-xs flex items-center gap-2 animate-pulse">
                <Globe size={12} className="text-green-300" />
                <span className="font-bold text-green-100">Live Data On</span>
             </div>
          )}
        </div>
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          <button onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === 'dashboard' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/50'}`}>
            <LayoutDashboard size={20} />대시보드
          </button>
          <button onClick={() => { setView('analytics'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === 'analytics' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/50'}`}>
            <PieChart size={20} />직무 분석
          </button>
          <button onClick={() => { setView('create'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === 'create' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/50'}`}>
            <PenTool size={20} />일지 작성
          </button>
          <button onClick={() => { setView('history'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === 'history' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/50'}`}>
            <ClipboardList size={20} />일지 조회
          </button>
          <button onClick={() => { setView('approval'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${view === 'approval' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/50'}`}>
            <FileSignature size={20} />전자결재
          </button>
          <div className="pt-4 mt-4 border-t border-indigo-800">
             <div className="px-4 text-xs font-semibold text-indigo-400 uppercase mb-2">관리</div>
             <button onClick={() => { setView('management'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${view === 'management' ? 'text-white bg-indigo-800' : 'text-indigo-200 hover:text-white hover:bg-indigo-800/50'}`}>
               <Users size={18} />이용인 관리
             </button>
             <button onClick={() => { setView('settings'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${view === 'settings' ? 'text-white bg-indigo-800' : 'text-indigo-200 hover:text-white hover:bg-indigo-800/50'}`}>
               <SettingsIcon size={18} />설정
             </button>
          </div>
        </nav>
        <div className="p-4 bg-indigo-950 border-t border-indigo-800">
           <div className="flex items-center gap-3 mb-3">
             <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-white border-2 border-indigo-600 overflow-hidden">
               {currentUser.signatureUrl ? <img src={processSignatureUrl(currentUser.signatureUrl)} alt="User" className="w-full h-full object-cover" /> : <UserCircle size={24} />}
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
               <div className="text-xs text-indigo-300 truncate">{currentUser.position}</div>
             </div>
           </div>
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 text-xs rounded transition-colors border border-indigo-800">
            <LogOut size={14} />로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-60px)] md:h-screen w-full">
        {view === 'dashboard' && <div className="max-w-6xl mx-auto"><Dashboard logs={displayLogs} jobs={displayJobs} userRole={userRole} onNavigateToLog={(id) => { setView('approval'); }} isDataSynced={isSheetMode} onRefresh={fetchRawSheetData} isRefreshing={isRawSheetLoading} /></div>}
        {view === 'analytics' && <div className="max-w-6xl mx-auto"><JobAnalytics logs={displayLogs} jobs={displayJobs} trainees={displayTrainees} isDataSynced={isSheetMode} onRefresh={fetchRawSheetData} isRefreshing={isRawSheetLoading} /></div>}
        {view === 'create' && (
          <div className="max-w-7xl mx-auto h-full">
            <LogForm 
              trainees={displayTrainees} 
              jobs={displayJobs} 
              employees={employees} 
              logs={logs}
              onSave={handleSaveLog} 
              onCancel={() => setView('dashboard')} 
              onPrint={handlePrint}
              onExportToSheet={handleExportToSheet}
            />
          </div>
        )}
        {view === 'approval' && (
          <div className="max-w-7xl mx-auto h-full">
            <ApprovalSystem 
              logs={displayLogs}
              jobs={displayJobs}
              trainees={displayTrainees}
              employees={employees} // Pass employees for signature lookup
              currentUser={currentUser}
              userRole={userRole}
              onApprove={handleApproveLog}
              onReject={handleRejectLog}
              onBulkApprove={handleBulkApproveLog}
              facilityName={facilityName}
              onSaveToDrive={handleSaveToDrive}
              onPrint={handlePrint}
              isLoading={isLoading}
            />
          </div>
        )}
        {view === 'management' && (
          <div className="max-w-6xl mx-auto">
            <TraineeManagement 
               trainees={trainees} 
               jobs={jobs} 
               onUpdateTrainees={setTrainees} 
               onSyncWithGoogleSheet={() => fetchTraineesFromGoogleSheet(false)}
               isSyncing={isLoading}
            />
          </div>
        )}
        {view === 'settings' && <div className="max-w-6xl mx-auto">
          <Settings 
            jobs={jobs} onUpdateJobs={setJobs} 
            employees={employees} onUpdateEmployees={setEmployees} 
            facilityName={facilityName} onUpdateFacilityName={setFacilityName} 
            googleDriveFolderId={googleDriveFolderId} onUpdateGoogleDriveFolderId={setGoogleDriveFolderId} 
            googleSheetUrl={googleSheetUrl} onUpdateGoogleSheetUrl={setGoogleSheetUrl} 
            userRole={userRole} 
            onResetData={handleResetData} 
            onCloudSave={handleCloudSave} 
            onCloudLoad={handleCloudLoad}
            googleSheetAutoSync={googleSheetAutoSync}
            onUpdateGoogleSheetAutoSync={setGoogleSheetAutoSync}
            autoConnectionStatus={autoConnectionStatus}
            autoConnectionMessage={autoConnectionMessage}
            autoDriveStatus={autoDriveStatus}
            autoDriveMessage={autoDriveMessage}
            onSyncEmployees={() => fetchEmployeesFromGoogleSheet(false)}
            onSaveEmployees={saveEmployeesToGoogleSheet}
            isEmployeeSyncing={isEmployeeSyncing}
          />
        </div>}
        
        {view === 'history' && (
          <div className="max-w-6xl mx-auto pb-20">
            <header className="mb-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                 <div>
                   <h2 className="text-2xl font-bold text-gray-800">일지 조회 및 검색</h2>
                   <p className="text-gray-500">
                     {isSheetMode ? '✅ 구글 시트 원본 데이터를 실시간으로 조회하고 있습니다.' : '📂 로컬 저장소의 데이터를 조회하고 있습니다.'}
                   </p>
                 </div>
                 <button 
                   onClick={() => handleLoadFromGoogleSheet(false)}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
                 >
                   <DownloadCloud size={18} />
                   데이터 가져오기 (Sync)
                 </button>
               </div>
               
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
                 <div className="relative w-full md:w-auto">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Filter size={16} className="text-gray-400" />
                   </div>
                   <input 
                     type="date"
                     className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                     value={historyFilter.date}
                     onChange={(e) => setHistoryFilter({...historyFilter, date: e.target.value})}
                   />
                 </div>
                 <div className="relative w-full flex-1">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search size={16} className="text-gray-400" />
                   </div>
                   <input 
                     type="text"
                     placeholder="검색어 입력"
                     className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                     value={historyFilter.term}
                     onChange={(e) => setHistoryFilter({...historyFilter, term: e.target.value})}
                   />
                   {historyFilter.term && (
                     <button 
                       onClick={() => setHistoryFilter({...historyFilter, term: ''})}
                       className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                     >
                       <X size={14} />
                     </button>
                   )}
                 </div>
                 <div className="text-sm text-gray-500 font-medium px-2">
                   총 <span className="text-indigo-600 font-bold">{filteredLogs.length}</span>건
                 </div>
               </div>
            </header>
            
            <div className="mb-4 flex items-center gap-2 text-indigo-800 font-bold text-sm bg-indigo-50 p-2 rounded-md border border-indigo-100">
               <Database size={16} />
               <span>{isSheetMode ? '구글 시트 연동 데이터 (Derived)' : '로컬 데이터'} 목록</span>
            </div>

            <div className="space-y-4 mb-12">
              {filteredLogs.length === 0 ? (
                <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center text-gray-400">
                  <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
                  <p>조건에 맞는 훈련 일지가 없습니다.</p>
                </div>
              ) : (
                filteredLogs.map(log => {
                   const job = displayJobs.find(j => j.id === log.taskId) || { title: 'Unknown', category: 'other' };
                   const isExpanded = expandedLogId === log.id;
                   
                   return (
                     <div key={log.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:border-indigo-200">
                       <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                         <div className="cursor-pointer flex-1" onClick={() => toggleExpand(log.id)}>
                           <div className="flex items-center gap-3 mb-1 flex-wrap">
                             <span className="font-bold text-lg text-gray-800">{log.date}</span>
                             <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold">{job.title}</span>
                             <span className="text-gray-500 text-sm flex items-center gap-1"><Cloud size={14}/> {log.weather}</span>
                             {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                           </div>
                           <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                             <UserCircle size={14} /> 담당: {log.instructorName} 
                             <span className="w-px h-3 bg-gray-300"></span>
                             <Users size={14} /> 참여: {log.evaluations.length}명
                             {log.images && log.images.length > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">📷 사진 {log.images.length}장</span>}
                           </p>
                         </div>
                         <div className="flex items-center gap-2 self-start sm:self-center">
                            <button onClick={(e) => { e.stopPropagation(); handlePrint(log); }} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Printer size={18} /></button>
                         </div>
                       </div>
                       
                       <div className="bg-gray-50/50 p-4 rounded-lg text-sm text-gray-700 border border-gray-100 mb-4 cursor-pointer" onClick={() => toggleExpand(log.id)}>
                         <span className="font-bold text-gray-900 block mb-1">📝 훈련총평 (미리보기)</span>
                         <p className="leading-relaxed whitespace-pre-wrap line-clamp-2 text-gray-500">{log.aiSummary || '내용 없음'}</p>
                       </div>

                       {isExpanded && (
                         <div className="mt-4 border-t border-gray-100 pt-4 animate-fade-in">
                           <div className="mb-4">
                              <h4 className="font-bold text-sm text-gray-700 mb-2">훈련총평 전체보기</h4>
                              <div className="p-3 bg-gray-50 rounded border border-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                                {log.aiSummary || '작성된 총평이 없습니다.'}
                              </div>
                           </div>
                           
                           {log.images && log.images.length > 0 && (
                             <div className="mb-4">
                               <h4 className="font-bold text-sm text-gray-700 mb-2">활동 사진</h4>
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {log.images.map((img, i) => (
                                    <div key={i} className="aspect-square bg-gray-100 rounded border overflow-hidden relative group">
                                      <img src={processSignatureUrl(img)} alt="활동 사진" className="w-full h-full object-cover" />
                                      <a href={processSignatureUrl(img)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                                         {/* Click area */}
                                      </a>
                                    </div>
                                  ))}
                               </div>
                             </div>
                           )}
                           
                           <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                              <Users size={16} /> 참여 이용인 상세 평가
                           </h4>
                           <div className="overflow-x-auto border border-gray-200 rounded-lg">
                             <table className="w-full text-sm text-left">
                               <thead className="bg-gray-50 text-gray-500 font-medium">
                                 <tr>
                                   <th className="px-4 py-2 w-1/4">이름</th>
                                   <th className="px-4 py-2 w-24 text-center">점수</th>
                                   <th className="px-4 py-2">특이사항</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-gray-100">
                                 {log.evaluations.map((ev, idx) => {
                                   const t = displayTrainees.find(tr => tr.id === ev.traineeId);
                                   return (
                                     <tr key={idx} className="bg-white hover:bg-gray-50">
                                       <td className="px-4 py-2 font-medium text-gray-800">{t?.name || '삭제된 이용인'}</td>
                                       <td className="px-4 py-2 text-center">
                                         <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                           ev.score >= 4 ? 'bg-green-100 text-green-700' : 
                                           ev.score <= 2 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                         }`}>
                                           {ev.score}점
                                         </span>
                                       </td>
                                       <td className="px-4 py-2 text-gray-500">{ev.note || '-'}</td>
                                     </tr>
                                   );
                                 })}
                               </tbody>
                             </table>
                           </div>
                         </div>
                       )}
                     </div>
                   );
                })
              )}
            </div>

            {/* --- Google Sheet Live Viewer Section (GViz) --- */}
            <div className="bg-gray-50 border-t-2 border-indigo-200 pt-8 mt-12">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                   <FileSpreadsheet className="text-green-600" />
                   구글 시트 원본 데이터 조회 (Live View)
                 </h2>
                 <button 
                   onClick={fetchRawSheetData}
                   disabled={isRawSheetLoading}
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 shadow-sm text-sm font-medium disabled:opacity-50"
                 >
                   {isRawSheetLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                   데이터 새로고침
                 </button>
               </div>
               
               <p className="text-sm text-gray-500 mb-4 bg-white p-3 rounded-lg border border-gray-200">
                  <span className="font-bold text-indigo-600">ⓘ</span> 이 데이터가 로드되면 <strong>대시보드</strong>와 <strong>직무 분석</strong>에도 자동으로 반영됩니다.
               </p>

               {rawSheetError && (
                 <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 mb-4 flex items-center gap-2">
                    <X size={16} /> {rawSheetError}
                 </div>
               )}

               <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 {rawSheetData.headers.length === 0 && !isRawSheetLoading ? (
                    <div className="p-12 text-center text-gray-400">
                       <FileSpreadsheet size={48} className="mx-auto mb-3 opacity-20" />
                       <p>[데이터 새로고침] 버튼을 눌러 시트 내용을 불러오세요.</p>
                    </div>
                 ) : (
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 sticky top-0 shadow-sm">
                          <tr>
                            {rawSheetData.headers.map((header, idx) => (
                              <th key={idx} className="px-6 py-3">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rawSheetData.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-gray-50">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-6 py-3 text-gray-700">
                                  {cell || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
