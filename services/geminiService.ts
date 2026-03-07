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
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 강도: ${l.intensity}/10, 평균 심박수: ${l.duration}BPM, 최대 심박수: ${l.maxHeartRate || '미기록'}BPM, 컨디션: ${l.condition}`
  ).join('\n');

  const maxHR = Math.max(...logs.map(l => l.maxHeartRate || 0));
  const zone2 = { min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7) };
  const zone4 = { min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9) };

  const prompt = `당신은 'Good morning song-do (굿모닝송도)' 러닝 클럽의 수석 데이터 분석 코치입니다.
회원 '${name}'님의 훈련 데이터를 분석하여 리포트를 작성하세요.

우리 클럽은 '양극화 8:2 훈련'을 지향합니다. 
- 주중: 존 2(Zone 2) 심박수 영역에서의 저강도 조깅 (전체 훈련의 80%)
- 합동 훈련/고강도: 존 4(Zone 4) 심박수 이상의 고강도 훈련 (전체 훈련의 20%)

[회원 심박수 정보]
- 최대 심박수: ${maxHR > 0 ? `${maxHR} BPM` : '기록 없음 (기본값 185 사용 권장)'}
- 권장 존 2 (조깅): ${zone2.min} ~ ${zone2.max} BPM
- 권장 존 4 (고강도): ${zone4.min} ~ ${zone4.max} BPM 이상

[핵심 데이터 개요]
- 분석 대상 기간: ${startDate} ~ ${endDate} (총 ${diffDays}일간)
- 해당 기간 내 실제 훈련 횟수: ${logs.length}회
- 훈련 밀도: 약 ${(logs.length / (diffDays / 7)).toFixed(1)}회/주

[분석 지침]
1. '분석 대상 기간'과 '실제 훈련 횟수'를 대조하여 정확한 코멘트를 작성하세요. 
2. 클럽의 '8:2 양극화 훈련' 원칙에 비추어 회원의 심박수 데이터를 분석하고 조언하세요.
   - 평균 심박수가 너무 높다면(존 3에 머무름) 조깅 시 더 천천히 뛸 것을 권장하세요.
   - 고강도 훈련 시 심박수가 충분히 올라가지 않는다면 더 도전적인 훈련을 권장하세요.
3. 전문적이면서도 격려하는 톤을 유지하세요. (~해요, ~입니다 사용)
4. 가독성을 위해 내용을 2~3개의 문단으로 나누어 작성하세요. 문단 사이에는 반드시 실제 줄바꿈(Enter)을 두 번 넣어 구분하세요.
5. 각 문장은 핵심 내용을 담아 간결하게 작성하고, 한글 단어가 중간에 끊기지 않도록 단어 단위로 문장을 구성하세요.

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