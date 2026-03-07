
export interface TrainingLog {
  timestamp: string;
  name: string;
  trainingType: string;
  intensity: number; // 1-10
  duration: number; // average heart rate (BPM)
  maxHeartRate?: number; // maximum heart rate (BPM)
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
