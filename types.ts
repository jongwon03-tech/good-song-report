
export interface TrainingLog {
  timestamp: string;
  name: string;
  trainingType: string;
  intensity: number; // 1-10
  duration: number; // minutes
  notes: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export interface FeedbackSummary {
  playerName: string;
  totalWorkouts: number;
  averageIntensity: number;
  totalDuration: number;
  aiInsight: string;
  recommendations: string[];
}
