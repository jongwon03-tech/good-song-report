
import React, { useState, useMemo, useEffect } from 'react';
import { getMemberFeedback } from './services/geminiService';
import { TrainingLog } from './types';
import Papa from 'papaparse';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Search, Loader2, BrainCircuit, Calendar, TrendingUp, RefreshCw, Heart, Quote, Zap } from 'lucide-react';
import StatsCard from './components/StatsCard';

const ATTENDANCE_SHEET_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTL-7osicYdHztOycmQngj3FA4NU56okNHSg0q7lqlfBeb9oL73mPqxcRB8oKfe2QigzGsuk3xVPeNj/pub?output=csv`;
const STRAVA_DATA_URL = `https://docs.google.com/spreadsheets/d/1aoLY1k5jT-kaJWUyiZ3wdEJOkAKHmDf8wa84AgZ5g00/export?format=csv&gid=1283125762`;
const MAPPING_SHEET_URL = `https://docs.google.com/spreadsheets/d/1aoLY1k5jT-kaJWUyiZ3wdEJOkAKHmDf8wa84AgZ5g00/export?format=csv&gid=1750893345`;

const App: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<TrainingLog[]>([]);
  const [stravaSummaries, setStravaSummaries] = useState<Record<string, any>>({});
  const [memberList, setMemberList] = useState<string[]>([]);
  const [nameToStravaId, setNameToStravaId] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ stravaAnalysis: string, coachingAnalysis: string, recommendations: string[] } | null>(null);
  const [maxHeartRate, setMaxHeartRate] = useState<number>(185);

  // Unified cleaning logic for names and IDs
  const cleanString = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

  const fetchData = async () => {
    setFetchingData(true);
    try {
      const [attendanceRes, stravaRes, mappingRes] = await Promise.all([
        fetch(`${ATTENDANCE_SHEET_URL}&t=${Date.now()}`),
        fetch(`${STRAVA_DATA_URL}&t=${Date.now()}`),
        fetch(`${MAPPING_SHEET_URL}&t=${Date.now()}`)
      ]);

      const [attendanceCsv, stravaCsv, mappingCsv] = await Promise.all([
        attendanceRes.text(),
        stravaRes.text(),
        mappingRes.text()
      ]);

      const getVal = (row: any, keywords: string[]) => {
        const keys = Object.keys(row);
        
        // 1. Try exact match first
        for (const kw of keywords) {
          const ckw = cleanString(kw);
          const foundKey = keys.find(k => cleanString(k) === ckw);
          if (foundKey) return row[foundKey]?.toString().trim() || '';
        }
        
        // 2. Try partial match but avoid '2' suffix
        const key = keys.find(k => {
          const ck = cleanString(k);
          if (ck.endsWith('2')) return false;
          return keywords.some(kw => ck.includes(cleanString(kw)));
        });
        return key ? row[key]?.toString().trim() : '';
      };

      // 1. Parse Mapping Data (Member List)
      const mapping: Record<string, string> = {};
      const members: string[] = [];
      
      // Skip the first title row "정회원 List" and handle potential empty lines or BOM
      const mappingLines = mappingCsv.split(/\r?\n/).filter(line => line.trim() !== '');
      const mappingCsvCleaned = mappingLines.slice(1).join('\n');
      
      const mappingResult = Papa.parse(mappingCsvCleaned, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().replace(/^\uFEFF/, '')
      });
      
      mappingResult.data.forEach((row: any) => {
        const name = getVal(row, ['이름', 'Name', '성함']);
        const id = getVal(row, ['Strava ID', 'StravaID', 'ID', '스트라바']);
        if (name && name !== '이름' && name !== 'Name') {
          members.push(name.trim());
          if (id) mapping[name.trim()] = id.trim();
        }
      });
      setMemberList(members);
      setNameToStravaId(mapping);
      console.log("Loaded members:", members.length);

      // 2. Parse Attendance Data
      const attendanceResult = Papa.parse(attendanceCsv, { header: true, skipEmptyLines: true });
      const attendanceLogs: TrainingLog[] = attendanceResult.data.map((row: any) => {
        const name = getVal(row, ['이름', '성함']);
        const trainingType = getVal(row, ['달린거리', '훈련', '종목']) || '러닝';
        const intensity = parseInt(getVal(row, ['보강훈련강도', '강도', 'intensity'])) || 0;
        const avgHR = parseInt(getVal(row, ['평균심박수', '심박수']).replace(/[^0-9]/g, '')) || 0;
        const maxHR = parseInt(getVal(row, ['최대심박수']).replace(/[^0-9]/g, '')) || 0;
        const timestamp = getVal(row, ['응답일시', '날짜', 'date']).split(' ')[0] || '';
        const conditionScore = parseInt(getVal(row, ['컨디션'])) || 3;
        const notes = getVal(row, ['바란다', '메모', '비고']);

        const conditionMapping: Record<number, TrainingLog['condition']> = {
          5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Poor'
        };

        return { 
          timestamp, name, trainingType, intensity, duration: avgHR, maxHeartRate: maxHR, notes, 
          condition: (conditionMapping[conditionScore] || 'Good') as TrainingLog['condition'],
          source: 'Attendance' as const
        };
      }).filter((item: TrainingLog) => item.name !== "");
      setAttendanceData(attendanceLogs);

      // 3. Parse Strava Summary Data
      // Use header: false to handle duplicate 'athlete' columns and specific indices
      const stravaResult = Papa.parse(stravaCsv, { 
        header: false, 
        skipEmptyLines: true
      });
      
      const summaries: Record<string, any> = {};
      
      // Skip header row (index 0)
      const stravaRows = stravaResult.data.slice(1);
      
      stravaRows.forEach((row: any) => {
        if (!row || row.length < 2) return;

        // Indices based on the latest screenshot (Step 58):
        // 0: 이름 (Col A) - User manually added
        // 1: athlete (Col B)
        // 2: longest (Col C)
        // 3: distance (Col D)
        // 4: avg_pace (Col E)
        // 5: elev_gain (Col F)
        // 6: rank (Col G)
        // 7: runs (Col H)

        const nameFromColA = row[0]?.toString().trim() || '';
        const idFromColB = row[1]?.toString().trim() || '';

        if (!nameFromColA && !idFromColB) return;

        const cleanNameA = cleanString(nameFromColA);
        const cleanIdB = cleanString(idFromColB);
        
        // Find which member this belongs to
        let matchedMemberName = '';

        // Priority 1: Match by Column A (이름) - This is what the user manually added
        if (cleanNameA) {
          matchedMemberName = members.find(m => cleanString(m) === cleanNameA) || '';
        }

        // Priority 2: Match by Column B (athlete) against Mapping Strava ID
        if (!matchedMemberName && cleanIdB) {
          matchedMemberName = Object.keys(mapping).find(mName => cleanString(mapping[mName]) === cleanIdB) || '';
        }

        // Priority 3: Match by Column B (athlete) against Member Name directly (fallback)
        if (!matchedMemberName && cleanIdB) {
          matchedMemberName = members.find(m => cleanString(m) === cleanIdB) || '';
        }
        
        if (matchedMemberName) {
          summaries[matchedMemberName] = {
            distance: row[3]?.toString().trim() || '',
            pace: row[4]?.toString().trim() || '',
            longest: row[2]?.toString().trim() || '',
            elevation: row[5]?.toString().trim() || '',
            runs: row[7]?.toString().trim() || '',
            rank: row[6]?.toString().trim() || ''
          };
        } else {
          // If no match found in members, but we have a name in Col A, use it directly as a fallback
          if (cleanNameA) {
            summaries[nameFromColA] = {
              distance: row[3]?.toString().trim() || '',
              pace: row[4]?.toString().trim() || '',
              longest: row[2]?.toString().trim() || '',
              elevation: row[5]?.toString().trim() || '',
              runs: row[7]?.toString().trim() || '',
              rank: row[6]?.toString().trim() || ''
            };
          }
        }
      });
      console.log("Strava summaries loaded:", Object.keys(summaries).length);
      setStravaSummaries(summaries);

      setFetchingData(false);
    } catch (err) {
      console.error("Data fetch error", err);
      setFetchingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const currentMemberAttendanceLogs = useMemo(() => {
    if (!selectedMember) return [];
    return attendanceData
      .filter(log => log.name === selectedMember)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedMember, attendanceData]);

  const currentMemberStravaSummary = useMemo(() => {
    if (!selectedMember) return null;
    return stravaSummaries[selectedMember] || null;
  }, [selectedMember, stravaSummaries]);

  const stats = useMemo(() => {
    const hasAttendance = currentMemberAttendanceLogs.length > 0;
    const hasStrava = !!currentMemberStravaSummary;
    
    if (!hasAttendance && !hasStrava) return null;
    
    const logsWithHR = currentMemberAttendanceLogs.filter(l => l.duration > 0);
    const avgHeart = logsWithHR.length > 0 
      ? Math.round(logsWithHR.reduce((acc, curr) => acc + curr.duration, 0) / logsWithHR.length)
      : 0;
      
    const attendanceWithIntensity = currentMemberAttendanceLogs.filter(l => l.intensity > 0);
    const avgIntensityNum = attendanceWithIntensity.length > 0
      ? attendanceWithIntensity.reduce((acc, curr) => acc + curr.intensity, 0) / attendanceWithIntensity.length
      : 0;

    return { 
      avgHeart, 
      avgIntensity: avgIntensityNum.toFixed(1), 
      totalCount: currentMemberAttendanceLogs.length,
      stravaCount: hasStrava ? 1 : 0
    };
  }, [currentMemberAttendanceLogs, currentMemberStravaSummary]);

  const handleSearch = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    setLoading(true);
    try {
      const cleanTrimmed = cleanString(trimmed);
      
      // 1. Search in member list first (Primary source)
      let foundName = memberList.find(m => cleanString(m).includes(cleanTrimmed));
      
      // 2. Fallback to attendance data if not in member list
      if (!foundName) {
        const foundInLogs = attendanceData.find(l => cleanString(l.name).includes(cleanTrimmed));
        if (foundInLogs) foundName = foundInLogs.name;
      }

      // 3. Fallback to Strava summaries if still not found
      if (!foundName) {
        const stravaKey = Object.keys(stravaSummaries).find(k => cleanString(k).includes(cleanTrimmed));
        if (stravaKey) foundName = stravaKey;
      }
      
      if (!foundName) {
        alert("회원리스트, 출석부 또는 Strava 기록에서 이름을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      setSelectedMember(foundName);
      
      const logs = attendanceData.filter(l => l.name === foundName);
      const absoluteMaxHR = Math.max(...logs.map(l => l.maxHeartRate || 0));
      if (absoluteMaxHR > 0) {
        setMaxHeartRate(absoluteMaxHR);
      }

      // Add Strava summary context to AI feedback
      let stravaInfo = stravaSummaries[foundName];
      
      // Safety: If not found by name mapping, try to find by direct name match in strava data
      if (!stravaInfo) {
        const cleanName = cleanString(foundName);
        const altName = Object.keys(stravaSummaries).find(k => cleanString(k) === cleanName);
        if (altName) stravaInfo = stravaSummaries[altName];
      }

      const enhancedLogs = [...logs];
      if (stravaInfo) {
        enhancedLogs.push({
          timestamp: 'Current Week Summary',
          name: foundName,
          trainingType: `Strava Summary: ${stravaInfo.distance}, ${stravaInfo.runs} runs, Pace: ${stravaInfo.pace}`,
          intensity: 0,
          duration: 0,
          notes: `Strava 주간 요약 데이터입니다. 총 거리 ${stravaInfo.distance}, 평균 페이스 ${stravaInfo.pace}, 총 ${stravaInfo.runs}회 달리기 기록이 있습니다.`,
          condition: 'Good',
          source: 'Strava'
        });
      }

      const feedback = await getMemberFeedback(foundName, enhancedLogs, stravaInfo);
      setAiFeedback(feedback);
    } catch (error) {
      console.error("Search error:", error);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
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
                      {nameToStravaId[selectedMember] && (
                        <span className="text-orange-400/60 font-black text-[10px] uppercase tracking-widest ml-2">
                          Mapped to Strava: {nameToStravaId[selectedMember]}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300 font-black text-xs uppercase tracking-widest">
                      {new Date().toLocaleDateString()}
                    </div>
                  </div>
                  
                  <h2 className="text-4xl md:text-6xl font-black text-[#2D2926] mb-10 tracking-tighter italic uppercase font-display leading-none">
                    {selectedMember}<span className="text-orange-500">'s</span><br />Performance
                    {nameToStravaId[selectedMember] && (
                      <div className="mt-4 flex items-center gap-2">
                        <span className="bg-[#FC4C02] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-orange-500/20">
                          <TrendingUp size={10} /> Strava Linked
                        </span>
                        <span className="text-slate-300 font-black text-[10px] uppercase tracking-widest">@{nameToStravaId[selectedMember]}</span>
                      </div>
                    )}
                  </h2>
                  
                  <div className="space-y-8">
                    {/* Strava Analysis Box */}
                    <div className="bg-orange-50/50 p-8 rounded-[2rem] border border-orange-100 relative group transition-all duration-500">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="text-[#FC4C02]" size={20} />
                        <h4 className="text-[11px] font-black text-[#FC4C02] uppercase tracking-[0.2em]">스트라바 상세 분석 (이번주 내용기반)</h4>
                      </div>
                      <div className="space-y-4 relative z-10">
                        {aiFeedback?.stravaAnalysis.split(/\\n|\n/).filter(p => p.trim()).map((para, idx) => (
                          <p key={idx} className="text-lg md:text-xl font-bold text-slate-800 italic leading-relaxed break-keep">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Coaching Analysis Box */}
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 relative group hover:bg-orange-50/30 transition-colors duration-500">
                      <Quote className="text-slate-200 absolute -top-2 -left-2 group-hover:text-orange-200 transition-colors" size={60} />
                      <div className="flex items-center gap-2 mb-4 relative z-10">
                        <BrainCircuit className="text-slate-400" size={20} />
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">(정규훈련 데이터 기반 코칭)</h4>
                      </div>
                      <div className="space-y-4 relative z-10 pl-4">
                        {aiFeedback?.coachingAnalysis.split(/\\n|\n/).filter(p => p.trim()).map((para, idx) => (
                          <p key={idx} className="text-lg md:text-xl font-bold text-slate-800 italic leading-relaxed break-keep">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stats & Philosophy Column */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                  <StatsCard label="평균 심박수" value={`${stats?.avgHeart} BPM`} icon={<Heart className="text-white" size={18} />} colorClass="bg-rose-500" />
                  <StatsCard label="평균 체감 강도" value={`${stats?.avgIntensity}/10`} icon={<TrendingUp className="text-white" size={18} />} colorClass="bg-orange-500" />
                  <StatsCard label="출석 횟수" value={`${stats?.totalCount}회`} icon={<Calendar className="text-white" size={18} />} colorClass="bg-slate-800" />
                  {currentMemberStravaSummary && (
                    <StatsCard 
                      label="이번 주 주행 거리" 
                      value={currentMemberStravaSummary.distance} 
                      icon={<TrendingUp className="text-white" size={18} />} 
                      colorClass="bg-[#FC4C02]" 
                    />
                  )}
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

              {/* Strava Activity Section (Summary Card) */}
              {nameToStravaId[selectedMember] && (
                <section className="lg:col-span-12 bg-[#FCF7F2] rounded-[2.5rem] border border-orange-100 overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-orange-50 flex items-center justify-between bg-orange-50/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#FC4C02] p-1.5 rounded-lg">
                        <TrendingUp className="text-white" size={16} />
                      </div>
                      <h3 className="font-black text-xl uppercase tracking-tighter italic font-display text-[#FC4C02]">Weekly Strava Summary</h3>
                    </div>
                    <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Linked Account: {nameToStravaId[selectedMember]}</div>
                  </div>
                  
                  {currentMemberStravaSummary ? (
                    <div className="p-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Total Distance</span>
                        <span className="text-3xl font-black text-slate-900 font-display">{currentMemberStravaSummary.distance}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Avg Pace</span>
                        <span className="text-3xl font-black text-slate-900 font-display">{currentMemberStravaSummary.pace}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Total Runs</span>
                        <span className="text-3xl font-black text-slate-900 font-display">{currentMemberStravaSummary.runs}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Longest Run</span>
                        <span className="text-3xl font-black text-slate-900 font-display">{currentMemberStravaSummary.longest}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Elev Gain</span>
                        <span className="text-3xl font-black text-slate-900 font-display">{currentMemberStravaSummary.elevation}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Club Rank</span>
                        <span className="text-3xl font-black text-orange-500 font-display">#{currentMemberStravaSummary.rank}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-orange-300 font-bold italic uppercase tracking-widest text-sm">이번 주 Strava 활동 요약 데이터가 없습니다.</p>
                      <p className="text-slate-400 text-[10px] mt-2">데이터 스크래핑 업데이트를 기다려주세요.</p>
                    </div>
                  )}
                </section>
              )}

              {/* History Table Card (Attendance) */}
              <section className="lg:col-span-12 bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-orange-500" size={20} />
                    <h3 className="font-black text-xl uppercase tracking-tighter italic font-display">Attendance History</h3>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last {currentMemberAttendanceLogs.length} Sessions</div>
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
                      {currentMemberAttendanceLogs.slice().reverse().map((log, i) => (
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
