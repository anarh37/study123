import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap, LayoutList, Trash2, Bot } from 'lucide-react';
import { addDays, getStartOfWeek, getTodayDateString, DAYS, TIME_SLOTS, SCHEDULE_CATEGORIES } from '../utils/constants';
import { useApp } from '../App';

export default function Timetable({ fixedSchedule, setFixedSchedule, goldenTime, setGoldenTime, dailyPlans, setDailyPlans }) {
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

    const weeklyAiTasks = useMemo(() => {
        const map = {};
        for(let i=0; i<7; i++) {
            const d = new Date(currentWeekStart); d.setDate(d.getDate() + i);
            const ds = getTodayDateString(d);
            const dow = DAYS[i];
            if (dailyPlans[ds]?.todos) {
                dailyPlans[ds].todos.forEach(t => {
                    if (t.aiScheduled) {
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
                            if (!weeklyAiTasks[cid]) {
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
    }, [isDragging, selectionStart, selectionEnd, weeklyAiTasks]);

    const handlePointerDown = (e, dIdx, tIdx, cid) => {
        if (weeklyAiTasks[cid]) return;
        
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
                if (weeklyAiTasks[cid]) return;
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
        if (!isDragging) return;
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
        const newSched = {...fixedSchedule};
        const newGold = new Set(goldenTime);
        selectedCells.forEach(cid => {
            delete newSched[cid];
            newGold.delete(cid);
            if (cat === 'goldenTime') newGold.add(cid);
            else if (cat !== '삭제') newSched[cid] = cat;
        });
        setFixedSchedule(newSched);
        setGoldenTime(Array.from(newGold));
        setSelectedCells(new Set());
        setSelectionStart(null);
        setSelectionEnd(null);
        setIsModalOpen(false);
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
                                const ai = weeklyAiTasks[cid];
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
                                        className={`h-8 border-r border-slate-100 relative transition-all duration-75 border-b ${t.endsWith(':30') ? 'border-b-slate-300 border-b-[2px]' : 'border-b-slate-100'} ${cat ? SCHEDULE_CATEGORIES[cat]?.color : (isG ? 'bg-amber-100' : 'bg-white')} ${(isS && !ai) ? '!bg-violet-200 z-10 shadow-inner' : 'hover:bg-slate-50'} ${ai ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
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
                                        {ai && (
                                            <div onClick={(e) => { e.stopPropagation(); setDetailTask(ai); }} className="absolute inset-0 bg-violet-500/80 m-[1px] rounded-[2px] flex items-center justify-center shadow-sm overflow-hidden animate-fade-in group hover:bg-violet-600 cursor-pointer pointer-events-auto z-20">
                                                <Bot size={14} className="text-white group-hover:scale-110 transition-transform"/>
                                            </div>
                                        )}
                                        {isG && !cat && !isS && <Zap size={12} className="text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" fill="currentColor"/>}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

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
                    </div>
                </div>
            )}

            {detailTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={()=>setDetailTask(null)}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-xs w-full border-t-8 border-violet-500" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-2 text-violet-600 font-black mb-4">
                            <Bot size={20}/> AI가 만든 계획
                        </div>
                        <p className="text-lg font-black text-slate-800 mb-2 leading-tight">{detailTask[0].task}</p>
                        <p className="text-sm font-bold text-slate-500 mb-6">{detailTask[0].duration}분 동안 집중해서 해볼까요?</p>
                        <div className="flex gap-2">
                            <button onClick={() => { 
                                setDailyPlans(prev => {
                                    const next = JSON.parse(JSON.stringify(prev));
                                    next[detailTask[0].dateStr].todos = next[detailTask[0].dateStr].todos.filter(t => t.id !== detailTask[0].id);
                                    return next;
                                });
                                setDetailTask(null);
                                showToast('일정에서 삭제했어요.');
                            }} className="flex-1 py-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-colors">계획 삭제</button>
                            <button onClick={()=>setDetailTask(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
