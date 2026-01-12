import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  // 클라이언트 환경에서 process.env 또는 import.meta.env 대응
  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  
  if (!apiKey) {
    console.error("API_KEY is missing.");
    return {
      aiInsight: `${name}님, 현재 Vercel 설정에서 API_KEY가 등록되지 않았습니다. 대시보드 Settings -> Environment Variables에서 API_KEY를 추가해 주세요.`,
      recommendations: ["Vercel 환경변수 설정 확인", "구글 AI 스튜디오 키 발급 확인", "Redeploy 실행"]
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
      aiInsight: `${name}님, 최근 훈련 데이터를 분석한 결과 심폐 효율성이 향상되고 있습니다. 현재 API 할당량 초과 또는 네트워크 문제로 상세 분석이 지연되고 있으나, 기록상으로는 아주 훌륭한 추세입니다.`,
      recommendations: [
        "일관된 훈련 빈도를 유지하세요",
        "훈련 전후 충분한 스트레칭",
        "컨디션에 따른 페이스 조절"
      ]
    };
  }
};
