import React, { useState } from 'react';
import { Zap, Star, Lightbulb, Gamepad2, Trash2, Bot, Calendar, Clock } from 'lucide-react';
import { getTodayDateString, addDays } from '../utils/constants';

export default function WeeklyTaskManager({ weeklyTasks, setWeeklyTasks, taskMatrix, setTaskMatrix, onAutoSchedule }) {
    const today = getTodayDateString();
    const [nt, setNt] = useState('');
    const [duration, setDuration] = useState('30');
    const [deadline, setDeadline] = useState(addDays(today, 7));
    
    // 드래그 상태 관리 (PC용)
    const [draggedTaskId, setDraggedTaskId] = useState(null);

    const qInfo = [
        { key: 'urgentImportant', t: '🔥 1순위: 중요하고 급한 일', c: 'border-red-400 bg-red-50 text-red-700', i: <Zap size={16}/> },
        { key: 'notUrgentImportant', t: '⭐ 2순위: 중요하지만 급하지 않은 일', c: 'border-blue-400 bg-blue-50 text-blue-700', i: <Star size={16}/> },
        { key: 'urgentNotImportant', t: '📢 3순위: 중요하지 않지만 급한 일', c: 'border-amber-400 bg-amber-50 text-amber-700', i: <Lightbulb size={16}/> },
        { key: 'notUrgentNotImportant', t: '☁️ 4순위: 중요하지 않고 급하지 않은 일', c: 'border-slate-300 bg-slate-50 text-slate-600', i: <Gamepad2 size={16}/> }
    ];

    const addTask = () => {
        if (!nt.trim()) return;
        const id = Date.now().toString();
        const newTask = { id, content: nt, duration: parseInt(duration), deadline };
        setWeeklyTasks([...weeklyTasks, newTask]);
        setTaskMatrix({
            ...taskMatrix,
            notUrgentNotImportant: [...(taskMatrix.notUrgentNotImportant || []), id]
        });
        setNt('');
    };

    const removeTask = (id, qKey) => {
        setWeeklyTasks(weeklyTasks.filter(t => t.id !== id));
        setTaskMatrix({
            ...taskMatrix,
            [qKey]: taskMatrix[qKey].filter(tid => tid !== id)
        });
    };

    // [이동 로직 개선] 버튼 클릭과 드래그 드롭 모두에서 사용하는 공통 함수
    const handleMoveTask = (taskId, targetKey) => {
        setTaskMatrix(prev => {
            const next = { ...prev };
            // 모든 위치에서 해당 아이디 제거
            Object.keys(next).forEach(k => {
                next[k] = (next[k] || []).filter(id => id !== taskId);
            });
            // 선택한 위치에 추가
            next[targetKey] = [...(next[targetKey] || []), taskId];
            return next;
        });
    };

    const onDragStart = (id) => {
        setDraggedTaskId(id);
    };

    const onDrop = (qKey) => {
        if (draggedTaskId) {
            handleMoveTask(draggedTaskId, qKey);
            setDraggedTaskId(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* 상단 입력 레이아웃 유지 */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-black text-slate-400 mb-2 ml-1">어떤 과제인가요?</label>
                        <input 
                            value={nt} onChange={e=>setNt(e.target.value)}
                            placeholder="과제 내용을 입력하세요..."
                            className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-violet-400 outline-none font-bold text-slate-700 transition-all"
                        />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-black text-slate-400 mb-2 ml-1">예상 시간(분)</label>
                        <input 
                            type="number" value={duration} onChange={e=>setDuration(e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-violet-400 outline-none font-bold text-slate-700 transition-all"
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block text-xs font-black text-slate-400 mb-2 ml-1">마감 기한</label>
                        <input 
                            type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-violet-400 outline-none font-bold text-slate-700 transition-all text-sm"
                        />
                    </div>
                    <button 
                        onClick={addTask}
                        className="self-end h-[58px] px-8 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-100"
                    >
                        추가
                    </button>
                </div>
            </div>

            {/* 4사분면 그리드 레이아웃 유지 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qInfo.map(q => (
                    <div 
                        key={q.key}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDrop(q.key)}
                        className={`p-5 rounded-[32px] border-2 min-h-[220px] transition-colors ${q.c}`}
                    >
                        <h3 className="font-black mb-4 flex items-center gap-2 text-sm">
                            {q.i} {q.t}
                        </h3>
                        <div className="space-y-3">
                            {(taskMatrix?.[q.key] || []).map(tid => {
                                const t = weeklyTasks.find(x => x.id === tid);
                                if (!t) return null;
                                return (
                                    <div 
                                        key={t.id}
                                        draggable
                                        onDragStart={() => onDragStart(t.id)}
                                        className="group relative bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800 leading-tight">{t.content}</p>
                                                <div className="flex items-center gap-3 mt-1 opacity-60 text-[10px] font-bold">
                                                    <span className="flex items-center gap-1"><Clock size={10}/> {t.duration}분</span>
                                                    <span className="flex items-center gap-1"><Calendar size={10}/> ~{t.deadline.split('-').slice(1).join('/')}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeTask(tid, q.key)} 
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>

                                        {/* [수정된 부분] 터치 기기 전용 이동 버튼 세트 */}
                                        <div className="flex gap-1 mt-4 border-t border-slate-50 pt-3">
                                            {qInfo.map((btn, idx) => (
                                                btn.key !== q.key && (
                                                    <button
                                                        key={btn.key}
                                                        onClick={() => handleMoveTask(t.id, btn.key)}
                                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-black bg-slate-50 text-slate-400 hover:bg-violet-100 hover:text-violet-600 transition-all border border-slate-100 active:scale-90"
                                                    >
                                                        {idx + 1}순위
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* 하단 버튼 레이아웃 유지 */}
            <div className="pt-6">
                <button 
                    onClick={onAutoSchedule} 
                    className="w-full py-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black rounded-3xl shadow-xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all text-xl"
                >
                    <Bot className="animate-pulse" size={28}/> AI 스마트 마감일 자동 계획 만들기
                </button>
            </div>
        </div>
    );
}
