import React, { useState, useMemo, useEffect } from 'react';
import { getMemberFeedback } from './services/geminiService';
import { TrainingLog } from './types';
import Papa from 'papaparse';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Search, Activity, Loader2, User, BrainCircuit, Calendar, TrendingUp, RefreshCw, AlertCircle, Heart, Quote, Zap, ChevronRight } from 'lucide-react';
import StatsCard from './components/StatsCard';

const SHEET_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTL-7osicYdHztOycmQngj3FA4NU56okNHSg0q7lqlfBeb9oL73mPqxcRB8oKfe2QigzGsuk3xVPeNj/pub?output=csv`;

const App: React.FC = () => {
  const [trainingData, setTrainingData] = useState<TrainingLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ aiInsight: string, recommendations: string[] } | null>(null);

  const fetchData = async () => {
    setFetchingData(true);
    try {
      const response = await fetch(`${SHEET_URL}&t=${Date.now()}`);
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
      console.error("Data fetch error", err);
      setFetchingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const memberLogs = useMemo(() => {
    if (!selectedMember) return [];
    return trainingData
      .filter(log => log.name === selectedMember)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedMember, trainingData]);

  const stats = useMemo(() => {
    if (memberLogs.length === 0) return null;
    const avgHeart = Math.round(memberLogs.reduce((acc, curr) => acc + curr.duration, 0) / memberLogs.length);
    const avgIntensity = (memberLogs.reduce((acc, curr) => acc + curr.intensity, 0) / memberLogs.length).toFixed(1);
    return { avgHeart, avgIntensity, totalCount: memberLogs.length };
  }, [memberLogs]);

  const handleSearch = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const found = trainingData.find(l => l.name.toLowerCase().includes(trimmed.toLowerCase()));
    if (!found) {
      alert("회원을 찾을 수 없습니다.");
      return;
    }

    setLoading(true);
    setSelectedMember(found.name);
    const feedback = await getMemberFeedback(found.name, trainingData.filter(l => l.name === found.name));
    setAiFeedback(feedback);
    setLoading(false);
  };

  if (fetchingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="font-bold text-slate-500">훈련 데이터를 불러오고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-black italic uppercase tracking-tighter text-xl">
            <Activity className="text-indigo-600" /> Good morning song-do
          </div>
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <RefreshCw size={20} className="text-slate-500" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Search Section */}
        <div className="relative mb-10 mt-6 group">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-10 group-focus-within:opacity-20 transition-opacity rounded-full"></div>
          <div className="relative shadow-xl rounded-full overflow-hidden border-2 border-white bg-white flex items-center pr-2">
            <input 
              className="w-full p-6 pl-8 outline-none font-bold text-lg text-slate-800 placeholder:text-slate-300"
              placeholder="분석을 원하는 회원의 성함을 입력하세요"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
            />
            <button 
              onClick={() => handleSearch(searchTerm)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full transition-all active:scale-95 shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Search size={24} />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <BrainCircuit className="animate-bounce text-indigo-600" size={64} />
            <p className="text-xl font-black text-slate-800">AI 코치가 데이터를 분석 중입니다...</p>
          </div>
        ) : selectedMember && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
            
            {/* AI Highlight */}
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <BrainCircuit size={120} className="text-indigo-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">AI Performance Insight</span>
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-6">{selectedMember}님 분석</h2>
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 leading-relaxed">
                  <Quote className="text-indigo-400 mb-2" size={24} />
                  <p className="text-xl font-bold text-indigo-950 italic">
                    {aiFeedback?.aiInsight || "최근 기록된 데이터를 기반으로 분석 중입니다."}
                  </p>
                </div>
              </div>
            </section>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard label="평균 심박수" value={`${stats?.avgHeart} BPM`} icon={<Heart className="text-white" />} colorClass="bg-rose-500" />
              <StatsCard label="평균 훈련강도" value={`${stats?.avgIntensity}/10`} icon={<TrendingUp className="text-white" />} colorClass="bg-indigo-500" />
              <StatsCard label="기록된 세션" value={`${stats?.totalCount}회`} icon={<Calendar className="text-white" />} colorClass="bg-emerald-500" />
            </div>

            {/* Chart Section */}
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <TrendingUp className="text-indigo-600" /> 심박수 변화 추이
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={memberLogs}>
                    <defs>
                      <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="duration" name="심박수" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorHeart)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aiFeedback?.recommendations.map((rec, i) => (
                <div key={i} className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col gap-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                  <div className="absolute -right-4 -bottom-4 bg-white/5 p-8 rounded-full group-hover:scale-110 transition-transform">
                    <Zap size={40} className="text-amber-400" />
                  </div>
                  <div className="bg-amber-400 w-10 h-10 rounded-xl flex items-center justify-center text-slate-900 font-black">
                    {i + 1}
                  </div>
                  <p className="font-bold text-lg relative z-10 leading-snug">{rec}</p>
                </div>
              ))}
            </div>

            {/* Training Logs Table */}
            <section className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-black">최근 훈련 상세 로그</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-xs font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">날짜</th>
                      <th className="px-8 py-4">훈련 내용</th>
                      <th className="px-8 py-4 text-center">강도</th>
                      <th className="px-8 py-4 text-center">심박수</th>
                      <th className="px-8 py-4">컨디션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {memberLogs.slice().reverse().map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5 text-sm font-bold text-slate-500">{log.timestamp}</td>
                        <td className="px-8 py-5">
                          <div className="font-bold text-slate-900">{log.trainingType}</div>
                          <div className="text-xs text-slate-400 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">{log.notes}</div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs border border-indigo-100">
                            {log.intensity}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center font-bold text-slate-700">{log.duration}</td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                            log.condition === 'Good' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {log.condition}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;