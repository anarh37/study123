import React from 'react';
import { GRADE_LEVELS } from '../utils/constants';

export default function GradeSetupModal({ onSelect }) {
    return (
        <div className="fixed inset-0 bg-slate-100 z-[200] p-4 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center">
                <div className="bg-white p-8 sm:p-10 rounded-[40px] shadow-2xl text-center animate-fade-in max-w-lg w-full mx-auto border-b-8 border-violet-200 my-8">
                <h1 className="text-3xl font-black text-slate-800 mb-2">나의 학년 선택하기</h1>
                <p className="text-slate-500 mb-8 text-sm">연령에 맞는 최적의 집중 시간과 목표 학습량을 추천해 드릴게요!</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.values(GRADE_LEVELS).map(level => (
                        <button 
                            key={level.key}
                            onClick={() => onSelect(level)}
                            className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[24px] hover:border-violet-400 hover:bg-violet-50 hover:shadow-lg transition flex flex-col items-center gap-3 group"
                        >
                            <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{level.icon}</span>
                            <span className="font-black text-slate-700 text-lg">{level.name}</span>
                            <div className="text-xs font-bold text-slate-400 flex flex-col bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-100 w-full">
                                <span>🎯 하루 목표: {level.max_study}분</span>
                                <span>⚡ 집중(초 집중시간): {level.pomodoro}분</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            </div>
        </div>
    );
}
