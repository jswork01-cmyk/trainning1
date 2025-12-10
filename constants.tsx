
import { JobTask, Trainee, Employee } from "./types";

// Removed default mock jobs as requested
export const MOCK_JOBS: JobTask[] = [];

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 'e-1', name: '박동호', position: '직업훈련교사', email: 'staff@center.com', password: '1234' },
  { id: 'e-2', name: '김중진', position: '직업훈련교사', email: 'lee@center.com', password: '1234' },
  { id: 'e-3', name: '김남진', position: '사무국장', email: 'manager@center.com', password: '1234' },
  { id: 'e-4', name: '권오건', position: '원장', email: 'director@center.com', password: '1234' },
];

export const MOCK_TRAINEES: Trainee[] = Array.from({ length: 40 }, (_, i) => ({
  id: `t-${i + 1}`,
  name: `이용인 ${i + 1}`,
  disabilityType: i % 3 === 0 ? '지적장애' : i % 3 === 1 ? '자폐성장애' : '기타',
  memo: '',
  jobRole: '', // Removed dependency on MOCK_JOBS
  workLocation: i % 2 === 0 ? '1층' : '2층',
  residenceType: i % 4 === 0 ? '시설' : '재가',
  employmentType: i % 5 === 0 ? '근로' : '훈련',
  phone: `010-${1000 + i}-${2000 + i}`,
  trainingGoal: i % 3 === 0 ? '작업 속도 향상 및 이석 줄이기' : i % 3 === 1 ? '동료와 협동하여 작업하기' : '작업 순서 암기 및 독립적 수행',
  targetScore: i % 3 === 0 ? 4 : i % 3 === 1 ? 3 : 5
}));

export const WEATHER_OPTIONS = ['맑음', '흐림', '비', '눈'];
