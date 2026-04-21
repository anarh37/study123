import React, { useState, useEffect, useRef } from 'react';
import { Flame, RotateCcw } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function PomodoroTimer({ userProfile }) {
    const ft = (userProfile?.pomodoro || 25) * 60;
    const bt = (userProfile?.breakTime || 5) * 60;
    const [mode, setMode] = useState('focus');
    const [left, setLeft] = useState(ft);
    const [run, setRun] = useState(false);
    const iv = useRef(null);

    useEffect(() => {
        if (run) {
            iv.current = setInterval(() => {
                setLeft(p => {
                    if (p <= 1) {
                        clearInterval(iv.current); setRun(false);
                        if (mode === 'focus') {
                            setMode('break');
                            // Timer finished! Add time to leaderboard database
                            const user = auth.currentUser;
                            if (user) {
                                const ref = doc(db, 'leaderboard', user.uid);
                                updateDoc(ref, { 
                                    totalStudyTime: increment((ft/60)),
                                    lastActive: Date.now()
                                }).catch(err => console.error("공부시간 기록 오류:", err));
                            }
                            return bt;
                        } else { 
                            setMode('focus'); 
                            return ft;
                        }
                    }
                    return p - 1;
                });
            }, 1000);
        }
        return () => clearInterval(iv.current);
    }, [run, mode, ft, bt]);

    const m = Math.floor(left / 60);
    const s = left % 60;
    
    // 방어 로직: left가 0일 때도 프로그래스 바가 0이 되도록 처리 
    const totalTime = mode === 'focus' ? ft : bt;
    const prog = totalTime > 0 ? ((totalTime - left) / totalTime) * 100 : 100;

    return (
        <div className="bg-white rounded-[32px] shadow-xl p-8 flex flex-col items-center gap-6 border border-slate-100 animate-fade-in">
            <div className="flex items-center gap-2 text-slate-800 font-black text-xl">
                <Flame className={mode === 'focus' ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
                {mode === 'focus' ? '초집중하는 시간!' : '잠깐 쉬는 시간!'}
            </div>
            <div className="relative w-44 h-44">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                    <circle 
                        cx="60" cy="60" r="54" fill="none" 
                        stroke={mode === 'focus' ? '#ef4444' : '#10b981'} 
                        strokeWidth="10" strokeDasharray="339.29" 
                        strokeDashoffset={339.29 * (1 - prog / 100)} 
                        strokeLinecap="round" 
                        className="transition-all duration-1000"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-4xl font-black font-mono text-slate-800 tracking-tighter">
                        {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{mode}</span>
                </div>
            </div>
            <div className="flex gap-3 w-full">
                <button 
                    onClick={()=>setRun(!run)} 
                    className={`flex-1 py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 ${run ? 'bg-amber-500' : 'bg-violet-600'}`}
                >
                    {run ? '잠시 멈춤' : '시작하기'}
                </button>
                <button 
                    onClick={() => { setRun(false); setLeft(ft); setMode('focus'); }} 
                    className="p-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                >
                    <RotateCcw size={20}/>
                </button>
            </div>
        </div>
    );
}
