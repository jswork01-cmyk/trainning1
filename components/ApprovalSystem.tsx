

import React, { useState, useMemo, useEffect } from 'react';
import { DailyLog, Trainee, JobTask, Employee, ApprovalRole, ApprovalStep } from '../types';
import { FileSignature, CheckCircle2, XCircle, Clock, Calendar, User, ChevronRight, X, CloudUpload, Printer, Loader2, CheckSquare, Square, FileText, Stamp, MessageSquare } from 'lucide-react';

interface ApprovalSystemProps {
  logs: DailyLog[];
  jobs: JobTask[];
  trainees: Trainee[];
  employees: Employee[]; // Added for signature lookup
  currentUser: Employee;
  userRole: ApprovalRole;
  onApprove: (logId: string, comment?: string) => void;
  onReject: (logId: string, reason: string) => void;
  onBulkApprove: (logIds: string[]) => void;
  facilityName: string;
  onSaveToDrive?: (log: DailyLog) => void;
  onPrint: (log: DailyLog) => void;
  isLoading?: boolean;
}

export const ApprovalSystem: React.FC<ApprovalSystemProps> = ({
  logs,
  jobs,
  trainees,
  employees,
  currentUser,
  userRole,
  onApprove,
  onReject,
  onBulkApprove,
  facilityName,
  onSaveToDrive,
  onPrint,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'processed' | 'all'>('pending');
  // Store ID instead of object to ensure reactivity when parent logs update
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  
  // Action State inside Modal
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  
  // Selection State (Bulk)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Derive the currently selected log object from props to ensure live updates
  const selectedLog = useMemo(() => {
      return logs.find(l => l.id === selectedLogId) || null;
  }, [logs, selectedLogId]);

  // Reset states when modal closes or log changes
  useEffect(() => {
    setActionType(null);
    setComment('');
  }, [selectedLogId]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedLogIds(new Set());
  }, [activeTab]);

  // Watch for loading state changes to reset processing UI
  useEffect(() => {
    if (!isLoading) {
       setIsBulkProcessing(false);
       // Clear selection if loading finished (implying success or end of operation)
       // However, we only clear if we were processing.
       if (isBulkProcessing) {
          setSelectedLogIds(new Set());
       }
    }
  }, [isLoading]);

  // Filter logs relevant to the current user's role
  const { pendingLogs, processedLogs, allLogs } = useMemo(() => {
    const pending: DailyLog[] = [];
    const processed: DailyLog[] = [];
    // All logs sorted by date
    const all = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    logs.forEach(log => {
      // Find the approval step for the current user's role
      const myStepIndex = log.approvals.findIndex(step => step.role === userRole);
      
      if (myStepIndex === -1) return; // Not involved in this workflow

      const myStep = log.approvals[myStepIndex];
      const prevStep = myStepIndex > 0 ? log.approvals[myStepIndex - 1] : null;

      // Logic for Pending:
      // 1. My step is 'pending'
      // 2. Previous step is 'approved' (or I am the first step)
      // 3. Document is not rejected by anyone
      const isMyTurn = myStep.status === 'pending' && (!prevStep || prevStep.status === 'approved');
      const isRejectedAnywhere = log.approvals.some(s => s.status === 'rejected');

      if (isMyTurn && !isRejectedAnywhere) {
        pending.push(log);
      }

      // Logic for Processed:
      // My step is 'approved' OR 'rejected'
      if (myStep.status !== 'pending') {
        processed.push(log);
      }
    });

    // Sort by date descending
    return {
      pendingLogs: pending.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      processedLogs: processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      allLogs: all
    };
  }, [logs, userRole]);

  const handleActionConfirm = () => {
    if (!selectedLog) return;

    if (actionType === 'approve') {
      onApprove(selectedLog.id, comment);
      // UX Improvement: Don't close modal immediately. Reset action type so user sees the approved state.
      setActionType(null);
      setComment('');
    } else if (actionType === 'reject') {
      if (!comment.trim()) {
        alert('반려 사유를 입력해주세요.');
        return;
      }
      onReject(selectedLog.id, comment);
      setActionType(null);
      setComment('');
    }
  };

  const handleBulkApproveClick = () => {
    if (selectedLogIds.size === 0) return;
    if (confirm(`선택한 ${selectedLogIds.size}건의 문서를 일괄 승인하시겠습니까?`)) {
        setIsBulkProcessing(true); // Local loading state to update button UI immediately
        onBulkApprove(Array.from(selectedLogIds));
        // Note: selectedLogIds will be cleared by the useEffect when isLoading becomes false from parent
    }
  };

  const toggleSelectAll = () => {
    if (selectedLogIds.size === pendingLogs.length && pendingLogs.length > 0) {
        setSelectedLogIds(new Set());
    } else {
        setSelectedLogIds(new Set(pendingLogs.map(l => l.id)));
    }
  };

  const toggleSelectLog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedLogIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedLogIds(newSet);
  };

  const getJobTitle = (id: string) => jobs.find(j => j.id === id)?.title || 'Unknown';

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col animate-fade-in pb-12 relative">
      {isLoading && (
         <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center backdrop-blur-sm rounded-xl">
             <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center gap-4 border border-indigo-100">
                 <Loader2 className="animate-spin text-indigo-600" size={40} />
                 <span className="text-lg font-bold text-gray-800">데이터 처리 중...</span>
                 <span className="text-sm text-gray-500">잠시만 기다려주세요.</span>
             </div>
         </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileSignature className="text-indigo-600" />
            전자결재 시스템
          </h2>
          <p className="text-gray-500">
            {currentUser.name} {currentUser.position}님의 결재 대기 문서를 처리합니다.
          </p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'pending' 
                ? 'bg-indigo-600 text-white shadow' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Clock size={16} />
            결재 대기 ({pendingLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'processed' 
                ? 'bg-indigo-600 text-white shadow' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 size={16} />
            결재 완료 ({processedLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'all' 
                ? 'bg-indigo-600 text-white shadow' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <FileText size={16} />
            전체 현황 ({allLogs.length})
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {activeTab === 'pending' && selectedLogIds.size > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between animate-fade-in shadow-sm">
              <span className="text-sm font-bold text-indigo-800 ml-2 flex items-center gap-2">
                  <CheckSquare className="text-indigo-600" size={18} />
                  {selectedLogIds.size}개 문서가 선택됨
              </span>
              <button 
                  onClick={handleBulkApproveClick}
                  disabled={isLoading || isBulkProcessing}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isLoading || isBulkProcessing ? <Loader2 size={16} className="animate-spin" /> : <Stamp size={16} />}
                  {isLoading || isBulkProcessing ? '처리 중...' : '일괄 승인하기'}
              </button>
          </div>
      )}

      {/* Main List Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col min-h-[400px]">
        {(activeTab === 'pending' && pendingLogs.length === 0) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
            <CheckCircle2 size={64} className="mb-4 text-green-100" />
            <p className="text-lg font-medium text-gray-600">현재 대기 중인 결재 문서가 없습니다.</p>
            <p className="text-sm">모든 업무가 처리되었습니다.</p>
          </div>
        ) : (activeTab === 'processed' && processedLogs.length === 0) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
            <FileSignature size={64} className="mb-4 text-gray-100" />
            <p>처리된 결재 문서가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  {activeTab === 'pending' && (
                      <th className="px-6 py-4 w-12 text-center">
                          <button onClick={toggleSelectAll} className="flex items-center justify-center text-gray-400 hover:text-indigo-600">
                              {selectedLogIds.size > 0 && selectedLogIds.size === pendingLogs.length ? (
                                  <CheckSquare size={18} className="text-indigo-600" />
                              ) : (
                                  <Square size={18} />
                              )}
                          </button>
                      </th>
                  )}
                  <th className="px-6 py-4">기안일 (훈련일자)</th>
                  <th className="px-6 py-4">문서 제목 (직무)</th>
                  <th className="px-6 py-4">기안자 (담당)</th>
                  <th className="px-6 py-4">진행 상태</th>
                  <th className="px-6 py-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(activeTab === 'pending' ? pendingLogs : activeTab === 'processed' ? processedLogs : allLogs).map(log => {
                  const jobTitle = getJobTitle(log.taskId);
                  const isSelected = selectedLogIds.has(log.id);
                  
                  const isCompleted = log.approvals.every(s => s.status === 'approved');
                  const isRejected = log.approvals.some(s => s.status === 'rejected');
                  
                  let statusLabel = '진행 중';
                  let statusColor = 'text-blue-600 bg-blue-50';
                  
                  if (isCompleted) { statusLabel = '승인 완료'; statusColor = 'text-green-600 bg-green-50'; }
                  else if (isRejected) { statusLabel = '반려됨'; statusColor = 'text-red-600 bg-red-50'; }
                  
                  return (
                    <tr 
                      key={log.id} 
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedLogId(log.id)}
                    >
                      {activeTab === 'pending' && (
                          <td className="px-6 py-4 text-center" onClick={(e) => toggleSelectLog(log.id, e)}>
                              <button className="flex items-center justify-center text-gray-400 hover:text-indigo-600">
                                  {isSelected ? (
                                      <CheckSquare size={18} className="text-indigo-600" />
                                  ) : (
                                      <Square size={18} />
                                  )}
                              </button>
                          </td>
                      )}
                      <td className="px-6 py-4 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {log.date}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-indigo-900">{jobTitle}</span> 훈련일지
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          {log.instructorName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 w-full">
                          상세보기 <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden animate-scale-in">
            {/* 1. Modal Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={20} />
                  결재 문서 상세
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedLog.approvals.some(s => s.status === 'rejected') ? 'bg-red-100 text-red-700' :
                  selectedLog.approvals.every(s => s.status === 'approved') ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {selectedLog.approvals.some(s => s.status === 'rejected') ? '반려됨' :
                   selectedLog.approvals.every(s => s.status === 'approved') ? '승인 완료' : '결재 진행 중'}
                </span>
              </div>
              <button 
                onClick={() => { setSelectedLogId(null); setActionType(null); }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {/* 2. Modal Body (Document Content - Styled as FORM) */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-6 flex justify-center">
               <div className="bg-white p-10 shadow-lg border border-gray-300 w-full max-w-[210mm] min-h-[297mm]">
                  
                  {/* Title - Remove Underlines */}
                  <h1 className="text-3xl font-bold text-center mb-10 text-gray-900">{facilityName} 훈련일지</h1>
                  
                  {/* Approval Line (Table Format) */}
                  <div className="flex justify-end mb-8">
                     <table className="border-collapse text-center text-sm">
                       <tbody>
                         <tr>
                           <th rowSpan={2} className="border border-black bg-gray-100 w-8 p-1 align-middle">결<br/>재</th>
                           {selectedLog.approvals.map((step, idx) => (
                             <th key={idx} className="border border-black bg-gray-100 w-24 p-1">{step.label}</th>
                           ))}
                         </tr>
                         <tr>
                           {selectedLog.approvals.map((step, idx) => {
                             // Signature Lookup Logic:
                             // If no signature stored in step, try to find it in current employee list
                             let signatureUrl = step.signatureUrl;
                             if (!signatureUrl && step.approverName) {
                                const emp = employees.find(e => e.name === step.approverName);
                                if (emp) signatureUrl = emp.signatureUrl;
                             }

                             return (
                               <td key={idx} className="border border-black h-[70px] w-24 align-middle p-0">
                                 {step.status === 'approved' ? (
                                   signatureUrl ? (
                                     <img src={signatureUrl} alt="Signed" className="max-w-[80px] max-h-[60px] object-contain mx-auto" />
                                   ) : (
                                     // Digital Seal Fallback
                                     <div className="w-[60px] h-[60px] border-[3px] border-red-600 rounded-full mx-auto flex items-center justify-center text-red-600 select-none">
                                        <span className="font-bold font-serif text-lg whitespace-nowrap">{step.approverName?.slice(0,3)}</span>
                                     </div>
                                   )
                                 ) : step.status === 'rejected' ? (
                                   <span className="text-red-600 font-bold border-2 border-red-600 rounded-lg px-2 py-1 transform -rotate-12 inline-block">반려</span>
                                 ) : (
                                   <span className="text-gray-300 text-xs">미결재</span>
                                 )}
                               </td>
                             );
                           })}
                         </tr>
                       </tbody>
                     </table>
                  </div>

                  {/* Meta Data (Table Format) */}
                  <table className="w-full border-collapse border border-black text-sm mb-6 table-fixed">
                     <tbody>
                        <tr>
                           <th className="border border-black bg-gray-100 p-2 w-[15%] text-center">날짜</th>
                           <td className="border border-black p-2 text-center">{selectedLog.date}</td>
                           <th className="border border-black bg-gray-100 p-2 w-[15%] text-center">날씨</th>
                           <td className="border border-black p-2 text-center">{selectedLog.weather}</td>
                        </tr>
                        <tr>
                           <th className="border border-black bg-gray-100 p-2 text-center">훈련 직무</th>
                           <td className="border border-black p-2 text-center">{getJobTitle(selectedLog.taskId)}</td>
                           <th className="border border-black bg-gray-100 p-2 text-center">담당자</th>
                           <td className="border border-black p-2 text-center">{selectedLog.instructorName}</td>
                        </tr>
                     </tbody>
                  </table>

                  {/* Summary Section */}
                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-2 pl-2 border-l-4 border-indigo-600">
                       1. 훈련 총평
                    </h4>
                    <div className="border border-black p-4 text-sm leading-relaxed min-h-[150px] whitespace-pre-wrap">
                       {selectedLog.aiSummary || '작성된 총평이 없습니다.'}
                    </div>
                  </div>

                  {/* Evaluation Table */}
                  <div className="mb-8">
                    <h4 className="text-lg font-bold text-gray-900 mb-2 pl-2 border-l-4 border-indigo-600">
                       2. 참여 이용인 평가
                    </h4>
                    <table className="w-full border-collapse border border-black text-sm">
                       <thead className="bg-gray-100">
                          <tr>
                             <th className="border border-black p-2 w-1/4">이름</th>
                             <th className="border border-black p-2 w-[15%] text-center">수행 점수</th>
                             <th className="border border-black p-2">비고 (관찰 내용)</th>
                          </tr>
                       </thead>
                       <tbody>
                          {selectedLog.evaluations.map((ev, idx) => {
                             const t = trainees.find(tr => tr.id === ev.traineeId) || { name: 'Unknown' };
                             return (
                                <tr key={idx}>
                                   <td className="border border-black p-2 text-center">{t.name}</td>
                                   <td className="border border-black p-2 text-center font-bold">
                                      {ev.score}점
                                   </td>
                                   <td className="border border-black p-2">{ev.note || '-'}</td>
                                </tr>
                             );
                          })}
                       </tbody>
                    </table>
                  </div>
                  
                  {/* Comments Section (Not in print, but useful for screen) */}
                  <div className="mt-8 border-t border-gray-300 pt-4">
                     <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">결재 의견</h4>
                     <div className="space-y-2">
                        {selectedLog.approvals.filter(s => s.status !== 'pending' && (s.comment || s.rejectReason)).length === 0 ? (
                           <p className="text-xs text-gray-400 italic">등록된 의견이 없습니다.</p>
                        ) : (
                           selectedLog.approvals.map((step, idx) => {
                              if (step.status === 'pending') return null;
                              if (!step.comment && !step.rejectReason) return null;
                              return (
                                 <div key={idx} className={`text-xs p-2 rounded border ${step.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                                    <span className="font-bold mr-2">[{step.label} {step.approverName}]:</span>
                                    {step.status === 'rejected' ? step.rejectReason : step.comment}
                                 </div>
                              );
                           })
                        )}
                     </div>
                  </div>
               </div>
            </div>
            
            {/* 3. Modal Footer (Interactive Actions) */}
            <div className="p-4 border-t border-gray-200 bg-white flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
               
               {/* My Pending Action Area */}
               {activeTab === 'pending' && pendingLogs.some(l => l.id === selectedLog.id) ? (
                   actionType ? (
                      // Confirmation Mode
                      <div className="animate-fade-in bg-gray-50 p-4 rounded-lg border border-gray-200">
                         <div className="flex items-start gap-3 mb-4">
                            <MessageSquare className={`mt-1 ${actionType === 'approve' ? 'text-blue-500' : 'text-red-500'}`} size={20} />
                            <div className="flex-1">
                               <label className="block text-sm font-bold text-gray-700 mb-1">
                                  {actionType === 'approve' ? '승인 의견 (선택사항)' : '반려 사유 (필수)'}
                               </label>
                               <textarea 
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  placeholder={actionType === 'approve' ? "승인 의견을 입력하세요." : "반려 사유를 입력하세요."}
                                  className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                                     actionType === 'approve' ? 'border-blue-200 focus:ring-blue-500' : 'border-red-200 focus:ring-red-500'
                                  }`}
                                  rows={2}
                                  autoFocus
                               />
                            </div>
                         </div>
                         <div className="flex justify-end gap-3">
                            <button 
                               onClick={() => setActionType(null)}
                               className="px-5 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                            >
                               취소
                            </button>
                            <button 
                               onClick={handleActionConfirm}
                               className={`px-5 py-2 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2 ${
                                  actionType === 'approve' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                               }`}
                            >
                               {actionType === 'approve' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                               {actionType === 'approve' ? '승인 확정' : '반려 확정'}
                            </button>
                         </div>
                      </div>
                   ) : (
                      // Initial Buttons
                      <div className="flex justify-end gap-3">
                         <button 
                            onClick={() => setActionType('reject')}
                            className="flex-1 md:flex-none px-6 py-3 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                         >
                            <XCircle size={18} /> 반려
                         </button>
                         <button 
                            onClick={() => setActionType('approve')}
                            className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-colors flex items-center justify-center gap-2"
                         >
                            <CheckCircle2 size={18} /> 승인하기
                         </button>
                      </div>
                   )
               ) : (
                   <div className="flex justify-end items-center gap-4">
                      {selectedLog.approvals.every(s => s.status === 'approved') && (
                          <span className="text-green-600 font-bold flex items-center gap-1">
                             <CheckCircle2 size={16} /> 모든 결재가 완료되었습니다.
                          </span>
                      )}
                      
                      {/* Print Button - Added for approved documents */}
                      {selectedLog.approvals.every(s => s.status === 'approved') && (
                        <button 
                           onClick={() => onPrint(selectedLog)}
                           className="px-4 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                           <Printer size={18} /> 인쇄
                        </button>
                      )}

                      {/* Google Drive Save Button - Only visible when fully approved */}
                      {selectedLog.approvals.every(s => s.status === 'approved') && onSaveToDrive && (
                         <button 
                           onClick={() => onSaveToDrive(selectedLog)}
                           className="px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                           <CloudUpload size={18} /> 구글 드라이브 전송
                         </button>
                      )}

                      <button 
                         onClick={() => setSelectedLogId(null)}
                         className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                      >
                         닫기
                      </button>
                   </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
