
import { GoogleGenAI } from "@google/genai";

// Vercel 서버리스 함수 환경 설정
export const config = {
  maxDuration: 60, // AI 연산 시간을 고려하여 60초까지 허용
};

/**
 * Gemini AI API를 서버 측에서 호출하는 프록시 함수입니다.
 * 브라우저에 API KEY가 노출되지 않도록 서버 측 환경 변수(API_KEY)를 사용합니다.
 */
export default async function handler(req: any, res: any) {
  // POST 요청만 처리하여 보안성을 확보합니다.
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: '허용되지 않는 요청 방식입니다.' 
    });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ 
      status: 'error', 
      message: '요약 데이터가 누락되었습니다.' 
    });
  }

  // 시스템 지침에 따라 process.env.API_KEY를 사용하여 인스턴스를 초기화합니다.
  // @ts-ignore: Vercel 환경에서 process.env가 런타임에 주입됨을 보장함
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      status: 'error', 
      message: '서버 환경 변수(API_KEY)가 설정되지 않았습니다.' 
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // 텍스트 요약 및 분석에 최적화된 gemini-3-flash-preview 모델 사용
    // 시스템 지침에 따라 ai.models.generateContent를 직접 호출
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return res.status(200).json({ 
      status: 'success', 
      text: response.text 
    });
  } catch (error: any) {
    console.error('Gemini Serverless API Error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      details: error.message 
    });
  }
}
