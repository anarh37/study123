import React, { useState, useMemo } from 'react';
import { CheckCircle2, CheckCircle, PlusCircle, Trash2, ArrowRightCircle, XCircle, Clock, Zap, AlertTriangle, Pencil } from 'lucide-react';
import { getTodayDateString, addDays, DAYS, TIME_SLOTS } from '../utils/constants';
import { useApp } from '../App';
import PomodoroTimer from './PomodoroTimer';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function DailyPlanner({ dailyPlans, setDailyPlans, userProfile, fixedSchedule, goldenTime }) {
    const { showToast } = useApp();
    const today = getTodayDateString();
    const [nt, setNt] = useState('');
    const todos = dailyPlans[today]?.todos || [];

    // 완료 시간 입력 모달 상태
    const [completionModal, setCompletionModal] = useState(null); // { id, task, defaultDuration }
    const [actualMinutes, setActualMinutes] = useState('');

    // 과제 수정 모달 상태
    const [editModal, setEditModal] = useState(null); // { id, task, duration }
    const [editTaskName, setEditTaskName] = useState('');
    const [editDuration, setEditDuration] = useState('');

    // 수정 모달 열기
    const openEditModal = (task) => {
        setEditModal({ id: task.id });
        setEditTaskName(task.task);
        setEditDuration(String(task.duration));
    };

    // 수정 확정
    const confirmEdit = () => {
        const newDuration = parseInt(editDuration, 10) || 0;
        if (!editTaskName.trim()) { showToast('과제명을 입력해 주세요!', 'error'); return; }
        if (newDuration <= 0) { showToast('1분 이상 입력해 주세요!', 'error'); return; }

        setDailyPlans(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const idx = next[today].todos.findIndex(t => t.id === editModal.id);
            if (idx !== -1) {
                next[today].todos[idx].task = editTaskName.trim();
                next[today].todos[idx].duration = newDuration;
            }
            return next;
        });
        showToast('과제가 수정되었어요! ✏️', 'success');
        setEditModal(null);
    };

    const add = () => {
        if(!nt.trim()) return;
        const newPlans = {...dailyPlans};
        if(!newPlans[today]) newPlans[today] = { todos: [], checklist: [false, false, false], reflection: {} };
        newPlans[today].todos.push({ id: Date.now(), task: nt, duration: 15, status: 'pending', aiScheduled: false });
        setDailyPlans(newPlans);
        setNt('');
    };

    // "끝냄" 버튼 클릭 시 → 모달을 열어서 실제 소요 시간을 입력받음
    const handleDoneClick = (task) => {
        setCompletionModal({ id: task.id, task: task.task, defaultDuration: task.duration });
        setActualMinutes(String(task.duration));
    };

    // 모달에서 "확인" 클릭 → 실제 시간 반영 + 상태 done + 우리반 활동 누적시간 반영
    const confirmCompletion = () => {
        const minutes = parseInt(actualMinutes, 10) || 0;
        if (minutes <= 0) {
            showToast('1분 이상 입력해 주세요!', 'error');
            return;
        }

        const taskId = completionModal.id;

        // 1. 과제 상태를 done으로 변경 + duration을 실제 소요 시간으로 업데이트
        setDailyPlans(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const targetIndex = next[today].todos.findIndex(t => t.id === taskId);
            if (targetIndex === -1) return next;
            next[today].todos[targetIndex].status = 'done';
            next[today].todos[targetIndex].duration = minutes;
            return next;
        });

        // 2. 우리반 활동 누적학습시간(leaderboard)에 반영
        const user = auth.currentUser;
        if (user) {
            const ref = doc(db, 'leaderboard', user.uid);
            updateDoc(ref, {
                totalStudyTime: increment(minutes),
                lastActive: Date.now()
            }).catch(err => console.error("학습시간 기록 오류:", err));
        }

        showToast(`${minutes}분 동안 열심히 했어요! 대단해요! 🎉`, 'success');
        setCompletionModal(null);
        setActualMinutes('');
    };

    // 상태 변경 이벤트 (postponed / failed)
    const updateStatus = (id, newStatus) => {
        const taskObjToUpdate = todos.find(t => t.id === id);
        if (!taskObjToUpdate) return;
        const oldStatus = taskObjToUpdate.status;

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
                
                // 원본 ID 추출 (postponed- 접두사 체이닝 방지)
                const originId = taskObj.id.toString().replace(/^(postponed-)+/, '');
                const postponedId = `postponed-${originId}`;
                
                // 내일에 중복 항목이 있는지 확인 후 없으면 추가
                const isDupe = next[tomorrow].todos.some(t => t.id === postponedId);
                if (!isDupe) {
                    next[tomorrow].todos.push({
                        ...taskObj,
                        id: postponedId,
                        status: 'pending',
                        startTime: null, // 시간 배정은 리셋
                        task: taskObj.task.replace(/ \(어제 밀림\)$/, '') + ' (어제 밀림)'
                    });
                }
            }
            return next;
        });

        // "끝냄(done)" 상태였던 과제를 다른 상태로 변경할 경우 누적 활동 시간 차감
        if (oldStatus === 'done' && newStatus !== 'done') {
            const user = auth.currentUser;
            if (user) {
                const ref = doc(db, 'leaderboard', user.uid);
                updateDoc(ref, {
                    totalStudyTime: increment(-taskObjToUpdate.duration),
                    lastActive: Date.now()
                }).catch(err => console.error("학습시간 차감 오류:", err));
            }
        }

        if (newStatus === 'postponed') showToast('일정을 내일로 미뤘습니다. 내일 꼭 해결해 보아요!', 'info');
        if (newStatus === 'failed') showToast('아쉽게 못했군요. 다음엔 꼭 성공하길!', 'error');
    };

    const remove = (id) => {
        const taskToDelete = todos.find(t => t.id === id);

        setDailyPlans(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            next[today].todos = next[today].todos.filter(t => t.id !== id);
            return next;
        });

        // "끝냄(done)" 상태의 과제를 삭제하면 우리반 활동 누적 시간 차감
        if (taskToDelete && taskToDelete.status === 'done') {
            const user = auth.currentUser;
            if (user) {
                const ref = doc(db, 'leaderboard', user.uid);
                updateDoc(ref, {
                    totalStudyTime: increment(-taskToDelete.duration),
                    lastActive: Date.now()
                }).catch(err => console.error("학습시간 차감 오류:", err));
                showToast(`완료된 과제가 삭제되어 활동 시간 ${taskToDelete.duration}분이 차감되었어요.`, 'info');
            }
        }
    };

    // 상태별 스타일 맵
    const stConfig = {
        'pending': { c: 'bg-emerald-50 border-emerald-500 shadow-sm hover:scale-[1.01]', t: 'text-slate-800' },
        'done': { c: 'bg-slate-50 border-slate-300 opacity-60 grayscale-[0.5]', t: 'line-through text-slate-500' },
        'postponed': { c: 'bg-amber-50 border-amber-300 opacity-70', t: 'text-amber-700 decoration-wavy' },
        'failed': { c: 'bg-red-50 border-red-300 opacity-70', t: 'text-red-700 line-through' }
    };
    // 오늘의 가용시간 계산
    const todayTimeInfo = useMemo(() => {
        const now = new Date();
        const todayDow = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1]; // 월~일
        const sleepConfig = userProfile?.sleep || { start: '22:00', end: '07:00' };
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const nowTime = `${String(currentHour).padStart(2, '0')}:${currentMin < 30 ? '00' : '30'}`;

        let totalAvailableSlots = 0;
        let remainingAvailableSlots = 0;

        TIME_SLOTS.forEach(time => {
            const cellId = `${todayDow}-${time}`;
            // 수면 시간 체크
            let isSleep = false;
            if (sleepConfig.start > sleepConfig.end) {
                if (time >= sleepConfig.start || time < sleepConfig.end) isSleep = true;
            } else {
                if (time >= sleepConfig.start && time < sleepConfig.end) isSleep = true;
            }
            // 고정 일정 체크 (황금시간은 가용시간에 포함)
            const isFixed = fixedSchedule?.[cellId] && !(goldenTime || []).includes(cellId);
            
            if (!isSleep && !isFixed) {
                totalAvailableSlots++;
                // 현재 시각 이후의 남은 슬롯만 카운트
                if (time >= nowTime) remainingAvailableSlots++;
            }
        });

        const totalAvailableMin = totalAvailableSlots * 30;
        const remainingAvailableMin = remainingAvailableSlots * 30;

        // 오늘 계획된 과제 시간 합산 (pending 상태만)
        const plannedMin = todos
            .filter(t => t.status === 'pending')
            .reduce((sum, t) => sum + (t.duration || 0), 0);
        
        // 오늘 완료한 과제 시간 합산
        const doneMin = todos
            .filter(t => t.status === 'done')
            .reduce((sum, t) => sum + (t.duration || 0), 0);

        const freeMin = Math.max(0, remainingAvailableMin - plannedMin);
        const isOverPlanned = plannedMin > remainingAvailableMin;

        return { totalAvailableMin, remainingAvailableMin, plannedMin, doneMin, freeMin, isOverPlanned };
    }, [fixedSchedule, goldenTime, userProfile, todos]);

    const formatTime = (min) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h === 0) return `${m}분`;
        if (m === 0) return `${h}시간`;
        return `${h}시간 ${m}분`;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-xl border-t-8 border-emerald-400">
                <h2 className="text-3xl font-black mb-2 flex items-center gap-3 text-slate-800">
                    <CheckCircle2 className="text-emerald-500" size={36}/> 오늘의 실천 계획
                </h2>
                <p className="text-sm font-bold text-slate-400 mb-6">할 일을 마쳤다면 초록색 체크를, 미루고 싶다면 노란색 화살표를 눌러주세요.</p>
                
                {/* 오늘의 가용시간 정보 카드 */}
                <div className={`p-5 rounded-2xl mb-8 border-2 ${todayTimeInfo.isOverPlanned ? 'bg-red-50 border-red-200' : 'bg-violet-50 border-violet-100'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        {todayTimeInfo.isOverPlanned 
                            ? <AlertTriangle size={18} className="text-red-500"/> 
                            : <Zap size={18} className="text-violet-600"/>
                        }
                        <span className="text-sm font-black text-slate-700">
                            {todayTimeInfo.isOverPlanned ? '⚠️ 과제가 남은 시간보다 많아요!' : '⚡ 오늘 나의 시간 현황'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">오늘 전체 가용</p>
                            <p className="text-lg font-black text-slate-700">{formatTime(todayTimeInfo.totalAvailableMin)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">지금부터 남은</p>
                            <p className="text-lg font-black text-violet-600">{formatTime(todayTimeInfo.remainingAvailableMin)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">계획된 과제</p>
                            <p className={`text-lg font-black ${todayTimeInfo.isOverPlanned ? 'text-red-500' : 'text-amber-600'}`}>{formatTime(todayTimeInfo.plannedMin)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">✅ 오늘 완료</p>
                            <p className="text-lg font-black text-emerald-600">{formatTime(todayTimeInfo.doneMin)}</p>
                        </div>
                    </div>
                    {todayTimeInfo.isOverPlanned && (
                        <p className="text-xs font-bold text-red-500 mt-3 text-center">계획이 남은 가용시간({formatTime(todayTimeInfo.remainingAvailableMin)})보다 {formatTime(todayTimeInfo.plannedMin - todayTimeInfo.remainingAvailableMin)} 초과했어요. 일부를 미루는 것도 방법이에요!</p>
                    )}
                    {!todayTimeInfo.isOverPlanned && todayTimeInfo.freeMin > 0 && (
                        <p className="text-xs font-bold text-violet-500 mt-3 text-center">아직 <strong>{formatTime(todayTimeInfo.freeMin)}</strong>의 여유 시간이 있어요! 💪</p>
                    )}
                </div>
                
                <div className="space-y-4 mb-10">
                    {todos.map(t => {
                        const s = stConfig[t.status] || stConfig['pending'];
                        return (
                            <div key={t.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border-l-8 transition-all gap-4 ${s.c}`}>
                                <div className="flex flex-col">
                                    <span className={`text-lg font-black ${s.t}`}>{t.task}</span>
                                    {t.status === 'postponed' && <span className="text-xs font-bold text-amber-500 mt-1">내일 날짜로 과제가 넘어갔습니다.</span>}
                                    {t.status === 'failed' && <span className="text-xs font-bold text-red-400 mt-1">오늘은 실천하지 못했습니다.</span>}
                                    {t.status === 'done' && <span className="text-xs font-bold text-emerald-500 mt-1">✅ {t.duration}분 동안 완료했어요!</span>}
                                    {t.startTime && t.status === 'pending' && <span className="text-xs font-bold text-slate-400 mt-1">🕒 {t.startTime} 시작 · {t.duration}분</span>}
                                    {!t.startTime && t.status === 'pending' && <span className="text-xs font-bold text-slate-400 mt-1">⏱ 예상 {t.duration}분</span>}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 w-full overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                                    {/* 컨트롤 패널 */}
                                    {t.status !== 'done' && (
                                        <button onClick={()=>handleDoneClick(t)} className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all rounded-xl border border-emerald-100 shadow-sm font-bold text-[11px] sm:text-sm shrink-0 whitespace-nowrap">
                                            <CheckCircle className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]"/> 끝냄
                                        </button>
                                    )}
                                    {t.status !== 'postponed' && (
                                        <button onClick={()=>updateStatus(t.id, 'postponed')} className="flex items-center gap-1 px-2.5 sm:px-2 py-1.5 sm:py-2 bg-white text-amber-500 hover:bg-amber-500 hover:text-white transition-all rounded-xl border border-amber-100 shadow-sm font-bold text-[11px] sm:text-sm shrink-0 whitespace-nowrap">
                                            <ArrowRightCircle className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]"/> 미룸
                                        </button>
                                    )}
                                    {t.status !== 'failed' && (
                                        <button onClick={()=>updateStatus(t.id, 'failed')} className="flex items-center gap-1 px-2.5 sm:px-2 py-1.5 sm:py-2 bg-white text-slate-400 hover:bg-slate-500 hover:text-white transition-all rounded-xl border border-slate-100 shadow-sm font-bold text-[11px] sm:text-sm shrink-0 whitespace-nowrap">
                                            <XCircle className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]"/> 못함
                                        </button>
                                    )}
                                    {t.status === 'pending' && (
                                        <button onClick={()=>openEditModal(t)} className="flex items-center gap-1 px-2.5 sm:px-2 py-1.5 sm:py-2 bg-white text-violet-400 hover:bg-violet-500 hover:text-white transition-all rounded-xl border border-violet-100 shadow-sm font-bold text-[11px] sm:text-sm shrink-0 whitespace-nowrap">
                                            <Pencil className="w-3.5 h-3.5 sm:w-[16px] sm:h-[16px]"/> 수정
                                        </button>
                                    )}
                                    <button onClick={()=>remove(t.id)} className="p-1.5 sm:p-2 ml-auto sm:ml-1 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl border border-slate-100 shadow-sm shrink-0">
                                        <Trash2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]"/>
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
                
                <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100 focus-within:border-emerald-400 transition-all">
                    <input 
                        value={nt} 
                        onChange={e=>setNt(e.target.value)} 
                        onKeyDown={e=>e.key==='Enter' && add()} 
                        className="flex-1 min-w-0 bg-transparent px-2 sm:px-4 py-2 outline-none font-bold text-slate-700" 
                        placeholder="추가하고 싶은 할 일을 적어보세요."
                    />
                    <button onClick={add} className="bg-emerald-500 text-white px-6 sm:px-8 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0">
                        <PlusCircle size={20}/> 추가
                    </button>
                </div>
            </div>
            <div className="space-y-6">
                <PomodoroTimer userProfile={userProfile} />
            </div>

            {/* 과제 완료 시간 입력 모달 */}
            {completionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setCompletionModal(null); setActualMinutes(''); }}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-sm w-full mx-auto border-t-8 border-emerald-400" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <Clock className="text-emerald-600" size={24}/>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">과제 완료! 🎉</h3>
                        </div>
                        <p className="text-slate-500 text-sm font-bold mb-6 mt-3">
                            "<strong className="text-slate-700">{completionModal.task}</strong>"를 완료했어요!<br/>
                            실제로 몇 분 동안 했는지 입력해 주세요.
                        </p>
                        <div className="bg-emerald-50 rounded-2xl p-4 flex items-center gap-3 mb-6 border border-emerald-100">
                            <input
                                type="number"
                                value={actualMinutes}
                                onChange={e => setActualMinutes(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmCompletion()}
                                className="flex-1 bg-white text-center text-2xl font-black text-slate-800 rounded-xl py-3 outline-none border-2 border-transparent focus:border-emerald-400 transition shadow-sm"
                                min="1"
                                max="300"
                                autoFocus
                            />
                            <span className="text-lg font-black text-emerald-700 shrink-0">분</span>
                        </div>
                        <div className="flex gap-2 text-xs font-bold text-slate-400 mb-6 justify-center flex-wrap">
                            {[10, 20, 30, 45, 60, 90].map(m => (
                                <button key={m} onClick={() => setActualMinutes(String(m))} 
                                    className={`px-3 py-1.5 rounded-full transition-all ${actualMinutes === String(m) ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                                    {m}분
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setCompletionModal(null); setActualMinutes(''); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">
                                취소
                            </button>
                            <button onClick={confirmCompletion} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-600 active:scale-95 transition-all">
                                완료 기록하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 과제 수정 모달 */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditModal(null)}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-sm w-full mx-auto border-t-8 border-violet-400" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center">
                                <Pencil className="text-violet-600" size={24}/>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">과제 수정 ✏️</h3>
                        </div>
                        
                        <div className="mt-5 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">과제명</label>
                                <input
                                    type="text"
                                    value={editTaskName}
                                    onChange={e => setEditTaskName(e.target.value)}
                                    className="w-full bg-slate-50 text-base font-black text-slate-800 rounded-2xl py-3 px-4 outline-none border-2 border-transparent focus:border-violet-400 transition shadow-sm"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">예상 소요시간</label>
                                <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                                    <input
                                        type="number"
                                        value={editDuration}
                                        onChange={e => setEditDuration(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                                        className="flex-1 bg-white text-center text-2xl font-black text-slate-800 rounded-xl py-2 outline-none border-2 border-transparent focus:border-violet-400 transition shadow-sm"
                                        min="1"
                                        max="300"
                                    />
                                    <span className="text-lg font-black text-violet-700 shrink-0">분</span>
                                </div>
                            </div>
                            <div className="flex gap-2 text-xs font-bold text-slate-400 justify-center flex-wrap">
                                {[5, 10, 15, 20, 30, 45, 60].map(m => (
                                    <button key={m} onClick={() => setEditDuration(String(m))} 
                                        className={`px-3 py-1.5 rounded-full transition-all ${editDuration === String(m) ? 'bg-violet-500 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                                        {m}분
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">
                                취소
                            </button>
                            <button onClick={confirmEdit} className="flex-1 py-4 bg-violet-500 text-white rounded-2xl font-black shadow-lg hover:bg-violet-600 active:scale-95 transition-all">
                                수정 완료
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
