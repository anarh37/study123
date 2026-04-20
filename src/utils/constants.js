export const THEME = {
    colors: {
        primary: '#7c3aed',
        secondary: '#64748b',
        accent: '#f59e0b',
        success: '#10b981',
        danger: '#ef4444',
        bg: '#f8fafc'
    }
};

export const GRADE_LEVELS = {
    'elem_low':  { key: 'elem_low',  name: '초등 저학년 (1-3)', max_study: 60,  pomodoro: 15, breakTime: 5,  icon: '🧸', sleep: { start: '21:00', end: '07:30' } },
    'elem_high': { key: 'elem_high', name: '초등 고학년 (4-6)', max_study: 90,  pomodoro: 20, breakTime: 5,  icon: '📚', sleep: { start: '22:30', end: '07:00' } },
    'middle':    { key: 'middle',    name: '중학생',            max_study: 150, pomodoro: 25, breakTime: 5,  icon: '🧑‍🏫', sleep: { start: '23:30', end: '07:00' } },
    'high':      { key: 'high',      name: '고등학생',          max_study: 210, pomodoro: 30, breakTime: 10, icon: '🧑‍🎓', sleep: { start: '01:00', end: '06:30' } },
};

export const SCHEDULE_CATEGORIES = {
    '수면': { color: 'bg-indigo-400' }, '수업': { color: 'bg-sky-400' },
    '통학': { color: 'bg-purple-400' }, '학원': { color: 'bg-teal-400' },
    '식사': { color: 'bg-amber-400' }, '기타': { color: 'bg-slate-400' },
};

export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${String(hour).padStart(2, '0')}:${minute}`;
});

export const SRL_PHASES = {
    forethought:  { label: '계획하기',  icon: '🎯', pages: ['goals', 'timetable', 'taskManager'] },
    performance:  { label: '실행하기',  icon: '⚡', pages: ['planner'] },
    reflection:   { label: '돌아보기', icon: '🪞', pages: ['reflection', 'dashboard'] },
};

export const getTodayDateString = (date = new Date()) =>
    new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

export const getStartOfWeek = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

export const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return getTodayDateString(d);
};

export const diffDays = (dateStr1, dateStr2) => {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
};
