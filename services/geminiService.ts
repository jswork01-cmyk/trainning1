
import { GoogleGenAI } from "@google/genai";
import { DailyLog, JobTask, Trainee, EVALUATION_CRITERIA } from "../types";

// API 키를 관리하는 함수
const getApiKey = () => {
  // ------------------------------------------------------------------
  // [직접 입력] API 키를 코드에 직접 넣으려면 아래 따옴표 안에 키를 입력하세요.
  // 예: const MANUAL_API_KEY = "AIzaSy...";
  // 주의: 코드를 공개 저장소(GitHub 등)에 올릴 경우 키가 노출될 수 있습니다.
  // ------------------------------------------------------------------
  const MANUAL_API_KEY = "AIzaSyDHKhVukZNDgEp79_ODU-8d4yk9Ufc-tv0"; 

  if (MANUAL_API_KEY) return MANUAL_API_KEY;

  try {
    // Vercel 환경 변수에서 가져오기 (배포 환경용)
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

export const generateDailyReport = async (
  date: string,
  job: JobTask,
  evaluations: { trainee: Trainee; score: number; note: string }[],
  weather: string,
  customInstruction?: string // 직무별 특별 지침 (구글 시트 B열 연동)
): Promise<string> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return "API Key가 설정되지 않았습니다. services/geminiService.ts 파일의 MANUAL_API_KEY에 키를 입력하거나, 환경 변수를 확인해주세요.";
  }

  // Create instance only when needed to prevent app crash on startup if key is missing
  const ai = new GoogleGenAI({ apiKey });

  // Calculate stats
  const total = evaluations.length;
  const avgScore = (evaluations.reduce((acc, curr) => acc + curr.score, 0) / total).toFixed(1);

  // Prepare detailed list for the prompt
  const detailList = evaluations.map(e => 
    `- ${e.trainee.name} (${e.trainee.disabilityType}): 점수 ${e.score}/5. 특이사항: ${e.note || '없음'}`
  ).join('\n');

  // Handle custom instruction text with high visibility for the model
  // 시스템 기본 설정보다 우선순위를 높이기 위해 가장 강력한 어조 사용 및 상단 배치
  const instructionSection = customInstruction 
    ? `
    [🚨 SYSTEM OVERRIDE: 최우선 적용 지침]
    (주의: 아래의 '특별 지침'은 이 프롬프트의 다른 어떤 '요청 사항'이나 '기본 설정'보다 우선합니다. 
    만약 기본 규칙과 충돌할 경우, 무조건 아래 지침을 따르세요.)
    
    👉 특별 지침: "${customInstruction}"
    `
    : '';

  const prompt = `
    당신은 장애인보호작업장의 전문 직업훈련교사입니다. 아래 데이터를 바탕으로 훈련일지 총평을 작성해야 합니다.

    ${instructionSection}
    
    [훈련 데이터]
    - 날짜: ${date}
    - 날씨: ${weather}
    - 훈련 직무: ${job.title} (${job.description})
    - 참여 인원: ${total}명
    - 평균 수행도: ${avgScore} / 5.0
    
    [개별 평가 데이터]
    ${detailList}

    [평가 기준 참고]
    - 1~2점: 집중적인 지도가 필요한 상태
    - 3점: 보통 수준
    - 4~5점: 독립적이고 우수한 수행
    
    [작성 요청 사항 (Default Rules)]
    0. [중요] 상단에 제시된 '최우선 적용 지침'이 있다면, 그 내용을 글의 핵심 주제로 삼아 작성하십시오.
    1. 전체적인 훈련 분위기와 성과를 요약해주세요.
    2. 훈련프로그램 전에 동료와 인사를 나누고 직무관련 안전교육을 실시한 내용을 포함하세요.
    3. 특별히 수행도가 높거나(4-5점) 낮아서(1-2점) 개입이 필요했던 사례를 구체적으로 묘사하되, 전문적이고 격려하는 어조를 유지하세요.
    4. 내일 훈련을 위한 제언을 한 문장 포함해주세요.
    5. 글자 수는 공백 포함 300~500자 내외로 작성해주세요.
    6. 경어체(습니다)를 사용해주세요.
    7. 구글시트 연동이나 시스템, AI에 대한 언급은 절대 하지 마세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "요약 생성에 실패했습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 서비스 연결 중 오류가 발생했습니다. API 키를 확인해주세요.";
  }
};