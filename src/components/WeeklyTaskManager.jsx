import React, { useState } from 'react';
import { Zap, Star, Lightbulb, Gamepad2, GripVertical, Trash2, Bot, Calendar, Clock, LayoutList } from 'lucide-react';
import { getTodayDateString, addDays } from '../utils/constants';

export default function WeeklyTaskManager({ weeklyTasks, setWeeklyTasks, taskMatrix, setTaskMatrix, onAutoSchedule }) {
    const today = getTodayDateString();
    const [nt, setNt] = useState('');
    const [duration, setDuration] = useState('30');
    const [deadline, setDeadline] = useState(addDays(today, 7));
    
    // Drag state
    const [draggedTaskId, setDraggedTaskId] = useState(null);

    const qInfo = [
        { key: 'urgentImportant', t: '🔥 1순위: 중요하고 급한 일', c: 'border-red-400 bg-red-50 text-red-700', i: <Zap size={16}/> },
        { key: 'notUrgentImportant', t: '⭐ 2순위: 중요하지만 급하지 않은 일', c: 'border-blue-400 bg-blue-50 text-blue-700', i: <Star size={16}/> },
        { key: 'urgentNotImportant', t: '📢 3순위: 중요하지 않지만 급한 일', c: 'border-amber-400 bg-amber-50 text-amber-700', i: <Lightbulb size={16}/> },
        { key: 'notUrgentNotImportant', t: '☁️ 4순위: 중요하지도, 급하지도 않은 일', c: 'border-slate-300 bg-slate-50 text-slate-500', i: <Gamepad2 size={16}/> }
    ];

    const addTask = () => {
        if (!nt.trim() || !duration || !deadline) return;
        const id = `t-${Date.now()}`;
        setWeeklyTasks([...(weeklyTasks || []), {
            id, 
            content: nt, 
            duration: parseInt(duration, 10), 
            deadline
        }]);
        setTaskMatrix({...taskMatrix, notUrgentImportant: [...(taskMatrix?.notUrgentImportant || []), id]});
        setNt('');
        setDuration('30');
    };

    const removeTask = (id, key) => {
        setWeeklyTasks((weeklyTasks || []).filter(t => t.id !== id));
        setTaskMatrix({
            ...taskMatrix, 
            [key]: (taskMatrix?.[key] || []).filter(tid => tid !== id)
        });
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, taskId) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        // Hide ghost image issue, or set opacity
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDraggedTaskId(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetKey) => {
        e.preventDefault();
        if (!draggedTaskId) return;

        // 찾기: 현재 draggedTaskId 가 어느 quadrant에 있는지
        let sourceKey = null;
        Object.keys(taskMatrix || {}).forEach(key => {
            if ((taskMatrix[key] || []).includes(draggedTaskId)) sourceKey = key;
        });

        if (sourceKey && sourceKey !== targetKey) {
            setTaskMatrix(prev => {
                const next = { ...prev };
                next[sourceKey] = (next[sourceKey] || []).filter(id => id !== draggedTaskId);
                next[targetKey] = [...(next[targetKey] || []), draggedTaskId];
                return next;
            });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
            {/* 개선된 과제 세부 입력 폼 */}
            <div className="bg-white p-6 rounded-[32px] shadow-xl border-t-8 border-violet-400">
                <h3 className="font-black text-slate-800 text-xl mb-4 flex items-center gap-2">
                    <LayoutList className="text-violet-500"/> 새로운 과제 추가하기
                </h3>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 bg-slate-50 rounded-2xl flex items-center p-2 focus-within:ring-2 focus-within:ring-violet-400">
                        <input 
                            value={nt} 
                            onChange={e=>setNt(e.target.value)} 
                            onKeyDown={e=>e.key==='Enter' && addTask()} 
                            className="bg-transparent w-full px-4 py-2 outline-none font-bold text-slate-700" 
                            placeholder="이번 주에 해야 할 숙제나 과제명 적기!"
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="bg-slate-50 rounded-2xl flex items-center px-4 shrink-0 focus-within:ring-2 focus-within:ring-violet-400">
                            <Clock size={16} className="text-slate-400 mr-2"/>
                            <input 
                                type="number" 
                                value={duration} 
                                onChange={e=>setDuration(e.target.value)}
                                className="bg-transparent w-16 py-4 outline-none font-bold text-slate-700 text-center" 
                                min="5" step="5"
                            />
                            <span className="text-slate-500 font-bold text-sm">분</span>
                        </div>
                        
                        <div className="bg-slate-50 rounded-2xl flex items-center px-4 shrink-0 focus-within:ring-2 focus-within:ring-violet-400">
                            <Calendar size={16} className="text-slate-400 mr-2"/>
                            <input 
                                type="date" 
                                value={deadline} 
                                min={today}
                                onChange={e=>setDeadline(e.target.value)}
                                className="bg-transparent py-4 outline-none font-bold text-slate-700 text-sm" 
                            />
                        </div>

                        <button onClick={addTask} className="bg-violet-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-violet-700 transition active:scale-95 shrink-0">
                            추가
                        </button>
                    </div>
                </div>
            </div>
            
            <p className="text-slate-500 text-center font-bold">💡 과제 상자를 마우스로 꾹 눌러서(드래그) 원하는 우선순위 칸으로 옮겨보세요!</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qInfo.map(q => (
                    <div 
                        key={q.key} 
                        className={`min-h-[220px] rounded-[24px] border-2 p-5 flex flex-col transition-colors ${q.c}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, q.key)}
                    >
                        <div className="font-black text-sm mb-4 flex items-center gap-2 relative">
                            {q.i} {q.t}
                        </div>
                        <div className="flex-1 flex flex-col gap-3 content-start">
                            {(taskMatrix?.[q.key] || []).map(tid => {
                                const t = (weeklyTasks || []).find(x => x.id === tid);
                                return t && (
                                    <div 
                                        key={tid} 
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, tid)}
                                        onDragEnd={handleDragEnd}
                                        className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col animate-fade-in group cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative"
                                    >
                                        <div className="flex items-center justify-between pointer-events-none">
                                            <div className="flex items-center gap-2">
                                                <GripVertical size={16} className="text-slate-300"/>
                                                <span className="font-black text-slate-800 text-base">{t.content}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2 pl-6 pr-1">
                                            <div className="flex gap-3 text-[11px] font-bold text-slate-400 pointer-events-none">
                                                <span className="flex items-center gap-1"><Clock size={12}/> {t.duration}분 예상</span>
                                                <span className="flex items-center gap-1"><Calendar size={12}/> {(t.deadline || today).slice(5).replace('-', '/')} 마감</span>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => removeTask(tid, q.key)} 
                                            className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                );
                            })}
                            {(taskMatrix?.[q.key] || []).length === 0 && (
                                <div className="h-full flex items-center justify-center text-slate-400 opacity-50 text-sm font-bold border-2 border-dashed border-current rounded-xl py-6 pointer-events-none">
                                    여기로 과제를 끌어다 놓으세요
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
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
