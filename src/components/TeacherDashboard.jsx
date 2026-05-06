import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, getDoc, doc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { Users, FileText, Activity, PieChart, CheckCircle2, TrendingUp, AlertTriangle, ChevronRight, ChevronLeft, Trophy, RefreshCcw, X, BarChart2, Calendar, CalendarCheck, Trash2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { getStartOfWeek, getTodayDateString } from '../utils/constants';

export default function TeacherDashboard() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentData, setStudentData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [chartTab, setChartTab] = useState('daily'); // 'daily' | 'weekly'
    const [modalTab, setModalTab] = useState('list'); // 'list' | 'weekly'
    const [mainTab, setMainTab] = useState('individual'); // 'individual' | 'weeklyOverview'
    const [studentWeekOffset, setStudentWeekOffset] = useState(0);
    const [weeklyOverview, setWeeklyOverview] = useState([]);
    const [weeklyOverviewLoading, setWeeklyOverviewLoading] = useState(false);
    const [overviewWeekOffset, setOverviewWeekOffset] = useState(0);

    // Fetch all students
    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(list);
        });
        return () => unsubscribe();
    }, []);

    // 주간 완수율 Overview 데이터 fetch
    useEffect(() => {
        if (mainTab !== 'weeklyOverview' || students.length === 0) return;
        const fetchWeeklyOverview = async () => {
            setWeeklyOverviewLoading(true);
            try {
                const today = new Date();
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + (overviewWeekOffset * 7));
                const ws = getStartOfWeek(targetDate);
                const todayStr = getTodayDateString();

                const results = [];
                for (const student of students) {
                    const dpRef = doc(db, 'users', student.id, 'plannerData', 'stepsPlannerDailyPlans');
                    const dpSnap = await getDoc(dpRef);
                    const dailyPlans = dpSnap.exists() ? dpSnap.data().value : {};

                    let done = 0, total = 0;
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(ws);
                        d.setDate(ws.getDate() + i);
                        const dateStr = getTodayDateString(d);
                        if (dateStr > todayStr && overviewWeekOffset === 0) continue;
                        const todos = dailyPlans?.[dateStr]?.todos || [];
                        total += todos.length;
                        done += todos.filter(t => t.status === 'done').length;
                    }
                    const rate = total > 0 ? Math.round(done / total * 100) : null;
                    results.push({
                        id: student.id,
                        name: student.displayName || '이름없음',
                        photoURL: student.photoURL || '',
                        done, total, rate
                    });
                }
                results.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
                setWeeklyOverview(results);
            } catch (e) {
                console.error('주간 완수율 조회 실패:', e);
            } finally {
                setWeeklyOverviewLoading(false);
            }
        };
        fetchWeeklyOverview();
    }, [mainTab, students, overviewWeekOffset]);

    const overviewWeekLabel = useMemo(() => {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (overviewWeekOffset * 7));
        const ws = getStartOfWeek(targetDate);
        const we = new Date(ws); we.setDate(ws.getDate() + 6);
        const label = overviewWeekOffset === 0 ? '이번 주' : overviewWeekOffset === -1 ? '지난 주' : `${Math.abs(overviewWeekOffset)}주 전`;
        return {
            label,
            range: `${ws.getMonth()+1}/${ws.getDate()} ~ ${we.getMonth()+1}/${we.getDate()}`
        };
    }, [overviewWeekOffset]);

    // 일괄 초기화 기능 (주간 시간표 제외)
    const handleResetAllData = async () => {
        if (!window.confirm("경고: 전체 학생들의 '주간 시간표'를 제외한 모든 데이터(목표, 과제, 일지, 누적 시간)를 0으로 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다!")) return;
        
        try {
            setLoadingData(true);
            const collectionsToDelete = [
                'stepsPlannerGoals',
                'stepsPlannerWeeklyTasks',
                'stepsPlannerTaskMatrix',
                'stepsPlannerDailyPlans'
            ];

            let count = 0;
            for (const student of students) {
                // 특정 데이터를 제외한 나머지 데이터 문서를 삭제합니다.
                for (const colName of collectionsToDelete) {
                    await deleteDoc(doc(db, 'users', student.id, 'plannerData', colName));
                }
                // 리더보드 점수 초기화
                await setDoc(doc(db, 'leaderboard', student.id), {
                    totalStudyTime: 0,
                    lastActive: Date.now()
                }, { merge: true });
                count++;
            }
            alert(`총 ${count}명의 학생 데이터(시간표 제외)가 초기화되었습니다.`);
        } catch(e) {
            console.error("초기화 실패:", e);
            alert("초기화 중 오류가 발생했습니다: " + e.message);
        } finally {
            setLoadingData(false);
            if(selectedStudent) {
                setSelectedStudent({...selectedStudent}); // 강제 리렌더링 트리거
            }
        }
    };

    // 학생 강제 탈퇴 (사용자 삭제)
    const handleDeleteStudent = async (e, studentId, studentName) => {
        e.stopPropagation();
        if (!window.confirm(`정말 '${studentName || '이름없음'}' 학생을 강제 탈퇴시키겠습니까?\n이 작업은 되돌릴 수 없습니다!`)) return;
        
        try {
            await deleteDoc(doc(db, 'users', studentId));
            if (selectedStudent?.id === studentId) {
                setSelectedStudent(null);
            }
        } catch (error) {
            console.error('학생 삭제 중 오류 발생:', error);
            alert('삭제에 실패했습니다. 권한이 부족할 수 있습니다.');
        }
    };

    // Fetch details when a student is selected
    useEffect(() => {
        if (!selectedStudent) return;
        setLoadingData(true);
        setStudentWeekOffset(0);
        const fetchData = async () => {
            try {
                // Fetch daily plans
                const dpRef = doc(db, 'users', selectedStudent.id, 'plannerData', 'stepsPlannerDailyPlans');
                const dpSnap = await getDoc(dpRef);
                const dailyPlans = dpSnap.exists() ? dpSnap.data().value : {};

                // Fetch goals
                const goalsRef = doc(db, 'users', selectedStudent.id, 'plannerData', 'stepsPlannerGoals');
                const goalsSnap = await getDoc(goalsRef);
                const goalsInfo = goalsSnap.exists() ? goalsSnap.data().value : { career: '', academic: '', studyTime: '' };

                // Process stats
                let totalTasks = 0;
                let doneTasks = 0;
                let emotionCounts = {};
                let recentReflections = [];
                let allTasks = [];

                Object.keys(dailyPlans).forEach(date => {
                    const dayData = dailyPlans[date];
                    // Tasks
                    if (dayData.todos && Array.isArray(dayData.todos)) {
                        totalTasks += dayData.todos.length;
                        doneTasks += dayData.todos.filter(t => t.status === 'done').length;
                        
                        dayData.todos.forEach(t => {
                            allTasks.push({ date, ...t });
                        });
                    }
                    // Reflections
                    if (dayData.reflection && dayData.reflection.emotion) {
                        const emo = dayData.reflection.emotion;
                        emotionCounts[emo] = (emotionCounts[emo] || 0) + 1;
                        recentReflections.push({ date, ...dayData.reflection });
                    }
                });

                // Sort reflections by date descending
                recentReflections.sort((a,b) => new Date(b.date) - new Date(a.date));
                
                // Sort tasks by date descending
                allTasks.sort((a,b) => new Date(b.date) - new Date(a.date));

                // Process recentData for chart (daily - last 14 days)
                const today = new Date();
                const recentData = Array.from({ length: 14 }, (_, i) => {
                    const d = new Date(); d.setDate(today.getDate() - 13 + i);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const ds = `${y}-${m}-${day}`;
                    const plan = dailyPlans[ds];
                    const ts = plan?.todos || [];
                    const done = ts.filter(t => t.status === 'done').length;
                    const total = ts.length;
                    return {
                        date: ds.slice(5).replace('-', '/'),
                        완료율: total > 0 ? Math.round(done / total * 100) : 0,
                        노력점수: plan?.reflection?.rating || 0
                    };
                });

                // Process weeklyData for chart
                const weekMap = {};
                Object.keys(dailyPlans).forEach(dateStr => {
                    const weekStart = getStartOfWeek(new Date(dateStr));
                    const wKey = getTodayDateString(weekStart);
                    if (!weekMap[wKey]) weekMap[wKey] = { done: 0, total: 0, weekStart };
                    const ts = dailyPlans[dateStr]?.todos || [];
                    weekMap[wKey].total += ts.length;
                    weekMap[wKey].done += ts.filter(t => t.status === 'done').length;
                });
                const weeklyData = Object.entries(weekMap)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([wKey, v]) => {
                        const ws = new Date(wKey);
                        const we = new Date(wKey); we.setDate(ws.getDate() + 6);
                        const label = `${ws.getMonth()+1}/${ws.getDate()}~${we.getMonth()+1}/${we.getDate()}`;
                        return {
                            weekLabel: label,
                            weekKey: wKey,
                            완수율: v.total > 0 ? Math.round(v.done / v.total * 100) : 0,
                            완료: v.done,
                            전체: v.total,
                        };
                    });

                setStudentData({
                    totalTasks,
                    doneTasks,
                    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
                    emotionCounts,
                    recentReflections,
                    allTasks,
                    recentData,
                    weeklyData,
                    goals: goalsInfo
                });
            } catch (err) {
                console.error("데이터 불러오기 실패:", err);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [selectedStudent]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-24 min-h-[100vh]">
            
            {/* Main Tab Switcher */}
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => setMainTab('individual')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${mainTab === 'individual' ? 'bg-rose-50 text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Users size={16}/> 개별 학생 분석
                </button>
                <button onClick={() => setMainTab('weeklyOverview')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${mainTab === 'weeklyOverview' ? 'bg-violet-50 text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <CalendarCheck size={16}/> 주간 완수율 현황
                </button>
            </div>

            {mainTab === 'weeklyOverview' ? (
                /* Weekly Overview Tab */
                <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100 p-4 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                        <h3 className="font-black text-lg sm:text-xl text-slate-800 flex items-center gap-2">
                            <CalendarCheck className="text-violet-500"/> 전체 학생 주간 완수율
                        </h3>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setOverviewWeekOffset(p => p - 1)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition active:scale-90"><ChevronLeft size={16}/></button>
                            <span className="text-xs font-black text-slate-600 bg-slate-100 px-4 py-2 rounded-xl min-w-[120px] text-center">{overviewWeekLabel.label}<br/><span className="text-[10px] text-slate-400 font-bold">{overviewWeekLabel.range}</span></span>
                            <button onClick={() => setOverviewWeekOffset(p => Math.min(p + 1, 0))} disabled={overviewWeekOffset === 0} className={`p-2 rounded-xl transition active:scale-90 ${overviewWeekOffset === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200'}`}><ChevronRight size={16}/></button>
                        </div>
                    </div>
                    {weeklyOverviewLoading ? (
                        <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full"></div></div>
                    ) : (
                        <div className="space-y-3">
                            {weeklyOverview.length > 0 ? weeklyOverview.map((s, idx) => (
                                <div key={s.id} className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-200 text-slate-500' : idx === 2 ? 'bg-orange-100 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
                                    {s.photoURL ? <img src={s.photoURL} className="w-9 h-9 rounded-xl shrink-0" alt=""/> : <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center font-black text-slate-400 text-sm shrink-0">{s.name?.charAt(0)}</div>}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-slate-700 text-sm truncate">{s.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${s.rate === null ? 'bg-slate-300' : s.rate >= 80 ? 'bg-emerald-400' : s.rate >= 50 ? 'bg-violet-400' : 'bg-red-400'}`} style={{ width: `${s.rate ?? 0}%` }}/>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">{s.total > 0 ? `${s.done}/${s.total}` : '-'}</span>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-black px-3 py-1 rounded-full shrink-0 ${s.rate === null ? 'bg-slate-100 text-slate-400' : s.rate >= 80 ? 'bg-emerald-100 text-emerald-600' : s.rate >= 50 ? 'bg-violet-100 text-violet-600' : 'bg-red-100 text-red-500'}`}>{s.rate !== null ? `${s.rate}%` : '—'}</span>
                                </div>
                            )) : <p className="text-center text-slate-400 font-bold py-10">데이터가 없습니다.</p>}
                        </div>
                    )}
                </div>
            ) : (
            /* Individual Student Tab - original layout */
            <div className="flex flex-col lg:flex-row gap-6">

            {/* Sidebar: Student List */}
            <div className="lg:w-1/3 w-full bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100 p-4 sm:p-6 flex flex-col h-[400px] sm:h-[500px] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-28 lg:self-start">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100 shrink-0">
                    <div className="w-12 h-12 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center">
                        <Users size={24} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">클래스 보드</h2>
                        <p className="text-sm font-bold text-slate-400">전체 학생 명단</p>
                    </div>
                    <button 
                        onClick={handleResetAllData} 
                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all border border-red-200 shadow-sm"
                        title="전체 데이터 초기화 (시간표 제외)"
                    >
                        <RefreshCcw size={18} className="mb-1" />
                        <span className="text-[10px] font-black leading-none whitespace-nowrap">데이터 초기화</span>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {students.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => setSelectedStudent(s)}
                            className={`w-full text-left p-4 rounded-2xl transition-all border flex items-center gap-3 cursor-pointer ${selectedStudent?.id === s.id ? 'bg-rose-50 border-rose-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
                        >
                            {s.photoURL ? (
                                <img src={s.photoURL} className="w-10 h-10 rounded-xl" alt="profile" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                    {s.displayName?.charAt(0) || '?'}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className={`font-black truncate ${selectedStudent?.id === s.id ? 'text-rose-700' : 'text-slate-700'}`}>{s.displayName}</h3>
                                <p className="text-xs text-slate-400 truncate">{s.email || '이메일 없음'}</p>
                            </div>
                            <button 
                                onClick={(e) => handleDeleteStudent(e, s.id, s.displayName)} 
                                className="p-2 rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title="학생 삭제"
                            >
                                <Trash2 size={16} />
                            </button>
                            <ChevronRight size={18} className={selectedStudent?.id === s.id ? 'text-rose-400' : 'text-slate-300'}/>
                        </div>
                    ))}
                    {students.length === 0 && <p className="text-center text-slate-400 font-bold py-10">가입된 학생이 없습니다.</p>}
                </div>
            </div>

            {/* Main Content: Student Stats */}
            <div className="flex-1">
                {!selectedStudent ? (
                    <div className="h-full bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-10 min-h-[400px]">
                        <Activity size={60} className="mb-4 opacity-50"/>
                        <p className="font-black text-xl">학생을 선택해주세요</p>
                        <p className="font-bold text-sm mt-2 text-center">좌측 명단에서 학생을 클릭하면<br/>상세 학습 통계를 확인할 수 있습니다.</p>
                    </div>
                ) : loadingData ? (
                    <div className="h-full bg-white rounded-[32px] flex items-center justify-center shadow-sm min-h-[400px]">
                        <div className="animate-spin w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : studentData ? (
                    <div className="space-y-6">
                        {/* Student Goals */}
                        {studentData.goals && (studentData.goals.career || studentData.goals.academic || studentData.goals.studyTime) && (
                            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-[32px] p-6 sm:p-8 shadow-sm">
                                <h3 className="font-black text-violet-800 text-lg mb-4 flex items-center gap-2">
                                    <Trophy className="text-violet-500"/> 학생의 목표
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {studentData.goals.career && (
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-violet-100">
                                            <p className="text-xs font-bold text-slate-400 mb-1">🌟 장래희망</p>
                                            <p className="text-slate-700 font-black text-lg">{studentData.goals.career}</p>
                                        </div>
                                    )}
                                    {studentData.goals.academic && (
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-violet-100">
                                            <p className="text-xs font-bold text-slate-400 mb-1">🎯 이번 달 목표</p>
                                            <ul className="text-slate-700 font-black text-sm space-y-1">
                                                {studentData.goals.academic.split('\n').filter(g => g.trim()).map((g, i) => (
                                                    <li key={i} className="flex gap-1.5"><span className="text-violet-300">•</span> <span>{g}</span></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {studentData.goals.studyTime && (
                                        <div className="md:col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
                                            <p className="text-xs font-bold text-emerald-600 mb-1">⏱️ 주간 목표 학습 시간</p>
                                            <p className="text-emerald-700 font-black text-lg">{studentData.goals.studyTime}시간 / 주</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setIsTaskModalOpen(true)}
                                className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-100 transition-all active:scale-[0.98] group"
                            >
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <PieChart size={30} />
                                </div>
                                <h3 className="text-slate-400 font-bold mb-1">과제 완수율 <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full ml-1 group-hover:bg-emerald-200 group-hover:text-emerald-700 transition-colors">상세보기</span></h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-800">{studentData.completionRate}</span>
                                    <span className="text-xl font-bold text-slate-400">%</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-2 font-bold bg-slate-50 group-hover:bg-white px-3 py-1 rounded-full text-center transition-colors">
                                    총 {studentData.totalTasks}개 중 {studentData.doneTasks}개 완료
                                </p>
                            </button>
                            
                            <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-4 text-3xl">
                                    {Object.entries(studentData.emotionCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '❓'}
                                </div>
                                <h3 className="text-slate-400 font-bold mb-1">가장 자주 느낀 감정</h3>
                                <div className="flex items-baseline gap-1 mt-2 flex-wrap justify-center">
                                    {Object.entries(studentData.emotionCounts).length > 0 ? Object.entries(studentData.emotionCounts).map(([emo, count]) => (
                                        <span key={emo} className="bg-slate-50 px-3 py-1.5 rounded-xl text-sm font-bold m-1 shadow-sm border border-slate-100">
                                            {emo} <span className="text-slate-400 ml-1">{count}회</span>
                                        </span>
                                    )) : <span className="text-sm font-bold text-slate-300">작성된 일지가 없습니다.</span>}
                                </div>
                            </div>
                        </div>

                        {/* 학생별 주간 완수율 카드 */}
                        {(() => {
                            const today = new Date();
                            const targetDate = new Date(today);
                            targetDate.setDate(today.getDate() + (studentWeekOffset * 7));
                            const ws = getStartOfWeek(targetDate);
                            const todayStr = getTodayDateString();
                            let wDone = 0, wTotal = 0;
                            const dailyPlans = {};
                            // studentData.allTasks에서 dailyPlans 재구성
                            studentData.allTasks.forEach(t => {
                                if (!dailyPlans[t.date]) dailyPlans[t.date] = [];
                                dailyPlans[t.date].push(t);
                            });
                            const days = [];
                            for (let i = 0; i < 7; i++) {
                                const d = new Date(ws);
                                d.setDate(ws.getDate() + i);
                                const dateStr = getTodayDateString(d);
                                const isFuture = dateStr > todayStr && studentWeekOffset === 0;
                                const tasks = dailyPlans[dateStr] || [];
                                const done = tasks.filter(t => t.status === 'done').length;
                                const total = tasks.length;
                                if (!isFuture) { wDone += done; wTotal += total; }
                                days.push({ dateStr, label: dateStr.slice(5).replace('-','/'), done, total, rate: total > 0 ? Math.round(done/total*100) : null, isFuture });
                            }
                            const wRate = wTotal > 0 ? Math.round(wDone / wTotal * 100) : null;
                            const wLabel = studentWeekOffset === 0 ? '이번 주' : studentWeekOffset === -1 ? '지난 주' : `${Math.abs(studentWeekOffset)}주 전`;
                            const wsLabel = `${ws.getMonth()+1}/${ws.getDate()}`;
                            const we = new Date(ws); we.setDate(ws.getDate()+6);
                            const weLabel = `${we.getMonth()+1}/${we.getDate()}`;
                            const rateColor = wRate === null ? 'from-slate-400 to-slate-500' : wRate >= 80 ? 'from-emerald-400 to-teal-500' : wRate >= 50 ? 'from-violet-400 to-indigo-500' : 'from-amber-400 to-orange-500';
                            return (
                                <div className={`bg-gradient-to-r ${rateColor} rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 text-white shadow-lg`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <CalendarCheck size={20} className="opacity-90"/>
                                            <span className="font-black text-sm sm:text-base">주간 과제 완수율</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setStudentWeekOffset(p => p - 1)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition active:scale-90"><ChevronLeft size={14}/></button>
                                            <span className="text-white/90 text-[11px] font-bold bg-white/20 px-3 py-1 rounded-full min-w-[70px] text-center">{wLabel}</span>
                                            <button onClick={() => setStudentWeekOffset(p => Math.min(p+1, 0))} disabled={studentWeekOffset === 0} className={`p-1.5 rounded-lg transition active:scale-90 ${studentWeekOffset === 0 ? 'bg-white/10 opacity-40 cursor-not-allowed' : 'bg-white/20 hover:bg-white/30'}`}><ChevronRight size={14}/></button>
                                        </div>
                                    </div>
                                    <p className="text-white/60 text-[11px] font-bold mb-3">{wsLabel} ~ {weLabel}</p>
                                    {wRate !== null ? (
                                        <>
                                            <div className="flex items-baseline gap-2 mb-3">
                                                <span className="text-4xl sm:text-5xl font-black">{wRate}</span>
                                                <span className="text-xl font-bold opacity-80">%</span>
                                                <span className="text-xs font-bold opacity-70 ml-1">({wTotal}개 중 {wDone}개 완료)</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-white/30 rounded-full overflow-hidden mb-3">
                                                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${wRate}%` }}/>
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {days.map((day, idx) => (
                                                    <div key={idx} className="flex flex-col items-center">
                                                        <div className={`w-full rounded-lg text-center py-1 text-[10px] font-black ${
                                                            day.isFuture ? 'bg-white/10 text-white/30' :
                                                            day.rate === null ? 'bg-white/15 text-white/50' :
                                                            day.rate >= 80 ? 'bg-white/40 text-white' :
                                                            day.rate >= 50 ? 'bg-white/25 text-white/90' :
                                                            'bg-white/15 text-white/70'
                                                        }`}>
                                                            {day.isFuture ? '-' : day.total === 0 ? '-' : `${day.rate}%`}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-white/50 mt-1">{day.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-white/80 font-bold text-sm mt-1">이 주에 등록된 과제가 없습니다.</p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Growth Chart with tab toggle */}
                        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                                <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="text-emerald-500"/> 학생 성장 그래프
                                </h3>
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setChartTab('daily')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                                            chartTab === 'daily' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <Calendar size={13}/> 일별
                                    </button>
                                    <button
                                        onClick={() => setChartTab('weekly')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                                            chartTab === 'weekly' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <BarChart2 size={13}/> 주별
                                    </button>
                                </div>
                            </div>
                            <div className="h-[250px] w-full">
                                {chartTab === 'daily' ? (
                                    <ResponsiveContainer>
                                        <LineChart data={studentData.recentData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10}/>
                                            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                                            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} hide/>
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}/>
                                            <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                                            <Line yAxisId="left" name="과제 완료율(%)" type="monotone" dataKey="완료율" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}/>
                                            <Line yAxisId="right" name="노력 점수" type="monotone" dataKey="노력점수" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}/>
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <ResponsiveContainer>
                                        <BarChart data={studentData.weeklyData} barCategoryGap="30%">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                                            <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={8}/>
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%"/>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                                                formatter={(value, name, props) => [
                                                    `${value}% (${props.payload.완료}/${props.payload.전체}개)`,
                                                    '주차별 완수율'
                                                ]}
                                            />
                                            <Bar dataKey="완수율" name="주차별 완수율(%)" radius={[8, 8, 0, 0]}>
                                                {(studentData.weeklyData || []).map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.완수율 >= 80 ? '#10b981' : entry.완수율 >= 50 ? '#a78bfa' : '#f87171'}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            {chartTab === 'weekly' && studentData.weeklyData?.length === 0 && (
                                <p className="text-center text-slate-400 font-bold text-sm mt-4">주차별 데이터가 없습니다.</p>
                            )}
                        </div>

                        {/* Reflection History (원래대로 메인 화면에 배치) */}
                        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                <FileText className="text-rose-500" size={24}/>
                                <h3 className="text-xl font-black text-slate-800">성찰 일지 기록</h3>
                            </div>
                            <div className="space-y-4">
                                {studentData.recentReflections.length > 0 ? studentData.recentReflections.map((ref, idx) => {
                                    let timeStr = '';
                                    if (ref.updatedAt) {
                                        const d = new Date(ref.updatedAt);
                                        const m = d.getMonth() + 1;
                                        const day = d.getDate();
                                        const h = d.getHours();
                                        const min = String(d.getMinutes()).padStart(2, '0');
                                        const ampm = h >= 12 ? '오후' : '오전';
                                        const h12 = h % 12 || 12;
                                        timeStr = `${m}월 ${day}일 ${ampm} ${h12}시 ${min}분 입력`;
                                    }
                                    return (
                                    <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row gap-4 sm:items-center">
                                        <div className="bg-white px-4 py-2 rounded-xl text-sm font-black text-slate-500 shadow-sm shrink-0 text-center">
                                            {ref.date}
                                        </div>
                                        <div className="text-5xl shrink-0 text-center sm:text-left drop-shadow-sm">{ref.emotion}</div>
                                        <div className="flex-1">
                                            <p className="text-slate-800 font-bold text-lg mb-1">"{ref.achieved}"</p>
                                            <div className="flex gap-1 text-yellow-400">
                                                {'★'.repeat(ref.rating)}{'☆'.repeat(5-ref.rating)}
                                            </div>
                                            {timeStr && <p className="text-[10px] text-slate-400 font-bold mt-2">{timeStr}</p>}
                                        </div>
                                    </div>
                                )}) : (
                                    <div className="text-center py-10 text-slate-400 font-bold flex flex-col items-center">
                                        <AlertTriangle size={30} className="mb-2 opacity-30" />
                                        아직 성찰 일지를 기록하지 않았습니다.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                ) : null}
            </div>
        </div>
        )}
        </div>
        {/* Task List Modal */}
            {isTaskModalOpen && studentData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsTaskModalOpen(false)}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-lg w-full max-h-[80vh] flex flex-col mx-auto" onClick={e=>e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <FileText className="text-emerald-500" /> 과제 완수율 상세보기
                            </h3>
                            <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        {/* Modal Tabs */}
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5">
                            <button
                                onClick={() => setModalTab('list')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    modalTab === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'
                                }`}
                            >📋 전체 과제 목록</button>
                            <button
                                onClick={() => setModalTab('weekly')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    modalTab === 'weekly' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400'
                                }`}
                            >📅 주차별 완수율</button>
                        </div>
                        <div className="overflow-y-auto pr-2 flex-1 min-h-0">
                            {modalTab === 'list' ? (
                                <div className="space-y-3">
                                    {studentData.allTasks.length > 0 ? studentData.allTasks.map((t, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border bg-slate-50 border-slate-100 gap-2">
                                            <div>
                                                <div className="text-xs font-bold text-slate-400 mb-1">{t.date}</div>
                                                <div className={`font-black ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.task}</div>
                                            </div>
                                            <div className="shrink-0">
                                                {t.status === 'done' && <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-2 py-1 rounded-lg">완료 ({t.duration}분)</span>}
                                                {t.status === 'pending' && <span className="bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-lg">대기중</span>}
                                                {t.status === 'postponed' && <span className="bg-amber-100 text-amber-600 text-xs font-bold px-2 py-1 rounded-lg">미룸</span>}
                                                {t.status === 'failed' && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-lg">실패</span>}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-10 text-slate-400 font-bold">등록된 과제가 없습니다.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {studentData.weeklyData?.length > 0 ? studentData.weeklyData.slice().reverse().map((w, idx) => (
                                        <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-black text-slate-600">📅 {w.weekLabel}</span>
                                                <span className={`text-sm font-black px-3 py-1 rounded-full ${
                                                    w.완수율 >= 80 ? 'bg-emerald-100 text-emerald-600' :
                                                    w.완수율 >= 50 ? 'bg-violet-100 text-violet-600' :
                                                    'bg-red-100 text-red-500'
                                                }`}>{w.완수율}%</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${
                                                        w.완수율 >= 80 ? 'bg-emerald-400' :
                                                        w.완수율 >= 50 ? 'bg-violet-400' : 'bg-red-400'
                                                    }`}
                                                    style={{ width: `${w.완수율}%` }}
                                                />
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 mt-1.5">{w.전체}개 중 {w.완료}개 완료</p>
                                        </div>
                                    )) : (
                                        <div className="text-center py-10 text-slate-400 font-bold">주차별 데이터가 없습니다.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
