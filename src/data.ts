export interface WeighingRecord {
  id: number; time: string; worker: string; workerId: string; greenhouse: string;
  team: string; variety: string; size: string; grade: string; weight: number;
  code: string; status: 'valid' | 'void';
}
export interface FilterValues {
  dates?: [string, string]; worker?: string; greenhouse?: string; team?: string;
  variety?: string; size?: string; grade?: string; status?: string;
}
export const initialFilters: FilterValues = { dates: ['2026-10-01', '2026-10-16'], status: 'all' };
const seed: Omit<WeighingRecord, 'id'>[] = [
  { time: '2026-10-16 08:23', worker: '张三', workerId: 'G001', greenhouse: '1号棚', team: 'A班', variety: '蓝莓1号', size: 'L', grade: '特级', weight: 6.2, code: 'BK202610160001', status: 'valid' },
  { time: '2026-10-16 08:27', worker: '李四', workerId: 'G002', greenhouse: '1号棚', team: 'A班', variety: '蓝莓1号', size: 'L', grade: '一级', weight: 5.8, code: 'BK202610160001', status: 'valid' },
  { time: '2026-10-16 08:31', worker: '王五', workerId: 'G003', greenhouse: '1号棚', team: 'A班', variety: '蓝莓1号', size: 'L', grade: '一级', weight: 6.1, code: 'BK202610160001', status: 'valid' },
  { time: '2026-10-16 08:35', worker: '张三', workerId: 'G001', greenhouse: '1号棚', team: 'A班', variety: '蓝莓1号', size: 'L', grade: '特级', weight: 5.9, code: 'BK202610160001', status: 'valid' },
  { time: '2026-10-16 08:42', worker: '赵六', workerId: 'G004', greenhouse: '2号棚', team: 'B班', variety: '蓝莓2号', size: 'M', grade: '一级', weight: 4.3, code: 'BK202610160002', status: 'valid' },
  { time: '2026-10-16 08:46', worker: '李四', workerId: 'G002', greenhouse: '2号棚', team: 'B班', variety: '蓝莓2号', size: 'M', grade: '一级', weight: 4.5, code: 'BK202610160002', status: 'valid' },
  { time: '2026-10-16 08:52', worker: '王五', workerId: 'G003', greenhouse: '2号棚', team: 'B班', variety: '蓝莓2号', size: 'M', grade: '一级', weight: 4.2, code: 'BK202610160002', status: 'valid' },
  { time: '2026-10-16 08:58', worker: '陈七', workerId: 'G005', greenhouse: '3号棚', team: 'A班', variety: '废果', size: 'L', grade: '/', weight: 3.6, code: 'BK202610160003', status: 'void' },
];
export const greenhouseOptions = Array.from({ length: 30 }, (_, index) => `${index + 1}号棚`);
// 固定生成模拟数据；首屏记录与参考图一致，刷新恢复初始状态。
export const records: WeighingRecord[] = Array.from({ length: 1860 }, (_, index) => {
  if (index < seed.length) return { ...seed[index], id: index + 1 };
  const source = seed[index % seed.length];
  const batchIndex = Math.floor((index - seed.length) / 8);
  const greenhouse = greenhouseOptions[batchIndex % greenhouseOptions.length];
  const date = `2026-10-${String(15 - Math.floor(batchIndex / 15) % 15).padStart(2, '0')}`;
  const basketNumber = batchIndex + 1;
  return { ...source, id: index + 1, greenhouse, time: `${date} ${String(8 + index % 9).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`, weight: (360 + (index * 17) % 320) / 100, code: `BK${date.replaceAll('-', '')}${String(basketNumber).padStart(4, '0')}` };
});
export function filterRecords(items: WeighingRecord[], filters: FilterValues) {
  return items.filter(record => {
    const date = record.time.slice(0, 10);
    const keyword = filters.worker?.trim().toLowerCase();
    if (filters.dates?.[0] && date < filters.dates[0]) return false;
    if (filters.dates?.[1] && date > filters.dates[1]) return false;
    if (keyword && !`${record.worker}${record.workerId}`.toLowerCase().includes(keyword)) return false;
    return (['greenhouse', 'team', 'variety', 'size', 'grade', 'status'] as const).every(key => !filters[key] || filters[key] === 'all' || filters[key] === record[key]);
  });
}
export interface WorkerSummary {
  workerId: string; worker: string; teams: string; count: number; validCount: number; voidCount: number; weight: number;
}
export function summarize(items: WeighingRecord[]): WorkerSummary[] {
  const map = new Map<string, WorkerSummary>();
  items.forEach(record => {
    const row = map.get(record.workerId) ?? { workerId: record.workerId, worker: record.worker, teams: '', count: 0, validCount: 0, voidCount: 0, weight: 0 };
    row.count += 1;
    if (!row.teams.includes(record.team)) row.teams = [row.teams, record.team].filter(Boolean).join('、');
    // 仅有效逐桶记录计入工人产量，作废记录和合筐动作不重复计量。
    if (record.status === 'valid') { row.validCount += 1; row.weight = Math.round((row.weight + record.weight) * 100) / 100; }
    else row.voidCount += 1;
    map.set(record.workerId, row);
  });
  return [...map.values()];
}
export function exportCsv(headers: string[], rows: (string | number)[][], name: string) {
  const escape = (value: string | number) => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
