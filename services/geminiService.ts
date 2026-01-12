import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const logSummary = logs.map(l => 
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 강도: ${l.intensity}/10, 심박수: ${l.duration}BPM, 비고: ${l.notes}`
  ).join('\n');

  const prompt = `당신은 'Good morning song-do'의 전문 코치입니다. 회원 '${name}'님의 데이터를 분석해 코멘트(aiInsight)와 3가지 제안(recommendations)을 주세요. 데이터:\n${logSummary}`;

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
      aiInsight: "꾸준한 훈련이 인상적입니다. 현재 데이터 기반 코칭 시스템을 최적화 중이니 잠시만 기다려주세요!",
      recommendations: ["일관된 페이스 유지", "충분한 수분 섭취", "훈련 후 스트레칭"]
    };
  }
};
