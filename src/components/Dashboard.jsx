import React, { useMemo } from 'react';
import { getTodayDateString } from '../utils/constants';
import { CheckCircle, BookOpen, Trophy, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard({ dailyPlans, goals }) {
    const recentData = useMemo(() => {
        const today = new Date();
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date(); d.setDate(today.getDate() - 13 + i);
            const ds = getTodayDateString(d);
            const plan = dailyPlans[ds];
            const ts = plan?.todos || [];
            const done = ts.filter(t => t.status === 'done').length;
            const total = ts.length;
            const studyMin = ts.filter(t => t.status === 'done').reduce((s, t) => s + (t.duration || 0), 0);
            return {
                date: ds.slice(5).replace('-', '/'),
                완료율: total > 0 ? Math.round(done / total * 100) : 0,
                학습시간: studyMin,
                노력점수: plan?.reflection?.rating || 0
            };
        });
    }, [dailyPlans]);

    const streak = useMemo(() => {
        let count = 0; let cursor = new Date();
        while(true) {
            const ds = getTodayDateString(cursor);
            if (dailyPlans[ds]?.todos?.some(t => t.status === 'done')) { count++; cursor.setDate(cursor.getDate()-1); }
            else break;
        }
        return count;
    }, [dailyPlans]);

    const totalDone = useMemo(() => {
        return Object.values(dailyPlans).reduce((acc, plan) => {
            return acc + (plan.todos?.filter(t => t.status === 'done').length || 0);
        }, 0);
    }, [dailyPlans]);

    const totalStudyTime = useMemo(() => {
        return Object.values(dailyPlans).reduce((acc, plan) => {
            return acc + (plan.todos?.filter(t => t.status === 'done').reduce((s, t) => s + (t.duration || 0), 0) || 0);
        }, 0);
    }, [dailyPlans]);

    const formatStudyTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m}분`;
        if (m === 0) return `${h}시간`;
        return `${h}시간 ${m}분`;
    };

    const averageRating = useMemo(() => {
        let sum = 0; let count = 0;
        Object.values(dailyPlans).forEach(plan => {
            if (plan.reflection?.rating) {
                sum += plan.reflection.rating;
                count++;
            }
        });
        return count > 0 ? (sum / count).toFixed(1) : '0';
    }, [dailyPlans]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-[32px] p-10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 text-[12rem] rotate-12">🚀</div>
                <div className="relative z-10">
                    <p className="text-lg font-bold opacity-80 mb-2">오늘도 멋진 성장을 기록 중입니다!</p>
                    <p className="text-4xl font-black mb-6 leading-tight">"{goals.career || '꿈을 향해'}"<br/><span className="text-2xl font-bold opacity-90 text-violet-200">목표까지 한 걸음 더!</span></p>
                    
                    {goals.academic && (
                        <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/20 mb-8 inline-block w-full max-w-lg">
                            <p className="text-violet-200 font-bold text-sm mb-2">🎯 이번 달 나의 목표</p>
                            <ul className="list-none space-y-1">
                                {goals.academic.split('\n').filter(g => g.trim()).map((g, i) => (
                                    <li key={i} className="text-white font-bold text-lg flex items-start gap-2">
                                        <span className="text-violet-300 mt-1 pb-1">•</span>
                                        <span>{g}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex gap-8">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase opacity-60">Success Streak</span>
                            <span className="text-3xl font-black">{streak}일 연속 실천 🔥</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 text-emerald-600"><CheckCircle size={32}/></div>
                    <span className="text-slate-500 font-bold text-sm">총 완료 과제</span>
                    <span className="text-4xl font-black text-slate-800 mt-1">{totalDone}개</span>
                </div>
                <div className="bg-white p-8 rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-4 text-violet-600"><BookOpen size={32}/></div>
                    <span className="text-slate-500 font-bold text-sm">누적 학습 시간</span>
                    <span className="text-4xl font-black text-slate-800 mt-1">{formatStudyTime(totalStudyTime)}</span>
                </div>
                <div className="bg-white p-8 rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 text-amber-600"><Trophy size={32}/></div>
                    <span className="text-slate-500 font-bold text-sm">나의 평균 노력 점수</span>
                    <span className="text-4xl font-black text-slate-800 mt-1">{averageRating}</span>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100">
                <h3 className="font-black text-xl text-slate-800 mb-8 flex items-center gap-2">
                    <TrendingUp className="text-violet-600"/> 최근 2주 나의 성장 그래프
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                        <LineChart data={recentData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                            <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10}/>
                            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} hide/>
                            <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}/>
                            <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                            <Line yAxisId="left" name="과제 완료율(%)" type="monotone" dataKey="완료율" stroke="#7c3aed" strokeWidth={4} dot={{ r: 6, strokeWidth: 3 }} activeDot={{ r: 8 }}/>
                            <Line yAxisId="right" name="노력 점수" type="monotone" dataKey="노력점수" stroke="#f59e0b" strokeWidth={4} dot={{ r: 6, strokeWidth: 3 }} activeDot={{ r: 8 }}/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
