import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  // 1. Vite 환경 변수 우선 확인 (VITE_API_KEY)
  // 2. Node/Vercel 환경 변수 확인 (API_KEY)
  // 3. 마지막으로 전역 process 객체 확인
  const apiKey = (import.meta as any).env?.VITE_API_KEY || 
                 (import.meta as any).env?.API_KEY || 
                 (typeof process !== 'undefined' ? process.env?.API_KEY : "");
  
  if (!apiKey) {
    console.error("API_KEY is missing.");
    return {
      aiInsight: `${name}님, 죄송합니다. 현재 AI 분석용 API 키가 인식되지 않고 있습니다. 
      Vercel 대시보드에서 'VITE_API_KEY'라는 이름으로 키를 등록했는지 확인하고 반드시 'Redeploy'를 해주세요.`,
      recommendations: [
        "Vercel Settings -> Environment Variables에서 'VITE_API_KEY' 추가",
        "Key 이름을 'API_KEY' 대신 'VITE_API_KEY'로 변경 시도",
        "설정 후 Deployments 메뉴에서 'Redeploy' 실행"
      ]
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const logSummary = logs.map(l => 
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 훈련강도: ${l.intensity}/10, 심박수: ${l.duration}BPM, 비고: ${l.notes}, 컨디션: ${l.condition}`
  ).join('\n');

  const prompt = `당신은 'Good morning song-do (굿모닝송도)' 러닝 클럽의 수석 데이터 분석 코치입니다.
회원 '${name}'님의 최근 훈련 데이터를 기반으로 매우 구체적이고 전문적인 성과 보고서를 작성하세요.

[분석 지침]
1. 데이터 패턴 파악: 단순히 나열하지 말고 구체적으로 분석하세요.
2. aiInsight 작성: 전문적이면서도 열정적인 톤을 유지하세요. (~해요, ~입니다 사용)
3. recommendations 작성: 분석 내용을 기반으로 실천 가능한 가이드라인 3가지를 제시하세요.

[훈련 데이터 기록]\n${logSummary}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiInsight: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["aiInsight", "recommendations"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      aiInsight: `${name}님, 데이터를 분석하는 과정에서 일시적인 오류가 발생했습니다. 하지만 기록된 데이터상으로는 꾸준한 훈련 성과가 나타나고 있습니다.`,
      recommendations: [
        "현재 데이터 기록은 정상입니다.",
        "잠시 후 새로고침하여 다시 분석을 요청해 주세요.",
        "꾸준한 훈련은 배신하지 않습니다!"
      ]
    };
  }
};
