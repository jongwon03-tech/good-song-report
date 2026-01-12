
import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  // AI가 duration 필드를 '시간'이 아닌 '심박수'로 인식하도록 라벨 수정
  const logSummary = logs.map(l => 
    `- ${l.timestamp}: ${l.trainingType}, 보강강도:${l.intensity}, 평균심박수:${l.duration}BPM, 컨디션:${l.condition}, 메모:${l.notes}`
  ).join('\n');

  const prompt = `
    역할: 당신은 'Good morning song-do'의 전문 러닝 코치입니다. 
    대상: 훈련을 마친 회원 '${name}'님에게 분석 결과와 격려를 전달해야 합니다.

    주의사항:
    - 말투는 전문적이면서도 따뜻한 코치의 말투를 사용하세요. (예: "~하셨군요", "~를 추천드립니다", "오늘도 고생 많으셨습니다")
    - 절대로 회원이 코치에게 하는 말(예: "고생하셨어요")을 AI가 뱉지 않도록 하세요. 당신은 조언을 주는 '코치'입니다.
    - 데이터 중 '평균심박수'는 훈련 강도를 나타내는 지표이며, 훈련 시간(분)이 아닙니다. 숫자가 높으면 고강도 훈련을 의미합니다.
    
    데이터:
    ${logSummary}

    위 데이터를 바탕으로 다음을 분석하여 한국어로 피드백을 주세요:
    1. [훈련 분석] 평균심박수와 보강강도를 통해 본 현재의 훈련 부하가 적절한지 분석.
    2. [전문 조언] 컨디션과 훈련 종류에 따른 기술적 개선 방향 제시.
    3. [코치의 격려] 회원의 메모에 답하며, 코치로서 건네는 진심 어린 응원 메시지.

    분석 결과는 'aiInsight'에 한 문단으로, 'recommendations'에 코치가 제안하는 3가지 실천 사항으로 정리해주세요.
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
            aiInsight: { type: Type.STRING, description: "코치로서 전하는 전문적인 분석과 격려 한마디" },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "코치가 제안하는 실천 사항 3가지"
            }
          },
          required: ["aiInsight", "recommendations"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      aiInsight: "안녕하세요, 코치입니다. 현재 시스템 점검으로 인해 상세 분석이 어렵지만, 기록해주신 심박수와 컨디션을 보니 꾸준히 잘 해내고 계시네요! 조금만 더 힘내봅시다.",
      recommendations: ["일관된 훈련 페이스 유지하기", "훈련 후 충분한 스트레칭", "수분 섭취와 휴식 챙기기"]
    };
  }
};
