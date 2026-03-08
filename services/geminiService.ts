import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[], stravaSummary?: any) => {
  const apiKey = (import.meta as any).env?.VITE_API_KEY || 
                 (import.meta as any).env?.API_KEY || 
                 (typeof process !== 'undefined' ? process.env?.API_KEY : "");
  
  if (!apiKey) {
    console.error("API_KEY is missing.");
    return {
      stravaAnalysis: "API 키 설정이 필요합니다.",
      coachingAnalysis: `${name}님, 죄송합니다. 현재 AI 분석용 API 키가 인식되지 않고 있습니다.`,
      recommendations: ["API_KEY 환경변수 확인"]
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const logSummary = logs.filter(l => l.source !== 'Strava').map(l => 
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 강도: ${l.intensity}/10, 심박수: ${l.duration}BPM, 컨디션: ${l.condition}`
  ).join('\n');

  const stravaContext = stravaSummary ? `
Strava 데이터:
- 거리: ${stravaSummary.distance}, 페이스: ${stravaSummary.pace}, 최장거리: ${stravaSummary.longest}, 고도: ${stravaSummary.elevation}, 횟수: ${stravaSummary.runs}
` : "Strava 연동 정보 없음";

  const prompt = `너는 'GSRC' 러닝클럽의 AI 코치야. 다음 데이터를 분석해 JSON으로 응답해줘.
회원명: ${name}
${stravaContext}
출석기록:
${logSummary}

[지침]
1. Strava 데이터(특히 횟수)를 최우선 신뢰할 것.
2. stravaAnalysis: Strava 데이터 기반 상세 분석 (없으면 '정보 없음').
3. coachingAnalysis: 전체 데이터 기반 2~3문단 코칭.
4. recommendations: 3가지 권장사항 배열.
5. 친절하고 전문적인 한국어로 작성.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stravaAnalysis: { type: Type.STRING },
            coachingAnalysis: { type: Type.STRING },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            }
          },
          required: ["stravaAnalysis", "coachingAnalysis", "recommendations"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    // Retry once if it's a transient error or timeout
    try {
      const retryResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json"
        }
      });
      return JSON.parse(retryResponse.text || "{}");
    } catch (retryError) {
      return {
        stravaAnalysis: "데이터 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        coachingAnalysis: `${name}님, 현재 분석 서버 부하로 인해 상세 코칭이 지연되고 있습니다. 꾸준한 러닝을 응원합니다!`,
        recommendations: ["잠시 후 다시 검색하기", "Strava 데이터 확인", "꾸준한 훈련 유지"]
      };
    }
  }
};
