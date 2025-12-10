import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DailyLog, JobTask, ApprovalRole } from '../types';
import { FileSignature, ArrowRight, Clock, CheckCircle2, Globe, Database, RefreshCw, Loader2 } from 'lucide-react';

interface DashboardProps {
  logs: DailyLog[];
  jobs: JobTask[];
  userRole: ApprovalRole;
  onNavigateToLog: (logId: string) => void;
  isDataSynced?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ logs, jobs, userRole, onNavigateToLog, isDataSynced = false, onRefresh, isRefreshing = false }) => {
  // Compute average score per day
  const trendData = logs.map(log => {
    const avg = log.evaluations.reduce((acc, cur) => acc + cur.score, 0) / (log.evaluations.length || 1);
    return {
      date: log.date,
      score: parseFloat(avg.toFixed(2)),
      count: log.evaluations.length
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7); // Last 7 entries

  // Compute distribution of scores (Total cumulative)
  const scoreDistribution = [
    { name: '1점 (도움필요)', count: 0 },
    { name: '2점 (지속지도)', count: 0 },
    { name: '3점 (간헐지도)', count: 0 },
    { name: '4점 (독립수행)', count: 0 },
    { name: '5점 (우수)', count: 0 },
  ];

  logs.forEach(log => {
    log.evaluations.forEach(ev => {
      if (ev.score >= 1 && ev.score <= 5) {
        scoreDistribution[ev.score - 1].count += 1;
      }
    });
  });

  // Filter logs pending for THIS user
  const pendingLogs = logs.filter(log => {
    const myStepIndex = log.approvals.findIndex(step => step.role === userRole);
    if (myStepIndex === -1) return false; // Role not involved
    
    const myStep = log.approvals[myStepIndex];
    if (myStep.status !== 'pending') return false; // Already processed

    // Check if previous step is approved
    if (myStepIndex === 0) return true;
    const prevStep = log.approvals[myStepIndex - 1];
    return prevStep.status === 'approved';
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end items-center gap-2">
        {isDataSynced ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-200 rounded-full text-xs font-bold text-green-700 shadow-sm">
            <Globe size={14} />
            Data Source: Google Sheets (Live)
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-bold text-gray-600 shadow-sm">
            <Database size={14} />
            Data Source: Local Storage
          </div>
        )}
        
        {onRefresh && (
          <button 
            onClick={onRefresh} 
            disabled={isRefreshing}
            className="p-1.5 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm disabled:opacity-50"
            title="데이터 새로고침"
          >
            {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        )}
      </div>

      {/* Pending Approvals Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <FileSignature size={100} className="text-indigo-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileSignature className="text-indigo-600" size={24} />
          나의 결재 대기 문서
          {pendingLogs.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pendingLogs.length}건
            </span>
          )}
        </h3>
        
        {pendingLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <CheckCircle2 size={32} className="mb-2 text-gray-300" />
            <p>현재 대기 중인 결재 문서가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-indigo-50 text-indigo-800 font-semibold border-b border-indigo-100">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">훈련 일자</th>
                  <th className="px-4 py-3">훈련 직무</th>
                  <th className="px-4 py-3">담당자</th>
                  <th className="px-4 py-3">결재 상태</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border border-gray-100 border-t-0 rounded-b-lg">
                {pendingLogs.map(log => {
                  const job = jobs.find(j => j.id === log.taskId);
                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                      onDoubleClick={() => onNavigateToLog(log.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{log.date}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          {job?.title || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{log.instructorName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700">
                          <Clock size={12} />
                          결재 대기
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => onNavigateToLog(log.id)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          결재하러 가기 <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2 text-right">* 목록을 더블 클릭하면 결재 화면으로 이동합니다.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">최근 훈련 수행도 추이 (평균)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 12}} />
                <YAxis domain={[0, 5]} hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="score" name="평균 점수" stroke="#4F46E5" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Distribution Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">누적 수행 평가 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" name="평가 횟수" fill="#10B981" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
          <p className="text-indigo-600 font-medium mb-1">총 누적 훈련 횟수</p>
          <p className="text-3xl font-bold text-indigo-900">{logs.length}회</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
          <p className="text-emerald-600 font-medium mb-1">참여 연인원</p>
          <p className="text-3xl font-bold text-emerald-900">
            {logs.reduce((acc, log) => acc + log.evaluations.length, 0)}명
          </p>
        </div>
        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
          <p className="text-amber-600 font-medium mb-1">최근 평균 수행도</p>
          <p className="text-3xl font-bold text-amber-900">
            {trendData.length > 0 ? trendData[trendData.length-1].score : 0} / 5.0
          </p>
        </div>
      </div>
    </div>
  );
};