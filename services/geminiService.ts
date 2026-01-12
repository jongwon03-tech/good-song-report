import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  // 반드시 process.env.API_KEY를 직접 사용해야 합니다.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const logSummary = logs.map(l => 
    `- ${l.timestamp}: ${l.trainingType}, 보강강도:${l.intensity}, 평균심박수:${l.duration}BPM, 컨디션:${l.condition}, 메모:${l.notes}`
  ).join('\n');

  const prompt = `
    역할: 당신은 'Good morning song-do'의 전문 러닝 코치입니다. 
    대상: 훈련을 마친 회원 '${name}'님에게 분석 결과와 격려를 전달해야 합니다.
    말투: 전문적이면서도 따뜻한 코치의 말투를 사용하세요.
    데이터: ${logSummary}
  `;

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
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            }
          },
          required: ["aiInsight", "recommendations"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      aiInsight: "코치입니다. 현재 분석 시스템에 지연이 발생하고 있지만 기록해주신 데이터를 보니 아주 훌륭하게 훈련을 소화하셨네요!",
      recommendations: ["일관된 훈련 페이스 유지하기", "충분한 수분 섭취와 휴식", "훈련 후 스트레칭 10분"]
    };
  }
};
