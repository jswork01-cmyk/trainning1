


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trainee, JobTask, DailyLog, Evaluation, EVALUATION_CRITERIA, Employee, ApprovalStep } from '../types';
import { WEATHER_OPTIONS } from '../constants';
import { Check, Search, Bot, Loader2, Save, Info, Filter, CheckSquare, Target, Printer, FileText, Image as ImageIcon, X, Upload } from 'lucide-react';
import { generateDailyReport } from '../services/geminiService';

interface LogFormProps {
  trainees: Trainee[];
  jobs: JobTask[];
  employees: Employee[];
  logs: DailyLog[]; // Added for consistency but mostly unused now due to redirect
  onSave: (log: DailyLog) => void;
  onCancel: () => void;
  onPrint: (log: DailyLog) => void;
  onExportToSheet?: (log: DailyLog) => void;
}

export const LogForm: React.FC<LogFormProps> = ({ trainees, jobs, employees, onSave, onCancel, onPrint }) => {
  const [date, setDate] = useState(() => {
    // KST Offset calculation to ensure correct date in Korea
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
  });
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [weather, setWeather] = useState(WEATHER_OPTIONS[0]);
  const [instructor, setInstructor] = useState('');
  
  // Selection & Evaluation State
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set());
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJobRole, setFilterJobRole] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  // Image Upload State
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize selectedJobId and filter
  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id);
      setFilterJobRole(jobs[0].title);
    }
  }, [jobs, selectedJobId]);

  // Initialize instructor with first employee if available
  useEffect(() => {
    if (employees.length > 0 && !instructor) {
      setInstructor(employees[0].name);
    }
  }, [employees, instructor]);

  const selectedJob = jobs.find(j => j.id === selectedJobId) || jobs[0];

  const filteredTrainees = useMemo(() => {
    return trainees.filter(t => {
      const matchesName = t.name.includes(searchTerm);
      const matchesJob = filterJobRole === '' || (t.jobRole && t.jobRole.includes(filterJobRole));
      const matchesLocation = filterLocation === '' || t.workLocation === filterLocation;
      return matchesName && matchesJob && matchesLocation;
    });
  }, [searchTerm, filterJobRole, filterLocation, trainees]);

  const toggleTrainee = (id: string) => {
    const newSet = new Set(selectedTraineeIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      const newEvaluations = { ...evaluations };
      delete newEvaluations[id];
      setEvaluations(newEvaluations);
    } else {
      newSet.add(id);
      setEvaluations(prev => ({
        ...prev,
        [id]: { traineeId: id, score: 3, note: '' }
      }));
    }
    setSelectedTraineeIds(newSet);
  };

  const handleSelectAllFiltered = () => {
    if (filteredTrainees.length === 0) return;

    const newSet = new Set(selectedTraineeIds);
    const newEvaluations = { ...evaluations };
    let addedCount = 0;

    filteredTrainees.forEach(t => {
      if (!newSet.has(t.id)) {
        newSet.add(t.id);
        if (!newEvaluations[t.id]) {
          newEvaluations[t.id] = { traineeId: t.id, score: 3, note: '' };
        }
        addedCount++;
      }
    });

    if (addedCount === 0) {
      alert('현재 목록의 모든 인원이 이미 선택되어 있습니다.');
      return;
    }

    setSelectedTraineeIds(newSet);
    setEvaluations(newEvaluations);
  };

  const updateEvaluation = (id: string, field: keyof Evaluation, value: any) => {
    setEvaluations(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleGenerateReport = async () => {
    if (selectedTraineeIds.size === 0) {
      alert("평가할 이용인을 선택해주세요.");
      return;
    }
    
    // Safety check for empty jobs list
    if (!selectedJob) {
      alert("선택된 직무가 없습니다. 직무 데이터가 로딩 중인지 확인해주세요.");
      return;
    }

    setIsGenerating(true);
    
    const evaluationList = Array.from(selectedTraineeIds).map((id: string) => {
      const trainee = trainees.find(t => t.id === id);
      if (!trainee) {
        return {
           trainee: { id, name: 'Unknown', disabilityType: 'Unknown', memo: '' } as Trainee,
           score: evaluations[id].score,
           note: evaluations[id].note
        };
      }
      return {
        trainee,
        score: evaluations[id].score,
        note: evaluations[id].note
      };
    });

    const report = await generateDailyReport(date, selectedJob, evaluationList, weather);
    setAiSummary(report);
    setIsGenerating(false);
  };

  // Image Resizer (Optimized for Script Payload Limit)
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Reduced Max width to 600px to ensure small payload for GAS
          const MAX_WIDTH = 600;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
             // White background for JPEGs to handle transparency if converting
             ctx.fillStyle = "#FFFFFF";
             ctx.fillRect(0, 0, width, height);
             ctx.drawImage(img, 0, 0, width, height);
             
             // FORCE JPEG for Google Apps Script compatibility & size reduction
             // PNGs can be huge and cause "Empty payload" or "Request too large" errors in GAS
             const mimeType = 'image/jpeg';
             const quality = 0.6; // 60% quality is good enough for logs

             const dataUrl = canvas.toDataURL(mimeType, quality);
             resolve(dataUrl);
          } else {
             reject(new Error('Canvas context not available'));
          }
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages: string[] = [];
      // Limit to 4 images total
      if (images.length + files.length > 4) {
         alert('사진은 최대 4장까지 첨부할 수 있습니다.');
         return;
      }

      for (let i = 0; i < files.length; i++) {
        try {
          const resized = await resizeImage(files[i]);
          newImages.push(resized);
        } catch (err) {
          console.error('Image resize failed', err);
        }
      }
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
     setImages(prev => prev.filter((_, i) => i !== index));
  };

  const getFormData = (): DailyLog | null => {
    if (!selectedJobId) {
      alert("훈련 직무를 선택해주세요.");
      return null;
    }

    if (!instructor) {
      alert("담당자를 선택해주세요.");
      return null;
    }
    
    const initialApprovals: ApprovalStep[] = [
      { 
        role: 'instructor', 
        label: '담당자', 
        status: 'approved', 
        approverName: instructor, 
        approvedAt: new Date().toISOString() 
      },
      { role: 'manager', label: '사무국장', status: 'pending' },
      { role: 'director', label: '원장', status: 'pending' }
    ];

    const currentEmp = employees.find(e => e.name === instructor);
    if (currentEmp && currentEmp.signatureUrl) {
      initialApprovals[0].signatureUrl = currentEmp.signatureUrl;
    }

    // Use consistent ID format for reliable sync and approval matching
    // Format: log-{date}-{jobTitle}-{instructor}
    const logId = `log-${date}-${selectedJob.title}-${instructor}`;

    return {
      id: logId,
      date,
      taskId: selectedJobId,
      weather,
      instructorName: instructor,
      evaluations: Object.values(evaluations),
      aiSummary,
      images, // Attach images
      approvals: initialApprovals
    };
  };

  const handleSave = () => {
    if (!aiSummary && !confirm("훈련총평이 작성되지 않았습니다. 그래도 저장하시겠습니까?")) {
      return;
    }
    const log = getFormData();
    if (log) {
       onSave(log);
       // Note: Redirection happens in parent, but we reset here just in case
       setSelectedTraineeIds(new Set());
       setEvaluations({});
       setAiSummary('');
       setImages([]);
    }
  };

  const handlePrintClick = () => {
    const log = getFormData();
    if (log) onPrint(log);
  };

  const handleJobChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newJobId = e.target.value;
    setSelectedJobId(newJobId);
    
    const job = jobs.find(j => j.id === newJobId);
    if (job) {
      setFilterJobRole(job.title);
    } else {
      setFilterJobRole('');
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-1">
      
      {/* Main Form Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-[700px]">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-indigo-600" />
              일지 작성
            </h2>
            <div className="flex gap-2">
              <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                취소
              </button>
              <div className="w-px h-8 bg-gray-300 mx-1 self-center"></div>
              <button onClick={handlePrintClick} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium shadow-sm text-sm">
                <Printer size={16} />
                임시 인쇄
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm">
                <Save size={18} />
                저장하기
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">훈련 일자</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">훈련 직무</label>
              <select 
                value={selectedJobId} 
                onChange={handleJobChange}
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {jobs.length === 0 ? (
                  <option value="">불러오는 중...</option>
                ) : (
                  jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">날씨</label>
              <select 
                value={weather} 
                onChange={e => setWeather(e.target.value)}
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">담당자</label>
              <select 
                value={instructor}
                onChange={e => setInstructor(e.target.value)}
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {employees.length === 0 ? (
                  <option value="">직원을 등록해주세요</option>
                ) : (
                  employees.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full">
          {/* Left: Participant Selection */}
          <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-gray-50/50 min-h-[400px]">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center justify-between">
                <span>참여 인원 선택</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {selectedTraineeIds.size}명 선택됨
                </span>
              </h3>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="이름 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
                  <select
                    value={filterJobRole}
                    onChange={e => setFilterJobRole(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">전체 직무</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.title}>{job.title}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <select
                    value={filterLocation}
                    onChange={e => setFilterLocation(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">전체 장소</option>
                    <option value="1층">1층</option>
                    <option value="2층">2층</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSelectAllFiltered}
                disabled={filteredTrainees.length === 0}
                className="w-full py-2 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckSquare size={14} />
                검색된 {filteredTrainees.length}명 일괄 추가
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[600px]">
              {filteredTrainees.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  검색 조건에 맞는 이용인이 없습니다.
                </div>
              ) : (
                filteredTrainees.map(trainee => {
                  const isSelected = selectedTraineeIds.has(trainee.id);
                  return (
                    <button
                      key={trainee.id}
                      onClick={() => toggleTrainee(trainee.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-300' 
                          : 'hover:bg-white hover:shadow-sm border border-transparent'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                            {trainee.name}
                          </span>
                          {trainee.workLocation && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                              {trainee.workLocation}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {trainee.disabilityType} • {trainee.jobRole || '직무 미지정'}
                        </div>
                      </div>
                      {isSelected && <Check size={18} className="text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Evaluation Matrix */}
          <div className="w-full md:w-2/3 flex flex-col bg-white min-h-[400px]">
             <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white z-10">
               <h3 className="font-semibold text-gray-700">개별 수행 평가</h3>
               <div className="group relative flex items-center gap-1 text-xs text-gray-500 cursor-help">
                 <Info size={14} />
                 <span>평가 척도 도움말</span>
                 <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-gray-800 text-white p-3 rounded-lg shadow-xl z-50 text-xs leading-relaxed">
                   {Object.entries(EVALUATION_CRITERIA).map(([score, info]) => (
                     <div key={score} className="mb-2 last:mb-0">
                       <span className="font-bold text-yellow-400">{score}점 ({info.label}):</span> {info.desc}
                     </div>
                   ))}
                 </div>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {selectedTraineeIds.size === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400">
                   <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                     <Search size={32} />
                   </div>
                   <p>좌측에서 훈련에 참여한 이용인을 선택해주세요.</p>
                 </div>
               ) : (
                 Array.from(selectedTraineeIds).map((id: string) => {
                   const trainee = trainees.find(t => t.id === id)!;
                   const ev = evaluations[id];
                   if (!trainee || !ev) return null;
                   
                   return (
                     <div key={id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-indigo-200 transition-colors">
                       <div className="flex justify-between items-start mb-3">
                         <div>
                           <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-800">{trainee.name}</span>
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{trainee.disabilityType}</span>
                           </div>
                           {trainee.trainingGoal && (
                             <div className="flex items-center gap-1 mt-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-flex">
                               <Target size={12} />
                               <span>목표: {trainee.trainingGoal} (목표 {trainee.targetScore}점)</span>
                             </div>
                           )}
                         </div>
                         <div className="flex gap-1">
                           {[1, 2, 3, 4, 5].map((score) => (
                             <button
                               key={score}
                               onClick={() => updateEvaluation(id, 'score', score)}
                               className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${
                                 ev.score === score 
                                   ? 'bg-indigo-600 text-white shadow-md scale-110' 
                                   : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                               }`}
                               title={EVALUATION_CRITERIA[score as keyof typeof EVALUATION_CRITERIA].label}
                             >
                               {score}
                             </button>
                           ))}
                         </div>
                       </div>
                       <textarea
                         placeholder="특이사항이나 관찰 내용을 입력하세요..."
                         value={ev.note}
                         onChange={e => updateEvaluation(id, 'note', e.target.value)}
                         className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-gray-50"
                         rows={2}
                       />
                     </div>
                   );
                 })
               )}
             </div>

             {/* AI Summary & Photo Section */}
             <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex flex-col gap-4">
               {/* Summary */}
               <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Bot size={18} className="text-indigo-600" />
                      훈련총평
                    </h3>
                    <button 
                      onClick={handleGenerateReport}
                      disabled={isGenerating || selectedTraineeIds.size === 0}
                      className="text-xs px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
                    >
                      {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                      {aiSummary ? '다시 생성' : '자동 생성'}
                    </button>
                  </div>
                  <textarea
                    value={aiSummary}
                    onChange={e => setAiSummary(e.target.value)}
                    placeholder="자동 생성 버튼을 눌러 오늘 훈련의 총평을 작성해보세요."
                    className="w-full h-24 text-sm p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                  />
               </div>

               {/* Photo Upload */}
               <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                     <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <ImageIcon size={18} className="text-indigo-600" />
                        활동 사진 첨부 <span className="text-xs text-gray-400 font-normal">(최대 4장)</span>
                     </h3>
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1 shadow-sm"
                     >
                        <Upload size={12} /> 사진 추가
                     </button>
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                     />
                  </div>
                  
                  {images.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                       {images.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                             <img src={img} alt={`활동사진 ${idx+1}`} className="w-full h-full object-cover" />
                             <button 
                                onClick={() => removeImage(idx)}
                                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                             >
                                <X size={12} />
                             </button>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg h-20 flex flex-col items-center justify-center text-gray-400 text-xs cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors"
                    >
                       <Upload size={16} className="mb-1" />
                       <p>클릭하여 사진을 업로드하세요</p>
                    </div>
                  )}
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};