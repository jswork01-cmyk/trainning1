
import { JobTask, Trainee } from "../types";

/**
 * 직업재활 훈련 데이터를 바탕으로 AI 전문 총평을 생성합니다.
 * Vercel Serverless Function(/api/chat)을 호출하여 보안을 강화했습니다.
 */
export const generateDailyReport = async (
  date: string,
  job: JobTask,
  evaluations: { trainee: Trainee; score: number; note: string }[],
  weather: string,
  customInstruction?: string
): Promise<string> => {
  
  // 훈련 통계 데이터 산출
  const total = evaluations.length;
  const avgScore = (evaluations.reduce((acc, curr) => acc + curr.score, 0) / (total || 1)).toFixed(1);

  // 이용인별 세부 관찰 기록 정제
  const detailList = evaluations.map(e => 
    `- ${e.trainee.name} (${e.trainee.disabilityType}): 수행 평점 ${e.score}/5. 주요 관찰: ${e.note || '특이사항 없음'}`
  ).join('\n');

  // 직무별 특별 지침(Override) 설정
  const instructionSection = customInstruction 
    ? `\n[🚨 운영 지침 반영]\n👉 특별 요청 사항: "${customInstruction}"\n`
    : '';

  // 직업재활 현장의 전문 용어를 반영한 프롬프트 구성
  const prompt = `
    당신은 장애인보호작업장에서 이용인분들의 직업적 성장을 돕는 전문 직업훈련교사입니다. 아래 데이터를 분석하여 '직업재활 서비스 훈련일지 총평'을 작성해 주세요.

    ${instructionSection}
    
    [훈련 개요]
    - 실시 일자: ${date}
    - 기상 상태: ${weather}
    - 수행 직무: ${job.title} (${job.description})
    - 참여 인원: ${total}명
    - 평균 작업 수행도: ${avgScore} / 5.0
    
    [이용인별 평가 내역]
    ${detailList}

    [작성 시 준수 사항]
    1. 전체적인 훈련 성과와 작업장 분위기를 전문적이고 객관적으로 요약하세요.
    2. 훈련 전 실시한 '직무 안전 교육' 및 이용인 간 '사회성 훈련(인사 나누기)' 내용을 반드시 포함하세요.
    3. 집중적 개입이 필요한 이용인과 자립적 작업이 가능한 이용인의 사례를 균형 있게 다루며, 이용인의 성취를 격려하는 전문적인 어조를 유지하세요.
    4. 내일 훈련의 목표 달성을 위한 제언을 포함해 주세요.
    5. 경어체(습니다)를 사용하고, 분량은 300~500자 내외로 작성하세요.
    6. 'AI', '프롬프트', '시스템' 등 기계적인 표현은 일절 사용하지 마세요.
  `;

  try {
    // 백엔드 API 엔드포인트(/api/chat)를 통한 안전한 통신
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'AI 총평 생성 서버 응답에 실패했습니다.');
    }

    const data = await response.json();
    return data.text || "요약 내용을 생성할 수 없습니다.";
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return `총평 생성 중 오류가 발생했습니다: ${error.message}. 시스템 관리자에게 문의바랍니다.`;
  }
};
