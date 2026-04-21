import React, { useState, useMemo, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useApp } from '../App';

export default function GoalSetting({ goals, setGoals, fixedSchedule, goldenTime }) {
    const { showToast } = useApp();
    const [c, setC] = useState(goals.career || '');
    const [a, setA] = useState(goals.academic || '');

    const availableHours = useMemo(() => {
        const total = 7 * 48; // 일주일 총 336칸 (30분 단위)
        
        // ✅ 핵심 수정: fixedSchedule(고정 시간) 데이터 중 
        // '황금시간(goldenTime)'으로 지정된 칸은 차감 대상에서 제외합니다.
        const fixedKeys = Object.keys(fixedSchedule || {});
        const gTime = goldenTime || [];
        
        const actualUsedSlots = fixedKeys.filter(key => !gTime.includes(key));
        
        const used = actualUsedSlots.length;
        return (total - used) / 2;
    }, [fixedSchedule, goldenTime]);

    const recHoursInt = Math.round(availableHours * 0.2);
    const [s, setS] = useState(goals.studyTime || recHoursInt || 0);

    useEffect(() => {
        if (!goals.studyTime && recHoursInt > 0) {
            setS(recHoursInt);
        }
    }, [recHoursInt, goals.studyTime]);

    return (
        <div className="bg-white p-10 rounded-[32px] shadow-xl border-t-8 border-amber-400 animate-fade-in max-w-2xl mx-auto">
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3 text-slate-800">
                <Trophy className="text-yellow-400" size={36}/> 꿈과 목표의 씨앗 심기
            </h2>
            <p className="text-slate-400 text-sm mb-10">구체적인 목표는 나의 행동을 변화시키는 마법이 됩니다.</p>
            <div className="space-y-8">
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                    <label className="block text-base font-black text-amber-700 mb-3">🌟 1. 나의 멋진 장래희망</label>
                    <input 
                        value={c} 
                        onChange={e=>setC(e.target.value)} 
                        className="w-full p-4 bg-white border-2 border-transparent rounded-xl outline-none focus:border-amber-400 transition font-bold text-slate-700 shadow-sm" 
                        placeholder="미래에 어떤 사람이 되고 싶나요?"
                    />
                </div>
                <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100">
                    <label className="block text-base font-black text-sky-700 mb-3">🎯 2. 이번 달 나의 목표 (여러 개 작성 가능)</label>
                    <textarea 
                        value={a} 
                        onChange={e=>setA(e.target.value)} 
                        rows={3}
                        className="w-full p-4 bg-white border-2 border-transparent rounded-xl outline-none focus:border-sky-400 transition font-bold text-slate-700 shadow-sm resize-none" 
                        placeholder="이번 달에 꼭 이루고 싶은 것들을 적어보세요!"
                    />
                </div>
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <label className="block text-base font-black text-emerald-700 mb-2">⏱️ 3. 주간 목표 학습 시간 (스스로 공부)</label>
                    <p className="text-sm font-bold text-slate-500 mb-4 leading-snug">
                        * 나의 이번 주 전체 가용시간 <strong className="text-emerald-600">{availableHours}시간</strong> 중, 
                        적정 비율인 <strong className="text-emerald-600">20% ({recHoursInt}시간)</strong>를 공부 시간으로 추천해요!
                    </p>
                    <div className="flex items-center gap-3">
                        <input 
                            type="number"
                            value={s} 
                            onChange={e=>setS(e.target.value)} 
                            className="w-full p-4 bg-white border-2 border-transparent rounded-xl outline-none focus:border-emerald-400 transition font-bold text-slate-700 shadow-sm" 
                            placeholder={`${recHoursInt}`}
                        />
                        <span className="text-lg font-black text-slate-600 shrink-0">시간 / 주</span>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        setGoals({...goals, career: c, academic: a, studyTime: parseInt(s, 10) || 0}); 
                        showToast('목표가 저장되었어요! 꿈을 향해 나아가요 🚀', 'success');
                    }} 
                    className="w-full py-5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-xl"
                >
                    마음에 새기기!
                </button>
            </div>
        </div>
    );
}
