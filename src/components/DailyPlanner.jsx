import React, { useState } from 'react';
import { CheckCircle2, CheckCircle, PlusCircle, Trash2, ArrowRightCircle, XCircle } from 'lucide-react';
import { getTodayDateString, addDays } from '../utils/constants';
import { useApp } from '../App';
import PomodoroTimer from './PomodoroTimer';

export default function DailyPlanner({ dailyPlans, setDailyPlans, userProfile }) {
    const { showToast } = useApp();
    const today = getTodayDateString();
    const [nt, setNt] = useState('');
    const todos = dailyPlans[today]?.todos || [];

    const add = () => {
        if(!nt.trim()) return;
        const newPlans = {...dailyPlans};
        if(!newPlans[today]) newPlans[today] = { todos: [], checklist: [false, false, false], reflection: {} };
        newPlans[today].todos.push({ id: Date.now(), task: nt, duration: 30, status: 'pending', aiScheduled: false });
        setDailyPlans(newPlans);
        setNt('');
    };

    // 상태 변경 이벤트 (pending -> done -> postponed -> failed)
    const updateStatus = (id, newStatus) => {
        setDailyPlans(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const targetIndex = next[today].todos.findIndex(t => t.id === id);
            if (targetIndex === -1) return next;
            
            const taskObj = next[today].todos[targetIndex];
            taskObj.status = newStatus;

            // 만약 'postponed'(미루기) 상태가 되었다면, 내일 날짜로 과제를 복제합니다.
            if (newStatus === 'postponed') {
                const tomorrow = addDays(today, 1);
                if (!next[tomorrow]) next[tomorrow] = { todos: [], checklist: [false,false,false], reflection: {} };
                
                // 내일에 중복 항목이 있는지 확인 후 없으면 추가
                const isDupe = next[tomorrow].todos.some(t => t.id === `postponed-${taskObj.id}`);
                if (!isDupe) {
                    next[tomorrow].todos.push({
                        ...taskObj,
                        id: `postponed-${taskObj.id}`,
                        status: 'pending',
                        startTime: null, // 시간 배정은 리셋
                        task: `${taskObj.task} (어제 밀림)`
                    });
                }
            }
            return next;
        });

        if (newStatus === 'postponed') showToast('일정을 내일로 미뤘습니다. 내일 꼭 해결해 보아요!', 'info');
        if (newStatus === 'done') showToast('과제 하나를 끝냈습니다! 대단해요!', 'success');
        if (newStatus === 'failed') showToast('아쉽게 못했군요. 다음엔 꼭 성공하길!', 'error');
    };

    const remove = (id) => {
        setDailyPlans(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            next[today].todos = next[today].todos.filter(t => t.id !== id);
            return next;
        });
    };

    // 상태별 스타일 맵
    const stConfig = {
        'pending': { c: 'bg-emerald-50 border-emerald-500 shadow-sm hover:scale-[1.01]', t: 'text-slate-800' },
        'done': { c: 'bg-slate-50 border-slate-300 opacity-60 grayscale-[0.5]', t: 'line-through text-slate-500' },
        'postponed': { c: 'bg-amber-50 border-amber-300 opacity-70', t: 'text-amber-700 decoration-wavy' },
        'failed': { c: 'bg-red-50 border-red-300 opacity-70', t: 'text-red-700 line-through' }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-xl border-t-8 border-emerald-400">
                <h2 className="text-3xl font-black mb-2 flex items-center gap-3 text-slate-800">
                    <CheckCircle2 className="text-emerald-500" size={36}/> 오늘의 실천 계획
                </h2>
                <p className="text-sm font-bold text-slate-400 mb-8">할 일을 마쳤다면 초록색 체크를, 미루고 싶다면 노란색 화살표를 눌러주세요.</p>
                
                <div className="space-y-4 mb-10">
                    {todos.map(t => {
                        const s = stConfig[t.status] || stConfig['pending'];
                        return (
                            <div key={t.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border-l-8 transition-all gap-4 ${s.c}`}>
                                <div className="flex flex-col">
                                    <span className={`text-lg font-black ${s.t}`}>{t.task}</span>
                                    {t.status === 'postponed' && <span className="text-xs font-bold text-amber-500 mt-1">내일 날짜로 과제가 넘어갔습니다.</span>}
                                    {t.status === 'failed' && <span className="text-xs font-bold text-red-400 mt-1">오늘은 실천하지 못했습니다.</span>}
                                    {t.startTime && t.status === 'pending' && <span className="text-xs font-bold text-slate-400 mt-1">🕒 {t.startTime} 시작 · {t.duration}분</span>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {/* 컨트롤 패널 */}
                                    {t.status !== 'done' && (
                                        <button onClick={()=>updateStatus(t.id, 'done')} className="flex items-center gap-1 px-3 py-2 bg-white text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all rounded-xl border border-emerald-100 shadow-sm font-bold text-sm">
                                            <CheckCircle size={18}/> 끝냄
                                        </button>
                                    )}
                                    {t.status !== 'postponed' && (
                                        <button onClick={()=>updateStatus(t.id, 'postponed')} className="flex items-center gap-1 px-2 py-2 bg-white text-amber-500 hover:bg-amber-500 hover:text-white transition-all rounded-xl border border-amber-100 shadow-sm font-bold text-sm">
                                            <ArrowRightCircle size={18}/> 미룸
                                        </button>
                                    )}
                                    {t.status !== 'failed' && (
                                        <button onClick={()=>updateStatus(t.id, 'failed')} className="flex items-center gap-1 px-2 py-2 bg-white text-slate-400 hover:bg-slate-500 hover:text-white transition-all rounded-xl border border-slate-100 shadow-sm font-bold text-sm">
                                            <XCircle size={18}/> 못함
                                        </button>
                                    )}
                                    <button onClick={()=>remove(t.id)} className="p-2 ml-1 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl border border-slate-100 shadow-sm">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {todos.length === 0 && (
                        <div className="py-16 text-center text-slate-300 font-bold border-4 border-dashed border-slate-50 rounded-[24px]">
                            위쪽 '과제 정리'에서 AI 계획을 세우거나<br/>아래에서 일정을 새로 추가해보세요!
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100 focus-within:border-emerald-400 transition-all">
                    <input 
                        value={nt} 
                        onChange={e=>setNt(e.target.value)} 
                        onKeyDown={e=>e.key==='Enter' && add()} 
                        className="flex-1 bg-transparent px-4 py-2 outline-none font-bold text-slate-700" 
                        placeholder="이곳에 추가하고 싶은 할 일을 직접 적어보세요."
                    />
                    <button onClick={add} className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2 shrink-0">
                        <PlusCircle size={20}/> 추가
                    </button>
                </div>
            </div>
            <div className="space-y-6">
                <PomodoroTimer userProfile={userProfile} />
            </div>
        </div>
    );
}
