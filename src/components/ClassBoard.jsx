import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Users, Target, Flame, Sparkles } from 'lucide-react';

export default function ClassBoard() {
    const [students, setStudents] = useState([]);
    
    // 협동 목표 분 (초3 22명 일주일 기준)
    const GOAL_MINUTES = 3000;

    useEffect(() => {
        // 최근 활동한 순서대로 가져오기 (피드용)
        const q = query(collection(db, 'leaderboard'), orderBy('lastActive', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStudents(data);
        });
        return () => unsubscribe();
    }, []);

    // 전체 누적 시간 합산
    const totalClassTime = students.reduce((acc, s) => acc + (s.totalStudyTime || 0), 0);
    // 100% 초과 방지
    const progressPercent = Math.min((totalClassTime / GOAL_MINUTES) * 100, 100);

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '알 수 없음';
        const diff = Math.floor((Date.now() - timestamp) / 1000 / 60); // 분 단위
        if (diff < 1) return '방금 전';
        if (diff < 60) return `${diff}분 전`;
        const hours = Math.floor(diff / 60);
        if (hours < 24) return `${hours}시간 전`;
        return `${Math.floor(hours / 24)}일 전`;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in p-4">
            {/* Header & 협동 목표 바 */}
            <div className="bg-gradient-to-r from-emerald-400 to-teal-500 rounded-[40px] p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                            <Users size={32} className="text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">우리반 활동</h1>
                    </div>
                    
                    <p className="text-emerald-50 text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
                        <Target size={20} /> 이번 주 우리 반 목표: 다이아몬드 등급 (3,000분)
                    </p>

                    {/* Progress Bar */}
                    <div className="bg-emerald-700/30 rounded-3xl p-6 backdrop-blur-md border border-white/20">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-4xl font-black">{totalClassTime}<span className="text-xl font-bold ml-1 opacity-80">분 달성!</span></span>
                            <span className="text-emerald-100 font-bold opacity-80 text-sm">목표 {GOAL_MINUTES}분</span>
                        </div>
                        <div className="h-6 w-full bg-black/20 rounded-full overflow-hidden p-1 shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full transition-all duration-1000 relative"
                                style={{ width: `${progressPercent}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                        <p className="text-right text-sm font-bold text-emerald-100 mt-2">
                            {progressPercent >= 100 ? '🎉 목표를 달성했습니다! 대단해요!' : `목표까지 ${GOAL_MINUTES - totalClassTime}분 남았어요! 다 함께 화이팅!`}
                        </p>
                    </div>
                </div>
                <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none transform -rotate-12">
                    <Sparkles size={250} />
                </div>
            </div>

            {/* Friend Activity Feed */}
            <h3 className="font-black text-2xl text-slate-800 px-2 flex items-center gap-2">
                <Flame className="text-orange-500" /> 친구들의 생생한 학습 현장
            </h3>
            
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                {students.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-bold flex flex-col items-center">
                        <Users size={40} className="mb-4 opacity-50"/>
                        아직 기록이 없어요!<br/>누가 먼저 시작해볼까요?
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {students.map((student) => (
                            <div key={student.id} className="flex flex-col sm:flex-row sm:items-center p-6 sm:p-8 hover:bg-slate-50 transition-all gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                    {/* Profile Image */}
                                    <div className="relative">
                                        {student.photoURL ? (
                                            <img src={student.photoURL} alt="profile" className="w-14 h-14 rounded-2xl shadow-sm object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-500 font-black text-2xl">
                                                {student.displayName?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        {/* Status indicator (green dot if active recently) */}
                                        {Date.now() - (student.lastActive || 0) < 1000 * 60 * 30 && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-lg text-slate-800">{student.displayName}</h3>
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                                {formatTimeAgo(student.lastActive)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-500 mt-0.5">
                                            {Date.now() - (student.lastActive || 0) < 1000 * 60 * 30 
                                                ? '🔥 지금 막 집중하고 있어요!' 
                                                : `${student.displayName}님이 열심히 공부를 마쳤어요.`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center bg-violet-50 rounded-2xl p-4 sm:ml-auto shrink-0 w-full sm:w-auto">
                                    <span className="text-xs font-bold text-violet-500 uppercase mr-4">Total Time</span>
                                    <div className="text-right">
                                        <span className="font-black text-2xl text-violet-700">{student.totalStudyTime || 0}</span>
                                        <span className="text-violet-600 font-bold ml-1">분</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
