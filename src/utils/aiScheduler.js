// AI Scheduler Logic
import { getTodayDateString, addDays, DAYS, TIME_SLOTS } from './constants';

export function runAutoSchedule({
    weeklyTasks,
    taskMatrix,
    fixedSchedule,
    goldenTime,
    dailyPlans,
    userProfile,
}) {
    if (!userProfile) return { newDailyPlans: dailyPlans, report: { success: 0, failed: 0 } };

    const MAX_STUDY_PER_DAY = userProfile.max_study;
    const POMODORO = userProfile.pomodoro; 
    const sleepConfig = userProfile.sleep || { start: '22:00', end: '07:00' };
    const todayStr = getTodayDateString();

    const priorityWeights = { urgentImportant: 10, notUrgentImportant: 5, urgentNotImportant: 2, notUrgentNotImportant: 1 };
    
    // 1. 모든 과제 리스트업 및 정렬 (마감일 우선, 그 다음 가중치)
    let tasksToSchedule = [];
    Object.keys(taskMatrix).forEach(priorityKey => {
        (taskMatrix[priorityKey] || []).forEach(taskId => {
            const task = weeklyTasks.find(t => t.id === taskId);
            if (task && task.duration > 0) {
                tasksToSchedule.push({
                    ...task,
                    priorityKey,
                    weight: priorityWeights[priorityKey] || 1,
                    remaining: task.duration,
                    deadline: task.deadline || addDays(todayStr, 7)
                });
            }
        });
    });

    if (tasksToSchedule.length === 0) return { newDailyPlans: dailyPlans, report: { success: 0, failed: 0 } };

    // 정렬: 마감일 빠른 순 -> 가중치 높은 순
    tasksToSchedule.sort((a, b) => {
        if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
        return b.weight - a.weight;
    });

    // 2. 가용 슬롯 맵 생성 (오늘부터 마지막 마감일까지)
    const lastDeadline = tasksToSchedule.reduce((max, t) => t.deadline > max ? t.deadline : max, todayStr);
    const dayMap = {};
    let cursor = new Date(todayStr);
    const endDate = new Date(lastDeadline);
    endDate.setDate(endDate.getDate() + 1);

    while (cursor < endDate) {
        const ds = getTodayDateString(cursor);
        const dow = DAYS[cursor.getDay() === 0 ? 6 : cursor.getDay() - 1];
        dayMap[ds] = {
            studied: 0,
            slots: TIME_SLOTS.map(time => {
                const cellId = `${dow}-${time}`;
                let isSleep = false;
                if (sleepConfig.start > sleepConfig.end) {
                    if (time >= sleepConfig.start || time < sleepConfig.end) isSleep = true;
                } else {
                    if (time >= sleepConfig.start && time < sleepConfig.end) isSleep = true;
                }
                
                return { time, available: (fixedSchedule[cellId] || isSleep) ? 0 : 30, isGolden: goldenTime.includes(cellId), tasks: [] };
            })
        };
        cursor.setDate(cursor.getDate() + 1);
    }

    // 3. 기존 AI 데이터 초기화
    const newPlans = JSON.parse(JSON.stringify(dailyPlans));
    Object.keys(newPlans).forEach(ds => {
        if (newPlans[ds]?.todos) newPlans[ds].todos = newPlans[ds].todos.filter(t => !t.aiScheduled);
    });

    // 4. 과제 분산 배치 로직
    tasksToSchedule.forEach(task => {
        let currentSearchDate = new Date(todayStr);
        const deadlineDate = new Date(task.deadline);
        
        while (task.remaining > 0 && currentSearchDate <= deadlineDate) {
            const ds = getTodayDateString(currentSearchDate);
            const dayData = dayMap[ds];

            if (dayData && dayData.studied < MAX_STUDY_PER_DAY) {
                // 이 날짜에서 사용할 슬롯 찾기 (황금시간 우선)
                const targetSlot = dayData.slots.find(s => s.available > 0 && s.isGolden) || dayData.slots.find(s => s.available > 0);
                
                if (targetSlot) {
                    const canPlace = Math.min(task.remaining, targetSlot.available, MAX_STUDY_PER_DAY - dayData.studied, POMODORO);
                    if (canPlace > 0) {
                        const newTodo = {
                            id: `ai-${task.id}-${ds}-${targetSlot.time}`,
                            task: task.content, // task.task in DailyPlanner mapped to task.content from WeeklyTaskManager
                            startTime: targetSlot.time,
                            duration: canPlace,
                            status: 'pending',
                            aiScheduled: true,
                            originTaskId: task.id,
                            priority: task.priorityKey
                        };
                        
                        targetSlot.available -= canPlace;
                        dayData.studied += canPlace;
                        task.remaining -= canPlace;
                        
                        if (!newPlans[ds]) newPlans[ds] = { todos: [], checklist: [false, false, false], reflection: {} };
                        newPlans[ds].todos.push(newTodo);
                    }
                }
            }
            currentSearchDate.setDate(currentSearchDate.getDate() + 1);
        }
    });

    return { newDailyPlans: newPlans, report: { success: tasksToSchedule.length } };
}
