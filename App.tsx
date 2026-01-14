
import React, { useState, useMemo, useEffect } from 'react';
import { getMemberFeedback } from './services/geminiService';
import { TrainingLog } from './types';
import Papa from 'papaparse';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Search, Loader2, BrainCircuit, Calendar, TrendingUp, RefreshCw, Heart, Quote, Zap } from 'lucide-react';
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
            const avgHeartRateValue = row[heartRateKey]?.toString().replace(/[^0-9]/g, '') || '0';
            const avgHeartRate = parseInt(avgHeartRateValue) || 0;
            const timestamp = (row['응답일시'] || '').split(' ')[0] || '';
            const conditionScore = parseInt(row['컨디션 체크(*)']) || 3;
            const notes = row['굿송에게 바란다.'] || row['메모'] || '';

            const conditionMapping: Record<number, TrainingLog['condition']> = {
              5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Poor'
            };

            return { 
              timestamp, name, trainingType, intensity, duration: avgHeartRate, notes, 
              condition: (conditionMapping[conditionScore] || 'Good') as TrainingLog['condition']
            };
          }).filter((item: TrainingLog) => item.name !== "");
          
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
    const avgIntensityNum = memberLogs.reduce((acc, curr) => acc + curr.intensity, 0) / memberLogs.length;
    return { avgHeart, avgIntensity: avgIntensityNum.toFixed(1), totalCount: memberLogs.length };
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
        <p className="font-bold text-slate-500 italic uppercase tracking-widest">Loading Club Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-20">
      <header className="bg-white/95 backdrop-blur-md border-b p-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 bg-gradient-to-tr from-[#E68E33] to-[#F7C144] rounded-full flex flex-col items-center justify-center overflow-hidden border-2 border-white shadow-md">
              <div className="absolute top-1 w-full flex items-end justify-center gap-[1px] opacity-40">
                <div className="w-1.5 h-3 bg-[#2D2926]"></div>
                <div className="w-1 h-5 bg-[#2D2926]"></div>
                <div className="w-2 h-7 bg-[#2D2926]"></div>
                <div className="w-1.5 h-4 bg-[#2D2926]"></div>
                <div className="w-1 h-6 bg-[#2D2926]"></div>
                <div className="w-2 h-10 bg-[#2D2926]"></div>
                <div className="w-1 h-4 bg-[#2D2926]"></div>
              </div>
              <div className="z-10 flex flex-col items-center mt-3">
                <span className="text-[12px] font-black text-[#2D2926] italic leading-none tracking-tighter">Goodsong</span>
                <div className="w-8 h-[1px] bg-[#2D2926] my-[2px]"></div>
                <span className="text-[5px] font-bold text-[#2D2926] uppercase tracking-[0.2em] leading-none">Running Club</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black text-2xl tracking-tighter text-[#2D2926] italic uppercase">
                <span className="text-orange-500">Goodsong</span> Analysis
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => fetchData()} className="p-2 hover:bg-orange-50 rounded-full transition-colors border border-slate-100 bg-white">
              <RefreshCw size={18} className="text-orange-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="relative mb-14 mt-10">
          <div className="absolute inset-0 bg-orange-500/5 blur-[100px] rounded-full"></div>
          <div className="relative shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] rounded-full border border-slate-200 bg-white flex items-center pr-2 overflow-hidden">
            <input 
              className="w-full p-5 md:p-7 pl-10 outline-none font-bold text-xl text-slate-800 placeholder:text-slate-300 bg-transparent"
              placeholder="회원 이름을 입력하세요 (예: 강종원)"
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
            <BrainCircuit className="text-orange-500 animate-pulse" size={80} />
            <p className="text-xl font-bold text-slate-400 italic">AI 코치가 분석 중입니다...</p>
          </div>
        ) : selectedMember && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <section className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">AI COACH</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-[#2D2926] mb-8 tracking-tighter italic uppercase">
                  {selectedMember}'s Report
                </h2>
                <div className="bg-orange-50/50 p-8 rounded-[2rem] border border-orange-100 relative">
                  <Quote className="text-orange-200 absolute top-4 left-4" size={40} />
                  <p className="text-xl md:text-2xl font-bold text-slate-800 italic leading-relaxed relative z-10 pl-6">
                    {aiFeedback?.aiInsight}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard label="평균 심박수" value={`${stats?.avgHeart} BPM`} icon={<Heart className="text-white" size={20} />} colorClass="bg-rose-500" />
              <StatsCard label="평균 강도" value={`${stats?.avgIntensity}/10`} icon={<TrendingUp className="text-white" size={20} />} colorClass="bg-orange-500" />
              <StatsCard label="훈련 횟수" value={`${stats?.totalCount}회`} icon={<Calendar className="text-white" size={20} />} colorClass="bg-slate-800" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aiFeedback?.recommendations.map((rec, i) => (
                <div key={i} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4 group hover:border-orange-200 transition-all">
                  <div className="bg-orange-100 w-12 h-12 rounded-xl flex items-center justify-center text-orange-600 font-black text-xl group-hover:bg-orange-500 group-hover:text-white transition-all">
                    {i + 1}
                  </div>
                  <p className="font-bold text-lg text-slate-800 leading-tight">{rec}</p>
                </div>
              ))}
            </div>

            <section className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b bg-slate-50/50">
                <h3 className="font-black text-xl uppercase tracking-tighter italic">Training History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4 text-left">Date</th>
                      <th className="px-8 py-4 text-left">Activity</th>
                      <th className="px-8 py-4 text-center">BPM</th>
                      <th className="px-8 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {memberLogs.slice().reverse().map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6 text-sm font-bold text-slate-400">{log.timestamp}</td>
                        <td className="px-8 py-6">
                          <div className="font-black text-slate-800">{log.trainingType}</div>
                          {/* 코멘트 노출 부분(notes)을 제거했습니다. */}
                        </td>
                        <td className="px-8 py-6 text-center font-black text-orange-500">{log.duration}</td>
                        <td className="px-8 py-6 text-right">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                            log.condition === 'Excellent' ? 'bg-emerald-500 text-white' :
                            log.condition === 'Good' ? 'bg-orange-500 text-white' : 'bg-slate-400 text-white'
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
