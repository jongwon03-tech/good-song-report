import React, { useState, useMemo, useEffect } from 'react';
import { getMemberFeedback } from './services/geminiService';
import { TrainingLog } from './types';
import Papa from 'papaparse';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Search, Activity, Loader2, BrainCircuit, Calendar, TrendingUp, RefreshCw, Heart, Quote, Zap } from 'lucide-react';
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
        <Loader2 className="animate-spin text-orange-500" size={48} />
        <p className="font-bold text-slate-500 italic">데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-20">
      <header className="bg-white/95 backdrop-blur-md border-b p-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            {/* Logo area inspired by the provided image */}
            <div className="relative w-14 h-14 bg-gradient-to-b from-orange-400 to-yellow-500 rounded-full flex flex-col items-center justify-center overflow-hidden border border-orange-200 shadow-sm">
              <div className="absolute top-2 w-full flex justify-center opacity-30">
                {/* Simplified Skyline representation */}
                <div className="flex items-end gap-[1px]">
                  <div className="w-1 h-3 bg-slate-900"></div>
                  <div className="w-1.5 h-5 bg-slate-900"></div>
                  <div className="w-1 h-4 bg-slate-900"></div>
                  <div className="w-2 h-7 bg-slate-900"></div>
                  <div className="w-1 h-4 bg-slate-900"></div>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-900 leading-tight z-10 italic">Goodsong</span>
              <div className="absolute bottom-1.5 w-full text-center">
                 <span className="text-[6px] font-bold text-slate-900/60 uppercase tracking-tighter">Running Club</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black text-2xl tracking-tighter text-[#2D2926] italic">
                <span className="text-orange-500">GOODSONG</span> ANALYSIS
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-widest border-r pr-4 mr-2 border-slate-200">
              AI Powered Performance Tracker
            </span>
            <button onClick={() => window.location.reload()} className="p-2 hover:bg-orange-50 rounded-full transition-colors border border-slate-100 bg-white">
              <RefreshCw size={18} className="text-orange-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="relative mb-14 mt-10">
          <div className="absolute inset-0 bg-orange-500/5 blur-[100px] rounded-full"></div>
          <div className="relative shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] rounded-full overflow-hidden border border-slate-200 bg-white flex items-center pr-2">
            <input 
              className="w-full p-5 md:p-7 pl-10 outline-none font-bold text-xl text-slate-800 placeholder:text-slate-300 bg-transparent"
              placeholder="분석할 회원의 이름을 입력하세요"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
            />
            <button 
              onClick={() => handleSearch(searchTerm)} 
              className="bg-[#2D2926] hover:bg-black text-white p-5 rounded-full transition-all active:scale-95 shadow-xl shadow-slate-200"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Search size={28} />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-24 gap-8">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-400/20 blur-2xl animate-pulse rounded-full"></div>
              <BrainCircuit className="relative text-orange-500 animate-bounce" size={80} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-2xl font-black text-slate-900 tracking-tight tracking-tighter italic uppercase">Deep Analysis Underway</p>
              <p className="text-slate-400 font-medium">데이터를 기반으로 최적의 훈련 제언을 생성 중입니다.</p>
            </div>
          </div>
        ) : selectedMember && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-10">
            
            <section className="bg-white p-8 md:p-12 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 pointer-events-none">
                <div className="w-80 h-80 bg-orange-500 rounded-full blur-[100px]"></div>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <span className="bg-[#2D2926] text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em] shadow-lg">
                    AI Performance Coach Insight
                  </span>
                </div>
                <h2 className="text-5xl md:text-6xl font-black text-[#2D2926] mb-10 tracking-tighter italic">
                  <span className="text-orange-500 uppercase">{selectedMember}</span>'s REPORT
                </h2>
                <div className="bg-orange-50/40 p-8 md:p-10 rounded-[2.5rem] border border-orange-100/50 leading-relaxed shadow-inner">
                  <Quote className="text-orange-400 mb-6 opacity-40" size={40} />
                  <p className="text-2xl md:text-3xl font-bold text-slate-800 italic leading-[1.45] tracking-tight">
                    {aiFeedback?.aiInsight}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StatsCard label="평균 심박수" value={`${stats?.avgHeart} BPM`} icon={<Heart className="text-white" size={22} />} colorClass="bg-rose-500 shadow-xl shadow-rose-100" />
              <StatsCard label="평균 훈련강도" value={`${stats?.avgIntensity}/10`} icon={<TrendingUp className="text-white" size={22} />} colorClass="bg-orange-500 shadow-xl shadow-orange-100" />
              <StatsCard label="기록된 세션" value={`${stats?.totalCount}회`} icon={<Calendar className="text-white" size={22} />} colorClass="bg-[#2D2926] shadow-xl shadow-slate-200" />
            </div>

            <section className="bg-white p-10 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.02)] border border-slate-100">
              <div className="flex justify-between items-center mb-12">
                <h3 className="text-2xl font-black text-[#2D2926] flex items-center gap-4 italic uppercase tracking-tighter">
                  <div className="w-3 h-10 bg-orange-500 rounded-full"></div>
                  Performance Trends
                </h3>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={memberLogs}>
                    <defs>
                      <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={15} fontWeight="700" />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 30px 60px -12px rgb(0 0 0 / 0.15)', padding: '20px' }}
                      labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '8px', fontSize: '18px' }}
                      itemStyle={{ fontWeight: '800', color: '#f97316' }}
                    />
                    <Area type="monotone" dataKey="duration" name="심박수" stroke="#f97316" strokeWidth={5} fillOpacity={1} fill="url(#colorHeart)" dot={{ r: 6, fill: '#f97316', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 9, strokeWidth: 0, fill: '#2D2926' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {aiFeedback?.recommendations.map((rec, i) => (
                <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6 relative overflow-hidden group hover:border-orange-200 transition-all duration-300">
                  <div className="bg-orange-100 w-14 h-14 rounded-2xl flex items-center justify-center text-orange-600 font-black text-2xl group-hover:bg-[#2D2926] group-hover:text-white transition-colors duration-500 shadow-sm">
                    {i + 1}
                  </div>
                  <p className="font-bold text-xl relative z-10 leading-tight tracking-tight text-slate-800">{rec}</p>
                  <div className="absolute right-6 top-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                    <Zap size={60} className="text-orange-500" />
                  </div>
                </div>
              ))}
            </div>

            <section className="bg-white rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
                <h3 className="text-2xl font-black text-[#2D2926] tracking-tight italic uppercase tracking-tighter">Detailed Training History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                    <tr>
                      <th className="px-12 py-6">Date</th>
                      <th className="px-12 py-6">Training Type</th>
                      <th className="px-12 py-6 text-center">훈련강도</th>
                      <th className="px-12 py-6 text-center">BPM</th>
                      <th className="px-12 py-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {memberLogs.slice().reverse().map((log, i) => (
                      <tr key={i} className="hover:bg-orange-50/20 transition-all group">
                        <td className="px-12 py-8 text-xs font-bold text-slate-400">{log.timestamp}</td>
                        <td className="px-12 py-8">
                          <div className="font-black text-[#2D2926] text-xl mb-2">{log.trainingType}</div>
                          <div className="text-sm text-slate-500 font-medium line-clamp-1 group-hover:line-clamp-none transition-all duration-500 max-w-md">{log.notes}</div>
                        </td>
                        <td className="px-12 py-8 text-center">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#2D2926] text-white font-black text-sm shadow-lg shadow-slate-200">
                            {log.intensity}
                          </span>
                        </td>
                        <td className="px-12 py-8 text-center font-black text-slate-700 text-xl">{log.duration}</td>
                        <td className="px-12 py-8 text-right">
                          <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                            log.condition === 'Excellent' ? 'bg-emerald-500 text-white' :
                            log.condition === 'Good' ? 'bg-orange-500 text-white' :
                            'bg-slate-400 text-white'
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