import React, { useState } from 'react';
import { 
  Plus, Trash2, Calendar, Clock, AlertCircle, 
  ArrowRight, Sparkles, LayoutGrid, CheckCircle2,
  ChevronRight, MousePointer2, Touchpad
} from 'lucide-react';
import { useApp } from '../App';
import { getTodayDateString, addDays } from '../utils/constants';

const WeeklyTaskManager = ({ weeklyTasks, setWeeklyTasks, taskMatrix, setTaskMatrix, onAutoSchedule }) => {
  const { showToast } = useApp();
  const [newTask, setNewTask] = useState('');
  const [deadline, setDeadline] = useState(addDays(getTodayDateString(), 1));
  const [duration, setDuration] = useState(40);

  // 1. 과제 추가 로직
  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    const id = `task-${Date.now()}`;
    const taskObj = { id, content: newTask, deadline, duration: Number(duration) };
    
    setWeeklyTasks([...weeklyTasks, taskObj]);
    // 기본적으로 '중요하지 않음/긴급하지 않음(4순위)'에 먼저 배치
    setTaskMatrix({
      ...taskMatrix,
      notUrgentNotImportant: [...taskMatrix.notUrgentNotImportant, id]
    });
    setNewTask('');
    showToast('새로운 과제가 등록되었습니다.', 'success');
  };

  const removeTask = (taskId) => {
    setWeeklyTasks(weeklyTasks.filter(t => t.id !== taskId));
    const newMatrix = { ...taskMatrix };
    Object.keys(newMatrix).forEach(key => {
      newMatrix[key] = newMatrix[key].filter(id => id !== taskId);
    });
    setTaskMatrix(newMatrix);
  };

  // 2. [핵심 수정] 터치 및 버튼 기반 이동 함수
  const moveTaskToQuadrant = (taskId, targetQuadrant) => {
    setTaskMatrix(prev => {
      const newMatrix = { ...prev };
      // 모든 사분면에서 기존 ID 제거
      Object.keys(newMatrix).forEach(key => {
        newMatrix[key] = newMatrix[key].filter(id => id !== taskId);
      });
      // 목표 사분면에 추가
      newMatrix[targetQuadrant] = [...newMatrix[targetQuadrant], taskId];
      return newMatrix;
    });
    
    const labels = {
      urgentImportant: '1순위',
      notUrgentImportant: '2순위',
      urgentNotImportant: '3순위',
      notUrgentNotImportant: '4순위'
    };
    showToast(`${labels[targetQuadrant]}로 이동되었습니다.`, 'info');
  };

  // 3. 기존 드래그 앤 드롭 로직 (PC용)
  const onDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const onDrop = (e, targetQuadrant) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    moveTaskToQuadrant(taskId, targetQuadrant);
  };

  const onDragOver = (e) => e.preventDefault();

  // 4. 사분면별 과제 카드 렌더링
  const renderTaskCard = (taskId, currentQuadrant) => {
    const task = weeklyTasks.find(t => t.id === taskId);
    if (!task) return null;

    return (
      <div 
        key={task.id}
        draggable
        onDragStart={(e) => onDragStart(e, task.id)}
        className="group relative bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm hover:border-violet-200 transition-all mb-3 animate-fade-in"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h4 className="font-bold text-slate-800 leading-tight mb-1">{task.content}</h4>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1"><Calendar size={12}/> ~{task.deadline.split('-').slice(1).join('/')}</span>
              <span className="flex items-center gap-1"><Clock size={12}/> {task.duration}분</span>
            </div>
          </div>
          <button onClick={() => removeTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
            <Trash2 size={16}/>
          </button>
        </div>

        {/* [추가] 터치 기기용 순위 이동 버튼 세트 */}
        <div className="mt-4 pt-3 border-t border-slate-50 flex flex-wrap gap-1">
          {[
            { id: 'urgentImportant', label: '1', color: 'bg-rose-50 text-rose-600 border-rose-100' },
            { id: 'notUrgentImportant', label: '2', color: 'bg-orange-50 text-orange-600 border-orange-100' },
            { id: 'urgentNotImportant', label: '3', color: 'bg-blue-50 text-blue-600 border-blue-100' },
            { id: 'notUrgentNotImportant', label: '4', color: 'bg-slate-50 text-slate-600 border-slate-100' }
          ].map(btn => (
            currentQuadrant !== btn.id && (
              <button
                key={btn.id}
                onClick={() => moveTaskToQuadrant(task.id, btn.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${btn.color} active:scale-90 transition-transform flex items-center gap-1`}
              >
                {btn.label}순위
              </button>
            )
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      {/* 상단 입력부 */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <Plus className="text-violet-600" /> 이번 주 해야 할 일 등록
        </h2>
        <form onSubmit={addTask} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <input 
              type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
              placeholder="무엇을 해야 하나요? (예: 수학 익힘책 풀기)"
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-violet-600 focus:bg-white transition-all outline-none font-bold"
            />
          </div>
          <div className="md:col-span-3">
            <input 
              type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-violet-600 outline-none font-bold"
            />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="w-full h-full bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-100 py-4">
              추가하기 <ArrowRight size={20}/>
            </button>
          </div>
        </form>
      </div>

      {/* 사분면 섹션 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">과제 우선순위 정하기</h2>
            <p className="text-slate-500 text-sm font-bold mt-1">드래그하거나 숫자 버튼을 눌러 순위를 정해보세요!</p>
          </div>
          <button 
            onClick={onAutoSchedule}
            className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95"
          >
            <Sparkles size={18}/> AI 자동 계획 세우기
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1순위: 급함 & 중요 */}
          <div 
            onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'urgentImportant')}
            className="bg-rose-50/50 rounded-[32px] p-6 border-2 border-dashed border-rose-100 min-h-[300px]"
          >
            <div className="flex items-center gap-2 mb-6 text-rose-600">
              <div className="p-2 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-100 font-black text-sm">1순위</div>
              <span className="font-black text-lg">급하고 중요해요!</span>
            </div>
            {taskMatrix.urgentImportant.map(id => renderTaskCard(id, 'urgentImportant'))}
          </div>

          {/* 2순위: 안급함 & 중요 */}
          <div 
            onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'notUrgentImportant')}
            className="bg-orange-50/50 rounded-[32px] p-6 border-2 border-dashed border-orange-100 min-h-[300px]"
          >
            <div className="flex items-center gap-2 mb-6 text-orange-600">
              <div className="p-2 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-100 font-black text-sm">2순위</div>
              <span className="font-black text-lg">중요하지만 여유 있어요.</span>
            </div>
            {taskMatrix.notUrgentImportant.map(id => renderTaskCard(id, 'notUrgentImportant'))}
          </div>

          {/* 3순위: 급함 & 안중요 */}
          <div 
            onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'urgentNotImportant')}
            className="bg-blue-50/50 rounded-[32px] p-6 border-2 border-dashed border-blue-100 min-h-[300px]"
          >
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 font-black text-sm">3순위</div>
              <span className="font-black text-lg">빨리 처리하면 좋아요.</span>
            </div>
            {taskMatrix.urgentNotImportant.map(id => renderTaskCard(id, 'urgentNotImportant'))}
          </div>

          {/* 4순위: 안급함 & 안중요 */}
          <div 
            onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'notUrgentNotImportant')}
            className="bg-slate-50 rounded-[32px] p-6 border-2 border-dashed border-slate-200 min-h-[300px]"
          >
            <div className="flex items-center gap-2 mb-6 text-slate-500">
              <div className="p-2 bg-slate-500 text-white rounded-xl shadow-lg shadow-slate-100 font-black text-sm">4순위</div>
              <span className="font-black text-lg">나중에 천천히 해요.</span>
            </div>
            {taskMatrix.notUrgentNotImportant.map(id => renderTaskCard(id, 'notUrgentNotImportant'))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyTaskManager;
