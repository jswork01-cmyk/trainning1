import React, { useState } from 'react';
import { Employee } from '../types';
import { Lock, Mail, ChevronRight, AlertCircle, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';

interface LoginProps {
  employees: Employee[];
  onLogin: (employee: Employee) => void;
  facilityName: string;
  onSyncEmployees?: () => void;
  isSyncing?: boolean;
}

export const Login: React.FC<LoginProps> = ({ employees, onLogin, facilityName, onSyncEmployees, isSyncing }) => {
  // Load saved email from localStorage if available
  const [email, setEmail] = useState(() => localStorage.getItem('app_last_login_email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = employees.find(emp => emp.email === email && emp.password === password);
    
    if (user) {
      // Save email to localStorage on successful login to persist for next session
      localStorage.setItem('app_last_login_email', email);
      onLogin(user);
    } else {
      setError('이메일 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  const handleTestLogin = () => {
    setEmail('director@center.com');
    setPassword('1234');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
        <div className="bg-indigo-900 p-8 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
           <ShieldCheck className="mx-auto text-indigo-300 mb-4" size={48} />
           <h1 className="text-2xl font-bold text-white mb-1">{facilityName}</h1>
           <p className="text-indigo-200 text-sm">스마트 훈련일지 시스템</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="비밀번호 입력"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group"
            >
              로그인
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <div className="mt-4 text-center">
             {isSyncing ? (
                <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                   <Loader2 className="animate-spin" size={16} />
                   <span>최신 직원 정보를 동기화 중입니다...</span>
                </div>
             ) : (
                onSyncEmployees && (
                  <button 
                    type="button"
                    onClick={onSyncEmployees}
                    className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mx-auto"
                  >
                    <RefreshCw size={14} /> 직원 정보 동기화
                  </button>
                )
             )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
             <p className="text-xs text-gray-400 mb-2">관리자(원장) 계정 빠른 로그인</p>
             <button 
               onClick={handleTestLogin}
               className="text-xs text-indigo-600 font-semibold hover:underline"
             >
               테스트 계정 자동 입력 (director@center.com)
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};