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
            // 구글 시트의 실제 헤더 이름을 기반으로 맵핑
            const name = (row['이름 (필수)(*)'] || row['이름'] || '').trim();
            const trainingType = row['오늘 달린거리는?(*)'] || '러닝';
            
            // 강도 컬럼명 대응
            const intensityKey = Object.keys(row).find(k => k.includes('보강훈련 강도')) || 'intensity';
            const intensity = parseInt(row[intensityKey]) || 0;
            
            // 심박수 컬럼명 대응
            const heartRateKey = Object.keys(row).find(key => key.includes('평균 심박수')) || 'duration';
            const avgHeartRate = parseInt(row[heartRateKey]?.toString().replace(/[^0-9]/g, '')) || 0;
            
            const timestamp = (row['응답일시'] || '').split(' ')[0] || '';
            const conditionScore = parseInt(row['컨디션 체크(*)']) || 3;
            const notes = row['굿송에게 바란다.'] || row['메모'] || '';

            const conditionMapping: Record<number, TrainingLog['condition']> = {
              5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Poor'
            };

            return { 
              timestamp, 
              name, 
              trainingType, 
              intensity, 
              duration: avgHeartRate, 
              notes, 
              condition: conditionMapping[conditionScore] || 'Good'
            };
          }).filter(item => item.name !== "");
          
          if (mappedData.length === 0) {
            setError("데이터가 비어있습니다. 시트 설정을 확인해주세요.");
          } else {
            setTrainingData(mappedData);
          }
          setFetchingData(false);
        },
        error: () => {
          setError("CSV 파싱 중 오류가 발생했습니다.");
          setFetchingData(false);
        }
      });
    } catch (err) {
      setError("연결 실패. 인터넷 상태나 시트 공유 설정을 확인해주세요.");
      setFetchingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = useMemo(() => {
    if (!selectedMember) return [];
    return trainingData.filter(log => log.name === selectedMember)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedMember, trainingData]);

  const stats = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const hrs = filteredLogs.map(l => l.duration).filter(h => h > 0);
    const avgHR = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
    const ints = filteredLogs.map(l => l.intensity).filter(i => i > 0);
    const avgInt = ints.length > 0 ? (ints.reduce((a, b) => a + b, 0) / ints.length).toFixed(1) : "0.0";

    return { total: filteredLogs.length, avgHR, avgInt };
  }, [filteredLogs]);

  const handleSearch = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    const found = trainingData.find(l => l.name.includes(trimmed));
    if (!found) {
      alert("해당 회원을 찾을 수 없습니다.");
      return;
    }

    setLoading(true);
    setSelectedMember(found.name);
    const logs = trainingData.filter(l => l.name === found.name);
    const feedback = await getMemberFeedback(found.name, logs);
    setAiFeedback(feedback);
    setLoading(false);
  };

  if (fetchingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-400 font-black tracking-widest animate-pulse">LOADING TRAINING DATA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] pb-20">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-indigo-600" size={24} />
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Good morning song-do</h1>
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw size={18} className="text-slate-400" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <section className="mb-12 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">AI 훈련 데이터 분석</h2>
          <div className="relative shadow-2xl shadow-indigo-100/30 rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden">
            <input 
              type="text"
              placeholder="회원 이름을 입력하세요"
              className="w-full pl-8 pr-32 py-6 rounded-[2.5rem] outline-none text-xl font-bold transition-all placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
            />
            <button 
              onClick={() => handleSearch(searchTerm)}
              disabled={loading}
              className="absolute right-3 top-3 bottom-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 rounded-full font-black flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
          </div>
        </section>

        {selectedMember && !loading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                <div className="shrink-0 flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
                    {selectedMember[0]}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900">{selectedMember}님</h3>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Training Summary</p>
                  </div>
                </div>

                <div className="flex-1 bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 relative">
                  <Quote className="absolute -top-3 left-4 text-indigo-100" size={40} />
                  <p className="text-lg font-bold text-slate-700 leading-relaxed italic">
                    "{aiFeedback?.aiInsight}"
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-500">누적 훈련</span>
                  <span className="text-2xl font-black text-slate-900">{stats?.total}회</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-500">평균 심박수</span>
                  <span className="text-2xl font-black text-rose-600">{stats?.avgHR} BPM</span>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-500">보강 평균강도</span>
                  <span className="text-2xl font-black text-amber-600">{stats?.avgInt}/10</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 bg-slate-900 p-8 rounded-[3rem] text-white">
                <h4 className="font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Zap className="text-amber-400" size={18} /> AI 코칭 솔루션
                </h4>
                <div className="space-y-4">
                  {aiFeedback?.recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex gap-3">
                      <span className="text-indigo-400 font-black">0{idx+1}</span>
                      <p className="font-bold text-white/90 text-sm leading-snug">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50">
                <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2">
                  <TrendingUp className="text-indigo-600" size={18} /> 트레이닝 심박수 추이
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredLogs}>
                      <defs>
                        <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip />
                      <Area type="monotone" dataKey="duration" stroke="#4f46e5" strokeWidth={4} fill="url(#colorBpm)" dot={{ r: 4, fill: '#4f46e5' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedMember && !loading && (
          <div className="py-32 text-center border-4 border-dashed border-slate-100 rounded-[4rem] bg-white/50">
            <User size={64} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-2xl font-black text-slate-300 uppercase italic">Waiting for search</h3>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
