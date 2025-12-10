
import React, { useState, useRef } from 'react';
import { Employee, ApprovalRole } from '../types';
import { Users, UserPlus, Upload, RefreshCw, Loader2, Search, Trash2, X, AlertTriangle } from 'lucide-react';

interface EmployeeSettingsProps {
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
  userRole: ApprovalRole;
  onSyncEmployees?: () => void;
  onSaveEmployees?: () => void;
  isEmployeeSyncing?: boolean;
}

export const EmployeeSettings: React.FC<EmployeeSettingsProps> = ({
  employees,
  onUpdateEmployees,
  userRole,
  onSyncEmployees,
  onSaveEmployees,
  isEmployeeSyncing = false
}) => {
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ 
    name: '', 
    position: '직업훈련교사', 
    email: '', 
    phone: '', 
    password: '', 
    signatureUrl: '' 
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirector = userRole === 'director';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) { 
        alert('이미지 크기는 2MB 이하여야 합니다.'); 
        return; 
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      setNewEmployee(p => ({ ...p, signatureUrl: res }));
    };
    reader.readAsDataURL(file);
  };

  const openEmployeeModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployeeId(emp.id);
      setNewEmployee({...emp});
    } else {
      setEditingEmployeeId(null);
      setNewEmployee({ name: '', position: '직업훈련교사', email: '', phone: '', password: '', signatureUrl: '' });
    }
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = () => {
    if (!newEmployee.name || !newEmployee.position || !newEmployee.email || !newEmployee.password) { 
      alert('필수 정보를 모두 입력해주세요 (이름, 직위, 이메일, 비밀번호).'); 
      return; 
    }
    
    if (editingEmployeeId) {
       onUpdateEmployees(employees.map(e => e.id === editingEmployeeId ? { ...e, ...newEmployee } as Employee : e));
    } else {
       if (employees.length >= 10) { alert('최대 10명까지만 등록 가능합니다.'); return; }
       onUpdateEmployees([...employees, { 
         id: `e-${Date.now()}`, 
         name: newEmployee.name!, 
         position: newEmployee.position!, 
         email: newEmployee.email!, 
         phone: newEmployee.phone || '',
         password: newEmployee.password!, 
         signatureUrl: newEmployee.signatureUrl 
       }]);
    }
    setIsEmployeeModalOpen(false);
    setEditingEmployeeId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteEmployee = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (employees.length <= 1) { alert('최소 1명은 있어야 합니다.'); return; }
    if (confirm('정말 삭제하시겠습니까?')) onUpdateEmployees(employees.filter(emp => emp.id !== id));
  };

  const filteredEmployees = employees.filter(e => 
    e.name.includes(employeeSearchTerm) || 
    e.position.includes(employeeSearchTerm) || 
    e.email?.includes(employeeSearchTerm)
  );

  if (!isDirector) {
      return <div className="p-8 text-center text-gray-500">권한이 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              직원 명단 관리
            </h3>
            <p className="text-xs text-gray-500 mt-1">시스템 접속 계정 및 결재 서명 관리</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEmployeeModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">
              <UserPlus size={16} /> 직원 등록
            </button>
            {onSaveEmployees && (
              <button onClick={onSaveEmployees} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm">
                <Upload size={16} /> 시트로 내보내기
              </button>
            )}
            {onSyncEmployees && (
              <button 
                onClick={onSyncEmployees} 
                disabled={isEmployeeSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
              >
                {isEmployeeSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                시트 동기화(불러오기)
              </button>
            )}
          </div>
       </div>
       
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-4 border-b border-gray-100 flex items-center justify-between">
           <div className="text-sm font-bold text-gray-700">총 {employees.length}명</div>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
             <input 
               type="text" 
               placeholder="이름, 직위, 이메일 검색" 
               value={employeeSearchTerm}
               onChange={e => setEmployeeSearchTerm(e.target.value)}
               className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none w-64"
             />
           </div>
         </div>
         
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
               <tr>
                 <th className="px-6 py-3">이름/직위</th>
                 <th className="px-6 py-3">이메일(ID)</th>
                 <th className="px-6 py-3">연락처</th>
                 <th className="px-6 py-3">비밀번호</th>
                 <th className="px-6 py-3 text-center">서명</th>
                 <th className="px-6 py-3 text-right">관리</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {filteredEmployees.map(emp => (
                 <tr key={emp.id} className="hover:bg-gray-50" onDoubleClick={() => openEmployeeModal(emp)}>
                   <td className="px-6 py-3">
                     <div className="font-medium text-gray-800">{emp.name}</div>
                     <div className="text-xs text-gray-500">{emp.position}</div>
                   </td>
                   <td className="px-6 py-3 text-gray-600 font-mono">{emp.email}</td>
                   <td className="px-6 py-3 text-gray-600">{emp.phone || '-'}</td>
                   <td className="px-6 py-3 text-gray-400 font-mono">••••</td>
                   <td className="px-6 py-3 text-center">
                     {emp.signatureUrl ? (
                       <img 
                         src={emp.signatureUrl} 
                         alt="Sign" 
                         className="h-8 mx-auto object-contain border border-gray-200 rounded"
                         onError={(e) => {
                           e.currentTarget.style.display = 'none';
                           // Fallback UI for broken images (e.g. permission error)
                           const span = document.createElement('span');
                           span.className = 'text-xs text-red-400 flex flex-col items-center justify-center';
                           span.innerHTML = '<span class="font-bold">이미지 오류</span><span class="text-[10px]">권한 확인</span>';
                           e.currentTarget.parentElement?.appendChild(span);
                         }}
                       />
                     ) : <span className="text-xs text-gray-400">미등록</span>}
                   </td>
                   <td className="px-6 py-3 text-right">
                     <button onClick={(e) => handleDeleteEmployee(emp.id, e)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>

       {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{editingEmployeeId ? '직원 정보 수정' : '새 직원 등록'}</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">이름</label>
                <input className="w-full p-2 border rounded" value={newEmployee.name} onChange={e=>setNewEmployee({...newEmployee, name:e.target.value})} placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">직위 (역할)</label>
                <select className="w-full p-2 border rounded" value={newEmployee.position} onChange={e=>setNewEmployee({...newEmployee, position:e.target.value})}>
                  <option value="직업훈련교사">직업훈련교사 (담당)</option>
                  <option value="사무국장">사무국장 (중간결재)</option>
                  <option value="원장">원장 (최종결재)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">이메일 (로그인 ID)</label>
                <input className="w-full p-2 border rounded" value={newEmployee.email} onChange={e=>setNewEmployee({...newEmployee, email:e.target.value})} placeholder="user@center.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">연락처</label>
                <input className="w-full p-2 border rounded" value={newEmployee.phone} onChange={e=>setNewEmployee({...newEmployee, phone:e.target.value})} placeholder="010-0000-0000" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">비밀번호</label>
                <input className="w-full p-2 border rounded" type="password" value={newEmployee.password} onChange={e=>setNewEmployee({...newEmployee, password:e.target.value})} placeholder="****" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">서명 이미지 (도장)</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-xs text-gray-500 mb-2" />
                {newEmployee.signatureUrl && (
                  <div className="border p-2 rounded bg-gray-50 text-center">
                    <img src={newEmployee.signatureUrl} alt="Preview" className="h-12 mx-auto object-contain" />
                    <button onClick={() => { setNewEmployee({...newEmployee, signatureUrl: ''}); if(fileInputRef.current) fileInputRef.current.value=''; }} className="text-xs text-red-500 underline mt-1">삭제</button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">* 배경이 투명한 PNG 이미지를 권장합니다.</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setIsEmployeeModalOpen(false)} className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-200 rounded">취소</button>
              <button onClick={handleSaveEmployee} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 rounded">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
