import React, { useMemo, useState } from 'react';
import { getTodayDateString, getStartOfWeek } from '../utils/constants';
import { CheckCircle, BookOpen, Trophy, TrendingUp, ChevronLeft, ChevronRight, CalendarCheck, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function Dashboard({ dailyPlans, goals }) {
    // 주간 완수율 주차 탐색 state
    const [weekOffset, setWeekOffset] = useState(0); // 0 = 이번 주, -1 = 지난 주, ...

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

    // 주간 완수율 계산 (weekOffset 기준)
    const weeklyStats = useMemo(() => {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (weekOffset * 7));
        const ws = getStartOfWeek(targetDate);
        const todayStr = getTodayDateString();

        let done = 0, total = 0;
        const dailyBreakdown = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(ws);
            d.setDate(ws.getDate() + i);
            const dateStr = getTodayDateString(d);
            // 미래 날짜면 스킵 (이번 주의 경우)
            if (dateStr > todayStr && weekOffset === 0) {
                dailyBreakdown.push({ date: dateStr, dayLabel: dateStr.slice(5).replace('-', '/'), done: 0, total: 0, rate: null, isFuture: true });
                continue;
            }
            const todos = dailyPlans?.[dateStr]?.todos || [];
            const dayTotal = todos.length;
            const dayDone = todos.filter(t => t.status === 'done').length;
            total += dayTotal;
            done += dayDone;
            dailyBreakdown.push({
                date: dateStr,
                dayLabel: dateStr.slice(5).replace('-', '/'),
                done: dayDone,
                total: dayTotal,
                rate: dayTotal > 0 ? Math.round(dayDone / dayTotal * 100) : 0,
                isFuture: false
            });
        }

        const rate = total > 0 ? Math.round(done / total * 100) : null;
        const wsStr = `${ws.getMonth() + 1}월 ${ws.getDate()}일`;
        const we = new Date(ws); we.setDate(ws.getDate() + 6);
        const weStr = `${we.getMonth() + 1}월 ${we.getDate()}일`;

        return { done, total, rate, dailyBreakdown, wsStr, weStr, weekStart: ws };
    }, [dailyPlans, weekOffset]);

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

    const rateColor = weeklyStats.rate === null ? 'from-slate-400 to-slate-500'
        : weeklyStats.rate >= 80 ? 'from-emerald-400 to-teal-500'
        : weeklyStats.rate >= 50 ? 'from-violet-400 to-indigo-500'
        : 'from-amber-400 to-orange-500';

    const weekLabel = weekOffset === 0 ? '이번 주' : weekOffset === -1 ? '지난 주' : `${Math.abs(weekOffset)}주 전`;

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-4xl mx-auto">
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 text-[8rem] sm:text-[12rem] rotate-12">🚀</div>
                <div className="relative z-10">
                    <p className="text-sm sm:text-lg font-bold opacity-80 mb-2">오늘도 멋진 성장을 기록 중입니다!</p>
                    <p className="text-2xl sm:text-4xl font-black mb-4 sm:mb-6 leading-tight">"{goals.career || '꿈을 향해'}"<br/><span className="text-lg sm:text-2xl font-bold opacity-90 text-violet-200">목표까지 한 걸음 더!</span></p>
                    
                    {goals.academic && (
                        <div className="bg-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-sm border border-white/20 mb-6 sm:mb-8 w-full max-w-lg">
                            <p className="text-violet-200 font-bold text-xs sm:text-sm mb-2">🎯 이번 달 나의 목표</p>
                            <ul className="list-none space-y-1">
                                {goals.academic.split('\n').filter(g => g.trim()).map((g, i) => (
                                    <li key={i} className="text-white font-bold text-sm sm:text-lg flex items-start gap-2">
                                        <span className="text-violet-300 mt-1 pb-1">•</span>
                                        <span>{g}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs font-bold uppercase opacity-60">Success Streak</span>
                            <span className="text-xl sm:text-3xl font-black">{streak}일 연속 실천 🔥</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 주간 과제 완수율 배너 */}
            <div className={`bg-gradient-to-r ${rateColor} rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 text-white shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <CalendarCheck size={20} className="opacity-90"/>
                        <span className="font-black text-sm sm:text-base">주간 과제 완수율</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setWeekOffset(prev => prev - 1)}
                            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition active:scale-90"
                        >
                            <ChevronLeft size={16}/>
                        </button>
                        <span className="text-white/90 text-[11px] sm:text-xs font-bold bg-white/20 px-3 py-1 rounded-full min-w-[80px] text-center">
                            {weekLabel}
                        </span>
                        <button
                            onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))}
                            disabled={weekOffset === 0}
                            className={`p-1.5 rounded-lg transition active:scale-90 ${weekOffset === 0 ? 'bg-white/10 opacity-40 cursor-not-allowed' : 'bg-white/20 hover:bg-white/30'}`}
                        >
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                </div>
                <p className="text-white/60 text-[11px] font-bold mb-3">
                    {weeklyStats.wsStr} ~ {weeklyStats.weStr}
                </p>
                {weeklyStats.rate !== null ? (
                    <>
                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-4xl sm:text-5xl font-black">{weeklyStats.rate}</span>
                            <span className="text-xl sm:text-2xl font-bold opacity-80">%</span>
                            <span className="text-xs sm:text-sm font-bold opacity-70 ml-1">
                                ({weeklyStats.total}개 중 {weeklyStats.done}개 완료)
                            </span>
                        </div>
                        <div className="h-3 w-full bg-white/30 rounded-full overflow-hidden mb-3">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-1000"
                                style={{ width: `${weeklyStats.rate}%` }}
                            />
                        </div>
                        {/* 요일별 미니 차트 */}
                        <div className="grid grid-cols-7 gap-1 mt-3">
                            {weeklyStats.dailyBreakdown.map((day, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                    <div className={`w-full rounded-lg text-center py-1 text-[10px] font-black ${
                                        day.isFuture ? 'bg-white/10 text-white/30' :
                                        day.rate === null || day.total === 0 ? 'bg-white/15 text-white/50' :
                                        day.rate >= 80 ? 'bg-white/40 text-white' :
                                        day.rate >= 50 ? 'bg-white/25 text-white/90' :
                                        'bg-white/15 text-white/70'
                                    }`}>
                                        {day.isFuture ? '-' : day.total === 0 ? '-' : `${day.rate}%`}
                                    </div>
                                    <span className="text-[9px] font-bold text-white/50 mt-1">{day.dayLabel.split('/')[1]}일</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs font-bold mt-3 opacity-80">
                            {weeklyStats.rate >= 80 ? '🎉 정말 잘하고 있어요! 최고예요!' :
                             weeklyStats.rate >= 50 ? '⚡ 조금만 더 힘내봐요!' :
                             '💪 오늘부터 다시 시작해 봐요!'}
                        </p>
                    </>
                ) : (
                    <p className="text-white/80 font-bold text-sm mt-1">이 주에 등록된 과제가 아직 없어요.</p>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="bg-white p-4 sm:p-8 rounded-[20px] sm:rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 bg-emerald-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 text-emerald-600"><CheckCircle size={24} className="sm:hidden"/><CheckCircle size={32} className="hidden sm:block"/></div>
                    <span className="text-slate-500 font-bold text-[10px] sm:text-sm text-center">총 완료 과제</span>
                    <span className="text-2xl sm:text-4xl font-black text-slate-800 mt-1">{totalDone}<span className="text-sm sm:text-xl">개</span></span>
                </div>
                <div className="bg-white p-4 sm:p-8 rounded-[20px] sm:rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 bg-violet-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 text-violet-600"><BookOpen size={24} className="sm:hidden"/><BookOpen size={32} className="hidden sm:block"/></div>
                    <span className="text-slate-500 font-bold text-[10px] sm:text-sm text-center">누적 학습</span>
                    <span className="text-xl sm:text-4xl font-black text-slate-800 mt-1">{formatStudyTime(totalStudyTime)}</span>
                </div>
                <div className="bg-white p-4 sm:p-8 rounded-[20px] sm:rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 bg-amber-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 text-amber-600"><Trophy size={24} className="sm:hidden"/><Trophy size={32} className="hidden sm:block"/></div>
                    <span className="text-slate-500 font-bold text-[10px] sm:text-sm text-center">평균 노력</span>
                    <span className="text-2xl sm:text-4xl font-black text-slate-800 mt-1">{averageRating}</span>
                </div>
            </div>

            {/* Growth Chart */}
            <div className="bg-white p-4 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border border-slate-100">
                <h3 className="font-black text-lg sm:text-xl text-slate-800 mb-4 sm:mb-8 flex items-center gap-2">
                    <TrendingUp className="text-violet-600"/> 최근 2주 나의 성장 그래프
                </h3>
                <div className="h-[220px] sm:h-[300px] w-full">
                    <ResponsiveContainer>
                        <LineChart data={recentData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                            <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} interval={window.innerWidth < 640 ? 1 : 0}/>
                            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30}/>
                            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} hide/>
                            <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}/>
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}/>
                            <Line yAxisId="left" name="과제 완료율(%)" type="monotone" dataKey="완료율" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}/>
                            <Line yAxisId="right" name="노력 점수" type="monotone" dataKey="노력점수" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
