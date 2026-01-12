import { GoogleGenAI, Type } from "@google/genai";
import { TrainingLog } from "../types";

export const getMemberFeedback = async (name: string, logs: TrainingLog[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const logSummary = logs.map(l => 
    `- 일자: ${l.timestamp}, 훈련: ${l.trainingType}, 훈련강도: ${l.intensity}/10, 심박수: ${l.duration}BPM, 비고: ${l.notes}, 컨디션: ${l.condition}`
  ).join('\n');

  const prompt = `당신은 'Good morning song-do (굿모닝송도)' 러닝 클럽의 수석 데이터 분석 코치입니다.
회원 '${name}'님의 최근 훈련 데이터를 기반으로 매우 구체적이고 전문적인 성과 보고서를 작성하세요.

[분석 지침]
1. 데이터 패턴 파악: 단순히 나열하지 말고, "훈련강도가 올라갈 때 심박수가 어떻게 반응하는지", "메모에 적힌 피로도가 컨디션 점수와 일치하는지" 등을 분석하세요.
2. aiInsight 작성: 
   - 첫 문장은 반드시 회원의 이름을 부르며 따뜻하게 시작하세요.
   - 데이터에서 발견된 특이점이나 칭찬할 점을 구체적으로 언급하세요. (예: "지난 수요일 대비 강도를 높였음에도 심박수가 안정적인 점이 인상적입니다")
   - 단순한 응원을 넘어 전문적인 코칭 조언을 포함하세요.
   - 전문적이면서도 열정적인 톤을 유지하세요. (~해요, ~입니다 사용)
3. recommendations 작성: 분석 내용을 기반으로 내일부터 당장 실천할 수 있는 구체적인 가이드라인 3가지를 제시하세요.

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
            aiInsight: { 
              type: Type.STRING,
              description: "데이터 분석을 포함한 코치 소견"
            },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "실천 가능한 3가지 제언"
            }
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
      aiInsight: `${name}님, 최근 훈련 데이터를 세밀하게 분석하고 있습니다. 전반적으로 꾸준한 페이스를 보여주고 계신데, 곧 더 구체적인 분석 결과를 전달해 드릴게요!`,
      recommendations: [
        "일관된 훈련 빈도를 유지하여 심폐 지구력 강화하기",
        "훈련 전후 15분 이상의 충분한 동적/정적 스트레칭 수행",
        "컨디션 점수가 낮은 날은 회복주(Recovery Run) 위주로 편성"
      ]
    };
  }
};