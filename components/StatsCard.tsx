
import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, colorClass }) => (
  <div className="bg-white p-6 rounded-3xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] border border-slate-100 flex flex-col gap-4 group hover:border-orange-200 transition-all duration-300">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${colorClass} shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 font-display tracking-tight">{value}</p>
    </div>
  </div>
);

export default StatsCard;
