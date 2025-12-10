import React, { useRef, useState } from 'react';
import { Trainee, JobTask } from '../types';
import { Upload, Download, Search, Trash2, UserPlus, AlertCircle, X, Save, Edit, Check, Target, RefreshCw, Loader2, FileSpreadsheet } from 'lucide-react';

interface TraineeManagementProps {
  trainees: Trainee[];
  jobs: JobTask[];
  onUpdateTrainees: (trainees: Trainee[]) => void;
  onSyncWithGoogleSheet?: () => void;
  isSyncing?: boolean;
}

export const TraineeManagement: React.FC<TraineeManagementProps> = ({ 
  trainees, 
  jobs, 
  onUpdateTrainees,
  onSyncWithGoogleSheet,
  isSyncing = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Track if we are editing
  const [newTrainee, setNewTrainee] = useState<Partial<Trainee>>({
    name: '',
    birthDate: '',
    disabilityType: '지적장애',
    jobRole: '',
    workLocation: '1층',
    residenceType: '재가',
    employmentType: '훈련',
    phone: '',
    memo: '',
    trainingGoal: '',
    targetScore: 3
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (confirm('정말 삭제하시겠습니까? 관련 훈련 기록은 유지되지만 이용인 목록에서는 사라집니다.')) {
      onUpdateTrainees(trainees.filter(t => t.id !== id));
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setNewTrainee({
      name: '',
      birthDate: '',
      disabilityType: '지적장애',
      jobRole: '',
      workLocation: '1층',
      residenceType: '재가',
      employmentType: '훈련',
      phone: '',
      memo: '',
      trainingGoal: '',
      targetScore: 3
    });
    setIsModalOpen(true);
  };

  const openEditModal = (trainee: Trainee) => {
    setEditingId(trainee.id);
    setNewTrainee({ ...trainee });
    setIsModalOpen(true);
  };

  const handleSaveTrainee = () => {
    if (!newTrainee.name) {
      alert('이름은 필수입니다.');
      return;
    }

    if (editingId) {
      // Update Existing
      const updatedTrainees = trainees.map(t => 
        t.id === editingId ? { ...t, ...newTrainee } as Trainee : t
      );
      onUpdateTrainees(updatedTrainees);
    } else {
      // Create New
      const traineeToAdd: Trainee = {
        id: `t-${Date.now()}`,
        name: newTrainee.name!,
        birthDate: newTrainee.birthDate || '',
        disabilityType: newTrainee.disabilityType || '기타',
        jobRole: newTrainee.jobRole || '',
        workLocation: newTrainee.workLocation as any,
        residenceType: newTrainee.residenceType as any,
        employmentType: newTrainee.employmentType as any,
        phone: newTrainee.phone || '',
        memo: newTrainee.memo || '',
        trainingGoal: newTrainee.trainingGoal || '',
        targetScore: newTrainee.targetScore || 3
      };
      onUpdateTrainees([...trainees, traineeToAdd]);
    }
    
    setIsModalOpen(false);
    setEditingId(null);
  };

  const toggleJobRole = (jobTitle: string) => {
    const currentRoles = newTrainee.jobRole ? newTrainee.jobRole.split(',').map(s => s.trim()).filter(Boolean) : [];
    let newRoles;
    if (currentRoles.includes(jobTitle)) {
      newRoles = currentRoles.filter(r => r !== jobTitle);
    } else {
      newRoles = [...currentRoles, jobTitle];
    }
    setNewTrainee({ ...newTrainee, jobRole: newRoles.join(', ') });
  };

  const filteredTrainees = trainees.filter(t => 
    t.name.includes(searchTerm) || 
    t.disabilityType.includes(searchTerm) ||
    (t.jobRole && t.jobRole.includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto relative">
      {/* Header & Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-xl font-bold text-gray-800">이용인 데이터 관리</h2>
           <p className="text-gray-500 text-sm mt-1">훈련 프로그램 참여자 명단 및 개별 훈련 목표를 관리합니다.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <UserPlus size={16} />
            개별 추가
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1 self-center hidden md:block"></div>
          
          {/* Google Sheet Sync Button */}
          {onSyncWithGoogleSheet && (
            <button 
              onClick={onSyncWithGoogleSheet}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
              title="구글 시트의 'employee' 탭에서 이용인 정보를 가져옵니다"
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              구글 시트 동기화
            </button>
          )}
        </div>
      </div>

      {/* Warning/Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <FileSpreadsheet className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">구글 시트 연동 안내</p>
          <p>
            '구글 시트 동기화' 버튼을 누르면 연동된 구글 스프레드시트의 <strong>'employee'</strong> 시트에서 이용인 정보를 자동으로 가져옵니다.<br/>
            (필수 컬럼: 이름, 생년월일, 장애유형, 훈련직무, 훈련목표 등)
          </p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50/50 gap-4">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <UserPlus size={18} />
            <span>등록된 이용인 ({trainees.length}명)</span>
          </div>
          <div className="relative w-full md:w-auto">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
             <input 
               type="text" 
               placeholder="이름, 유형, 직무 검색" 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none w-full md:w-64"
             />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 whitespace-nowrap">
              <tr>
                <th className="px-6 py-3 w-16">No</th>
                <th className="px-6 py-3">이름/생년월일</th>
                <th className="px-6 py-3">장애유형</th>
                <th className="px-6 py-3">훈련직무</th>
                <th className="px-6 py-3">훈련목표</th>
                <th className="px-6 py-3">근무장소</th>
                <th className="px-6 py-3">구분</th>
                <th className="px-6 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTrainees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredTrainees.map((t, idx) => (
                  <tr 
                    key={t.id} 
                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer"
                    onDoubleClick={() => openEditModal(t)}
                  >
                    <td className="px-6 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-800">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.birthDate || '-'}</div>
                    </td>
                    <td className="px-6 py-3">{t.disabilityType}</td>
                    <td className="px-6 py-3 font-medium text-gray-700">
                       {t.jobRole ? (
                         <div className="flex flex-wrap gap-1">
                           {t.jobRole.split(',').map((role, i) => (
                             <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{role.trim()}</span>
                           ))}
                         </div>
                       ) : '-'}
                    </td>
                    <td className="px-6 py-3">
                      {t.trainingGoal ? (
                        <div className="flex flex-col gap-1 max-w-xs">
                          <span className="text-xs text-gray-800 truncate" title={t.trainingGoal}>{t.trainingGoal}</span>
                          <span className="text-[10px] text-indigo-600 font-medium">목표: {t.targetScore}점</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">미설정</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{t.workLocation}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.residenceType === '시설' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t.residenceType || '미지정'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditModal(t); }}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="수정"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(t.id, e)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Manual Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                {editingId ? '이용인 정보 수정' : '이용인 개별 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">이름 <span className="text-red-500">*</span></label>
                 <input 
                   type="text" 
                   value={newTrainee.name}
                   onChange={e => setNewTrainee({...newTrainee, name: e.target.value})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                   placeholder="홍길동"
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">생년월일</label>
                 <input 
                   type="date" 
                   value={newTrainee.birthDate}
                   onChange={e => setNewTrainee({...newTrainee, birthDate: e.target.value})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">장애유형</label>
                 <input 
                   type="text" 
                   value={newTrainee.disabilityType}
                   onChange={e => setNewTrainee({...newTrainee, disabilityType: e.target.value})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                   placeholder="예: 지적장애"
                 />
               </div>
               
               <div className="md:col-span-2">
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">훈련직무 (다중선택 가능)</label>
                 <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                   {jobs.map(job => {
                     const currentRoles = newTrainee.jobRole ? newTrainee.jobRole.split(',').map(s => s.trim()) : [];
                     const isSelected = currentRoles.includes(job.title);
                     return (
                       <button
                         key={job.id}
                         onClick={() => toggleJobRole(job.title)}
                         className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                           isSelected 
                             ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                             : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                         }`}
                       >
                         {isSelected && <Check size={12} strokeWidth={3} />}
                         {job.title}
                       </button>
                     );
                   })}
                   {jobs.length === 0 && (
                     <span className="text-xs text-gray-400">등록된 직무가 없습니다. 설정 메뉴에서 직무를 추가해주세요.</span>
                   )}
                 </div>
               </div>

               {/* Training Goal Section */}
               <div className="md:col-span-2 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <h4 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                    <Target size={16} /> 개별 훈련 목표 설정
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">훈련 목표</label>
                      <input 
                        type="text" 
                        value={newTrainee.trainingGoal}
                        onChange={e => setNewTrainee({...newTrainee, trainingGoal: e.target.value})}
                        className="w-full p-2 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="예: 작업 속도 향상 및 이석 줄이기"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">목표 점수 (1-5)</label>
                      <select 
                        value={newTrainee.targetScore}
                        onChange={e => setNewTrainee({...newTrainee, targetScore: parseInt(e.target.value)})}
                        className="w-full p-2 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {[1, 2, 3, 4, 5].map(num => (
                          <option key={num} value={num}>{num}점</option>
                        ))}
                      </select>
                    </div>
                  </div>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">근무장소</label>
                 <select 
                   value={newTrainee.workLocation}
                   onChange={e => setNewTrainee({...newTrainee, workLocation: e.target.value as any})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                   <option value="1층">1층</option>
                   <option value="2층">2층</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">이용구분</label>
                 <select 
                   value={newTrainee.residenceType}
                   onChange={e => setNewTrainee({...newTrainee, residenceType: e.target.value as any})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                   <option value="재가">재가</option>
                   <option value="시설">시설</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">직급</label>
                 <select 
                   value={newTrainee.employmentType}
                   onChange={e => setNewTrainee({...newTrainee, employmentType: e.target.value as any})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                   <option value="훈련">훈련생</option>
                   <option value="근로">근로자</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">휴대전화</label>
                 <input 
                   type="text" 
                   value={newTrainee.phone}
                   onChange={e => setNewTrainee({...newTrainee, phone: e.target.value})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                   placeholder="010-0000-0000"
                 />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">특이사항 (메모)</label>
                 <input 
                   type="text" 
                   value={newTrainee.memo}
                   onChange={e => setNewTrainee({...newTrainee, memo: e.target.value})}
                   className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                   placeholder="예: 특정 소음에 민감함"
                 />
               </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                취소
              </button>
              <button 
                onClick={handleSaveTrainee}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                <Save size={18} />
                {editingId ? '수정사항 저장' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};