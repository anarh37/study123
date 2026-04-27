import React, { useState } from 'react';
import { getTodayDateString, getStartOfWeek } from '../utils/constants';
import { BrainCircuit, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReflectionJournal({ dailyPlans, setDailyPlans }) {
    const today = getTodayDateString();
    const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date(today)));
    const [sel, setSel] = useState(today);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        return getTodayDateString(d);
    });

    const reflection = dailyPlans[sel]?.reflection || { emotion: '', achieved: '', rating: 3 };

    const update = (f, v) => {
        setDailyPlans(prev => {
            const next = prev ? JSON.parse(JSON.stringify(prev)) : {};
            if (!next[sel]) next[sel] = { todos: [], checklist: [false,false,false], reflection: {} };
            if (!next[sel].reflection) next[sel].reflection = { emotion: '', achieved: '', rating: 3 };
            next[sel].reflection[f] = v;
            next[sel].reflection.updatedAt = new Date().toISOString();
            return next;
        });
    };

    return (
        <div className="bg-white p-8 rounded-[32px] shadow-xl border-t-8 border-violet-400 animate-fade-in max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h2 className="text-3xl font-black flex items-center gap-3 text-slate-800">
                    <BrainCircuit className="text-violet-500" size={36}/> 성찰 일지
                </h2>
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                    <button onClick={() => { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft size={18}/></button>
                    <span className="text-xs font-black w-24 text-center text-slate-600">{weekStart.getMonth()+1}월 {weekStart.getDate()}일 주</span>
                    <button onClick={() => { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight size={18}/></button>
                </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
                {weekDates.map(d => (
                    <button 
                        key={d} 
                        onClick={() => setSel(d)} 
                        disabled={d > today} 
                        className={`flex-shrink-0 px-5 py-3 rounded-2xl text-xs font-black transition-all border-2 ${sel === d ? 'bg-violet-600 text-white border-violet-600 shadow-lg' : d > today ? 'bg-slate-50 text-slate-300 border-transparent opacity-50' : 'bg-slate-50 text-slate-500 border-transparent hover:border-violet-200'}`}
                    >
                        {d.slice(5).replace('-', '/')} {d === today && '(오늘)'}
                        {dailyPlans[d]?.reflection?.rating && <div className="mt-1 text-center">✅</div>}
                    </button>
                ))}
            </div>
            {sel > today ? (
                <div className="py-20 text-center text-slate-300 font-bold bg-slate-50 rounded-[24px]">미래의 나에게 일기를 쓸 수는 없어요!<br/>오늘 밤에 다시 만나요 👋</div>
            ) : (
                <div className="space-y-8 mt-4">
                    <div className="bg-violet-50 p-6 rounded-2xl border border-violet-100">
                        <label className="block text-sm font-black text-violet-700 mb-4">🌈 오늘 나의 기분 보석은?</label>
                        <div className="flex justify-between">
                            {[
                                { emoji: '😆', label: '신나요' },
                                { emoji: '😊', label: '기뻐요' },
                                { emoji: '😐', label: '그저그래요' },
                                { emoji: '😢', label: '슬퍼요' },
                                { emoji: '😫', label: '힘들어요' },
                            ].map(e => (
                                <button key={e.emoji} onClick={() => update('emotion', e.emoji)} className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${reflection.emotion === e.emoji ? 'bg-white shadow-lg scale-125' : 'grayscale-[0.5] hover:grayscale-0 hover:scale-110'}`}>
                                    <span className="text-4xl">{e.emoji}</span>
                                    <span className="text-[11px] font-black text-slate-500">{e.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-3">⭐ 오늘 나에게 주는 칭찬 (노력 점수)</label>
                        <div className="flex gap-3">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => update('rating', n)} className="text-3xl transition-transform hover:scale-125">
                                    {(reflection.rating || 0) >= n ? (
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    ) : (
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-3">📝 오늘 가장 기억에 남는 보람찬 순간</label>
                        <textarea 
                            value={reflection.achieved || ''} 
                            onChange={e=>update('achieved', e.target.value)} 
                            className="w-full p-6 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:border-violet-400 focus:bg-white transition-all font-bold text-slate-700 shadow-inner" 
                            rows={4} 
                            placeholder="오늘의 성장을 칭찬해 주세요!"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
