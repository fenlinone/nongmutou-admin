import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, DatePicker, Descriptions, Drawer, Empty, Input, Modal, Pagination, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getDrawerStyles, getModalStyles } from '../components/floatingLayer';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import { greenhouseSelectSearchProps } from '../components/greenhouseSelect';
import { exportCsv } from '../data';

type TabKey = 'pending' | 'inventory' | 'inbound' | 'outbound';
type Basket = { code: string; variety: string; size: string; grade: string; buckets: number; weight: number; pickedAt: string; greenhouse: string; team: string; warehouse?: string; inboundAt?: string; batch: string; state: 'pending' | 'stock' | 'out'; outboundBatch?: string };
type IntakeRecord = { key: string; batch: string; warehouse: string; count: number; weight: number; operator: string; time: string; codes: string[] };
type OutboundRecord = { key: string; batch: string; warehouse: string; count: number; weight: number; operator: string; time: string; codes: string[] };
type Submission = { batch: string; submittedBy: string; submittedAt: string; pickedAt: string; codes: string[] };
type PendingSubmission = Submission & { pending: string[] };
type BatchFilterValues = { keyword: string; variety?: string; size?: string; grade?: string; greenhouse?: string; team?: string; pickedRange?: [string, string] };

const extendedBasketCodes = Array.from({ length: 12 }, (_, index) => `BK20261019${String(index + 27).padStart(4, '0')}`);
const initialBaskets: Basket[] = [
  { code: 'BK202610190021', variety: '蓝莓1号', size: 'L', grade: '特级', buckets: 8, weight: 48.6, pickedAt: '2026-10-19', greenhouse: '1号棚', team: 'A班', warehouse: '1号冷库', inboundAt: '2026-10-19 11:05', batch: 'RI202610190006', state: 'stock' },
  { code: 'BK202610190022', variety: '蓝莓1号', size: 'L', grade: '一级', buckets: 7, weight: 42.3, pickedAt: '2026-10-19', greenhouse: '1号棚', team: 'A班', warehouse: '1号冷库', inboundAt: '2026-10-19 11:05', batch: 'RI202610190006', state: 'stock' },
  { code: 'BK202610190023', variety: '蓝莓1号', size: 'M', grade: '一级', buckets: 6, weight: 34.8, pickedAt: '2026-10-19', greenhouse: '1号棚', team: 'A班', batch: 'RI202610190006', state: 'pending' },
  { code: 'BK202610190024', variety: '蓝莓2号', size: 'M', grade: '一级', buckets: 8, weight: 39.2, pickedAt: '2026-10-19', greenhouse: '2号棚', team: 'B班', batch: 'RI202610190007', state: 'pending' },
  { code: 'BK202610190025', variety: '蓝莓2号', size: 'S', grade: '二级', buckets: 5, weight: 25.5, pickedAt: '2026-10-19', greenhouse: '2号棚', team: 'B班', warehouse: '2号冷库', inboundAt: '2026-10-19 14:32', batch: 'RI202610190007', state: 'stock' },
  { code: 'BK202610190026', variety: '废果', size: '/', grade: '/', buckets: 3, weight: 12.6, pickedAt: '2026-10-19', greenhouse: '3号棚', team: 'A班', batch: 'RI202610190008', state: 'pending' },
  { code: 'BK202610180016', variety: '蓝莓1号', size: 'L', grade: '特级', buckets: 9, weight: 53.1, pickedAt: '2026-10-18', greenhouse: '1号棚', team: 'A班', warehouse: '1号冷库', inboundAt: '2026-10-18 10:18', batch: 'RI202610180004', state: 'stock' },
  { code: 'BK202610180017', variety: '蓝莓1号', size: 'M', grade: '一级', buckets: 7, weight: 40.6, pickedAt: '2026-10-18', greenhouse: '1号棚', team: 'A班', warehouse: '1号冷库', inboundAt: '2026-10-18 10:18', batch: 'RI202610180004', state: 'out', outboundBatch: 'RO202610180002' },
  { code: 'BK202610180018', variety: '蓝莓2号', size: 'L', grade: '一级', buckets: 6, weight: 36.2, pickedAt: '2026-10-18', greenhouse: '2号棚', team: 'B班', warehouse: '2号冷库', inboundAt: '2026-10-18 09:46', batch: 'RI202610180005', state: 'out', outboundBatch: 'RO202610180003' },
  ...extendedBasketCodes.map((code, index): Basket => ({ code, variety: index % 3 === 0 ? '蓝莓1号' : '蓝莓2号', size: ['XL', 'L', 'M', 'S'][index % 4], grade: ['特级', '一级', '二级'][index % 3], buckets: 4 + (index % 6), weight: Number((24.6 + index * 1.85).toFixed(1)), pickedAt: '2026-10-19', greenhouse: `${1 + (index % 3)}号棚`, team: index % 2 === 0 ? 'A班' : 'B班', batch: 'RI202610190007', state: 'pending' })),
];
const initialSubmissions: Submission[] = [
  { batch: 'RI202610190006', submittedBy: '张三', submittedAt: '2026-10-19 10:42', pickedAt: '2026-10-19', codes: ['BK202610190021', 'BK202610190022', 'BK202610190023'] },
  { batch: 'RI202610190007', submittedBy: '李四', submittedAt: '2026-10-19 13:56', pickedAt: '2026-10-19', codes: ['BK202610190024', 'BK202610190025', ...extendedBasketCodes] },
  { batch: 'RI202610190008', submittedBy: '王五', submittedAt: '2026-10-19 15:10', pickedAt: '2026-10-19', codes: ['BK202610190026'] },
  { batch: 'RI202610180004', submittedBy: '张三', submittedAt: '2026-10-18 09:52', pickedAt: '2026-10-18', codes: ['BK202610180016', 'BK202610180017'] },
];
const warehouses = ['1号冷库', '2号冷库'];
const number = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });

export default function RawFruitPage() {
  const { message } = App.useApp();
  const [tab, setTab] = useState<TabKey>('inventory');
  const [baskets, setBaskets] = useState(initialBaskets);
  const [submissions] = useState(initialSubmissions);
  const [inbound, setInbound] = useState<IntakeRecord[]>([
    { key: 'IN202610190001', batch: 'RI202610190006', warehouse: '1号冷库', count: 2, weight: 90.9, operator: '管理员', time: '2026-10-19 11:05', codes: ['BK202610190021', 'BK202610190022'] },
    { key: 'IN202610190002', batch: 'RI202610190007', warehouse: '2号冷库', count: 1, weight: 25.5, operator: '管理员', time: '2026-10-19 14:32', codes: ['BK202610190025'] },
  ]);
  const [outbound, setOutbound] = useState<OutboundRecord[]>([
    { key: 'RO202610180002', batch: 'RO202610180002', warehouse: '1号冷库', count: 1, weight: 40.6, operator: '管理员', time: '2026-10-18 16:20', codes: ['BK202610180017'] },
    { key: 'RO202610180003', batch: 'RO202610180003', warehouse: '2号冷库', count: 1, weight: 36.2, operator: '管理员', time: '2026-10-18 16:24', codes: ['BK202610180018'] },
  ]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [hiddenPendingColumns, setHiddenPendingColumns] = useState<string[]>([]);
  const [hiddenInventoryColumns, setHiddenInventoryColumns] = useState<string[]>([]);
  const [hiddenTableColumns, setHiddenTableColumns] = useState<Record<string, string[]>>({});
  const [tableColumnOrders, setTableColumnOrders] = useState<Record<string, string[]>>({});
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [selectedPendingBatches, setSelectedPendingBatches] = useState<string[]>([]);
  const [selectedInventoryCodes, setSelectedInventoryCodes] = useState<string[]>([]);
  const [selectedInboundKeys, setSelectedInboundKeys] = useState<string[]>([]);
  const [selectedOutboundKeys, setSelectedOutboundKeys] = useState<string[]>([]);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(20);
  const [batchDetails, setBatchDetails] = useState<Pick<Submission, 'batch' | 'codes'>>();
  const [batchFilterDraft, setBatchFilterDraft] = useState<BatchFilterValues>({ keyword: '' });
  const [batchFilters, setBatchFilters] = useState<BatchFilterValues>({ keyword: '' });
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(20);
  const batchTableAreaRef = useRef<HTMLDivElement>(null);
  const [batchTableScrollY, setBatchTableScrollY] = useState<number>();
  const [scannedPage, setScannedPage] = useState(1);
  const [scannedPageSize, setScannedPageSize] = useState(20);
  const [details, setDetails] = useState<Basket>();
  const [inboundDetails, setInboundDetails] = useState<IntakeRecord>();
  const [outboundDetails, setOutboundDetails] = useState<OutboundRecord>();
  const [intakeBatch, setIntakeBatch] = useState<PendingSubmission[]>();
  const [intakeWarehouse, setIntakeWarehouse] = useState('1号冷库');
  const [outboundModalOpen, setOutboundModalOpen] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scannedBasketCodes, setScannedBasketCodes] = useState<string[]>([]);
  const scanInputRef = useRef<import('antd').InputRef>(null);

  const pendingSubmissions = useMemo<PendingSubmission[]>(() => submissions.map(item => ({ ...item, pending: item.codes.filter(code => baskets.some(b => b.code === code && b.state === 'pending')) })).filter(item => item.pending.length), [submissions, baskets]);
  const filteredPendingSubmissions = pendingSubmissions.filter(row => (!appliedFilters.batch || row.batch.includes(appliedFilters.batch)) && (!appliedFilters.dateFrom || row.submittedAt.slice(0, 10) >= appliedFilters.dateFrom) && (!appliedFilters.dateTo || row.submittedAt.slice(0, 10) <= appliedFilters.dateTo));
  const allShownBaskets = tab === 'pending' ? baskets.filter(b => b.state === 'pending') : tab === 'inventory' ? baskets.filter(b => b.state === 'stock') : tab === 'outbound' ? baskets.filter(b => b.state === 'out') : baskets;
  const visibleBaskets = allShownBaskets.filter(row => (!appliedFilters.warehouse || row.warehouse === appliedFilters.warehouse) && (!appliedFilters.variety || row.variety === appliedFilters.variety) && (!appliedFilters.batch || row.batch.includes(appliedFilters.batch)) && (!appliedFilters.greenhouse || row.greenhouse === appliedFilters.greenhouse) && (!appliedFilters.size || row.size === appliedFilters.size) && (!appliedFilters.grade || row.grade === appliedFilters.grade) && (!appliedFilters.dateFrom || row.pickedAt >= appliedFilters.dateFrom) && (!appliedFilters.dateTo || row.pickedAt <= appliedFilters.dateTo));
  const shownIntakes = inbound.filter(row => (!appliedFilters.warehouse || row.warehouse === appliedFilters.warehouse) && (!appliedFilters.batch || row.batch.includes(appliedFilters.batch)));
  const shownOutbounds = outbound.filter(row => (!appliedFilters.warehouse || row.warehouse === appliedFilters.warehouse) && (!appliedFilters.batch || row.batch.includes(appliedFilters.batch)));
  const inboundDetailBaskets = inboundDetails
    ? inboundDetails.codes.map(code => baskets.find(row => row.code === code)).filter((row): row is Basket => Boolean(row))
    : [];
  const outboundDetailBaskets = outboundDetails
    ? outboundDetails.codes.map(code => baskets.find(row => row.code === code)).filter((row): row is Basket => Boolean(row))
    : [];
  const tally = (rows: Basket[]) => ({ count: rows.length, weight: rows.reduce((sum, row) => sum + row.weight, 0) });
  const batchWeight = (codes: string[]) => baskets.filter(basket => codes.includes(basket.code)).reduce((sum, basket) => sum + basket.weight, 0);
  const setActiveTab = (key: string) => { setTab(key as TabKey); setFilters({}); setAppliedFilters({}); setPendingPage(1); setRecordPage(1); setSelectedPendingBatches([]); setSelectedInventoryCodes([]); setSelectedInboundKeys([]); setSelectedOutboundKeys([]); };
  const openIntake = (batch: PendingSubmission | PendingSubmission[]) => { setIntakeBatch(Array.isArray(batch) ? batch : [batch]); setIntakeWarehouse('1号冷库'); };
  const openBatchDetails = (batch: Pick<Submission, 'batch' | 'codes'>) => { setBatchDetails({ batch: batch.batch, codes: batch.codes }); setBatchTableScrollY(undefined); setBatchFilterDraft({ keyword: '' }); setBatchFilters({ keyword: '' }); setBatchPage(1); setBatchPageSize(20); };
  const updateBatchFilter = <K extends keyof BatchFilterValues>(key: K, value: BatchFilterValues[K]) => setBatchFilterDraft(current => ({ ...current, [key]: value }));
  const confirmIntake = () => {
    if (!intakeBatch?.length) return;
    const now = '2026-10-20 09:30';
    const selected = baskets.filter(row => intakeBatch.some(batch => batch.pending.includes(row.code)) && row.state === 'pending');
    if (!selected.length) { message.warning('所选批次已没有待入库筐'); setIntakeBatch(undefined); setSelectedPendingBatches([]); return; }
    setBaskets(current => current.map(row => selected.some(item => item.code === row.code) ? { ...row, state: 'stock', warehouse: intakeWarehouse, inboundAt: now } : row));
    setInbound(current => [...intakeBatch.map((batch, index) => {
      const batchRows = selected.filter(row => batch.pending.includes(row.code));
      return { key: `IN${Date.now()}${index}`, batch: batch.batch, warehouse: intakeWarehouse, count: batchRows.length, weight: batchRows.reduce((sum, row) => sum + row.weight, 0), operator: '管理员', time: now, codes: batchRows.map(row => row.code) };
    }).filter(record => record.count > 0), ...current]);
    setIntakeBatch(undefined); setSelectedPendingBatches([]); message.success(`已确认 ${intakeBatch.length} 个批次、${selected.length} 筐入库，库存已更新`);
  };
  const openOutbound = () => {
    const sampleCode = baskets.find(basket => basket.state === 'stock')?.code;
    setScannedBasketCodes(sampleCode ? [sampleCode] : []);
    setScannedPage(1);
    setScanValue('');
    setScanActive(false);
    setOutboundModalOpen(true);
  };
  const startScanning = () => { setScanActive(true); window.setTimeout(() => scanInputRef.current?.focus(), 0); };
  const receiveScan = (value: string) => {
    const code = value.trim();
    setScanValue('');
    if (!code) return;
    const basket = baskets.find(row => row.code === code);
    if (!basket) { message.warning(`未找到筐码 ${code}`); return; }
    if (basket.state !== 'stock') { message.warning(basket.state === 'out' ? '该筐已出库，不能重复扫码' : '该筐尚未入库，不能出库'); return; }
    if (scannedBasketCodes.includes(code)) { message.info('该筐已在本次扫码清单中'); return; }
    const firstScannedBasket = baskets.find(row => scannedBasketCodes.includes(row.code));
    if (firstScannedBasket && (firstScannedBasket.warehouse ?? '未指定仓库') !== (basket.warehouse ?? '未指定仓库')) {
      message.warning(`本次出库已选择${firstScannedBasket.warehouse ?? '未指定仓库'}，不能混入${basket.warehouse ?? '未指定仓库'}的筐`);
      return;
    }
    setScannedBasketCodes(current => [...current, code]); setScannedPage(1);
  };
  const confirmOutbound = () => {
    const selected = baskets.filter(row => scannedBasketCodes.includes(row.code) && row.state === 'stock');
    if (!selected.length) { message.warning('请先扫描在库筐码'); return; }
    if (selected.length !== scannedBasketCodes.length) { message.warning('部分筐已不在库存中，请重新核对扫码清单'); return; }
    const warehouse = selected[0].warehouse ?? '未指定仓库';
    if (selected.some(row => (row.warehouse ?? '未指定仓库') !== warehouse)) { message.warning('同一张出库单只能包含一个仓库的筐，请重新核对扫码清单'); return; }
    const now = '2026-10-20 09:30';
    const batch = `RO20261020${String(outbound.length + 1).padStart(4, '0')}`;
    setBaskets(current => current.map(row => scannedBasketCodes.includes(row.code) ? { ...row, state: 'out', outboundBatch: batch } : row));
    setOutbound(current => [{ key: batch, batch, warehouse, count: selected.length, weight: selected.reduce((sum, row) => sum + row.weight, 0), operator: '管理员', time: now, codes: selected.map(row => row.code) }, ...current]);
    setOutboundModalOpen(false); setScanActive(false); setScannedBasketCodes([]); setScanValue('');
    message.success(`已确认 ${selected.length} 筐出库，出库记录和库存已同步更新`);
    setTab('outbound'); setFilters({}); setAppliedFilters({}); setRecordPage(1); setSelectedInventoryCodes([]); setSelectedInboundKeys([]); setSelectedOutboundKeys([]);
  };
  const detailAction = (code: string) => { const row = baskets.find(item => item.code === code); if (row) setDetails(row); else message.info('未找到已同步记录'); };
  const openInboundDetails = (record: IntakeRecord) => setInboundDetails(record);
  const openOutboundDetails = (record: OutboundRecord) => setOutboundDetails(record);
  const link = (text: string, action: () => void) => <Button type="link" className="raw-link" onClick={action}>{text}</Button>;
  const pendingColumns: ColumnsType<Submission & { pending: string[] }> = [
    { title: '入库批次号', dataIndex: 'batch', width: 190, render: (_, row) => link(row.batch, () => openBatchDetails(row)) },
    { title: '称重员', dataIndex: 'submittedBy', width: 96 },
    { title: '总筐数', key: 'basketCount', render: (_, row) => row.codes.length, width: 96, align: 'right' },
    { title: '总重量', key: 'batchWeight', render: (_, row) => `${number(batchWeight(row.codes))} kg`, width: 128, align: 'right' },
    { title: '称重日期', dataIndex: 'pickedAt', width: 116 }, { title: '提交时间', dataIndex: 'submittedAt', width: 160 },
    { title: '操作', key: 'action', fixed: 'right', width: 96, align: 'center', render: (_, row) => link('批次入库', () => openIntake(row)) },
  ];
  const pendingColumnKey = (column: ColumnsType<PendingSubmission>[number]) => String(column.key ?? ('dataIndex' in column ? column.dataIndex : undefined));
  const columnKey = <T,>(column: ColumnsType<T>[number]) => String(column.key ?? ('dataIndex' in column ? column.dataIndex : undefined));
  const hiddenFor = (id: string) => id === 'pending' ? hiddenPendingColumns : id === 'inventory' ? hiddenInventoryColumns : hiddenTableColumns[id] ?? [];
  const updateHiddenFor = (id: string, keys: string[]) => {
    if (id === 'pending') setHiddenPendingColumns(keys);
    else if (id === 'inventory') setHiddenInventoryColumns(keys);
    else setHiddenTableColumns(current => ({ ...current, [id]: keys }));
  };
  const optionsFor = <T,>(columns: ColumnsType<T>, keyOf: (column: ColumnsType<T>[number]) => string): ColumnOption[] => columns
    .filter(column => keyOf(column) !== 'action')
    .map(column => ({ key: keyOf(column), label: String(column.title ?? keyOf(column)) }));
  const arrangedColumns = <T,>(id: string, columns: ColumnsType<T>, keyOf: (column: ColumnsType<T>[number]) => string) => {
    const hidden = hiddenFor(id);
    const order = tableColumnOrders[id] ?? [];
    return columns.filter(column => keyOf(column) === 'action' || !hidden.includes(keyOf(column))).slice().sort((left, right) => {
      if (keyOf(left) === 'action') return 1;
      if (keyOf(right) === 'action') return -1;
      const leftDefault = columns.findIndex(column => keyOf(column) === keyOf(left));
      const rightDefault = columns.findIndex(column => keyOf(column) === keyOf(right));
      return (order.indexOf(keyOf(left)) < 0 ? leftDefault : order.indexOf(keyOf(left))) - (order.indexOf(keyOf(right)) < 0 ? rightDefault : order.indexOf(keyOf(right)));
    });
  };
  const settingsPopover = <T,>(id: string, columns: ColumnsType<T>, keyOf: (column: ColumnsType<T>[number]) => string) => <ColumnSettingsPopover
    columns={optionsFor(columns, keyOf)}
    hiddenKeys={hiddenFor(id)}
    onHiddenKeysChange={keys => updateHiddenFor(id, keys)}
    order={tableColumnOrders[id] ?? optionsFor(columns, keyOf).map(column => column.key)}
    onOrderChange={keys => setTableColumnOrders(current => ({ ...current, [id]: keys }))}
  />;
  const pendingTableScrollWidth = 48 + arrangedColumns('pending', pendingColumns, pendingColumnKey).reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const basketColumns: ColumnsType<Basket> = [
    { title: '称重码', dataIndex: 'code', width: 160, render: value => link(value, () => detailAction(value)) },
    ...(tab === 'inventory' ? [{ title: '仓库', dataIndex: 'warehouse', width: 96 } as const] : []),
    { title: tab === 'inventory' ? '入库批次' : '原果入库批次号', dataIndex: 'batch', width: 170 },
    { title: '称重日期', dataIndex: 'pickedAt', width: 108 },
    ...(tab === 'inventory' ? [{ title: '入库日期', dataIndex: 'inboundAt', width: 108, render: (value: string | undefined) => value?.slice(0, 10) ?? '—' } as const] : []),
    { title: '大棚', dataIndex: 'greenhouse', width: 90 }, { title: '班组', dataIndex: 'team', width: 80 }, { title: '品种', dataIndex: 'variety', width: 92 }, { title: '果径', dataIndex: 'size', width: 64 }, { title: '等级', dataIndex: 'grade', width: 76 },
    { title: '桶数', dataIndex: 'buckets', width: 72, align: 'right' }, { title: tab === 'inventory' ? '净重（筐/kg）' : '净重', dataIndex: 'weight', width: tab === 'inventory' ? 144 : 110, align: 'right', className: tab === 'inventory' ? 'raw-inventory-weight-column' : undefined, render: value => `${number(value)} kg` },
    ...(tab === 'outbound' ? [{ title: '出库批次号', dataIndex: 'outboundBatch', width: 170 } as const] : []),
  ];
  const basketColumnKey = (column: ColumnsType<Basket>[number]) => String(column.key ?? ('dataIndex' in column ? column.dataIndex : undefined));
  const visibleBasketColumns = arrangedColumns('inventory', basketColumns, basketColumnKey);
  const basketTableScrollWidth = visibleBasketColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 56);
  const intakeColumns: ColumnsType<IntakeRecord> = [
    { title: '入库批次号', dataIndex: 'batch', width: 180, render: (_, row) => link(row.batch, () => openBatchDetails(row)) }, { title: '仓库', dataIndex: 'warehouse', width: 120 }, { title: '入库筐数', dataIndex: 'count', width: 90, align: 'right' }, { title: '入库净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` }, { title: '确认人', dataIndex: 'operator', width: 90 }, { title: '确认时间', dataIndex: 'time', width: 160 },
  ];
  const outboundColumns: ColumnsType<OutboundRecord> = [
    { title: '出库批次号', dataIndex: 'batch', width: 180, render: (_, row) => link(row.batch, () => openBatchDetails(row)) }, { title: '仓库', dataIndex: 'warehouse', width: 130 }, { title: '出库筐数', dataIndex: 'count', width: 90, align: 'right' }, { title: '出库净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` }, { title: '操作人', dataIndex: 'operator', width: 90 }, { title: '出库时间', dataIndex: 'time', width: 160 },
  ];
  const tabLabels: { key: TabKey; label: string }[] = [{ key: 'inventory', label: '原果库存' }, { key: 'pending', label: '待入库' }, { key: 'inbound', label: '入库记录' }, { key: 'outbound', label: '出库记录' }];
  const tableCount = tab === 'pending' ? filteredPendingSubmissions.length : tab === 'inventory' ? visibleBaskets.length : tab === 'inbound' ? shownIntakes.length : shownOutbounds.length;
  const activePageSize = tab === 'pending' ? pendingPageSize : recordPageSize;
  const compactTable = tableCount < activePageSize;
  const recordPageCount = Math.max(1, Math.ceil(tableCount / recordPageSize));
  const currentRecordPage = Math.min(recordPage, recordPageCount);
  const recordPageStart = (currentRecordPage - 1) * recordPageSize;
  const pendingPageCount = Math.max(1, Math.ceil(filteredPendingSubmissions.length / pendingPageSize));
  const currentPendingPage = Math.min(pendingPage, pendingPageCount);
  const visiblePendingSubmissions = filteredPendingSubmissions.slice((currentPendingPage - 1) * pendingPageSize, currentPendingPage * pendingPageSize);
  const batchBasketRows = batchDetails?.codes.map(code => baskets.find(basket => basket.code === code)).filter((basket): basket is Basket => Boolean(basket)) ?? [];
  const filteredBatchBasketRows = batchBasketRows.filter(basket => (!batchFilters.keyword || basket.code.toLowerCase().includes(batchFilters.keyword.trim().toLowerCase()))
    && (!batchFilters.variety || basket.variety === batchFilters.variety)
    && (!batchFilters.size || basket.size === batchFilters.size)
    && (!batchFilters.grade || basket.grade === batchFilters.grade)
    && (!batchFilters.greenhouse || basket.greenhouse === batchFilters.greenhouse)
    && (!batchFilters.team || basket.team === batchFilters.team)
    && (!batchFilters.pickedRange || (basket.pickedAt >= batchFilters.pickedRange[0] && basket.pickedAt <= batchFilters.pickedRange[1])));
  const batchPageCount = Math.max(1, Math.ceil(filteredBatchBasketRows.length / batchPageSize));
  const currentBatchPage = Math.min(batchPage, batchPageCount);
  const visibleBatchBasketRows = filteredBatchBasketRows.slice((currentBatchPage - 1) * batchPageSize, currentBatchPage * batchPageSize);
  const scannedBaskets = scannedBasketCodes.map(code => baskets.find(row => row.code === code)).filter((basket): basket is Basket => Boolean(basket));
  const selectedRecordCount = tab === 'pending' ? selectedPendingBatches.length : tab === 'inventory' ? selectedInventoryCodes.length : tab === 'inbound' ? selectedInboundKeys.length : selectedOutboundKeys.length;
  const selectedRecordLabel = tab === 'pending' ? '个批次' : tab === 'inventory' ? '个筐' : '条记录';
  const clearActiveSelection = () => {
    if (tab === 'pending') setSelectedPendingBatches([]);
    else if (tab === 'inventory') setSelectedInventoryCodes([]);
    else if (tab === 'inbound') setSelectedInboundKeys([]);
    else setSelectedOutboundKeys([]);
  };
  const exportCurrentTable = () => {
    if (tab === 'pending') {
      const rows = selectedPendingBatches.length ? filteredPendingSubmissions.filter(row => selectedPendingBatches.includes(row.batch)) : filteredPendingSubmissions;
      exportCsv(['入库批次号', '提交人', '提交时间', '称重日期', '待入库筐数', '筐码'], rows.map(row => [row.batch, row.submittedBy, row.submittedAt, row.pickedAt, row.pending.length, row.pending.join('、')]), '原果待入库批次.csv');
      return;
    }
    if (tab === 'inventory') {
      const rows = selectedInventoryCodes.length ? visibleBaskets.filter(row => selectedInventoryCodes.includes(row.code)) : visibleBaskets;
      exportCsv(['筐码', '仓库', '原果入库批次号', '称重日期', '入库日期', '大棚', '班组', '品种', '果径', '等级', '桶数', '净重（筐/kg）'], rows.map(row => [row.code, row.warehouse ?? '', row.batch, row.pickedAt, row.inboundAt?.slice(0, 10) ?? '', row.greenhouse, row.team, row.variety, row.size, row.grade, row.buckets, row.weight]), '原果库存.csv');
      return;
    }
    if (tab === 'inbound') {
      const rows = selectedInboundKeys.length ? shownIntakes.filter(row => selectedInboundKeys.includes(row.key)) : shownIntakes;
      exportCsv(['原果入库批次号', '本次入库仓库', '入库筐数', '入库净重(kg)', '确认人', '确认时间'], rows.map(row => [row.batch, row.warehouse, row.count, row.weight, row.operator, row.time]), '原果入库记录.csv');
      return;
    }
    const rows = selectedOutboundKeys.length ? shownOutbounds.filter(row => selectedOutboundKeys.includes(row.key)) : shownOutbounds;
    exportCsv(['出库批次号', '仓库', '出库筐数', '出库净重(kg)', '操作人', '出库时间'], rows.map(row => [row.batch, row.warehouse, row.count, row.weight, row.operator, row.time]), '原果出库记录.csv');
  };
  const exportBatchBaskets = () => exportCsv(
    ['称重码', '品种', '果径', '等级', '大棚', '班组', '称重日期', '桶数', '净重（筐/kg）'],
    filteredBatchBasketRows.map(row => [row.code, row.variety, row.size, row.grade, row.greenhouse, row.team, row.pickedAt, row.buckets, row.weight]),
    '原果批次筐明细.csv',
  );
  const exportBasketRows = (rows: Basket[], filename: string) => exportCsv(
    ['筐码', '仓库', '品种', '果径', '等级', '大棚', '班组', '称重日期', '桶数', '净重(kg)'],
    rows.map(row => [row.code, row.warehouse ?? '', row.variety, row.size, row.grade, row.greenhouse, row.team, row.pickedAt, row.buckets, row.weight]),
    filename,
  );
  const scannedColumns: ColumnsType<Basket> = [
    { title: '筐码', dataIndex: 'code', width: 160 }, { title: '仓库', dataIndex: 'warehouse', width: 96 }, { title: '品种', dataIndex: 'variety', width: 96 },
    { title: '果径', dataIndex: 'size', width: 64 }, { title: '等级', dataIndex: 'grade', width: 76 }, { title: '桶数', dataIndex: 'buckets', width: 72, align: 'right' },
    { title: '净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` },
  ];
  const batchBasketColumns: ColumnsType<Basket> = [
    { title: '称重码', dataIndex: 'code', fixed: 'left', width: 170, render: value => link(value, () => detailAction(value)) },
    { title: '品种', dataIndex: 'variety', width: 92 }, { title: '果径', dataIndex: 'size', width: 64 }, { title: '等级', dataIndex: 'grade', width: 76 },
    { title: '大棚', dataIndex: 'greenhouse', width: 88 }, { title: '班组', dataIndex: 'team', width: 80 },
    { title: '桶数', dataIndex: 'buckets', width: 72, align: 'right' }, { title: '净重（筐/kg）', dataIndex: 'weight', width: 144, align: 'right', render: value => `${number(value)} kg` },
    { title: '称重日期', dataIndex: 'pickedAt', width: 108 },
  ];
  const arrangedBatchBasketColumns = arrangedColumns('batch-details', batchBasketColumns, columnKey<Basket>);
  const batchBasketTableScrollWidth = arrangedBatchBasketColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  useLayoutEffect(() => {
    const area = batchTableAreaRef.current;
    if (!batchDetails || !area) return;
    let frame = 0;
    // 按实际内容判断溢出，短表不启用固定表头结构，避免预留滚动条空槽。
    const measure = () => {
      const header = area.querySelector('thead');
      const rows = area.querySelector('tbody');
      const scroller = area.querySelector<HTMLElement>('.ant-table-body, .ant-table-content');
      if (!header || !rows || !scroller || area.clientHeight === 0) {
        setBatchTableScrollY(undefined);
        return;
      }
      const style = window.getComputedStyle(scroller);
      const borderHeight = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      const horizontalScrollbarHeight = scroller.scrollWidth > scroller.clientWidth
        ? Math.max(0, scroller.offsetHeight - scroller.clientHeight - borderHeight) : 0;
      const availableHeight = Math.max(1, Math.floor(area.clientHeight - header.getBoundingClientRect().height));
      const needsScroll = rows.getBoundingClientRect().height + horizontalScrollbarHeight > availableHeight + 1;
      const nextHeight = needsScroll ? availableHeight : undefined;
      setBatchTableScrollY(current => current === nextHeight ? current : nextHeight);
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    const observeTable = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(area);
      area.querySelectorAll('thead, tbody').forEach(element => resizeObserver.observe(element));
      scheduleMeasure();
    };
    // 切换滚动模式会更换表格结构，重新绑定内容尺寸观察。
    const mutationObserver = new MutationObserver(observeTable);
    mutationObserver.observe(area, { childList: true, subtree: true });
    observeTable();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [batchDetails, currentBatchPage, batchPageSize, filteredBatchBasketRows.length, batchBasketTableScrollWidth, hiddenTableColumns, tableColumnOrders]);
  const arrangedScannedColumns = arrangedColumns('outbound-scan', scannedColumns, columnKey<Basket>);
  const scannedTableWidth = arrangedScannedColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const bucketRecordsFor = (basket?: Basket) => basket ? Array.from({ length: basket.buckets }, (_, i) => ({ id: i + 1, worker: ['张三', '李四', '王五'][i % 3], weight: Number((basket.weight / basket.buckets + ((i % 2) ? 0.12 : -0.12)).toFixed(2)), time: `${basket.pickedAt} ${String(8 + i).padStart(2, '0')}:${String(18 + i * 4).padStart(2, '0')}` })) : [];
  const bucketRecords = bucketRecordsFor(details);
  const bucketColumns: ColumnsType<(typeof bucketRecords)[number]> = [{ title: '工人', dataIndex: 'worker', width: 90 }, { title: '称重时间', dataIndex: 'time', width: 160 }, { title: '净重', dataIndex: 'weight', width: 100, render: value => `${number(value)} kg` }];
  const arrangedBucketColumns = arrangedColumns('bucket-detail', bucketColumns, columnKey<(typeof bucketRecords)[number]>);
  const bucketTableWidth = arrangedBucketColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const currentScannedPage = Math.min(scannedPage, Math.max(1, Math.ceil(scannedBaskets.length / scannedPageSize)));
  const scannedTableRows = scannedBaskets.slice((currentScannedPage - 1) * scannedPageSize, currentScannedPage * scannedPageSize);
  const arrangedIntakeColumns = arrangedColumns('inbound', intakeColumns, columnKey<IntakeRecord>);
  const arrangedOutboundColumns = arrangedColumns('outbound', outboundColumns, columnKey<OutboundRecord>);
  const intakeScrollWidth = arrangedIntakeColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 40);
  const outboundScrollWidth = arrangedOutboundColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 40);
  const tableContent = tab === 'pending' ? <Table<PendingSubmission> rowKey="batch" size="small" columns={arrangedColumns('pending', pendingColumns, pendingColumnKey)} dataSource={visiblePendingSubmissions} pagination={false} rowSelection={{ columnWidth: 48, selectedRowKeys: selectedPendingBatches, preserveSelectedRowKeys: true, onChange: keys => setSelectedPendingBatches(keys.map(String)) }} scroll={{ x: pendingTableScrollWidth, y: '100%' }} />
    : tab === 'inventory' ? <Table<Basket> rowKey="code" size="small" columns={visibleBasketColumns} dataSource={visibleBaskets.slice(recordPageStart, recordPageStart + recordPageSize)} pagination={false} rowSelection={{ columnWidth: 56, selectedRowKeys: selectedInventoryCodes, preserveSelectedRowKeys: true, onChange: keys => setSelectedInventoryCodes(keys.map(String)) }} scroll={{ x: basketTableScrollWidth, y: '100%' }} />
    : tab === 'inbound' ? <Table<IntakeRecord> rowKey="key" size="small" columns={arrangedIntakeColumns} dataSource={shownIntakes.slice(recordPageStart, recordPageStart + recordPageSize)} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedInboundKeys, preserveSelectedRowKeys: true, onChange: keys => setSelectedInboundKeys(keys.map(String)) }} scroll={{ x: intakeScrollWidth, y: '100%' }} />
    : <Table<OutboundRecord> rowKey="key" size="small" columns={arrangedOutboundColumns} dataSource={shownOutbounds.slice(recordPageStart, recordPageStart + recordPageSize)} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedOutboundKeys, preserveSelectedRowKeys: true, onChange: keys => setSelectedOutboundKeys(keys.map(String)) }} scroll={{ x: outboundScrollWidth, y: '100%' }} />;
  const filterActions = <div className="raw-filter-actions"><Button onClick={() => { setFilters({}); setAppliedFilters({}); clearActiveSelection(); setPendingPage(1); setRecordPage(1); }}>重置</Button><Button type="primary" onClick={() => { setAppliedFilters(filters); setPendingPage(1); setRecordPage(1); clearActiveSelection(); }}>查询</Button></div>;

  return <div className="raw-page">
    <Tabs className="raw-tabs" activeKey={tab} onChange={setActiveTab} items={tabLabels.map(({ key, label }) => ({ key, label }))} />
    <Card className="raw-filter-card" bordered={false}>
      <div className={`raw-filter-grid raw-filter-grid-${tab}`}>
        {tab === 'inventory' ? <>
          <div className="raw-filter-row raw-filter-row-inventory-primary">
            <label className="raw-filter-field raw-filter-field-date"><span className="raw-filter-label">称重日期</span><DatePicker.RangePicker allowClear value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null} placeholder={['开始日期', '结束日期']} onChange={dates => setFilters(v => { const next = { ...v }; if (dates?.[0] && dates[1]) { next.dateFrom = dates[0].format('YYYY-MM-DD'); next.dateTo = dates[1].format('YYYY-MM-DD'); } else { delete next.dateFrom; delete next.dateTo; } return next; })} /></label>
            <label className="raw-filter-field raw-filter-field-batch"><span className="raw-filter-label">入库批次</span><Input allowClear value={filters.batch ?? ''} placeholder="请输入批次号" onChange={e => setFilters(v => ({ ...v, batch: e.target.value }))} /></label>
            <label className="raw-filter-field raw-filter-field-warehouse"><span className="raw-filter-label">仓库</span><Select allowClear value={filters.warehouse} placeholder="全部仓库" options={warehouses.map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, warehouse: value ?? '' }))} /></label>
          </div>
          <div className="raw-filter-row raw-filter-row-inventory-secondary">
            <label className="raw-filter-field raw-filter-field-greenhouse"><span className="raw-filter-label">大棚</span><Select {...greenhouseSelectSearchProps} allowClear value={filters.greenhouse} placeholder="搜索或选择大棚" options={['1号棚', '2号棚', '3号棚'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, greenhouse: value ?? '' }))} /></label>
            <label className="raw-filter-field raw-filter-field-team"><span className="raw-filter-label">班组</span><Select allowClear value={filters.team} placeholder="请选择班组" options={['A班', 'B班'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, team: value ?? '' }))} /></label>
            <label className="raw-filter-field raw-filter-field-variety"><span className="raw-filter-label">品种</span><Select allowClear value={filters.variety} placeholder="全部品种" options={['蓝莓1号', '蓝莓2号', '废果'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, variety: value ?? '' }))} /></label>
            <label className="raw-filter-field raw-filter-field-size"><span className="raw-filter-label">果径</span><Select allowClear value={filters.size} placeholder="全部果径" options={['XL', 'L', 'M', 'S', '/'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, size: value ?? '' }))} /></label>
            <label className="raw-filter-field raw-filter-field-grade"><span className="raw-filter-label">等级</span><Select allowClear value={filters.grade} placeholder="全部等级" options={['特级', '一级', '二级', '/'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, grade: value ?? '' }))} /></label>
            {filterActions}
          </div>
        </> : <>
          {tab === 'pending' && <>
            <label className="raw-filter-field raw-filter-field-date"><span className="raw-filter-label">提交时间</span><DatePicker.RangePicker allowClear format="YYYY-MM-DD" value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null} placeholder={['开始日期', '结束日期']} onChange={dates => setFilters(v => { const next = { ...v }; if (dates?.[0] && dates[1]) { next.dateFrom = dates[0].format('YYYY-MM-DD'); next.dateTo = dates[1].format('YYYY-MM-DD'); } else { delete next.dateFrom; delete next.dateTo; } return next; })} /></label>
            <label className="raw-filter-field raw-filter-field-batch"><span className="raw-filter-label">原果入库批次号</span><Input prefix={<SearchOutlined />} allowClear value={filters.batch ?? ''} placeholder="请输入批次号" onChange={e => setFilters(v => ({ ...v, batch: e.target.value }))} /></label>
          </>}
          {(tab === 'inbound' || tab === 'outbound') && <><label className="raw-filter-field raw-filter-field-batch"><span className="raw-filter-label">{tab === 'inbound' ? '入库批次号' : '出库批次号'}</span><Input allowClear value={filters.batch ?? ''} placeholder="请输入批次号" onChange={e => setFilters(v => ({ ...v, batch: e.target.value }))} /></label><label className="raw-filter-field raw-filter-field-warehouse"><span className="raw-filter-label">仓库</span><Select allowClear value={filters.warehouse} placeholder="全部仓库" options={warehouses.map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, warehouse: value ?? '' }))} /></label></>}
          {filterActions}
        </>}
      </div>
    </Card>
    <Card className={`raw-table-card${compactTable ? ' raw-table-card-compact' : ''}`} bordered={false}>
      <TableSelectionToolbar title={tabLabels.find(item => item.key === tab)?.label ?? '原果数据'} selectedCount={selectedRecordCount} selectedLabel={selectedRecordLabel} onClear={clearActiveSelection} className="raw-table-toolbar"
        batchActions={<Space size={8}>
          {tab === 'pending' && selectedPendingBatches.length > 0 && <Button type="primary" onClick={() => openIntake(pendingSubmissions.filter(row => selectedPendingBatches.includes(row.batch)))}>批量入库</Button>}
          {selectedRecordCount > 0 && <Button onClick={exportCurrentTable}>批量导出</Button>}
        </Space>}
        fixedActions={<Space size={16}>
          {tab === 'inventory' && <Button type="primary" onClick={openOutbound}>扫码出库</Button>}
          <Button onClick={exportCurrentTable} disabled={!tableCount}>导出</Button>
          {tab === 'pending' && settingsPopover('pending', pendingColumns, pendingColumnKey)}
          {tab === 'inventory' && settingsPopover('inventory', basketColumns, basketColumnKey)}
          {tab === 'inbound' && settingsPopover('inbound', intakeColumns, columnKey<IntakeRecord>)}
          {tab === 'outbound' && settingsPopover('outbound', outboundColumns, columnKey<OutboundRecord>)}
        </Space>} />
      {tab === 'pending' ? <div className="raw-pending-list">{tableCount === 0 ? <div className="raw-table-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的数据" /></div> : tableContent}<div className="raw-pending-pagination"><Pagination current={currentPendingPage} pageSize={pendingPageSize} total={filteredPendingSubmissions.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setPendingPage(pageSize !== pendingPageSize ? 1 : page); setPendingPageSize(pageSize); }} /></div></div> : <><div className="raw-table-content">{tableCount === 0 ? <div className="raw-table-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的数据" /></div> : tableContent}</div><div className="raw-pagination"><Pagination current={currentRecordPage} pageSize={recordPageSize} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} total={tableCount} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setRecordPage(pageSize !== recordPageSize ? 1 : page); setRecordPageSize(pageSize); }} /></div></>}
    </Card>
    <Modal className="business-modal raw-batch-modal" centered width={1440} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles({ container: { height: 'calc(100dvh - var(--floating-layer-viewport-gap, 48px))' }, body: { display: 'flex', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'hidden' } })} open={!!batchDetails} title={batchDetails ? <span>批次详情 · <Typography.Text copyable={{ text: batchDetails.batch, onCopy: () => message.success('批次号已复制') }}>{batchDetails.batch}</Typography.Text></span> : '批次详情'} footer={null} onCancel={() => setBatchDetails(undefined)}>
      {batchDetails && <div className="raw-batch-modal-content">
        <div className="raw-batch-modal-toolbar"><div className="raw-batch-modal-filters">
          <label className="filter-keyword raw-filter-field raw-filter-field-code"><span className="raw-filter-label">称重码</span><Input allowClear value={batchFilterDraft.keyword} onChange={event => updateBatchFilter('keyword', event.target.value)} placeholder="请输入称重码" /></label>
          <label className="filter-date raw-filter-field raw-filter-field-date"><span className="raw-filter-label">称重日期</span><DatePicker.RangePicker allowClear format="YYYY-MM-DD" placeholder={['开始日期', '结束日期']} value={batchFilterDraft.pickedRange ? [dayjs(batchFilterDraft.pickedRange[0]), dayjs(batchFilterDraft.pickedRange[1])] as [dayjs.Dayjs, dayjs.Dayjs] : null} onChange={dates => updateBatchFilter('pickedRange', dates?.[0] && dates?.[1] ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] : undefined)} /></label>
          <label className="filter-greenhouse raw-filter-field raw-filter-field-greenhouse"><span className="raw-filter-label">大棚</span><Select {...greenhouseSelectSearchProps} allowClear value={batchFilterDraft.greenhouse} onChange={value => updateBatchFilter('greenhouse', value)} placeholder="搜索或选择大棚" options={[...new Set(batchBasketRows.map(basket => basket.greenhouse))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-team raw-filter-field raw-filter-field-team"><span className="raw-filter-label">班组</span><Select allowClear value={batchFilterDraft.team} onChange={value => updateBatchFilter('team', value)} placeholder="全部班组" options={[...new Set(batchBasketRows.map(basket => basket.team))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-variety raw-filter-field raw-filter-field-variety"><span className="raw-filter-label">品种</span><Select allowClear value={batchFilterDraft.variety} onChange={value => updateBatchFilter('variety', value)} placeholder="全部品种" options={[...new Set(batchBasketRows.map(basket => basket.variety))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-size raw-filter-field raw-filter-field-size"><span className="raw-filter-label">果径</span><Select allowClear value={batchFilterDraft.size} onChange={value => updateBatchFilter('size', value)} placeholder="全部果径" options={[...new Set(batchBasketRows.map(basket => basket.size))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-grade raw-filter-field raw-filter-field-grade"><span className="raw-filter-label">等级</span><Select allowClear value={batchFilterDraft.grade} onChange={value => updateBatchFilter('grade', value)} placeholder="全部等级" options={[...new Set(batchBasketRows.map(basket => basket.grade))].map(value => ({ value, label: value }))} /></label>
          <div className="raw-batch-filter-actions"><Button onClick={() => { setBatchFilterDraft({ keyword: '' }); setBatchFilters({ keyword: '' }); setBatchPage(1); }}>重置</Button><Button type="primary" onClick={() => { setBatchFilters(batchFilterDraft); setBatchPage(1); }}>查询</Button></div>
        </div></div>
        <TableSelectionToolbar title="批次筐明细" selectedCount={0} onClear={() => undefined} className="raw-batch-table-toolbar" fixedActions={<Space size={8}><Button onClick={exportBatchBaskets} disabled={!filteredBatchBasketRows.length}>导出</Button>{settingsPopover('batch-details', batchBasketColumns, columnKey<Basket>)}</Space>} />
        <div className="raw-batch-table-area" ref={batchTableAreaRef}>{filteredBatchBasketRows.length ? <Table<Basket> size="small" rowKey="code" columns={arrangedBatchBasketColumns} dataSource={visibleBatchBasketRows} pagination={false} scroll={{ x: batchBasketTableScrollWidth, ...(batchTableScrollY === undefined ? {} : { y: batchTableScrollY }) }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的筐信息" />}</div>
        <div className="raw-batch-pagination"><span className="record-total">共 {filteredBatchBasketRows.length.toLocaleString('zh-CN')} 项数据</span><Pagination current={currentBatchPage} pageSize={batchPageSize} total={filteredBatchBasketRows.length} pageSizeOptions={[10, 20, 50, 100]} showSizeChanger showQuickJumper onChange={(page, pageSize) => { setBatchPage(pageSize !== batchPageSize ? 1 : page); setBatchPageSize(pageSize); }} /></div>
      </div>}
    </Modal>
    <Drawer className="raw-drawer raw-inbound-detail-drawer" width={FLOATING_LAYER_WIDTHS.complexDrawer} open={!!inboundDetails} onClose={() => setInboundDetails(undefined)} closable={false} title={<Space><Button type="text" aria-label="关闭入库详情" icon={<ArrowLeftOutlined />} onClick={() => setInboundDetails(undefined)} />入库详情</Space>} styles={getDrawerStyles()}>
      {inboundDetails && <div className="raw-inbound-detail-content">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="原果入库批次号" span={2}>{inboundDetails.batch}</Descriptions.Item>
          <Descriptions.Item label="本次入库仓库">{inboundDetails.warehouse}</Descriptions.Item>
          <Descriptions.Item label="入库筐数">{inboundDetails.count} 筐</Descriptions.Item>
          <Descriptions.Item label="入库净重">{number(inboundDetails.weight)} kg</Descriptions.Item>
          <Descriptions.Item label="确认人">{inboundDetails.operator}</Descriptions.Item>
          <Descriptions.Item label="确认时间" span={2}>{inboundDetails.time}</Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5} className="raw-drawer-subtitle">本次入库筐明细</Typography.Title>
        {inboundDetailBaskets.length ? <div className="raw-inbound-detail-list">
          {inboundDetailBaskets.map(basket => <section className="raw-inbound-basket-card" key={basket.code}>
            <div className="raw-inbound-basket-title">{basket.code}</div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="品种">{basket.variety}</Descriptions.Item>
              <Descriptions.Item label="果径 / 等级">{basket.size} / {basket.grade}</Descriptions.Item>
              <Descriptions.Item label="称重日期">{basket.pickedAt}</Descriptions.Item>
              <Descriptions.Item label="大棚 / 班组">{basket.greenhouse} / {basket.team}</Descriptions.Item>
              <Descriptions.Item label="桶数">{basket.buckets} 桶</Descriptions.Item>
              <Descriptions.Item label="入库净重">{number(basket.weight)} kg</Descriptions.Item>
            </Descriptions>
          </section>)}
        </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联的入库筐信息" />}
      </div>}
    </Drawer>
    <Drawer className="raw-drawer raw-inbound-detail-drawer" width={FLOATING_LAYER_WIDTHS.complexDrawer} open={!!outboundDetails} onClose={() => setOutboundDetails(undefined)} closable={false} title={<Space><Button type="text" aria-label="关闭出库详情" icon={<ArrowLeftOutlined />} onClick={() => setOutboundDetails(undefined)} />出库详情</Space>} styles={getDrawerStyles()}>
      {outboundDetails && <div className="raw-inbound-detail-content">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="原果出库批次号" span={2}>{outboundDetails.batch}</Descriptions.Item>
          <Descriptions.Item label="出库仓库">{outboundDetails.warehouse}</Descriptions.Item>
          <Descriptions.Item label="出库筐数">{outboundDetails.count} 筐</Descriptions.Item>
          <Descriptions.Item label="出库净重">{number(outboundDetails.weight)} kg</Descriptions.Item>
          <Descriptions.Item label="操作人">{outboundDetails.operator}</Descriptions.Item>
          <Descriptions.Item label="出库时间" span={2}>{outboundDetails.time}</Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5} className="raw-drawer-subtitle">本次出库筐明细</Typography.Title>
        {outboundDetailBaskets.length ? <div className="raw-inbound-detail-list">
          {outboundDetailBaskets.map(basket => <section className="raw-inbound-basket-card" key={basket.code}>
            <div className="raw-inbound-basket-title">{basket.code}</div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="品种">{basket.variety}</Descriptions.Item>
              <Descriptions.Item label="果径 / 等级">{basket.size} / {basket.grade}</Descriptions.Item>
              <Descriptions.Item label="称重日期">{basket.pickedAt}</Descriptions.Item>
              <Descriptions.Item label="大棚 / 班组">{basket.greenhouse} / {basket.team}</Descriptions.Item>
              <Descriptions.Item label="桶数">{basket.buckets} 桶</Descriptions.Item>
              <Descriptions.Item label="出库净重">{number(basket.weight)} kg</Descriptions.Item>
            </Descriptions>
          </section>)}
        </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联的出库筐信息" />}
      </div>}
    </Drawer>
    <Drawer className="raw-drawer" width={FLOATING_LAYER_WIDTHS.detailDrawer} zIndex={1010} open={!!details} onClose={() => setDetails(undefined)} closable={false} title={<Space><Button type="text" aria-label="关闭筐详情" icon={<ArrowLeftOutlined />} onClick={() => setDetails(undefined)} />筐详情</Space>} styles={getDrawerStyles()}>
      {details && <>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="入库批次号" span={2}>
            <Typography.Text copyable={{ text: details.batch, tooltips: ['复制入库批次号', '已复制'], onCopy: () => message.success('入库批次号已复制') }}>{details.batch}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="称重码" span={2}>
            <Typography.Text copyable={{ text: details.code, tooltips: ['复制称重码', '已复制'], onCopy: () => message.success('称重码已复制') }}>{details.code}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="品种">{details.variety}</Descriptions.Item>
          <Descriptions.Item label="果径 / 等级">{details.size} / {details.grade}</Descriptions.Item>
          <Descriptions.Item label="称重日期">{details.pickedAt}</Descriptions.Item>
          <Descriptions.Item label="大棚 / 班组">{details.greenhouse} / {details.team}</Descriptions.Item>
          <Descriptions.Item label="桶数">{details.buckets} 桶</Descriptions.Item>
          <Descriptions.Item label="汇总净重">{number(details.weight)} kg</Descriptions.Item>
        </Descriptions>
        <TableSelectionToolbar title="逐桶称重记录" selectedCount={0} onClear={() => undefined} className="raw-detail-table-toolbar" />
        <Table size="small" pagination={false} rowKey="id" dataSource={bucketRecords} columns={arrangedBucketColumns} scroll={{ x: bucketTableWidth }} />
      </>}
    </Drawer>
    <Modal className="business-modal raw-modal" centered width={520} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles({ body: { padding: '16px 24px' } })} open={!!intakeBatch} title="确认原果入库" okText="确认整批入库" cancelText="取消" onCancel={() => setIntakeBatch(undefined)} onOk={confirmIntake}>
      {intakeBatch && <label className="raw-modal-label">入库仓库<Select value={intakeWarehouse} onChange={setIntakeWarehouse} options={warehouses.map(value => ({ value, label: value }))} /></label>}
    </Modal>
    <Modal className="business-modal raw-outbound-modal" centered width={FLOATING_LAYER_MAX_WIDTH} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles({ container: { height: 'calc(100dvh - var(--floating-layer-viewport-gap, 48px))' }, body: { display: 'flex', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'auto' } })} open={outboundModalOpen} title="原果扫码出库" okText={`确认出库（${scannedBaskets.length} 筐）`} cancelText="取消" okButtonProps={{ disabled: scannedBaskets.length === 0 }} onCancel={() => { setOutboundModalOpen(false); setScanActive(false); }} onOk={confirmOutbound}>
      <div className="raw-scan-panel">
        <div className="raw-scan-controls">
          <Button type="primary" onClick={startScanning}>开始扫码</Button>
          <Input className="raw-scan-capture" aria-label="扫码枪输入" ref={scanInputRef} value={scanValue} disabled={!scanActive} onChange={event => setScanValue(event.target.value)} onPressEnter={event => receiveScan(event.currentTarget.value)} />
        </div>
        <TableSelectionToolbar title="出库列表" selectedCount={0} onClear={() => undefined} className="raw-scan-table-toolbar" fixedActions={<Space size={8}><Button onClick={() => exportBasketRows(scannedBaskets, '原果扫码出库清单.csv')} disabled={!scannedBaskets.length}>导出</Button>{settingsPopover('outbound-scan', scannedColumns, columnKey<Basket>)}</Space>} />
        {scannedBaskets.length ? <><Table<Basket> size="small" rowKey="code" columns={arrangedScannedColumns} dataSource={scannedTableRows} pagination={false} scroll={{ x: scannedTableWidth, y: 'max(120px, calc(100dvh - 470px))' }} /><div className="raw-scan-pagination"><Pagination current={currentScannedPage} pageSize={scannedPageSize} total={scannedBaskets.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setScannedPage(pageSize !== scannedPageSize ? 1 : page); setScannedPageSize(pageSize); }} /></div></> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无出库筐" />}
      </div>
    </Modal>
  </div>;
}
