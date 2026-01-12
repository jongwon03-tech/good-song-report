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
            const name = (row['이름 (필수)(*)'] || '').trim();
            const trainingType = row['오늘 달린거리는?(*)'] || '러닝';
            
            const intensityRaw = row['오늘 보강훈련 강도는(1~10)(필수)(*)'] || row['오늘 보강훈련 강도는(1~10) (필수)(*)'];
            const intensity = parseInt(intensityRaw) || 0;
            
            const heartRateKey = Object.keys(row).find(key => key.includes('평균 심박수'));
            const avgHeartRateRaw = heartRateKey ? row[heartRateKey] : '0';
            const avgHeartRate = parseInt(avgHeartRateRaw.toString().replace(/[^0-9]/g, '')) || 0;
            
            const timestamp = (row['응답일시'] || '').split(' ')[0] || '';
            const conditionScore = parseInt(row['컨디션 체크(*)']) || 0;
            const notes = row['굿송에게 바란다.'] || '';

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
            setError("데이터를 찾을 수 없습니다. 시트 설정을 확인해주세요.");
          } else {
            setTrainingData(mappedData);
          }
          setFetchingData(false);
        },
        error: () => {
          setError("데이터 분석 중 오류가 발생했습니다.");
          setFetchingData(false);
        }
      });
    } catch (err) {
      setError("연결 실패. 인터넷 연결이나 시트 주소를 확인해주세요.");
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
    
    const validHeartRates = filteredLogs.map(l => l.duration).filter(h => h > 0);
    const avgHeartRate = validHeartRates.length > 0 
      ? Math.round(validHeartRates.reduce((acc, curr) => acc + curr, 0) / validHeartRates.length) 
      : 0;
    
    const validIntensities = filteredLogs.map(l => l.intensity).filter(i => i > 0);
    const avgIntensity = validIntensities.length > 0
      ? (validIntensities.reduce((acc, curr) => acc + curr, 0) / validIntensities.length).toFixed(1)
      : null;

    return {
      totalWorkouts: filteredLogs.length,
      avgHeartRate,
      avgIntensity
    };
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

  const uniqueMembers = Array.from(new Set(trainingData.map(m => m.name))).filter(Boolean);

  if (fetchingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-400 font-black tracking-widest animate-pulse uppercase">Syncing Live Training Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] pb-20 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-indigo-600" size={24} />
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Good morning song-do</h1>
          </div>
          <button onClick={fetchData} title="새로고침" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw size={18} className="text-slate-400" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-8 p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 text-rose-600 shadow-sm">
            <AlertCircle size={24} />
            <p className="font-bold">{error}</p>
          </div>
        )}

        <section className="mb-12 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight leading-tight">회원별 훈련 데이터 분석</h2>
          <div className="relative mb-8 shadow-2xl shadow-indigo-100/30 rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden">
            <input 
              type="text"
              placeholder="이름을 입력하세요 (예: 이창민3218)"
              className="w-full pl-8 pr-32 py-6 rounded-[2.5rem] outline-none text-xl font-bold transition-all placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
            />
            <button 
              onClick={() => handleSearch(searchTerm)}
              disabled={loading}
              className="absolute right-3 top-3 bottom-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 rounded-full font-black transition-all flex items-center justify-center min-w-[120px]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {uniqueMembers.slice(0, 15).map(name => (
              <button 
                key={name}
                onClick={() => { setSearchTerm(name); handleSearch(name); }}
                className="text-[11px] font-black bg-white text-slate-400 hover:text-indigo-600 px-4 py-2 rounded-xl border border-slate-100 shadow-sm transition-all hover:-translate-y-0.5"
              >
                #{name}
              </button>
            ))}
          </div>
        </section>

        {selectedMember && !loading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/20 border border-slate-50 overflow-hidden relative">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                <div className="shrink-0 flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                    {selectedMember[0]}
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{selectedMember} <span className="text-indigo-600 italic">님</span></h3>
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">Gutsong Training Report</p>
                  </div>
                </div>

                <div className="flex-1 bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 relative">
                  <Quote className="absolute -top-3 left-4 text-indigo-100" size={48} />
                  <div className="flex gap-4">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white shrink-0 h-fit mt-1">
                      <BrainCircuit size={20} />
                    </div>
                    <p className="text-xl font-bold text-slate-700 leading-relaxed italic pr-4">
                      "{aiFeedback?.aiInsight}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="bg-white border border-slate-100 p-6 rounded-3xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-indigo-600" size={24} />
                    <span className="font-bold text-slate-500">누적 훈련횟수</span>
                  </div>
                  <span className="text-3xl font-black text-slate-900">{stats?.totalWorkouts}회</span>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-3xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <Heart className="text-rose-600" size={24} />
                    <span className="font-bold text-slate-500">평균 심박수</span>
                  </div>
                  <span className="text-3xl font-black text-rose-600">{stats?.avgHeartRate || "-"} <span className="text-sm">BPM</span></span>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-3xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="text-amber-600" size={24} />
                    <span className="font-bold text-slate-500">보강 평균 강도</span>
                  </div>
                  <span className="text-3xl font-black text-amber-600">{stats?.avgIntensity ? `${stats.avgIntensity}/10` : "-/10"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl h-full flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <Zap className="text-amber-400" size={24} />
                  <h4 className="font-black text-sm uppercase tracking-widest">AI 추천 행동 강령</h4>
                </div>
                <div className="space-y-4 flex-1">
                  {aiFeedback?.recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all flex gap-4 items-start">
                      <span className="bg-indigo-500 text-white text-[12px] font-black w-6 h-6 flex items-center justify-center rounded-lg mt-0.5 shrink-0">{idx+1}</span>
                      <p className="font-bold text-white/90 leading-snug">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/20 border border-slate-50">
                <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-2">
                  <TrendingUp className="text-indigo-600" size={20} /> 심박수 변화 리포트 (BPM)
                </h3>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredLogs}>
                      <defs>
                        <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }}
                        itemStyle={{ fontWeight: '900', color: '#4f46e5' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="duration" 
                        name="BPM" 
                        stroke="#4f46e5" 
                        strokeWidth={5} 
                        fill="url(#colorBpm)" 
                        dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] shadow-xl shadow-slate-200/20 border border-slate-50">
              <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic">Training Detail History</h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scroll">
                {filteredLogs.slice().reverse().map((log, idx) => (
                  <div key={idx} className="p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 hover:bg-white hover:shadow-xl transition-all group">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{log.timestamp}</span>
                        <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                          log.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-600' : 
                          log.condition === 'Good' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                        }`}>{log.condition}</div>
                      </div>
                      <h4 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{log.trainingType}</h4>
                      <p className="text-base text-slate-500 font-medium italic">"{log.notes || "오늘도 무사히 훈련을 마쳤습니다."}"</p>
                    </div>
                    <div className="flex gap-12 shrink-0 bg-white p-6 rounded-3xl shadow-sm">
                      <div className="text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">INTENSITY</p>
                        <p className="text-2xl font-black text-slate-900">{log.intensity || "-"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">HEART RATE</p>
                        <p className="text-2xl font-black text-indigo-600">{log.duration || "-"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!selectedMember && !loading && (
          <div className="py-48 text-center border-4 border-dashed border-slate-200 rounded-[5rem] bg-white opacity-40">
            <User size={80} className="mx-auto text-slate-200 mb-6" />
            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter italic uppercase">Waiting for input</h3>
            <p className="text-slate-400 font-medium">조회할 회원의 성함을 입력하여 분석을 시작하세요.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
