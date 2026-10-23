import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';

export type ScatteredMovementType = '入库' | '出库';
export type ScatteredRecord = {
  key: string;
  inboundNo?: string;
  outboundNo?: string;
  sourceInboundKey?: string;
  businessDate: string;
  type: ScatteredMovementType;
  weight: number;
  operator: string;
  purpose: string;
  note: string;
  confirmedAt: string;
};

export function sumScatteredWeights(records: Array<Pick<ScatteredRecord, 'weight'>>) {
  const parts = records.map(record => {
    const [coefficient, exponentText] = record.weight.toString().toLowerCase().split('e');
    const exponent = Number(exponentText ?? 0);
    const [whole, fraction = ''] = coefficient.split('.');
    return { digits: BigInt(`${whole}${fraction}`), exponent, fractionLength: fraction.length };
  });
  const decimals = Math.max(0, ...parts.map(part => part.fractionLength - part.exponent));
  const scale = 10n ** BigInt(decimals);
  const scaledTotal = parts.reduce((total, part) => total + part.digits * 10n ** BigInt(part.exponent + decimals - part.fractionLength), 0n);
  return Number(scaledTotal) / Number(scale);
}

// 每条库存对应一次入库，仅累计明确关联到该入库的出库流水。
export function getScatteredInventory(records: ScatteredRecord[]) {
  const outboundByInbound = new Map<string, number>();
  records.filter(record => record.type === '出库' && record.sourceInboundKey).forEach(record => {
    const key = record.sourceInboundKey!;
    outboundByInbound.set(key, sumScatteredWeights([{ weight: outboundByInbound.get(key) ?? 0 }, record]));
  });
  return records.filter(record => record.type === '入库').map(record => {
    const outboundWeight = outboundByInbound.get(record.key) ?? 0;
    return { ...record, outboundWeight, balanceAfter: sumScatteredWeights([record, { weight: -outboundWeight }]) };
  }).sort((left, right) => right.businessDate.localeCompare(left.businessDate) || right.confirmedAt.localeCompare(left.confirmedAt));
}

const inboundWeights = [12.6, 9.8, 15.2, 11.4, 10.8, 13.7, 8.6, 16.1, 9.2, 14.5, 12.8, 10.3, 11.9, 15.6];
const outboundWeights = [4.2, 3.6, 6.5, 2.8, 7.2, 4.3, 5.6, 3.4, 6.8, 4.1, 5.2, 3.8, 6.1, 4.5];
const demoOperators = ['张三', '李四', '王五', '赵六'];
const demoPurposes = ['包装散果销售', '样品领用', '内部处置', '包装散果销售'];

// 包装散果使用独立演示账本，不与原果或成品库存互相记账。
const initialRecords: ScatteredRecord[] = Array.from({ length: inboundWeights.length }, (_, index) => {
  const date = dayjs('2026-10-21').subtract(index, 'day').format('YYYY-MM-DD');
  const operator = demoOperators[index % demoOperators.length];
  const inbound: ScatteredRecord = {
    key: `DEMO-IN-${index + 1}`,
    inboundNo: `SGRK${date.replaceAll('-', '')}${String(index + 1).padStart(4, '0')}`,
    businessDate: date,
    type: '入库',
    weight: inboundWeights[index],
    operator,
    purpose: '不适用',
    note: index % 3 === 0 ? '分拣包装集中称重' : '',
    confirmedAt: `${date} 10:${String(12 + index % 40).padStart(2, '0')}`,
  };
  const outbound: ScatteredRecord = {
    key: `DEMO-OUT-${index + 1}`,
    outboundNo: `SGCK${date.replaceAll('-', '')}${String(index + 1).padStart(4, '0')}`,
    sourceInboundKey: inbound.key,
    inboundNo: inbound.inboundNo,
    businessDate: date,
    type: '出库',
    weight: outboundWeights[index],
    operator: demoOperators[(index + 1) % demoOperators.length],
    purpose: demoPurposes[index % demoPurposes.length],
    note: index % 4 === 0 ? '按当日实际称重登记' : '',
    confirmedAt: `${date} 15:${String(18 + index % 40).padStart(2, '0')}`,
  };
  return [outbound, inbound];
}).flat();

type ScatteredFruitContextValue = {
  rows: ScatteredRecord[];
  addRecord: (record: ScatteredRecord) => void;
  updateRecord: (record: ScatteredRecord) => void;
  deleteRecord: (key: string) => void;
  balance: number;
  inboundTotal: number;
  outboundTotal: number;
};

const ScatteredFruitContext = createContext<ScatteredFruitContextValue | null>(null);

export function ScatteredFruitProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState(initialRecords);
  const value = useMemo(() => {
    const inboundTotal = sumScatteredWeights(rows.filter(record => record.type === '入库'));
    const outboundTotal = sumScatteredWeights(rows.filter(record => record.type === '出库'));
    return {
      rows,
      addRecord: (record: ScatteredRecord) => setRows(current => [record, ...current].sort((left, right) => right.businessDate.localeCompare(left.businessDate) || right.confirmedAt.localeCompare(left.confirmedAt))),
      updateRecord: (record: ScatteredRecord) => setRows(current => current.map(item => item.key === record.key ? record : item).sort((left, right) => right.businessDate.localeCompare(left.businessDate) || right.confirmedAt.localeCompare(left.confirmedAt))),
      deleteRecord: (key: string) => setRows(current => current.filter(record => record.key !== key)),
      balance: inboundTotal - outboundTotal,
      inboundTotal,
      outboundTotal,
    };
  }, [rows]);
  return <ScatteredFruitContext.Provider value={value}>{children}</ScatteredFruitContext.Provider>;
}

export function useScatteredFruit() {
  const context = useContext(ScatteredFruitContext);
  if (!context) throw new Error('useScatteredFruit must be used within ScatteredFruitProvider');
  return context;
}
