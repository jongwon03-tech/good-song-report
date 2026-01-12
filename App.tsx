import React, { useState, useMemo, useEffect } from 'react';
import { getMemberFeedback } from './services/geminiService';
import { TrainingLog } from './types';
import Papa from 'papaparse';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Search, Activity, Loader2, User, BrainCircuit, Calendar, TrendingUp, RefreshCw, AlertCircle, Heart, Quote, Zap } from 'lucide-react';

const SHEET_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTL-7osicYdHztOycmQngj3FA4NU56okNHSg0q7lqlfBeb9oL73mPqxcRB8oKfe2QigzGsuk3xVPeNj/pub?output=csv`;

const App: React.FC = () => {
  const [trainingData, setTrainingData] = useState<TrainingLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ aiInsight: string, recommendations: string[] } | null>(null);

  const fetchData = async () => {
    setFetchingData(true);
    setError(null);
    try {
      const response = await fetch(`${SHEET_URL}&t=${Date.now()}`);
      if (!response.ok) throw new Error("데이터를 불러올 수 없습니다.");
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const mappedData: TrainingLog[] = results.data.map((row: any) => {
            const name = (row['이름 (필수)(*)'] || row['이름'] || '').trim();
            const trainingType = row['오늘 달린거리는?(*)'] || '러닝';
            const intensityKey = Object.keys(row).find(k => k.includes('보강훈련 강도')) || 'intensity';
            const intensity = parseInt(row[intensityKey]) || 0;
            const heartRateKey = Object.keys(row).find(key => key.includes('평균 심박수')) || 'duration';
            const avgHeartRate = parseInt(row[heartRateKey]?.toString().replace(/[^0-9]/g, '')) || 0;
            const timestamp = (row['응답일시'] || '').split(' ')[0] || '';
            const conditionScore = parseInt(row['컨디션 체크(*)']) || 3;
            const notes = row['굿송에게 바란다.'] || row['메모'] || '';

            const conditionMapping: Record<number, TrainingLog['condition']> = {
              5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Poor'
            };

            return { 
              timestamp, name, trainingType, intensity, duration: avgHeartRate, notes, 
              condition: conditionMapping[conditionScore] || 'Good'
            };
          }).filter(item => item.name !== "");
          
          setTrainingData(mappedData);
          setFetchingData(false);
        }
      });
    } catch (err) {
      setError("연결 실패");
      setFetchingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredLogs = useMemo(() => {
    if (!selectedMember) return [];
    return trainingData.filter(log => log.name === selectedMember)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedMember, trainingData]);

  const handleSearch = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const found = trainingData.find(l => l.name.includes(trimmed));
    if (!found) return alert("회원을 찾을 수 없습니다.");

    setLoading(true);
    setSelectedMember(found.name);
    const feedback = await getMemberFeedback(found.name, trainingData.filter(l => l.name === found.name));
    setAiFeedback(feedback);
    setLoading(false);
  };

  if (fetchingData) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center gap-2 font-black italic uppercase tracking-tighter">
          <Activity className="text-indigo-600" /> Good morning song-do
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <div className="relative mb-12 shadow-2xl rounded-full overflow-hidden border bg-white mt-10">
          <input 
            className="w-full p-6 pl-8 pr-20 outline-none font-bold text-lg"
            placeholder="회원 이름을 입력하세요"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
          />
          <button onClick={() => handleSearch(searchTerm)} className="absolute right-4 top-4 bg-indigo-600 text-white p-3 rounded-full">
            {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
          </button>
        </div>

        {selectedMember && !loading && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="text-3xl font-black mb-4">{selectedMember}님 분석 보고서</h2>
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 italic font-bold text-indigo-900">
                "{aiFeedback?.aiInsight}"
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {aiFeedback?.recommendations.map((rec, i) => (
                <div key={i} className="bg-slate-900 text-white p-6 rounded-2xl flex gap-3">
                  <Zap className="text-amber-400 shrink-0" />
                  <p className="text-sm font-bold">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;