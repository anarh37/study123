import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, getDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Users, FileText, Activity, PieChart, CheckCircle2, TrendingUp, AlertTriangle, ChevronRight, Trophy, RefreshCcw, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TeacherDashboard() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentData, setStudentData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    // Fetch all students
    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(list);
        });
        return () => unsubscribe();
    }, []);

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

    // Fetch details when a student is selected
    useEffect(() => {
        if (!selectedStudent) return;
        setLoadingData(true);
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

                // Process recentData for chart
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

                setStudentData({
                    totalTasks,
                    doneTasks,
                    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
                    emotionCounts,
                    recentReflections,
                    allTasks,
                    recentData,
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
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-24 min-h-[100vh] flex flex-col lg:flex-row gap-6">
            
            {/* Sidebar: Student List */}
            <div className="lg:w-1/3 w-full bg-white rounded-[32px] shadow-sm border border-slate-100 p-6 flex flex-col h-[500px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-16 lg:self-start">
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
                        <button 
                            key={s.id} 
                            onClick={() => setSelectedStudent(s)}
                            className={`w-full text-left p-4 rounded-2xl transition-all border flex items-center gap-3 ${selectedStudent?.id === s.id ? 'bg-rose-50 border-rose-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
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
                            <ChevronRight size={18} className={selectedStudent?.id === s.id ? 'text-rose-400' : 'text-slate-300'}/>
                        </button>
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

                        {/* Recent 14 Days Growth Chart */}
                        <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-slate-100">
                            <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp className="text-emerald-500"/> 최근 2주 학생 성장 그래프
                            </h3>
                            <div className="h-[250px] w-full">
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
                            </div>
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
        {/* Task List Modal */}
            {isTaskModalOpen && studentData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsTaskModalOpen(false)}>
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl animate-fade-in max-w-lg w-full max-h-[80vh] flex flex-col mx-auto" onClick={e=>e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <FileText className="text-emerald-500" /> 과제 완수율 상세보기
                            </h3>
                            <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="overflow-y-auto pr-2 space-y-3 flex-1 min-h-0">
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
                    </div>
                </div>
            )}
        </>
    );
}
