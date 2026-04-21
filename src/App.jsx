import React, { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { Sparkles, ChevronRight, CheckCircle2, FilePlus2, BrainCircuit, TrendingUp, Clock, AlertTriangle, CheckCircle, Bot, LogOut, Trophy } from 'lucide-react';
import { useFirestore } from './hooks/useFirestore';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { SRL_PHASES, getTodayDateString, addDays } from './utils/constants';
import { runAutoSchedule } from './utils/aiScheduler';

import GradeSetupModal from './components/GradeSetupModal';
import GoalSetting from './components/GoalSetting';
import Timetable from './components/Timetable';
import WeeklyTaskManager from './components/WeeklyTaskManager';
import DailyPlanner from './components/DailyPlanner';
import ReflectionJournal from './components/ReflectionJournal';
import Dashboard from './components/Dashboard';
import ClassBoard from './components/ClassBoard';
import TeacherDashboard from './components/TeacherDashboard';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

const AppProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const showToast = useCallback((message, type = 'info') => {
        setToast({ message, type, id: Date.now() });
        setTimeout(() => setToast(null), 3000);
    }, []);

    return (
        <AppContext.Provider value={{ isLoading, setIsLoading, showToast }}>
            {children}
            {toast && <ToastUI message={toast.message} type={toast.type} />}
            {isLoading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[400] flex flex-col items-center justify-center animate-fade-in">
                    <Bot className="animate-bounce text-violet-600 mb-4" size={60}/>
                    <p className="font-black text-slate-800 text-xl">AI가 최적의 계획을 찾고 있어요...</p>
                </div>
            )}
        </AppContext.Provider>
    );
};

function ToastUI({ message, type }) {
    const colors = { info: 'bg-violet-600', success: 'bg-emerald-500', error: 'bg-red-500' };
    return (
        <div className={`fixed top-6 right-6 text-white px-6 py-4 rounded-2xl shadow-2xl animate-fade-in z-[300] font-bold flex items-center gap-2 ${colors[type]}`}>
            {type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}
            {message}
        </div>
    );
}

function SRLPhaseBanner({ currentPage }) {
    const cp = Object.entries(SRL_PHASES).find(([, v]) => v.pages.includes(currentPage))?.[0] || 'forethought';
    return (
        <div className="flex items-center justify-center gap-2 py-3 bg-violet-50 border-b border-violet-100 overflow-x-auto whitespace-nowrap px-4">
            {Object.entries(SRL_PHASES).map(([k, p], idx) => (
                <React.Fragment key={k}>
                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all ${cp === k ? 'bg-violet-600 text-white shadow-md scale-105' : 'text-slate-400'}`}>
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                    </div>
                    {idx < 2 && <ChevronRight size={14} className="text-slate-300"/>}
                </React.Fragment>
            ))}
        </div>
    );
}

function MainApp() {
    const { setIsLoading, showToast } = useApp();
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser({ uid: currentUser.uid, name: currentUser.displayName, photoURL: currentUser.photoURL, email: currentUser.email });
                
                // Top-level Info Registry
                setDoc(doc(db, 'users', currentUser.uid), {
                    displayName: currentUser.displayName || '연구참여자',
                    email: currentUser.email || '',
                    photoURL: currentUser.photoURL || '',
                    lastLogin: Date.now()
                }, { merge: true });

                // Leaderboard Registry (creates document if not exists, updates name/photo)
                setDoc(doc(db, 'leaderboard', currentUser.uid), {
                    displayName: currentUser.displayName || '연구참여자',
                    photoURL: currentUser.photoURL || '',
                }, { merge: true });
                
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const uid = user?.uid;
    const [userProfile, setUserProfile, profileReady] = useFirestore(uid, 'stepsPlannerProfile', null);
    const [page, setPage] = useState('timetable');

    const [goals, setGoals, goalsReady] = useFirestore(uid, 'stepsPlannerGoals', { career: '', academic: '' });
    const [fixedSchedule, setFixedSchedule, fixedReady] = useFirestore(uid, 'stepsPlannerFixedSchedule', {
        '월-00:00': '수면', '월-08:30': '통학', '월-09:00': '수업'
    });
    const [goldenTime, setGoldenTime, goldenReady] = useFirestore(uid, 'stepsPlannerGoldenTime', ['월-19:00', '월-19:30']);
    const [weeklyTasks, setWeeklyTasks, weeklyReady] = useFirestore(uid, 'stepsPlannerWeeklyTasks', [
        { id: 'task-1', content: '수학 익힘책 10쪽 풀기', deadline: addDays(getTodayDateString(), 2), duration: 50 },
    ]);
    const [taskMatrix, setTaskMatrix, matrixReady] = useFirestore(uid, 'stepsPlannerTaskMatrix', { 
        urgentImportant: ['task-1'], notUrgentImportant: [], urgentNotImportant: [], notUrgentNotImportant: [] 
    });
    const [dailyPlans, setDailyPlans, dailyReady] = useFirestore(uid, 'stepsPlannerDailyPlans', {});

    const isDataReady = profileReady && goalsReady && fixedReady && goldenReady && weeklyReady && matrixReady && dailyReady;

    const handleAutoSchedule = useCallback(() => {
        setIsLoading(true);
        setTimeout(() => {
            const { newDailyPlans, report } = runAutoSchedule({ weeklyTasks, taskMatrix, fixedSchedule, goldenTime, dailyPlans, userProfile });
            setDailyPlans(newDailyPlans);
            if (report.success > 0) {
                showToast(`마감일과 중요도에 따라 ${report.success}개의 계획이 세워졌어요!`, 'success');
            } else {
                showToast('추가할 과제나 빈 시간이 없어요.', 'info');
            }
            setIsLoading(false);
        }, 800);
    }, [weeklyTasks, taskMatrix, fixedSchedule, goldenTime, dailyPlans, userProfile, setDailyPlans, setIsLoading, showToast]);

    if (authLoading || (user && !isDataReady)) {
        return (
            <div className="fixed inset-0 bg-slate-100 flex flex-col justify-center items-center z-[200]">
                <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold">클라우드 동기화 중...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="fixed inset-0 bg-slate-100 flex justify-center items-center z-[200] p-4">
                <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center animate-fade-in max-w-sm w-full mx-auto border-b-8 border-violet-200">
                    <div className="w-20 h-20 bg-violet-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="text-violet-600" size={40}/>
                    </div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase mb-2">STEPS</h1>
                    <p className="text-slate-500 mt-3 mb-10 text-sm leading-relaxed">초등학교 3학년 학생들의<br/>자기주도학습을 응원합니다!</p>
                    <button onClick={async () => {
                                try {
                                    setIsLoading(true);
                                    await signInWithPopup(auth, googleProvider);
                                } catch (error) {
                                    showToast('로그인 실패: ' + error.message, 'error');
                                } finally {
                                    setIsLoading(false);
                                }
                            }} 
                            className="w-full bg-violet-600 text-white font-black py-5 px-6 rounded-2xl hover:bg-violet-700 transition shadow-lg flex items-center justify-center gap-2 text-lg active:scale-95">
                        Google 로그인 <ChevronRight size={20}/>
                    </button>
                </div>
            </div>
        );
    }

    if (!userProfile && profileReady) return <GradeSetupModal onSelect={setUserProfile} />;

    return (
        <div className="bg-[#f8fafc] min-h-screen font-sans pb-24 sm:pb-0">
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 mr-6 shrink-0">
                        <div className="p-1.5 bg-violet-600 rounded-lg"><Sparkles className="text-white" size={18}/></div>
                        <span className="font-black text-xl text-slate-800 tracking-tighter uppercase">Steps</span>
                    </div>
                    <div className="flex space-x-1 shrink-0 pb-1 sm:pb-0">
                        {[
                            {id: 'goals', n: '나의 목표'}, {id: 'timetable', n: '주간 시간표'}, {id: 'taskManager', n: '과제 정리'},
                            {id: 'planner', n: '오늘의 계획'}, {id: 'reflection', n: '성찰 일지'}, {id: 'dashboard', n: '성장 보고서'},
                            {id: 'leaderboard', n: '🤝 우리반 활동'}
                        ].map(m => (
                            <button key={m.id} onClick={() => setPage(m.id)} 
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${page === m.id ? 'bg-violet-50 text-violet-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {m.n}
                            </button>
                        ))}
                        {user?.email === 'byulnoa@gmail.com' && (
                            <button onClick={() => setPage('teacher')} 
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ml-2 border border-rose-200 ${page === 'teacher' ? 'bg-rose-50 text-rose-600 shadow-sm' : 'text-rose-500 hover:bg-rose-50'}`}>
                                👨‍🏫 클래스 보드
                            </button>
                        )}
                    </div>
                    <div className="hidden sm:flex items-center gap-2 ml-4 shrink-0">
                        {userProfile && (
                        <button onClick={() => setUserProfile(null)} className="p-2 rounded-xl bg-slate-100 text-xl hover:bg-slate-200 transition" title="학년 변경">
                            {userProfile.icon}
                        </button>
                        )}
                        <button onClick={() => signOut(auth)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition" title="로그아웃">
                            <LogOut size={20}/>
                        </button>
                        {user?.photoURL && (
                            <img src={user.photoURL} alt="profile" className="w-8 h-8 rounded-full ml-1" referrerPolicy="no-referrer" />
                        )}
                    </div>
                </div>
                <SRLPhaseBanner currentPage={page} />
            </nav>

            <main className="max-w-7xl mx-auto py-8 px-4">
                {page === 'goals' && <GoalSetting goals={goals} setGoals={setGoals} fixedSchedule={fixedSchedule} goldenTime={goldenTime} />}
                {page === 'timetable' && <Timetable fixedSchedule={fixedSchedule} setFixedSchedule={setFixedSchedule} goldenTime={goldenTime} setGoldenTime={setGoldenTime} dailyPlans={dailyPlans} setDailyPlans={setDailyPlans} weeklyTasks={weeklyTasks} taskMatrix={taskMatrix} />}
                {page === 'taskManager' && <WeeklyTaskManager weeklyTasks={weeklyTasks} setWeeklyTasks={setWeeklyTasks} taskMatrix={taskMatrix} setTaskMatrix={setTaskMatrix} onAutoSchedule={handleAutoSchedule} />}
                {page === 'planner' && <DailyPlanner dailyPlans={dailyPlans} setDailyPlans={setDailyPlans} userProfile={userProfile} />}
                {page === 'reflection' && <ReflectionJournal dailyPlans={dailyPlans} setDailyPlans={setDailyPlans} />}
                {page === 'dashboard' && <Dashboard dailyPlans={dailyPlans} weeklyTasks={weeklyTasks} goals={goals} />}
                {page === 'leaderboard' && <ClassBoard />}
                {page === 'teacher' && <TeacherDashboard />}
            </main>

            {/* Mobile Bottom Nav */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50 rounded-t-[30px] pb-5">
                {[
                    {id: 'timetable', i: <Clock size={22}/>, n: '시간표'}, 
                    {id: 'taskManager', i: <FilePlus2 size={22}/>, n: '과제'},
                    {id: 'planner', i: <CheckCircle2 size={22}/>, n: '계획'},
                    {id: 'dashboard', i: <TrendingUp size={22}/>, n: '리포트'},
                    {id: 'leaderboard', i: <Trophy size={22}/>, n: '활동'}
                ].map(m => (
                    <button key={m.id} onClick={() => setPage(m.id)} className={`flex flex-col items-center flex-1 py-1 transition-all ${page === m.id ? 'text-violet-600 scale-110' : 'text-slate-400'}`}>
                        {m.i}
                        <span className="text-[10px] mt-1 font-black">{m.n}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function AppWrapper() {
    return (
        <AppProvider>
            <MainApp />
        </AppProvider>
    );
}
