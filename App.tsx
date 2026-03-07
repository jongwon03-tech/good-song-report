
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
  const [maxHeartRate, setMaxHeartRate] = useState<number>(185);

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
            
            const maxHeartRateKey = Object.keys(row).find(key => key.includes('최대 심박수')) || 'maxHeartRate';
            const maxHeartRateValue = row[maxHeartRateKey]?.toString().replace(/[^0-9]/g, '') || '0';
            const maxHeartRate = parseInt(maxHeartRateValue) || 0;

            const timestamp = (row['응답일시'] || '').split(' ')[0] || '';
            const conditionScore = parseInt(row['컨디션 체크(*)']) || 3;
            const notes = row['굿송에게 바란다.'] || row['메모'] || '';

            const conditionMapping: Record<number, TrainingLog['condition']> = {
              5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Poor'
            };

            return { 
              timestamp, name, trainingType, intensity, duration: avgHeartRate, maxHeartRate, notes, 
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
    
    // Update maxHeartRate state based on the maximum recorded value for this member
    const memberLogs = trainingData.filter(l => l.name === found.name);
    const absoluteMaxHR = Math.max(...memberLogs.map(l => l.maxHeartRate || 0));
    
    if (absoluteMaxHR > 0) {
      setMaxHeartRate(absoluteMaxHR);
    }

    const feedback = await getMemberFeedback(found.name, memberLogs);
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
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-3">
            {/* Circular Logo */}
            <div className="relative w-14 h-14 rounded-full bg-gradient-to-b from-[#F7C144] to-[#E68E33] flex flex-col items-center justify-center overflow-hidden border-2 border-white shadow-md">
              {/* Vertical Bars Background */}
              <div className="absolute inset-0 flex items-end justify-center gap-[2px] opacity-10 pb-1">
                <div className="w-1 h-6 bg-black"></div>
                <div className="w-1 h-8 bg-black"></div>
                <div className="w-1 h-10 bg-black"></div>
                <div className="w-1 h-7 bg-black"></div>
                <div className="w-1 h-9 bg-black"></div>
              </div>
              {/* Logo Text */}
              <div className="z-10 flex flex-col items-center">
                <span className="text-[11px] font-black text-[#2D2926] italic leading-none tracking-tighter">Goodsong</span>
                <div className="w-8 h-[0.5px] bg-[#2D2926] my-0.5 opacity-50"></div>
                <span className="text-[5px] font-bold text-[#2D2926] uppercase tracking-[0.05em]">Running Club</span>
              </div>
            </div>
            {/* Main Text Logo */}
            <div className="flex items-center">
              <h1 className="font-black text-2xl tracking-tighter italic uppercase font-display leading-none">
                <span className="text-[#E68E33]">GOODSONG</span>
                <span className="text-[#2D2926] ml-2">ANALYSIS</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => fetchData()} className="p-2.5 hover:bg-orange-50 rounded-xl transition-all border border-slate-100 bg-white shadow-sm active:scale-95">
              <RefreshCw size={18} className="text-orange-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="relative mb-16 mt-8 max-w-2xl mx-auto">
          <div className="absolute inset-0 bg-orange-500/10 blur-[80px] rounded-full"></div>
          <div className="relative shadow-2xl shadow-slate-200/50 rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md flex items-center pr-3 overflow-hidden p-1">
            <div className="pl-6 text-slate-400">
              <Search size={20} />
            </div>
            <input 
              className="w-full p-4 md:p-5 outline-none font-bold text-lg text-slate-800 placeholder:text-slate-300 bg-transparent"
              placeholder="회원 이름을 입력하세요 (예: 강종원)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(searchTerm)}
            />
            <button 
              onClick={() => handleSearch(searchTerm)} 
              className="bg-[#2D2926] hover:bg-black text-white px-6 py-3 rounded-2xl transition-all active:scale-95 font-black text-sm uppercase tracking-widest shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Search"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-24 gap-8">
            <BrainCircuit className="text-orange-500 animate-pulse" size={80} />
            <p className="text-xl font-bold text-slate-400 italic">AI 코치가 분석 중입니다...</p>
          </div>
        ) : selectedMember && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main AI Report Card */}
              <section className="lg:col-span-8 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden flex flex-col">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-orange-500/20">AI COACH</span>
                      <span className="text-slate-300 font-black text-xs uppercase tracking-widest">Analysis Report</span>
                    </div>
                    <div className="text-slate-300 font-black text-xs uppercase tracking-widest">
                      {new Date().toLocaleDateString()}
                    </div>
                  </div>
                  
                  <h2 className="text-4xl md:text-6xl font-black text-[#2D2926] mb-10 tracking-tighter italic uppercase font-display leading-none">
                    {selectedMember}<span className="text-orange-500">'s</span><br />Performance
                  </h2>
                  
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 relative group hover:bg-orange-50/30 transition-colors duration-500">
                    <Quote className="text-slate-200 absolute -top-2 -left-2 group-hover:text-orange-200 transition-colors" size={60} />
                    <div className="space-y-6 relative z-10 pl-4">
                      {aiFeedback?.aiInsight.split(/\\n|\n/).filter(p => p.trim()).map((para, idx) => (
                        <p key={idx} className="text-xl md:text-2xl font-bold text-slate-800 italic leading-relaxed break-keep text-justify">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Stats & Philosophy Column */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-4">
                  <StatsCard label="평균 심박수" value={`${stats?.avgHeart} BPM`} icon={<Heart className="text-white" size={18} />} colorClass="bg-rose-500" />
                  <StatsCard label="평균 강도" value={`${stats?.avgIntensity}/10`} icon={<TrendingUp className="text-white" size={18} />} colorClass="bg-orange-500" />
                  <StatsCard label="훈련 횟수" value={`${stats?.totalCount}회`} icon={<Calendar className="text-white" size={18} />} colorClass="bg-slate-800" />
                </div>

                {/* Philosophy Card */}
                <div className="bg-[#2D2926] text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden flex-grow">
                  <div className="absolute -bottom-10 -right-10 p-4 opacity-5">
                    <Zap size={200} />
                  </div>
                  <div className="relative z-10 h-full flex flex-col">
                    <h3 className="text-orange-400 font-black text-[10px] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <Zap size={14} fill="currentColor" /> Club Philosophy
                    </h3>
                    <p className="text-lg font-bold leading-tight mb-4 font-display">
                      우리 굿송은 <span className="text-orange-400">양극화 8:2 훈련</span>을 지향합니다.
                    </p>
                    <p className="text-[11px] font-bold text-white/60 leading-relaxed mb-8 break-keep">
                      주중엔 최대한 평소에 존 2 심박을 보면서 조깅을 해주시고, 합동 훈련에서는 존 4 심박 이상을 도전해보는걸 추천드립니다.
                    </p>
                    
                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Zone 2 (Jogging)</span>
                        <span className="text-xl font-black text-orange-400 font-display">
                          {Math.round(maxHeartRate * 0.6)}-{Math.round(maxHeartRate * 0.7)} <span className="text-[10px] text-white/30">BPM</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Zone 4 (High)</span>
                        <span className="text-xl font-black text-rose-400 font-display">
                          {Math.round(maxHeartRate * 0.8)}-{Math.round(maxHeartRate * 0.9)} <span className="text-[10px] text-white/30">BPM</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex flex-col gap-2">
                      <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Adjust Max HR</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="150" 
                          max="220" 
                          value={maxHeartRate} 
                          onChange={(e) => setMaxHeartRate(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="font-black text-sm text-orange-400 w-8">{maxHeartRate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations Row */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                {aiFeedback?.recommendations.map((rec, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6 group hover:border-orange-200 transition-all duration-300">
                    <div className="bg-orange-50 w-14 h-14 rounded-2xl flex items-center justify-center text-orange-500 font-black text-2xl group-hover:bg-orange-500 group-hover:text-white transition-all duration-500 shadow-sm">
                      {i + 1}
                    </div>
                    <p className="font-bold text-xl text-slate-800 leading-tight tracking-tight break-keep">{rec}</p>
                  </div>
                ))}
              </div>

              {/* History Table Card */}
              <section className="lg:col-span-12 bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <h3 className="font-black text-xl uppercase tracking-tighter italic font-display">Training History</h3>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last {memberLogs.length} Sessions</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                      <tr>
                        <th className="px-10 py-5 text-left">Date</th>
                        <th className="px-10 py-5 text-left">Activity</th>
                        <th className="px-10 py-5 text-center">Avg BPM</th>
                        <th className="px-10 py-5 text-right">Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {memberLogs.slice().reverse().map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-10 py-6 text-sm font-bold text-slate-400">{log.timestamp}</td>
                          <td className="px-10 py-6">
                            <div className="font-black text-slate-800 text-lg tracking-tight group-hover:text-orange-500 transition-colors">{log.trainingType}</div>
                          </td>
                          <td className="px-10 py-6 text-center">
                            <span className="font-black text-xl text-slate-900 font-display">{log.duration}</span>
                            <span className="text-[10px] font-black text-slate-300 ml-1 uppercase">BPM</span>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                              log.condition === 'Excellent' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                              log.condition === 'Good' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                              'bg-slate-50 text-slate-500 border border-slate-100'
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
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
