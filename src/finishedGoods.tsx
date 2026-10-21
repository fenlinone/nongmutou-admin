import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type FinishedBox = {
  code: string; variety: string; size: string; grade: string; spec: string; weight: number;
  state: 'pending' | 'stock' | 'out'; pallet?: string; warehouse?: string; inboundAt?: string; outboundBatch?: string;
};
export type Pallet = { code: string; codes: string[]; warehouse: string; time: string };
export type Inbound = { id: string; pallet: string; warehouse: string; boxes: FinishedBox[]; operator: string; time: string };
export type Outbound = { id: string; document: string; warehouse: string; boxes: FinishedBox[]; operator: string; time: string; restoration?: { reason: string; operator: string; time: string } };
export type FinishedState = { boxes: FinishedBox[]; pallets: Pallet[]; inbound: Inbound[]; outbound: Outbound[]; sequence: number };
export const finishedWarehouses = ['1号冷库', '2号冷库'];
export const finishedSpecs = ['125g × 12盒/箱', '250g × 8盒/箱'];
export const finishedSizes = ['XL', 'L', 'M', 'S', '/'];
export const finishedGrades = ['特级', '一级', '二级', '/'];
export const totalWeight = (boxes: FinishedBox[]) => Math.round(boxes.reduce((sum, box) => sum + box.weight, 0) * 100) / 100;
export const formatWeight = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function initialFinishedState(): FinishedState {
  const boxes: FinishedBox[] = [];
  const pallets: Pallet[] = [];
  const inbound: Inbound[] = [];
  let index = 1;
  [6, 4, 5, 3, 2].forEach((count, i) => {
    const code = `TP202610${i < 2 ? '15' : '16'}${String(i + 1).padStart(4, '0')}`;
    const warehouse = i === 2 ? '2号冷库' : '1号冷库';
    const time = `2026-10-${i < 2 ? '15' : '16'} 10:${String(10 + i * 5)}`;
    const group: FinishedBox[] = Array.from({ length: count }, () => ({
      code: `CP2026101500${String(index++).padStart(4, '0')}`,
      variety: i === 2 ? '蓝莓2号' : '蓝莓1号', size: i === 1 || i === 2 ? 'M' : 'L', grade: i === 1 || i === 2 || i === 4 ? '一级' : '特级', spec: finishedSpecs[i === 2 ? 1 : 0], weight: i === 2 ? 2 : 1.5,
      state: 'stock', pallet: code, warehouse, inboundAt: time,
    }));
    boxes.push(...group);
    pallets.push({ code, warehouse, time, codes: group.map(box => box.code) });
    inbound.push({ id: `FI20261016000${i + 1}`, pallet: code, warehouse, boxes: group.map(box => ({ ...box })), operator: '管理员', time });
  });
  // 补齐概览默认展示的 10 月 10 日至 16 日逐日演示记录，让入库、出库图表及记录表使用同一账本。
  const dailyOutbound: Outbound[] = [];
  for (let day = 10; day <= 14; day += 1) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    const suffix = String(day).padStart(2, '0');
    const pallet = `TP202610${suffix}0001`;
    const time = `${date} 09:30`;
    const group: FinishedBox[] = Array.from({ length: 2 }, (_, i) => ({
      code: `CP202610${suffix}000${String(i + 1).padStart(4, '0')}`,
      variety: '蓝莓1号', size: 'L', grade: '特级', spec: finishedSpecs[0], weight: 1.5,
      state: 'stock', pallet, warehouse: '1号冷库', inboundAt: time,
    }));
    boxes.push(...group);
    pallets.push({ code: pallet, warehouse: '1号冷库', time, codes: group.map(box => box.code) });
    inbound.push({ id: `FI202610${suffix}0001`, pallet, warehouse: '1号冷库', boxes: group.map(box => ({ ...box })), operator: '管理员', time });
    const moved = group[0];
    moved.state = 'out';
    moved.outboundBatch = `FO202610${suffix}0001`;
    dailyOutbound.push({
      id: moved.outboundBatch, document: `CK202610${suffix}0001`, warehouse: '1号冷库',
      boxes: [{ ...moved }], operator: '管理员', time: `${date} 15:20`,
    });
  }
  const outbound: Outbound[] = [
    ...dailyOutbound,
    { id: 'FO202610150001', document: 'CK202610150001', warehouse: '1号冷库', boxes: boxes.slice(0, 1).map(box => ({ ...box })), operator: '管理员', time: '2026-10-15 15:20' },
    { id: 'FO202610160001', document: 'CK202610160001', warehouse: '1号冷库', boxes: boxes.slice(8, 10).map(box => ({ ...box })), operator: '管理员', time: '2026-10-16 14:20' },
    { id: 'FO202610170002', document: 'CK202610170002', warehouse: '1号冷库', boxes: boxes.slice(15, 18).map(box => ({ ...box })), operator: '管理员', time: '2026-10-17 09:30', restoration: { reason: '取消发货，整批货物已放回原仓库', operator: '管理员', time: '2026-10-17 11:10' } },
    { id: 'FO202610180003', document: 'CK202610180003', warehouse: '1号冷库', boxes: boxes.slice(18, 20).map(box => ({ ...box })), operator: '管理员', time: '2026-10-18 13:15' },
  ];
  outbound.filter(row => !row.restoration).forEach(row => row.boxes.forEach(snapshot => {
    const box = boxes.find(item => item.code === snapshot.code)!;
    box.state = 'out'; box.outboundBatch = row.id;
  }));
  // 待组托数据代表已预打印并贴码的箱子；标签存在并不增加库存。
  Array.from({ length: 12 }, (_, i) => boxes.push({ code: `CP2026102000${String(i + 1).padStart(4, '0')}`, variety: i < 8 || i > 9 ? '蓝莓1号' : '蓝莓2号', size: i % 3 === 2 ? 'S' : i % 3 === 1 ? 'M' : 'L', grade: i % 3 === 0 ? '特级' : i % 3 === 1 ? '一级' : '二级', spec: finishedSpecs[i < 8 ? 0 : 1], weight: i < 8 ? 1.5 : 2, state: 'pending' }));
  return { boxes, pallets, inbound, outbound, sequence: 1 };
}

export type FinishedAction =
  | { type: 'inbound'; codes: string[]; warehouse: string; time: string }
  | { type: 'outbound'; codes: string[]; time: string }
  | { type: 'restore'; batch: string; reason: string; time: string };
export type TransactionResult = { ok: boolean; error?: string; id?: string };

export function applyFinishedAction(state: FinishedState, action: FinishedAction): { state: FinishedState; result: TransactionResult } {
  const fail = (error: string) => ({ state, result: { ok: false, error } });
  const day = action.time.slice(0, 10).replaceAll('-', '');
  const suffix = `${day}${String(state.sequence).padStart(4, '0')}`;
  if (action.type === 'restore') {
    const record = state.outbound.find(row => row.id === action.batch);
    if (!record || record.restoration) return fail('此出库批次不存在或已恢复，不能重复恢复。');
    if (!action.reason.trim()) return fail('请填写恢复原因。');
    // 必须全部仍属于该次出库，才能整批冲回；禁止部分恢复或覆盖后续流转。
    if (!record.boxes.every(snapshot => state.boxes.some(box => box.code === snapshot.code && box.state === 'out' && box.outboundBatch === record.id))) return fail('原批次货物状态发生变化，请重新核对完整清单。');
    const codes = new Set(record.boxes.map(box => box.code));
    return { state: { ...state, boxes: state.boxes.map(box => codes.has(box.code) ? { ...box, state: 'stock', outboundBatch: undefined } : box), outbound: state.outbound.map(row => row.id === record.id ? { ...row, restoration: { reason: action.reason.trim(), operator: '管理员', time: action.time } } : row) }, result: { ok: true, id: record.id } };
  }
  const unique = [...new Set(action.codes)];
  if (!unique.length) return fail('请至少选择一箱成品。');
  const selected = unique.map(code => state.boxes.find(box => box.code === code));
  if (selected.some(box => !box)) return fail('箱码不存在，请重新核对。');
  const boxes = selected as FinishedBox[];
  if (action.type === 'inbound') {
    if (!finishedWarehouses.includes(action.warehouse)) return fail('请选择入库仓库。');
    if (boxes.some(box => box.state !== 'pending' || box.pallet)) return fail('清单含已组托或已入库成品，不能重复入库。');
    if (boxes.some(box => box.variety !== boxes[0].variety || box.spec !== boxes[0].spec)) return fail('同一托盘必须为同品种、同包装规格。');
    const pallet = `TP${suffix}`;
    const saved = boxes.map(box => ({ ...box, pallet, state: 'stock' as const, warehouse: action.warehouse, inboundAt: action.time }));
    return { state: { ...state, sequence: state.sequence + 1, boxes: state.boxes.map(box => saved.find(item => item.code === box.code) ?? box), pallets: [{ code: pallet, codes: unique, warehouse: action.warehouse, time: action.time }, ...state.pallets], inbound: [{ id: `FI${suffix}`, pallet, warehouse: action.warehouse, boxes: saved, time: action.time, operator: '管理员' }, ...state.inbound] }, result: { ok: true, id: pallet } };
  }
  if (boxes.some(box => box.state !== 'stock')) return fail('清单含非在库成品，请重新选择。');
  if (new Set(boxes.map(box => box.warehouse)).size !== 1) return fail('本次演示请按仓库分别办理出库。');
  const id = `FO${suffix}`;
  const codes = new Set(unique);
  return { state: { ...state, sequence: state.sequence + 1, boxes: state.boxes.map(box => codes.has(box.code) ? { ...box, state: 'out', outboundBatch: id } : box), outbound: [{ id, document: `CK${suffix}`, warehouse: boxes[0].warehouse!, boxes: boxes.map(box => ({ ...box })), time: action.time, operator: '管理员' }, ...state.outbound] }, result: { ok: true, id } };
}

const FinishedContext = createContext<{ state: FinishedState; transact: (action: FinishedAction) => TransactionResult } | undefined>(undefined);
export function FinishedGoodsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialFinishedState);
  const current = useRef(state);
  // 同步更新引用，连续点击也必须使用最新库存校验，避免重复扣账或入库。
  const transact = useCallback((action: FinishedAction) => {
    const next = applyFinishedAction(current.current, action);
    if (next.result.ok) { current.current = next.state; setState(next.state); }
    return next.result;
  }, []);
  return <FinishedContext.Provider value={{ state, transact }}>{children}</FinishedContext.Provider>;
}
export function useFinishedGoods() {
  const value = useContext(FinishedContext);
  if (!value) throw new Error('成品数据上下文未初始化');
  return value;
}
