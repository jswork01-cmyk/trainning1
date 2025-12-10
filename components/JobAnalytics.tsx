
import React, { useMemo, useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { DailyLog, JobTask, Trainee } from '../types';
import { Info, Users, BarChart2, Search, Target, Globe, RefreshCw, Loader2, Printer, Calendar, Filter, X } from 'lucide-react';

interface JobAnalyticsProps {
  logs: DailyLog[];
  jobs: JobTask[];
  trainees: Trainee[];
  isDataSynced?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Local mock jobs for simulation since global defaults are removed
// NOTE: These IDs are now standardized but simulation data is only used when no logs exist.
const SIMULATION_JOBS: JobTask[] = [
  { id: 'shared-job-단순-조립', title: '단순 조립', category: 'assembly', description: '' },
  { id: 'shared-job-부품-포장', title: '부품 포장', category: 'packaging', description: '' },
  { id: 'shared-job-스티커-부착', title: '스티커 부착', category: 'packaging', description: '' },
  { id: 'shared-job-작업장-청소', title: '작업장 청소', category: 'cleaning', description: '' }
];

// Helper to generate mock data if real data is empty
const generateMockData = (): DailyLog[] => {
  const mockLogs: DailyLog[] = [];
  const today = new Date();
  
  // Generate last 30 days of data
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Create 2-3 sessions per day
    const sessions = Math.floor(Math.random() * 2) + 1; 
    
    for (let s = 0; s < sessions; s++) {
      const job = SIMULATION_JOBS[Math.floor(Math.random() * SIMULATION_JOBS.length)];
      // Random number of trainees 5-15
      const traineeCount = Math.floor(Math.random() * 10) + 5;
      const evals = [];
      
      // Base score varies by job complexity to create diverse trends
      let baseScore = 3.0;
      if (job.category === 'assembly') baseScore = 3.5;
      if (job.category === 'service') baseScore = 2.5; // harder
      
      // Add some trend over time (improving)
      const timeFactor = (30 - i) / 30; // 0 to 1
      const improvement = timeFactor * 0.8; 
      
      for (let t = 0; t < traineeCount; t++) {
        let scoreVal = Math.round(baseScore + improvement + (Math.random() * 2.5 - 1.25));
        if (scoreVal < 1) scoreVal = 1;
        if (scoreVal > 5) scoreVal = 5;
        
        evals.push({
          traineeId: `t-${t+1}`, // align with mock trainee IDs
          score: scoreVal as 1|2|3|4|5,
          note: ''
        });
      }
      
      mockLogs.push({
        id: `mock-${i}-${s}`,
        date: dateStr,
        taskId: job.id,
        weather: '맑음',
        evaluations: evals,
        instructorName: '가상 데이터',
        aiSummary: 'Mock Data',
        approvals: [
            { role: 'instructor', label: '담당자', status: 'approved', approverName: '가상 강사', approvedAt: dateStr },
            { role: 'manager', label: '사무국장', status: 'pending' },
            { role: 'director', label: '원장', status: 'pending' }
        ]
      });
    }
  }
  return mockLogs;
};

export const JobAnalytics: React.FC<JobAnalyticsProps> = ({ logs, jobs, trainees, isDataSynced = false, onRefresh, isRefreshing = false }) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'individual'>('overall');
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>('');
  
  // Date Range Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Initial calculation of logs (Mock vs Real)
  const { processedLogs, isMock } = useMemo(() => {
    if (logs.length > 0) return { processedLogs: logs, isMock: false };
    return { processedLogs: generateMockData(), isMock: true };
  }, [logs]);

  // Apply Date Filter
  const filteredLogs = useMemo(() => {
    return processedLogs.filter(log => {
      if (startDate && log.date < startDate) return false;
      if (endDate && log.date > endDate) return false;
      return true;
    });
  }, [processedLogs, startDate, endDate]);

  // --- OVERALL ANALYSIS LOGIC (Using filteredLogs) ---
  const trendData = useMemo(() => {
    const dataByDate: Record<string, any> = {};
    const usedJobs = new Set<string>();

    filteredLogs.forEach(log => {
      if (!dataByDate[log.date]) {
        dataByDate[log.date] = { date: log.date };
      }
      
      // For mock data, we need to look up title from SIMULATION_JOBS if not found in props.jobs
      let jobTitle = jobs.find(j => j.id === log.taskId)?.title;
      if (!jobTitle && isMock) {
         jobTitle = SIMULATION_JOBS.find(j => j.id === log.taskId)?.title;
      }
      jobTitle = jobTitle || 'Unknown';

      usedJobs.add(jobTitle);
      
      const avg = log.evaluations.reduce((acc, curr) => acc + curr.score, 0) / (log.evaluations.length || 1);
      
      if (dataByDate[log.date][jobTitle] !== undefined) {
        dataByDate[log.date][jobTitle] = (dataByDate[log.date][jobTitle] + avg) / 2;
      } else {
        dataByDate[log.date][jobTitle] = avg;
      }
    });

    return {
      data: Object.values(dataByDate).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
      keys: Array.from(usedJobs)
    };
  }, [filteredLogs, jobs, isMock]);

  const categoryData = useMemo(() => {
    const stats: Record<string, number[]> = {};
    ['assembly', 'packaging', 'cleaning', 'service', 'other'].forEach(cat => {
      stats[cat] = [0, 0, 0, 0, 0];
    });

    filteredLogs.forEach(log => {
      let job = jobs.find(j => j.id === log.taskId);
      if (!job && isMock) job = SIMULATION_JOBS.find(j => j.id === log.taskId);

      if (job) {
        log.evaluations.forEach(ev => {
          if (stats[job!.category]) {
            stats[job!.category][ev.score - 1]++;
          } else {
             // If category is not standard
             if (!stats['other']) stats['other'] = [0,0,0,0,0];
             stats['other'][ev.score - 1]++;
          }
        });
      }
    });

    const categoryLabels: Record<string, string> = {
      assembly: '조립', packaging: '포장', cleaning: '청소', service: '서비스', other: '기타'
    };

    return Object.entries(stats).map(([cat, counts]) => ({
      name: categoryLabels[cat] || cat,
      score1: counts[0], score2: counts[1], score3: counts[2], score4: counts[3], score5: counts[4],
      total: counts.reduce((a, b) => a + b, 0)
    })).filter(item => item.total > 0);
  }, [filteredLogs, jobs, isMock]);

  const jobRankingData = useMemo(() => {
    const jobStats: Record<string, { totalScore: number, count: number }> = {};
    filteredLogs.forEach(log => {
      let jobName = jobs.find(j => j.id === log.taskId)?.title;
      if (!jobName && isMock) jobName = SIMULATION_JOBS.find(j => j.id === log.taskId)?.title;
      jobName = jobName || 'Unknown';

      if (!jobStats[jobName]) jobStats[jobName] = { totalScore: 0, count: 0 };
      const logSum = log.evaluations.reduce((acc, curr) => acc + curr.score, 0);
      jobStats[jobName].totalScore += logSum;
      jobStats[jobName].count += log.evaluations.length;
    });

    return Object.entries(jobStats)
      .map(([name, stat]) => ({ name, avg: parseFloat((stat.totalScore / stat.count).toFixed(2)) }))
      .sort((a, b) => b.avg - a.avg);
  }, [filteredLogs, jobs, isMock]);

  // --- INDIVIDUAL ANALYSIS LOGIC (Using filteredLogs) ---
  
  // Get list of trainees who have records in the FILTERED logs
  // However, for UX, we might want to see all trainees even if they don't have logs in the range, 
  // but selecting them would show empty data. Let's filter to those active in range or all mock.
  const availableTrainees = useMemo(() => {
    // If no filter, show everyone who has ever had a log. 
    // If filtered, show trainees who have logs in that range? 
    // Better: Show all trainees available in the system (passed via props) to allow checking "no activity" too.
    // But original logic filtered based on processedLogs. Let's stick to showing trainees relevant to current view.
    
    // Use ALL logs to determine "Available Trainees" list to prevent names disappearing when changing dates,
    // OR use filteredLogs to only show people who worked in that period.
    // Let's show all trainees from props to be safe, sorted by name.
    return [...trainees].sort((a, b) => a.name.localeCompare(b.name));
  }, [trainees]);

  // Default select first trainee if none selected
  useEffect(() => {
    if (!selectedTraineeId && availableTrainees.length > 0) {
      setSelectedTraineeId(availableTrainees[0].id);
    }
  }, [availableTrainees, selectedTraineeId]);

  const individualData = useMemo(() => {
    if (!selectedTraineeId) return null;
    
    const traineeLogs = filteredLogs
      .filter(log => log.evaluations.some(ev => ev.traineeId === selectedTraineeId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (traineeLogs.length === 0) return { history: [], byJob: [], avgScore: 0, count: 0, maxScore: 0 };

    // 1. History Trend
    const history = traineeLogs.map(log => {
      const ev = log.evaluations.find(e => e.traineeId === selectedTraineeId);
      let jobTitle = jobs.find(j => j.id === log.taskId)?.title;
      if (!jobTitle && isMock) jobTitle = SIMULATION_JOBS.find(j => j.id === log.taskId)?.title;
      
      return {
        date: log.date,
        score: ev?.score || 0,
        jobTitle: jobTitle || 'Unknown',
        note: ev?.note
      };
    });

    // 2. Performance by Job
    const jobStats: Record<string, { total: number, count: number }> = {};
    traineeLogs.forEach(log => {
      let job = jobs.find(j => j.id === log.taskId);
      if (!job && isMock) job = SIMULATION_JOBS.find(j => j.id === log.taskId);

      const ev = log.evaluations.find(e => e.traineeId === selectedTraineeId);
      if (job && ev) {
        if (!jobStats[job.title]) jobStats[job.title] = { total: 0, count: 0 };
        jobStats[job.title].total += ev.score;
        jobStats[job.title].count += 1;
      }
    });

    const byJob = Object.entries(jobStats).map(([name, stat]) => ({
      name,
      avg: parseFloat((stat.total / stat.count).toFixed(1)),
      count: stat.count
    })).sort((a, b) => b.avg - a.avg);

    // 3. Overall Stats
    const totalScore = history.reduce((acc, curr) => acc + curr.score, 0);
    const avgScore = (totalScore / history.length).toFixed(2);
    const maxScore = Math.max(...history.map(h => h.score));
    
    return { history, byJob, avgScore, count: history.length, maxScore };
  }, [filteredLogs, selectedTraineeId, jobs, isMock]);

  // Colors
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  const scoreColors = ['#EF4444', '#F97316', '#FBBF24', '#34D399', '#10B981']; 

  const selectedTraineeInfo = trainees.find(t => t.id === selectedTraineeId);

  // Robust Print Handler using Window.open
  const handlePrint = () => {
    const printContent = document.getElementById('analytics-report-container');
    if (!printContent) return;
    
    // Open new window
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      alert('팝업 차단을 해제해주세요.');
      return;
    }

    // Capture the HTML of the report container
    const contentHtml = printContent.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>직무 분석 리포트 - ${new Date().toLocaleDateString()}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
          body { font-family: 'Noto Sans KR', sans-serif; padding: 40px; background: white; }
          
          /* Hide non-print elements that might have been cloned */
          .no-print { display: none !important; }
          
          /* Show print-only elements that are hidden on screen */
          .print-only-info { display: block !important; margin-bottom: 20px; }

          /* Hide select inputs in print view as they reset to default value */
          select { display: none !important; }
          
          /* Ensure charts render with correct size in print window */
          .recharts-responsive-container { width: 100% !important; height: 350px !important; }
          
          /* Layout adjustments for print */
          h1 { font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
          h3 { font-size: 18px; font-weight: bold; margin-bottom: 10px; margin-top: 20px; color: #1f2937; }
          
          /* Force page break avoidance inside charts/cards */
          .bg-white { break-inside: avoid; border: 1px solid #e5e7eb; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          // Allow time for styles/CDN/Charts to stabilize
          setTimeout(() => {
            window.print();
            // Optional: window.close();
          }, 1000);
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };
  
  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div id="analytics-report-container" className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-center no-print">
        {isDataSynced && !isMock ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <Globe className="text-green-600" size={20} />
            <span className="text-green-800 text-sm font-bold">Google Sheet 실시간 데이터 분석 중</span>
          </div>
        ) : <div />}

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button 
              onClick={onRefresh} 
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors shadow-sm disabled:opacity-50"
            >
              {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              데이터 새로고침
            </button>
          )}
          <button 
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 border border-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Printer size={14} />
            분석 리포트 인쇄
          </button>
        </div>
      </div>
      
      {isMock && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg no-print">
          <div className="flex items-center">
            <Info className="text-blue-500 mr-2" size={20} />
            <p className="text-blue-700 text-sm">
              현재 축적된 데이터가 없어 <strong>가상 시뮬레이션 데이터</strong>를 보여주고 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Date Range Filter Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-4 no-print">
         <div className="flex items-center gap-2 text-gray-700 font-bold text-sm min-w-fit">
            <Filter size={18} className="text-indigo-600" />
            <span>분석 기간 설정:</span>
         </div>
         
         <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative">
               <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
               <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
               />
            </div>
            <span className="text-gray-400">~</span>
            <div className="relative">
               <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
               <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
               />
            </div>
            
            <div className="h-6 w-px bg-gray-300 mx-2"></div>

            <div className="flex gap-1">
               <button onClick={() => setDateRange(7)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded transition-colors">1주일</button>
               <button onClick={() => setDateRange(30)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded transition-colors">1개월</button>
               <button onClick={() => setDateRange(90)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded transition-colors">3개월</button>
               <button onClick={clearDateRange} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded transition-colors flex items-center gap-1">
                 <X size={12} /> 전체
               </button>
            </div>
         </div>
         
         <div className="text-xs text-gray-500">
            분석 대상: <span className="text-indigo-600 font-bold">{filteredLogs.length}</span>건 / 전체 {processedLogs.length}건
         </div>
      </div>

      {/* Print-only Filter Info */}
      <div className="print-only-info hidden mb-4 bg-gray-50 p-4 rounded border border-gray-200">
         <p className="font-bold text-gray-800 text-sm">분석 기간: {startDate || '전체'} ~ {endDate || '전체'}</p>
         <p className="text-xs text-gray-500 mt-1">분석 대상 데이터: 총 {filteredLogs.length}건</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 no-print">
        <button
          onClick={() => setActiveTab('overall')}
          className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'overall' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 size={18} />
          종합 분석
        </button>
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'individual' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={18} />
          개인별 분석
        </button>
      </div>

      {activeTab === 'overall' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Print Header for Overall */}
          <div className="hidden no-print block-on-print-window mb-6 border-b pb-4">
             <h1 className="text-2xl font-bold">직무 훈련 종합 분석 리포트</h1>
             <p className="text-sm text-gray-500">출력일: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2">직무별 수행도 변화 추이</h3>
            <p className="text-sm text-gray-500 mb-6">선택 기간 동안 각 직무별 훈련생들의 평균 수행 능력 변화입니다.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} />
                  <YAxis domain={[0, 5]} hide />
                  <Tooltip 
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                     itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {trendData.keys.map((key, idx) => (
                    <Line 
                      key={key}
                      connectNulls
                      type="monotone" 
                      dataKey={key} 
                      stroke={colors[idx % colors.length]} 
                      strokeWidth={2}
                      dot={{r: 3}}
                      activeDot={{r: 6}}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-2">직무 유형별 평가 분포</h3>
              <p className="text-sm text-gray-500 mb-6">각 직무 유형에서 1~5점 평가가 얼마나 나왔는지 보여줍니다.</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend />
                    {[1, 2, 3, 4, 5].map((score, idx) => (
                       <Bar 
                         key={score} 
                         dataKey={`score${score}`} 
                         name={`${score}점`} 
                         stackId="a" 
                         fill={scoreColors[idx]} 
                         barSize={30}
                       />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-2">직무별 평균 수행 점수</h3>
              <p className="text-sm text-gray-500 mb-6">어떤 직무에서 훈련생들이 가장 높은 성과를 보였는지 순위입니다.</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jobRankingData} margin={{ top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} />
                    <YAxis domain={[0, 5]} />
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      formatter={(value: number) => [`${value}점`, '평균 점수']}
                    />
                    <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {jobRankingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.avg >= 4 ? '#10B981' : entry.avg >= 3 ? '#6366f1' : '#F59E0B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Print Header for Individual */}
          <div className="hidden no-print block-on-print-window mb-6 border-b pb-4">
             <h1 className="text-2xl font-bold">개인별 직무 훈련 분석 리포트</h1>
             <p className="text-sm text-gray-500">출력일: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Individual Analysis Content */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-1/3 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">분석할 이용인 선택</label>
                <div className="relative">
                  <select 
                    value={selectedTraineeId}
                    onChange={e => setSelectedTraineeId(e.target.value)}
                    className="w-full p-2.5 pl-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700"
                  >
                    <option value="">이용인을 선택하세요</option>
                    {availableTrainees.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.disabilityType})</option>
                    ))}
                  </select>

                  {/* Print-Only Static Text (Replaces Select box in print view) */}
                  <div className="print-only-info hidden">
                     <div className="text-lg font-bold text-indigo-900 border-b border-indigo-200 pb-2">
                       {selectedTraineeInfo?.name || '미선택'} <span className="text-sm text-gray-500 font-normal">({selectedTraineeInfo?.disabilityType})</span>
                     </div>
                  </div>
                </div>
              </div>
              
              {selectedTraineeInfo && (
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <div className="flex items-start gap-2 mb-1">
                    <Target size={16} className="text-indigo-600 mt-0.5" />
                    <span className="text-xs font-bold text-indigo-800">개별 훈련 목표</span>
                  </div>
                  <p className="text-sm text-gray-800 mb-1 font-medium">{selectedTraineeInfo.trainingGoal || '설정된 목표가 없습니다.'}</p>
                  <p className="text-xs text-indigo-600">목표 점수: {selectedTraineeInfo.targetScore ? `${selectedTraineeInfo.targetScore}점` : '미설정'}</p>
                </div>
              )}
            </div>

            {individualData && individualData.count > 0 ? (
              <div className="flex-1 w-full grid grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-3 rounded-lg text-center border border-indigo-100">
                  <div className="text-xs text-indigo-500 font-semibold uppercase">총 훈련 횟수</div>
                  <div className="text-xl font-bold text-indigo-900">{individualData.count}회</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg text-center border border-emerald-100">
                  <div className="text-xs text-emerald-500 font-semibold uppercase">평균 수행도</div>
                  <div className="text-xl font-bold text-emerald-900">{individualData.avgScore}점</div>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg text-center border border-amber-100">
                  <div className="text-xs text-amber-500 font-semibold uppercase">최고 점수</div>
                  <div className="text-xl font-bold text-amber-900">{individualData.maxScore}점</div>
                </div>
              </div>
            ) : (
                <div className="flex-1 text-center text-gray-400 text-sm">
                   해당 기간에 훈련 데이터가 없습니다.
                </div>
            )}
          </div>

          {selectedTraineeId && individualData && individualData.count > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Line Chart: History */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">개인 수행도 변화 추이</h3>
                    <p className="text-sm text-gray-500 mb-6">{selectedTraineeInfo?.name}님의 날짜별 훈련 점수 변화입니다.</p>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={individualData.history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} />
                          <YAxis domain={[0, 5]} hide />
                          <Tooltip 
                             content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
                                      <p className="font-bold mb-1">{label}</p>
                                      <p className="text-indigo-600 font-semibold">{data.jobTitle}: {data.score}점</p>
                                      {data.note && <p className="text-gray-500 text-xs mt-1 max-w-[200px]">{data.note}</p>}
                                    </div>
                                  );
                                }
                                return null;
                             }}
                          />
                          {selectedTraineeInfo?.targetScore && (
                            <ReferenceLine 
                              y={selectedTraineeInfo.targetScore} 
                              label={{ value: '목표 점수', position: 'insideTopRight', fill: '#ef4444', fontSize: 12 }} 
                              stroke="#ef4444" 
                              strokeDasharray="3 3" 
                            />
                          )}
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#4F46E5" 
                            strokeWidth={3}
                            dot={{r: 4, fill: '#4F46E5', strokeWidth: 0}}
                            activeDot={{r: 6}}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Bar Chart: By Job */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">직무별 평균 수행도</h3>
                    <p className="text-sm text-gray-500 mb-6">{selectedTraineeInfo?.name}님이 강점을 보이는 직무입니다.</p>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={individualData.byJob} layout="vertical" margin={{ left: 20 }}>
                           <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                           <XAxis type="number" domain={[0, 5]} hide />
                           <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                           <Tooltip 
                             cursor={{fill: '#f3f4f6'}}
                             formatter={(value: number) => [`${value}점`, '평균 점수']}
                           />
                           <Bar dataKey="avg" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={24}>
                             {individualData.byJob.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.avg >= 4 ? '#10B981' : entry.avg >= 3 ? '#8B5CF6' : '#F59E0B'} />
                             ))}
                           </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
              </div>
              
              {/* Recent History Table */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4">최근 훈련 이력 상세 (선택 기간)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3">날짜</th>
                        <th className="px-4 py-3">직무</th>
                        <th className="px-4 py-3 text-center">점수</th>
                        <th className="px-4 py-3">평가 내용 (특이사항)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {individualData.history.slice().reverse().slice(0, 10).map((log, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{log.date}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{log.jobTitle}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              log.score >= 4 ? 'bg-green-100 text-green-700' : 
                              log.score <= 2 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {log.score}점
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{log.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {individualData.history.length === 0 && (
                    <div className="p-8 text-center text-gray-400">데이터가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
               <Search size={48} className="mb-4 opacity-20" />
               <p>{selectedTraineeId ? '선택한 기간에 해당 이용인의 훈련 기록이 없습니다.' : '상단에서 분석할 이용인을 선택해주세요.'}</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};
