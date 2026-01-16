import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  const apiKey = (import.meta as any).env?.VITE_API_KEY || 
                 (import.meta as any).env?.API_KEY || 
                 (typeof process !== 'undefined' ? process.env?.API_KEY : "");
  
  if (!apiKey) {
    console.error("API_KEY is missing.");
    return {
      aiInsight: `${name}님, 죄송합니다. 현재 AI 분석용 API 키가 인식되지 않고 있습니다. Vercel 대시보드에서 'VITE_API_KEY' 등록을 확인해주세요.`,
      recommendations: ["VITE_API_KEY 환경변수 확인", "Redeploy 실행"]
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // 날짜 정렬 및 기간 계산
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const startDate = sortedLogs[0]?.timestamp;
  const endDate = sortedLogs[sortedLogs.length - 1]?.timestamp;
  
  // 총 기간(일수) 계산
  const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const logSummary = logs.map(l => 
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 강도: ${l.intensity}/10, 심박수: ${l.duration}BPM, 컨디션: ${l.condition}`
  ).join('\n');

  const prompt = `당신은 'Good morning song-do (굿모닝송도)' 러닝 클럽의 수석 데이터 분석 코치입니다.
회원 '${name}'님의 훈련 데이터를 분석하여 리포트를 작성하세요.

[핵심 데이터 개요]
- 분석 대상 기간: ${startDate} ~ ${endDate} (총 ${diffDays}일간)
- 해당 기간 내 실제 훈련 횟수: ${logs.length}회
- 훈련 밀도: 약 ${(logs.length / (diffDays / 7)).toFixed(1)}회/주

[분석 지침]
1. '분석 대상 기간'과 '실제 훈련 횟수'를 대조하여 정확한 코멘트를 작성하세요. 
   (예: 30일 동안 4회 훈련했다면 "한 달간 꾸준히 주 1회 참여하셨네요"라고 언급하고, 7일 동안 4회라면 "매우 고밀도로 집중 훈련하셨네요"라고 구분)
2. 절대 실제 기간보다 부풀려 말하지 마세요 (예: 4회 훈련을 4주간의 훈련이라고 일반화 금지).
3. 전문적이면서도 격려하는 톤을 유지하세요. (~해요, ~입니다 사용)

[세부 훈련 데이터 기록]\n${logSummary}`;

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
      aiInsight: `${name}님, 최근 훈련 기간 동안의 데이터를 분석 중입니다. 꾸준한 참여가 가장 큰 자산입니다.`,
      recommendations: ["일관된 훈련 빈도 유지", "심박수 기반의 페이스 조절", "충분한 회복 시간 확보"]
    };
  }
};
