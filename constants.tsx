
import { TrainingLog } from './types';

// 링크된 시트의 구조(성함, 훈련종목, 운동강도, 운동시간, 컨디션, 메모)를 반영한 모의 데이터
export const MOCK_TRAINING_DATA: TrainingLog[] = [
  { timestamp: "2024-05-20", name: "김철수", trainingType: "하체 웨이트", intensity: 8, duration: 80, notes: "스쿼트 100kg 성공, 컨디션 좋음", condition: 'Excellent' },
  { timestamp: "2024-05-21", name: "김철수", trainingType: "인터벌 러닝", intensity: 9, duration: 40, notes: "심박수 170 유지", condition: 'Good' },
  { timestamp: "2024-05-22", name: "김철수", trainingType: "상체 웨이트", intensity: 7, duration: 90, notes: "어깨 통증 약간 있음", condition: 'Fair' },
  { timestamp: "2024-05-20", name: "이영희", trainingType: "요가", intensity: 4, duration: 60, notes: "유연성 향상 집중", condition: 'Excellent' },
  { timestamp: "2024-05-23", name: "이영희", trainingType: "필라테스", intensity: 6, duration: 50, notes: "코어 근육 활성화", condition: 'Good' },
  { timestamp: "2024-05-21", name: "박지성", trainingType: "축구 전술 훈련", intensity: 10, duration: 120, notes: "고강도 스프린트 반복", condition: 'Good' },
  { timestamp: "2024-05-24", name: "박지성", trainingType: "회복 훈련", intensity: 2, duration: 30, notes: "가벼운 스트레칭", condition: 'Excellent' },
  { timestamp: "2024-05-25", name: "최민지", trainingType: "수영", intensity: 7, duration: 50, notes: "자유형 1km", condition: 'Good' },
  { timestamp: "2024-05-26", name: "최민지", trainingType: "웨이트", intensity: 6, duration: 60, notes: "데드리프트 자세 교정", condition: 'Fair' }
];
