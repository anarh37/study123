import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap, LayoutList, Trash2, Bot, PenLine, Clock, Star, Lightbulb, Gamepad2, ListChecks } from 'lucide-react';
import { addDays, getStartOfWeek, getTodayDateString, DAYS, TIME_SLOTS, SCHEDULE_CATEGORIES } from '../utils/constants';
import { useApp } from '../App';

export default function Timetable({ fixedSchedule, setFixedSchedule, goldenTime, setGoldenTime, dailyPlans, setDailyPlans, weeklyTasks, taskMatrix }) {
    const { showToast } = useApp();
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek());
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Rectangular drag selection states
    const [selectionStart, setSelectionStart] = useState(null); // { dIdx, tIdx }
    const [selectionEnd, setSelectionEnd] = useState(null); // { dIdx, tIdx }
    const [isDragging, setIsDragging] = useState(false);
    
    // Store finalized cells to color
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [detailTask, setDetailTask] = useState(null);
    const scrollContainerRef = React.useRef(null);
    
    // Long press states
    const dragTimerRef = React.useRef(null);
    const startPosRef = React.useRef(null);

    // 수동 과제 입력 모달 상태
    const [manualTaskModal, setManualTaskModal] = useState(null); // { cells: Set, days: [] }
    const [manualTaskName, setManualTaskName] = useState('');

    // Prevent actual browser scrolling globally when drag mode is activated
    useEffect(() => {
        const preventScroll = (e) => {
            if (isDragging) e.preventDefault();
        };
        document.addEventListener('touchmove', preventScroll, { passive: false });
        return () => document.removeEventListener('touchmove', preventScroll);
    }, [isDragging]);

    const changeWeek = (amount) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + (amount * 7));
        setCurrentWeekStart(d);
    };

    const availableHours = useMemo(() => {
        const total = 7 * 48;
        const fixedKeys = Object.keys(fixedSchedule || {});
        const gTime = goldenTime || [];
        const actualUsedSlots = fixedKeys.filter(key => !gTime.includes(key));
        const used = actualUsedSlots.length;
        return (total - used) / 2;
    }, [fixedSchedule, goldenTime]);

    // AI + 수동 배치 과제 모두 포함하는 맵
    const weeklyScheduledTasks = useMemo(() => {
        const map = {};
        for(let i=0; i<7; i++) {
            const d = new Date(currentWeekStart); d.setDate(d.getDate() + i);
            const ds = getTodayDateString(d);
            const dow = DAYS[i];
            if (dailyPlans[ds]?.todos) {
                dailyPlans[ds].todos.forEach(t => {
                    if (t.aiScheduled || t.manualScheduled) {
                        const cid = `${dow}-${t.startTime}`;
                        if (!map[cid]) map[cid] = [];
                        map[cid].push({...t, dateStr: ds});
                    }
                });
            }
        }
        return map;
    }, [dailyPlans, currentWeekStart]);

    // Handle global pointer up to finalize rendering selection
    useEffect(() => {
        const handleGlobalPointerUp = () => {
            if (isDragging) {
                setIsDragging(false);
                // Selection Rect to Set
                if (selectionStart && selectionEnd) {
                    const minD = Math.min(selectionStart.dIdx, selectionEnd.dIdx);
                    const maxD = Math.max(selectionStart.dIdx, selectionEnd.dIdx);
                    const minT = Math.min(selectionStart.tIdx, selectionEnd.tIdx);
                    const maxT = Math.max(selectionStart.tIdx, selectionEnd.tIdx);
                    
                    const newSet = new Set();
                    for (let d = minD; d <= maxD; d++) {
                        for (let t = minT; t <= maxT; t++) {
                            const cid = `${DAYS[d]}-${TIME_SLOTS[t]}`;
                            if (!weeklyScheduledTasks[cid]) {
                                newSet.add(cid);
                            }
                        }
                    }
                    setSelectedCells(newSet);
                    if (newSet.size > 0) setIsModalOpen(true);
                }
            }
        };
        window.addEventListener('pointerup', handleGlobalPointerUp);
        return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
    }, [isDragging, selectionStart, selectionEnd, weeklyScheduledTasks]);

    const handlePointerDown = (e, dIdx, tIdx, cid) => {
        if (weeklyScheduledTasks[cid]) return;
        
        if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
        startPosRef.current = { x: e.clientX, y: e.clientY };
        
        dragTimerRef.current = setTimeout(() => {
            if ('vibrate' in navigator) navigator.vibrate(50);
            setIsDragging(true);
            setSelectionStart({ dIdx, tIdx });
            setSelectionEnd({ dIdx, tIdx });
            setSelectedCells(new Set()); 
        }, 800);
    };

    const handlePointerUp = (e, dIdx, tIdx, cid) => {
        if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
        
        if (!isDragging && startPosRef.current) {
            const dx = Math.abs(e.clientX - startPosRef.current.x);
            const dy = Math.abs(e.clientY - startPosRef.current.y);
            
            // It's a quick tap without much movement
            if (dx < 20 && dy < 20) {
                if (weeklyScheduledTasks[cid]) return;
                setSelectionStart({ dIdx, tIdx });
                setSelectionEnd({ dIdx, tIdx });
                setSelectedCells(new Set([cid]));
                setIsModalOpen(true);
            }
        }
        startPosRef.current = null;
    };

    const handlePointerCancel = () => {
        if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    };

    const handlePointerEnter = (dIdx, tIdx) => {
        if (isDragging) {
            setSelectionEnd({ dIdx, tIdx });
        }
    };

    const handlePointerMove = (e) => {
        if (!isDragging) {
            if (startPosRef.current && dragTimerRef.current) {
                const dx = Math.abs(e.clientX - startPosRef.current.x);
                const dy = Math.abs(e.clientY - startPosRef.current.y);
                if (dx > 10 || dy > 10) {
                    clearTimeout(dragTimerRef.current);
                    dragTimerRef.current = null;
                }
            }
            return;
        }
        const container = scrollContainerRef.current;
        if (!container) return;
        
        // Auto-scroll logic
        const rect = container.getBoundingClientRect();
        const buffer = 50; 
        const speed = 15; 
        
        if (e.clientY > rect.bottom - buffer) {
            container.scrollTop += speed;
        } else if (e.clientY < rect.top + buffer) {
            container.scrollTop -= speed;
        }
        
        if (e.clientX > rect.right - buffer) {
            container.scrollLeft += speed;
        } else if (e.clientX < rect.left + buffer) {
            container.scrollLeft -= speed;
        }

        // Mobile touch drag feedback
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) {
            const dStr = el.getAttribute('data-didx');
            const tStr = el.getAttribute('data-tidx');
            if (dStr !== null && tStr !== null) {
                setSelectionEnd({ dIdx: parseInt(dStr, 10), tIdx: parseInt(tStr, 10) });
            }
        }
    };

    // Helper: is cell in current drag selection?
    const isCellInSelectionRect = (dIdx, tIdx) => {
        if (!isDragging || !selectionStart || !selectionEnd) return false;
        const minD = Math.min(selectionStart.dIdx, selectionEnd.dIdx);
        const maxD = Math.max(selectionStart.dIdx, selectionEnd.dIdx);
        const minT = Math.min(selectionStart.tIdx, selectionEnd.tIdx);
        const maxT = Math.max(selectionStart.tIdx, selectionEnd.tIdx);
        return (dIdx >= minD && dIdx <= maxD && tIdx >= minT && tIdx <= maxT);
    };

    const handleSelectCategory = (cat) => {
        setFixedSchedule(prev => {
            const newSched = {...prev};
            selectedCells.forEach(cid => {
                delete newSched[cid];
                if (cat !== 'goldenTime' && cat !== '삭제') newSched[cid] = cat;
            });
            return newSched;
        });
        setGoldenTime(prev => {
            const newGold = new Set(prev);
            selectedCells.forEach(cid => {
                newGold.delete(cid);
                if (cat === 'goldenTime') newGold.add(cid);
            });
            return Array.from(newGold);
        });
        setSelectedCells(new Set());
        setSelectionStart(null);
        setSelectionEnd(null);
        setIsModalOpen(false);
    };

    // 수동 과제 입력 모달 열기
    const openManualTaskModal = () => {
        setIsModalOpen(false);
        setManualTaskModal({ cells: selectedCells });
        setManualTaskName('');
    };

    // 수동 과제 배치 확정
    const confirmManualTask = () => {
        if (!manualTaskName.trim()) {
            showToast('과제명을 입력해 주세요!', 'error');
            return;
        }

        const cellsArray = Array.from(manualTaskModal.cells);
        const durationPerSlot = 30; // 각 슬롯당 30분

        setDailyPlans(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            
            cellsArray.forEach(cid => {
                // "월-14:00" → 요일과 시간 분리
                const [dow, time] = cid.split('-');
                const dowIdx = DAYS.indexOf(dow);
                
                // 현재 주시작 기준으로 해당 날짜 계산
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() + dowIdx);
                const ds = getTodayDateString(d);
                
                if (!next[ds]) next[ds] = { todos: [], checklist: [false, false, false], reflection: {} };
                
                // 같은 날짜 같은 시간에 같은 과제가 이미 있는지 중복 체크
                const isDupe = next[ds].todos.some(t => t.manualScheduled && t.startTime === time && t.task === manualTaskName.trim());
                if (!isDupe) {
                    next[ds].todos.push({
                        id: `manual-${Date.now()}-${cid}`,
                        task: manualTaskName.trim(),
                        startTime: time,
                        duration: durationPerSlot,
                        status: 'pending',
                        aiScheduled: false,
                        manualScheduled: true,
                    });
                }
            });
            
            return next;
        });

        const totalMin = cellsArray.length * durationPerSlot;
        showToast(`"${manualTaskName.trim()}" 과제가 ${cellsArray.length}칸(${totalMin}분)에 배치되었어요! 📝`, 'success');
        
        setManualTaskModal(null);
        setManualTaskName('');
        setSelectedCells(new Set());
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    const weekRangeStr = `${currentWeekStart.getMonth()+1}월 ${currentWeekStart.getDate()}일 ~ ${addDays(getTodayDateString(currentWeekStart), 6).split('-')[2]}일`;

    return (
        <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-xl border border-slate-100 animate-fade-in relative w-full overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <h2 className="text-2xl font-black text-slate-800 shrink-0">주간 시간표</h2>
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                        <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft size={18}/></button>
                        <span className="text-sm font-bold sm:w-36 text-center shrink-0">{weekRangeStr}</span>
                        <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight size={18}/></button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-3 bg-violet-100 border border-violet-200 px-5 py-3 rounded-2xl shadow-sm">
                        <Zap className="text-violet-600 animate-pulse" size={24} />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-violet-500 uppercase leading-none mb-1">전체 가용 시간</span>
                            <span className="text-xl font-black text-violet-800 leading-none">{availableHours} <span className="text-sm font-bold text-violet-600">시간</span></span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-100 border border-emerald-200 px-5 py-3 rounded-2xl shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase leading-none mb-1">🎯 최소 목표 학습 (20%)</span>
                            <span className="text-xl font-black text-emerald-800 leading-none">{Math.round(availableHours * 0.2)} <span className="text-sm font-bold text-emerald-600">시간</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-slate-400 text-sm mb-4">
                📱 모바일 사용 시: 시간표 <strong>안쪽을 약 1초간 꾹 누르면 진동과 함께 드래그가 시작</strong>됩니다.<br/>
                평소처럼 시간표를 밀면 자연스럽게 상하좌우 스크롤(이동)이 가능합니다!
            </p>

            <div 
                ref={scrollContainerRef} 
                onPointerMove={handlePointerMove}
                onContextMenu={(e) => e.preventDefault()}
                style={{ WebkitTouchCallout: 'none' }}
                className="max-h-[65vh] overflow-auto rounded-2xl border border-slate-200 bg-white no-scrollbar relative shadow-inner select-none touch-pan-x touch-pan-y"
            >
                <div className="grid grid-cols-[40px_repeat(7,_minmax(0,_1fr))] sm:grid-cols-[50px_repeat(7,_minmax(0,_1fr))] min-w-[320px] w-full">
                    <div className="sticky top-0 left-0 z-40 bg-slate-50 border-b border-r border-slate-200 h-10"></div>
                    {DAYS.map(d => (
                        <div key={d} className="sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200 h-10 flex items-center justify-center font-black text-slate-600 text-[10px] sm:text-xs shadow-sm">
                            <span className="sm:hidden">{d}</span>
                            <span className="hidden sm:inline">{d}요일</span>
                        </div>
                    ))}

                    {TIME_SLOTS.map((t, tIdx) => (
                        <React.Fragment key={t}>
                            <div className={`sticky left-0 z-20 bg-slate-50 border-r border-slate-200 flex items-center justify-center font-mono text-[10px] h-8 border-b ${t.endsWith(':30') ? 'border-b-slate-300 border-b-[2px] text-slate-300' : 'border-b-slate-200 font-bold text-slate-500'}`}>
                                {t.endsWith(':00') ? t : ''}
                            </div>
                            {DAYS.map((d, dIdx) => {
                                const cid = `${d}-${t}`;
                                const cat = fixedSchedule[cid];
                                const scheduledTasks = weeklyScheduledTasks[cid];
                                const taskCount = scheduledTasks ? scheduledTasks.length : 0;
                                const hasAi = scheduledTasks?.some(t => t.aiScheduled);
                                const hasManual = scheduledTasks?.some(t => t.manualScheduled);
                                const isG = goldenTime.includes(cid);
                                
                                // View-time check: is this cell finalized inside selectedCells OR actively being dragged in Rect?
                                const isFinalized = selectedCells.has(cid);
                                const isDraggingArea = isCellInSelectionRect(dIdx, tIdx);
                                const isS = isFinalized || isDraggingArea;

                                return (
                                    <div 
                                        key={cid} 
                                        data-didx={dIdx}
                                        data-tidx={tIdx}
                                        className={`h-8 border-r border-slate-100 relative transition-all duration-75 border-b ${t.endsWith(':30') ? 'border-b-slate-300 border-b-[2px]' : 'border-b-slate-100'} ${cat ? SCHEDULE_CATEGORIES[cat]?.color : (isG ? 'bg-amber-100' : 'bg-white')} ${(isS && !scheduledTasks) ? '!bg-violet-200 z-10 shadow-inner' : 'hover:bg-slate-50'} ${scheduledTasks ? 'cursor-pointer' : 'cursor-crosshair'}`}
                                        onPointerDown={(e) => { 
                                            e.currentTarget.releasePointerCapture(e.pointerId); 
                                            handlePointerDown(e, dIdx, tIdx, cid); 
                                        }}
                                        onPointerUp={(e) => handlePointerUp(e, dIdx, tIdx, cid)}
                                        onPointerCancel={handlePointerCancel}
                                        onPointerLeave={handlePointerCancel}
                                        onPointerEnter={() => handlePointerEnter(dIdx, tIdx)}
                                    >
                                        {cat && <span className="text-[10px] font-bold text-white px-1 truncate absolute inset-0 flex items-center justify-center pointer-events-none">{cat}</span>}
                                        {scheduledTasks && (
                                            <div onClick={(e) => { e.stopPropagation(); setDetailTask(scheduledTasks); }} className={`absolute inset-0 ${hasManual && !hasAi ? 'bg-emerald-500/80 hover:bg-emerald-600' : 'bg-violet-500/80 hover:bg-violet-600'} m-[1px] rounded-[2px] flex items-center justify-center shadow-sm overflow-hidden animate-fade-in group cursor-pointer pointer-events-auto z-20`}>
                                                {hasAi && <Bot size={14} className="text-white group-hover:scale-110 transition-transform"/>}
                                                {hasManual && !hasAi && <PenLine size={14} className="text-white group-hover:scale-110 transition-transform"/>}
                                                {hasAi && hasManual && <PenLine size={10} className="text-white/70 ml-0.5"/>}
                                                {taskCount > 1 && (
                                                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm z-30">{taskCount}</span>
                                                )}
                                            </div>
                                        )}
                                        {isG && !cat && !isS && !scheduledTasks && <Zap size={12} className="text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" fill="currentColor"/>}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap gap-3 mt-4 text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-500 inline-block"></span> AI 배치</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> 수동 배치</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300 inline-block"></span> 황금시간</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full inline-flex items-center justify-center text-white text-[7px]">2</span> 과제 겹침</span>
            </div>

            {/* 카테고리 선택 모달 (고정시간 + 수동과제 입력 버튼 추가) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setIsModalOpen(false); setSelectedCells(new Set()); setSelectionStart(null); setSelectionEnd(null); }}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-sm w-full mx-auto" onClick={e=>e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                            <LayoutList className="text-violet-600"/> 선택한 {selectedCells.size}칸 채우기
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {Object.keys(SCHEDULE_CATEGORIES).map(c => (
                                <button key={c} onClick={() => handleSelectCategory(c)} className={`p-4 rounded-2xl text-xs font-black text-white shadow-md transition-transform hover:-translate-y-1 ${SCHEDULE_CATEGORIES[c].color}`}>{c}</button>
                            ))}
                            <button onClick={() => handleSelectCategory('goldenTime')} className="p-4 rounded-2xl text-xs font-black bg-amber-400 text-white shadow-md transition-transform hover:-translate-y-1 flex flex-col items-center justify-center gap-1"><Zap size={14}/>황금시간</button>
                            <button onClick={() => handleSelectCategory('삭제')} className="p-4 rounded-2xl text-xs font-black bg-slate-100 text-slate-400 border border-slate-200 shadow-sm transition-transform hover:-translate-y-1 flex flex-col items-center justify-center gap-1"><Trash2 size={14}/>비우기</button>
                        </div>
                        
                        {/* 수동 과제 입력 버튼 (구분선 + 강조) */}
                        <div className="border-t border-slate-200 mt-5 pt-5">
                            <button 
                                onClick={openManualTaskModal} 
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <PenLine size={18}/> 이 시간에 과제 직접 배치하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 수동 과제 입력 모달 (기존 과제 목록 선택 + 직접 입력) */}
            {manualTaskModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setManualTaskModal(null); setManualTaskName(''); setSelectedCells(new Set()); setSelectionStart(null); setSelectionEnd(null); }}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-md w-full mx-auto border-t-8 border-emerald-400 max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <PenLine className="text-emerald-600" size={24}/>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">과제 배치하기 📝</h3>
                        </div>
                        <p className="text-slate-500 text-sm font-bold mb-5 mt-3">
                            선택한 <strong className="text-emerald-600">{manualTaskModal.cells.size}칸 ({manualTaskModal.cells.size * 30}분)</strong>에 배치할 과제를 선택하세요.
                        </p>

                        {/* 기존 과제 목록에서 선택 */}
                        {weeklyTasks && weeklyTasks.length > 0 && (
                            <div className="mb-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <ListChecks size={16} className="text-emerald-600"/>
                                    <span className="text-sm font-black text-slate-700">과제 정리 목록에서 선택</span>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {(() => {
                                        const qIcons = {
                                            urgentImportant: { icon: <Zap size={12}/>, label: '🔥 1순위', color: 'border-red-300 bg-red-50 hover:bg-red-100' },
                                            notUrgentImportant: { icon: <Star size={12}/>, label: '⭐ 2순위', color: 'border-blue-300 bg-blue-50 hover:bg-blue-100' },
                                            urgentNotImportant: { icon: <Lightbulb size={12}/>, label: '📢 3순위', color: 'border-amber-300 bg-amber-50 hover:bg-amber-100' },
                                            notUrgentNotImportant: { icon: <Gamepad2 size={12}/>, label: '☁️ 4순위', color: 'border-slate-200 bg-slate-50 hover:bg-slate-100' }
                                        };
                                        const items = [];
                                        Object.entries(taskMatrix || {}).forEach(([key, taskIds]) => {
                                            (taskIds || []).forEach(tid => {
                                                const task = weeklyTasks.find(t => t.id === tid);
                                                if (task) items.push({ ...task, priorityKey: key });
                                            });
                                        });
                                        return items.map(task => {
                                            const q = qIcons[task.priorityKey] || qIcons.notUrgentNotImportant;
                                            const isSelected = manualTaskName === task.content;
                                            return (
                                                <button
                                                    key={task.id}
                                                    onClick={() => setManualTaskName(task.content)}
                                                    className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${isSelected ? 'border-emerald-500 bg-emerald-50 shadow-md scale-[1.02]' : q.color}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                                                        {isSelected ? <PenLine size={14}/> : q.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-black truncate ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>{task.content}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">{q.label} · {task.duration}분 · 마감 {(task.deadline || '').slice(5).replace('-', '/')}</p>
                                                    </div>
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* 직접 입력 구분선 */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 border-t border-slate-200"></div>
                            <span className="text-xs font-bold text-slate-400">또는 직접 입력</span>
                            <div className="flex-1 border-t border-slate-200"></div>
                        </div>
                        <input
                            type="text"
                            value={manualTaskName}
                            onChange={e => setManualTaskName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmManualTask()}
                            className="w-full bg-emerald-50 text-base font-black text-slate-800 rounded-2xl py-3 px-5 outline-none border-2 border-transparent focus:border-emerald-400 transition shadow-sm mb-5"
                            placeholder="과제명을 직접 입력하세요"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setManualTaskModal(null); setManualTaskName(''); setSelectedCells(new Set()); setSelectionStart(null); setSelectionEnd(null); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">
                                취소
                            </button>
                            <button onClick={confirmManualTask} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-600 active:scale-95 transition-all">
                                배치하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 과제 상세 보기 모달 (중복 과제 모두 표시) */}
            {detailTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={()=>setDetailTask(null)}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-xs w-full border-t-8 border-violet-500" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-2 text-violet-600 font-black mb-4">
                            <Clock size={20}/> 이 시간의 과제 목록 ({detailTask.length}개)
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
                            {detailTask.map((t, i) => (
                                <div key={t.id} className={`p-4 rounded-2xl border-l-4 ${t.aiScheduled ? 'border-violet-500 bg-violet-50' : 'border-emerald-500 bg-emerald-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {t.aiScheduled ? <Bot size={14} className="text-violet-500"/> : <PenLine size={14} className="text-emerald-500"/>}
                                        <span className="text-[10px] font-bold text-slate-400">{t.aiScheduled ? 'AI 배치' : '수동 배치'}</span>
                                    </div>
                                    <p className="text-base font-black text-slate-800 leading-tight">{t.task}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-1">{t.duration}분 · {t.startTime} 시작</p>
                                    <button onClick={() => { 
                                        setDailyPlans(prev => {
                                            const next = JSON.parse(JSON.stringify(prev));
                                            next[t.dateStr].todos = next[t.dateStr].todos.filter(todo => todo.id !== t.id);
                                            return next;
                                        });
                                        const remaining = detailTask.filter(x => x.id !== t.id);
                                        if (remaining.length === 0) setDetailTask(null);
                                        else setDetailTask(remaining);
                                        showToast('일정에서 삭제했어요.');
                                    }} className="mt-2 text-xs font-bold text-red-400 hover:text-red-600 transition-colors">삭제하기</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={()=>setDetailTask(null)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">닫기</button>
                    </div>
                </div>
            )}
        </div>
    );
}
