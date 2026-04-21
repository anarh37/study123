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
                // 1. 해당 날짜에 지정된 황금시간의 인덱스 배열 찾기
                const goldenIndices = [];
                dayData.slots.forEach((s, i) => { if (s.isGolden) goldenIndices.push(i); });
                
                // 2. 가용한 슬롯들의 우선순위 점수 계산 (가장 점수가 높은 슬롯 선택)
                let bestSlot = null;
                let bestScore = -1;

                dayData.slots.forEach((s, idx) => {
                    if (s.available <= 0) return; // 배치 불가 슬롯 패스

                    let score = 0;
                    
                    if (s.isGolden) {
                        score = 100; // 1순위: 황금시간
                    } else {
                        // 기본 점수: 시간대 판별
                        const hour = parseInt(s.time.split(':')[0], 10);
                        if (hour >= 6 && hour < 12) {
                            score = 0; // 4순위: 아침 시간대 (가장 힘든 시간, 최후순위)
                        } else {
                            score = 20; // 3순위: 그 외 일반 시간대 (점심~밤)
                        }

                        // 2순위: 황금시간 근접도 보너스 (집중하는 김에 이어서 배치)
                        if (goldenIndices.length > 0) {
                            let minDistance = 999;
                            goldenIndices.forEach(gIdx => {
                                const dist = Math.abs(idx - gIdx);
                                if (dist < minDistance) minDistance = dist;
                            });
                            
                            // 거리 1(30분)당 -2점씩, 최고 50점 보너스 (가까울수록 높음)
                            const proximityBonus = Math.max(0, 50 - (minDistance * 2));
                            score += proximityBonus;
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestSlot = s;
                    }
                });

                const targetSlot = bestSlot;
                
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
