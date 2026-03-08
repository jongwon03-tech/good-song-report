import { GoogleGenAI, Type } from "@google/genai";
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
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 강도: ${l.intensity}/10, 평균 심박수: ${l.duration}BPM, 최대 심박수: ${l.maxHeartRate || '미기록'}BPM, 컨디션: ${l.condition}`
  ).join('\n');

  const stravaContext = stravaSummary ? `
Strava 데이터 - 금주 수집 데이터 기준 -
- 총 거리(distance): ${stravaSummary.distance}
- 평균 페이스(avg_pace): ${stravaSummary.pace}
- 최장 거리(longest): ${stravaSummary.longest}
- 획득 고도(elev_gain): ${stravaSummary.elevation}
- 이번 주 뛴 횟수(runs): ${stravaSummary.runs}
` : "Strava 연동 정보가 없습니다.";

  const prompt = `[역할 정의]
너는 '굿모닝 송도 러닝클럽(GSRC)'의 전문 AI 코치야. 제공된 구글 시트의 데이터를 통합 분석하여, 회원별 개인 맞춤형 러닝 분석 리포트를 작성해줘.

[데이터 우선순위]
1. Strava 데이터: 본인 시계에서 자동으로 수집된 데이터이므로 가장 정확도가 높음. 특히 '이번 주 뛴 횟수(runs)'는 출석 데이터보다 Strava 데이터를 최우선 기준으로 삼아야 함.
2. 출석데이터: 매주 토요일 정규훈련에 참석한 사람이 직접 기재한 데이터.

[분석 및 리포트 작성 지침]
1. Strava 연동 심화 분석 (최우선):
   - Strava 데이터가 있는 회원은 반드시 'Strava 데이터 - 금주 수집 데이터 기준 -' 내용을 바탕으로 분석을 진행해.
   - 출석 데이터의 심박수/강도 정보와 Strava의 실제 주행 거리/페이스를 결합하여 입체적으로 분석해.
2. 기본 AI 코치 분석 (출석 기반):
   - 각 회원의 출석 빈도, 최근 훈련 성실도, 기록 변화를 분석하여 코칭 메시지를 작성해줘.
   - 전문적이고 격려하는 말투를 사용해. (~해요, ~입니다)

[출력 형식]
반드시 아래 JSON 필드에 맞춰 작성해:
1. stravaAnalysis: Strava 데이터가 있는 경우 'Strava 데이터 - 금주 수집 데이터 기준 -' 내용을 포함하여 상세 분석 작성. 없을 경우 'Strava 연동 정보가 없습니다'라고 작성.
2. coachingAnalysis: 출석 데이터 기반 분석 리포트 - 2~3문단으로 구성. (정규훈련 데이터 기반 코칭)
3. recommendations: 3가지 핵심 권장 사항 (배열 형태)

[특이 사항]
- 데이터를 매칭할 때 이름의 띄어쓰기나 대소문자 차이가 있을 수 있으니 유연하게 매칭해줘.
- 분석이 완료되면 마지막에 해당 회원의 상태를 요약해줘.

[입력 데이터]
회원명: ${name}
${stravaContext}

[출석부 기록]
${logSummary}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stravaAnalysis: { 
              type: Type.STRING,
              description: "Strava 데이터 기반 상세 분석 내용 (이번주 내용기반)"
            },
            coachingAnalysis: { 
              type: Type.STRING,
              description: "Strava 훈련 빈도(횟수)와 정규훈련 데이터를 결합한 전반적인 러닝 성향 기반 코칭 내용"
            },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3가지 핵심 권장 사항"
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
    return {
      stravaAnalysis: "데이터 분석 중 오류가 발생했습니다.",
      coachingAnalysis: `${name}님, 최근 훈련 기간 동안의 데이터를 분석 중입니다. 꾸준한 참여가 가장 큰 자산입니다.`,
      recommendations: ["일관된 훈련 빈도 유지", "심박수 기반의 페이스 조절", "충분한 회복 시간 확보"]
    };
  }
};
