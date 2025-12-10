
import React, { useState, useEffect } from 'react';
import { JobTask, Employee, ApprovalRole } from '../types';
import { Trash2, Building, Briefcase, Users, Lock, CloudUpload, CloudDownload, Activity, Loader2, Check } from 'lucide-react';
import { EmployeeSettings } from './EmployeeSettings';

interface SettingsProps {
  jobs: JobTask[];
  onUpdateJobs: (jobs: JobTask[]) => void;
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
  facilityName: string;
  onUpdateFacilityName: (name: string) => void;
  googleDriveFolderId: string;
  onUpdateGoogleDriveFolderId: (id: string) => void;
  googleSheetUrl: string;
  onUpdateGoogleSheetUrl: (url: string) => void;
  userRole: ApprovalRole;
  onResetData: () => void;
  onCloudSave: () => void;
  onCloudLoad: () => void;
  googleSheetAutoSync?: boolean;
  onUpdateGoogleSheetAutoSync?: (auto: boolean) => void;
  autoConnectionStatus?: 'idle' | 'success' | 'error';
  autoConnectionMessage?: string;
  autoDriveStatus?: 'idle' | 'success' | 'error';
  autoDriveMessage?: string;
  onSyncEmployees?: () => void;
  onSaveEmployees?: () => void;
  isEmployeeSyncing?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ 
  jobs, 
  onUpdateJobs, 
  employees,
  onUpdateEmployees,
  facilityName, 
  onUpdateFacilityName,
  googleDriveFolderId,
  onUpdateGoogleDriveFolderId,
  googleSheetUrl,
  onUpdateGoogleSheetUrl,
  userRole,
  onResetData,
  onCloudSave,
  onCloudLoad,
  googleSheetAutoSync,
  onUpdateGoogleSheetAutoSync,
  autoConnectionStatus = 'idle',
  autoConnectionMessage = '',
  autoDriveStatus = 'idle',
  autoDriveMessage = '',
  onSyncEmployees,
  onSaveEmployees,
  isEmployeeSyncing = false
}) => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'employees' | 'general'>('jobs');
  
  // Connection Test State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Drive Test State
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveConnectionStatus, setDriveConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [driveStatusMessage, setDriveStatusMessage] = useState('');

  const isDirector = userRole === 'director';
  
  const [newJob, setNewJob] = useState<Partial<JobTask>>({ title: '', category: 'assembly', description: '' });

  // Sync auto connection status from App when component mounts or prop updates
  useEffect(() => {
    if (autoConnectionStatus !== 'idle') {
      setConnectionStatus(autoConnectionStatus);
      setStatusMessage(autoConnectionMessage);
    }
  }, [autoConnectionStatus, autoConnectionMessage]);

  // Sync auto drive status
  useEffect(() => {
    if (autoDriveStatus !== 'idle') {
      setDriveConnectionStatus(autoDriveStatus);
      setDriveStatusMessage(autoDriveMessage);
    }
  }, [autoDriveStatus, autoDriveMessage]);

  const handleTabChange = (tab: 'jobs' | 'employees' | 'general') => {
    if (tab !== 'jobs' && !isDirector) { alert('이 메뉴는 원장님만 접근할 수 있습니다.'); return; }
    setActiveTab(tab);
  };

  const handleAddJob = () => {
    if (!newJob.title) { alert('직무명은 필수입니다.'); return; }
    const normalizedId = `shared-job-${newJob.title.trim().replace(/\s+/g, '-').toLowerCase()}`;
    
    if (jobs.some(j => j.id === normalizedId)) {
       alert('이미 존재하는 직무명입니다.');
       return;
    }

    onUpdateJobs([...jobs, { id: normalizedId, title: newJob.title!, category: newJob.category as any, description: newJob.description || '' }]);
    setNewJob({ title: '', category: 'assembly', description: '' });
  };
  const handleDeleteJob = (id: string) => {
    if (jobs.length <= 1) { alert('최소 하나의 직무는 존재해야 합니다.'); return; }
    if (confirm('이 직무를 삭제하시겠습니까?')) onUpdateJobs(jobs.filter(j => j.id !== id));
  };

  const handleTestConnection = async () => {
    if (!googleSheetUrl) {
      setConnectionStatus('error');
      setStatusMessage('URL을 입력해주세요.');
      return;
    }
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    setStatusMessage('');

    try {
      const response = await fetch(googleSheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'test' })
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      
      const text = await response.text();
      if (text.includes("Google") || text.includes("html")) {
        throw new Error("권한 오류: 스크립트 접근 권한 확인 필요");
      }

      const json = JSON.parse(text);
      if (json.status === 'success') {
        setConnectionStatus('success');
        setStatusMessage('정상 연결됨');
      } else {
        setConnectionStatus('error');
        setStatusMessage(json.message || '연결 실패');
      }
    } catch (e: any) {
      setConnectionStatus('error');
      setStatusMessage(e.message || '알 수 없는 오류');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestDriveConnection = async () => {
    if (!googleSheetUrl) {
        alert('구글 스크립트 URL이 먼저 설정되어야 합니다.');
        return;
    }
    if (!googleDriveFolderId) {
        setDriveConnectionStatus('error');
        setDriveStatusMessage('폴더 ID를 입력해주세요.');
        return;
    }
    setIsTestingDrive(true);
    setDriveConnectionStatus('idle');
    setDriveStatusMessage('');

    try {
      const response = await fetch(googleSheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'test_drive_folder', folderId: googleDriveFolderId })
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      
      const text = await response.text();
      const json = JSON.parse(text);
      
      if (json.status === 'success') {
          setDriveConnectionStatus('success');
          setDriveStatusMessage(json.message || '폴더 접근 가능');
      } else {
          setDriveConnectionStatus('error');
          setDriveStatusMessage(json.message || '접근 실패');
      }
    } catch (e: any) {
        setDriveConnectionStatus('error');
        setDriveStatusMessage(e.message || '오류 발생');
    } finally {
        setIsTestingDrive(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in relative">
      <header className="mb-8"><h2 className="text-2xl font-bold text-gray-800">시스템 설정</h2><p className="text-gray-500">작업장 환경 및 연동 설정</p></header>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button onClick={() => handleTabChange('jobs')} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'jobs' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}><Briefcase size={18} />직무 관리</button>
          <button onClick={() => handleTabChange('employees')} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'employees' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : !isDirector ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}>{!isDirector ? <Lock size={16}/> : <Users size={18} />}직원 관리</button>
          <button onClick={() => handleTabChange('general')} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'general' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : !isDirector ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}>{!isDirector ? <Lock size={16}/> : <Building size={18} />}기관 정보 설정</button>
        </div>
        <div className="p-6">
          {activeTab === 'jobs' && (
            <div className="space-y-6">
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-2">
                 <input className="p-2 border rounded text-sm w-1/4" placeholder="직무명" value={newJob.title} onChange={e=>setNewJob({...newJob, title:e.target.value})} />
                 <select className="p-2 border rounded text-sm w-1/4" value={newJob.category} onChange={e=>setNewJob({...newJob, category:e.target.value as any})}><option value="assembly">조립</option><option value="packaging">포장</option><option value="cleaning">청소</option><option value="service">서비스</option><option value="other">기타</option></select>
                 <input className="p-2 border rounded text-sm flex-1" placeholder="설명" value={newJob.description} onChange={e=>setNewJob({...newJob, description:e.target.value})} />
                 <button onClick={handleAddJob} className="bg-indigo-600 text-white px-4 rounded text-sm font-bold">추가</button>
               </div>
               <table className="w-full text-sm text-left"><thead className="bg-gray-50"><tr><th className="px-4 py-2">직무명</th><th className="px-4 py-2">카테고리</th><th className="px-4 py-2">설명</th><th className="px-4 py-2 text-right">관리</th></tr></thead><tbody>{jobs.map(j => (<tr key={j.id} className="border-b"><td className="px-4 py-2">{j.title}</td><td className="px-4 py-2">{j.category}</td><td className="px-4 py-2 text-gray-500">{j.description}</td><td className="px-4 py-2 text-right"><button onClick={()=>handleDeleteJob(j.id)} className="text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table>
            </div>
          )}
          
          {activeTab === 'employees' && isDirector && (
            <EmployeeSettings 
              employees={employees}
              onUpdateEmployees={onUpdateEmployees}
              userRole={userRole}
              onSyncEmployees={onSyncEmployees}
              onSaveEmployees={onSaveEmployees}
              isEmployeeSyncing={isEmployeeSyncing}
            />
          )}

          {activeTab === 'general' && isDirector && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Building size={18} className="text-indigo-600"/> 기관명 설정</h3>
                <input value={facilityName} onChange={e=>onUpdateFacilityName(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="기관명 입력" />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Activity size={18} className="text-indigo-600"/> 구글 스크립트 연동 (데이터 저장용)</h3>
                <div className="flex gap-2 mb-2">
                  <input value={googleSheetUrl} onChange={e=>onUpdateGoogleSheetUrl(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-sm font-mono text-xs" placeholder="Google Apps Script Web App URL" />
                  <button 
                     onClick={handleTestConnection} 
                     disabled={isTestingConnection || !googleSheetUrl}
                     className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isTestingConnection ? <Loader2 size={12} className="animate-spin" /> : '연동 테스트'}
                  </button>
                </div>
                {statusMessage && (
                  <div className={`text-xs p-2 rounded flex items-center gap-1 mb-2 ${connectionStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {connectionStatus === 'success' ? <Check size={12}/> : <Activity size={12}/>} {statusMessage}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                  <input 
                    type="checkbox" 
                    id="autoSync" 
                    checked={googleSheetAutoSync} 
                    onChange={(e) => onUpdateGoogleSheetAutoSync?.(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                  />
                  <label htmlFor="autoSync" className="cursor-pointer">일지 저장 시 자동으로 구글 시트로 데이터 전송 (Auto Sync)</label>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><CloudUpload size={18} className="text-indigo-600"/> 구글 드라이브 연동 (PDF 저장용)</h3>
                <div className="flex gap-2 mb-2">
                  <input value={googleDriveFolderId} onChange={e=>onUpdateGoogleDriveFolderId(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-sm font-mono text-xs" placeholder="구글 드라이브 폴더 ID 입력" />
                  <button 
                     onClick={handleTestDriveConnection} 
                     disabled={isTestingDrive || !googleDriveFolderId}
                     className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isTestingDrive ? <Loader2 size={12} className="animate-spin" /> : '폴더 확인'}
                  </button>
                </div>
                {driveStatusMessage && (
                  <div className={`text-xs p-2 rounded flex items-center gap-1 mb-2 ${driveConnectionStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {driveConnectionStatus === 'success' ? <Check size={12}/> : <Activity size={12}/>} {driveStatusMessage}
                  </div>
                )}
                <p className="text-xs text-gray-500">* 결재 완료된 훈련일지를 PDF로 저장할 폴더의 ID입니다. (URL의 /folders/ 뒷부분)</p>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button onClick={onResetData} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-bold"><Trash2 size={16}/> 데이터 초기화</button>
                <button onClick={onCloudSave} className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-bold"><CloudUpload size={16}/> 클라우드 백업</button>
                <button onClick={onCloudLoad} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-bold"><CloudDownload size={16}/> 백업 불러오기</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
