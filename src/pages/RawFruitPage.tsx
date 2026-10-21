import { useMemo, useRef, useState } from 'react';
import { App, Button, Card, DatePicker, Descriptions, Drawer, Empty, Input, Modal, Pagination, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getDrawerStyles, getModalStyles } from '../components/floatingLayer';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
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
  { code: 'BK202610180018', variety: '蓝莓2号', size: 'L', grade: '一级', buckets: 6, weight: 36.2, pickedAt: '2026-10-18', greenhouse: '2号棚', team: 'B班', warehouse: '2号冷库', inboundAt: '2026-10-18 09:46', batch: 'RI202610180005', state: 'out', outboundBatch: 'RO202610180002' },
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
  const [tab, setTab] = useState<TabKey>('pending');
  const [baskets, setBaskets] = useState(initialBaskets);
  const [submissions] = useState(initialSubmissions);
  const [inbound, setInbound] = useState<IntakeRecord[]>([
    { key: 'IN202610190001', batch: 'RI202610190006', warehouse: '1号冷库', count: 2, weight: 90.9, operator: '管理员', time: '2026-10-19 11:05', codes: ['BK202610190021', 'BK202610190022'] },
    { key: 'IN202610190002', batch: 'RI202610190007', warehouse: '2号冷库', count: 1, weight: 25.5, operator: '管理员', time: '2026-10-19 14:32', codes: ['BK202610190025'] },
  ]);
  const [outbound, setOutbound] = useState<OutboundRecord[]>([
    { key: 'RO202610180002', batch: 'RO202610180002', warehouse: '1号冷库、2号冷库', count: 2, weight: 76.8, operator: '管理员', time: '2026-10-18 16:20', codes: ['BK202610180017', 'BK202610180018'] },
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
  const [batchDetails, setBatchDetails] = useState<PendingSubmission>();
  const [batchFilterDraft, setBatchFilterDraft] = useState<BatchFilterValues>({ keyword: '' });
  const [batchFilters, setBatchFilters] = useState<BatchFilterValues>({ keyword: '' });
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(20);
  const [bucketPage, setBucketPage] = useState(1);
  const [bucketPageSize, setBucketPageSize] = useState(20);
  const [scannedPage, setScannedPage] = useState(1);
  const [scannedPageSize, setScannedPageSize] = useState(20);
  const [details, setDetails] = useState<Basket>();
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
  const shownOutbounds = outbound.filter(row => (!appliedFilters.warehouse || row.warehouse.includes(appliedFilters.warehouse)) && (!appliedFilters.batch || row.batch.includes(appliedFilters.batch)));
  const tally = (rows: Basket[]) => ({ count: rows.length, weight: rows.reduce((sum, row) => sum + row.weight, 0) });
  const batchWeight = (codes: string[]) => baskets.filter(basket => codes.includes(basket.code)).reduce((sum, basket) => sum + basket.weight, 0);
  const setActiveTab = (key: string) => { setTab(key as TabKey); setFilters({}); setAppliedFilters({}); setPendingPage(1); setRecordPage(1); setSelectedPendingBatches([]); setSelectedInventoryCodes([]); setSelectedInboundKeys([]); setSelectedOutboundKeys([]); };
  const openIntake = (batch: PendingSubmission | PendingSubmission[]) => { setIntakeBatch(Array.isArray(batch) ? batch : [batch]); setIntakeWarehouse('1号冷库'); };
  const openBatchDetails = (batch: PendingSubmission) => { setBatchDetails(batch); setBatchFilterDraft({ keyword: '' }); setBatchFilters({ keyword: '' }); setBatchPage(1); setBatchPageSize(20); };
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
  const openOutbound = (initialCodes: string[] = []) => { setScannedBasketCodes(initialCodes); setScannedPage(1); setScanValue(''); setScanActive(false); setOutboundModalOpen(true); };
  const startScanning = () => { setScanActive(true); window.setTimeout(() => scanInputRef.current?.focus(), 0); };
  const receiveScan = (value: string) => {
    const code = value.trim();
    setScanValue('');
    if (!code) return;
    const basket = baskets.find(row => row.code === code);
    if (!basket) { message.warning(`未找到筐码 ${code}`); return; }
    if (basket.state !== 'stock') { message.warning(basket.state === 'out' ? '该筐已出库，不能重复扫码' : '该筐尚未入库，不能出库'); return; }
    if (scannedBasketCodes.includes(code)) { message.info('该筐已在本次扫码清单中'); return; }
    setScannedBasketCodes(current => [...current, code]); setScannedPage(1);
  };
  const removeScannedBasket = (code: string) => setScannedBasketCodes(current => current.filter(item => item !== code));
  const confirmOutbound = () => {
    const selected = baskets.filter(row => scannedBasketCodes.includes(row.code) && row.state === 'stock');
    if (!selected.length) { message.warning('请先扫描在库筐码'); return; }
    if (selected.length !== scannedBasketCodes.length) { message.warning('部分筐已不在库存中，请重新核对扫码清单'); return; }
    const now = '2026-10-20 09:30';
    const batch = `RO20261020${String(outbound.length + 1).padStart(4, '0')}`;
    const warehousesInBatch = [...new Set(selected.map(row => row.warehouse ?? '未指定仓库'))];
    setBaskets(current => current.map(row => scannedBasketCodes.includes(row.code) ? { ...row, state: 'out', outboundBatch: batch } : row));
    setOutbound(current => [{ key: batch, batch, warehouse: warehousesInBatch.join('、'), count: selected.length, weight: selected.reduce((sum, row) => sum + row.weight, 0), operator: '管理员', time: now, codes: selected.map(row => row.code) }, ...current]);
    setOutboundModalOpen(false); setScanActive(false); setScannedBasketCodes([]); setScanValue('');
    message.success(`已确认 ${selected.length} 筐出库，出库记录和库存已同步更新`);
    setTab('outbound'); setFilters({}); setAppliedFilters({}); setRecordPage(1); setSelectedInventoryCodes([]); setSelectedInboundKeys([]); setSelectedOutboundKeys([]);
  };
  const detailAction = (code: string) => { const row = baskets.find(item => item.code === code); if (row) { setDetails(row); setBucketPage(1); } else message.info('未找到已同步记录'); };
  const link = (text: string, action: () => void) => <Button type="link" className="raw-link" onClick={action}>{text}</Button>;
  const pendingColumns: ColumnsType<Submission & { pending: string[] }> = [
    { title: '入库批次号', dataIndex: 'batch', width: 190, render: (_, row) => link(row.batch, () => openBatchDetails(row)) },
    { title: '称重员', dataIndex: 'submittedBy', width: 96 },
    { title: '总筐数', key: 'basketCount', render: (_, row) => row.codes.length, width: 96, align: 'right' },
    { title: '总重量', key: 'batchWeight', render: (_, row) => `${number(batchWeight(row.codes))} kg`, width: 128, align: 'right' },
    { title: '称重日期', dataIndex: 'pickedAt', width: 116 }, { title: '提交时间', dataIndex: 'submittedAt', width: 160 },
    { title: '操作', key: 'action', fixed: 'right', width: 96, render: (_, row) => link('批次入库', () => openIntake(row)) },
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
    { title: '原果入库批次号', dataIndex: 'batch', width: 170, render: value => link(value, () => detailAction((baskets.find(b => b.batch === value)?.code) ?? '')) },
    { title: '称重日期', dataIndex: 'pickedAt', width: 108 },
    ...(tab === 'inventory' ? [{ title: '入库日期', dataIndex: 'inboundAt', width: 108, render: (value: string | undefined) => value?.slice(0, 10) ?? '—' } as const] : []),
    { title: '大棚', dataIndex: 'greenhouse', width: 90 }, { title: '班组', dataIndex: 'team', width: 80 }, { title: '品种', dataIndex: 'variety', width: 92 }, { title: '果径', dataIndex: 'size', width: 64 }, { title: '等级', dataIndex: 'grade', width: 76 },
    { title: '桶数', dataIndex: 'buckets', width: 72, align: 'right' }, { title: tab === 'inventory' ? '在库净重' : '净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` },
    ...(tab === 'outbound' ? [{ title: '原果出库批次号', dataIndex: 'outboundBatch', width: 170 } as const] : []),
    ...(tab === 'inventory' ? [{ title: '操作', key: 'action', fixed: 'right', width: 104, render: (_: unknown, row: Basket) => link('查看详情', () => detailAction(row.code)) } as const] : []),
  ];
  const basketColumnKey = (column: ColumnsType<Basket>[number]) => String(column.key ?? ('dataIndex' in column ? column.dataIndex : undefined));
  const visibleBasketColumns = arrangedColumns('inventory', basketColumns, basketColumnKey);
  const basketTableScrollWidth = visibleBasketColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 40);
  const intakeColumns: ColumnsType<IntakeRecord> = [
    { title: '原果入库批次号', dataIndex: 'batch', width: 180, render: value => link(value, () => detailAction(inbound.find(row => row.batch === value)?.codes[0] ?? '')) }, { title: '本次入库仓库', dataIndex: 'warehouse', width: 120 }, { title: '入库筐数', dataIndex: 'count', width: 90, align: 'right' }, { title: '入库净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` }, { title: '确认人', dataIndex: 'operator', width: 90 }, { title: '确认时间', dataIndex: 'time', width: 160 }, { title: '操作', key: 'action', fixed: 'right', width: 96, render: (_, row) => link('查看流水', () => detailAction(row.codes[0])) },
  ];
  const outboundColumns: ColumnsType<OutboundRecord> = [
    { title: '原果出库批次号', dataIndex: 'batch', width: 180, render: value => link(value, () => detailAction(outbound.find(row => row.batch === value)?.codes[0] ?? '')) }, { title: '出库仓库', dataIndex: 'warehouse', width: 130 }, { title: '出库筐数', dataIndex: 'count', width: 90, align: 'right' }, { title: '出库净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` }, { title: '操作人', dataIndex: 'operator', width: 90 }, { title: '出库时间', dataIndex: 'time', width: 160 }, { title: '操作', key: 'action', fixed: 'right', width: 96, render: (_, row) => link('查看批次', () => detailAction(row.codes[0])) },
  ];
  const tabLabels: { key: TabKey; label: string }[] = [{ key: 'pending', label: '待入库' }, { key: 'inventory', label: '原果库存' }, { key: 'inbound', label: '入库记录' }, { key: 'outbound', label: '出库记录' }];
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
  const scannedTally = tally(scannedBaskets);
  const selectedRecordCount = tab === 'pending' ? selectedPendingBatches.length : tab === 'inventory' ? selectedInventoryCodes.length : tab === 'inbound' ? selectedInboundKeys.length : selectedOutboundKeys.length;
  const selectedRecordLabel = tab === 'pending' ? '个批次' : tab === 'inventory' ? '个筐' : '条记录';
  const clearActiveSelection = () => {
    if (tab === 'pending') setSelectedPendingBatches([]);
    else if (tab === 'inventory') setSelectedInventoryCodes([]);
    else if (tab === 'inbound') setSelectedInboundKeys([]);
    else setSelectedOutboundKeys([]);
  };
  const exportSelectedRecords = () => {
    if (tab === 'inbound') {
      const rows = inbound.filter(row => selectedInboundKeys.includes(row.key));
      exportCsv(['原果入库批次号', '本次入库仓库', '入库筐数', '入库净重(kg)', '确认人', '确认时间'], rows.map(row => [row.batch, row.warehouse, row.count, row.weight, row.operator, row.time]), '原果入库记录-所选.csv');
      message.success(`已导出 ${rows.length} 条入库记录`);
    } else if (tab === 'outbound') {
      const rows = outbound.filter(row => selectedOutboundKeys.includes(row.key));
      exportCsv(['原果出库批次号', '出库仓库', '出库筐数', '出库净重(kg)', '操作人', '出库时间'], rows.map(row => [row.batch, row.warehouse, row.count, row.weight, row.operator, row.time]), '原果出库记录-所选.csv');
      message.success(`已导出 ${rows.length} 条出库记录`);
    }
  };
  const scannedColumns: ColumnsType<Basket> = [
    { title: '筐码', dataIndex: 'code', width: 160 }, { title: '仓库', dataIndex: 'warehouse', width: 96 }, { title: '品种', dataIndex: 'variety', width: 96 },
    { title: '果径 / 等级', key: 'sizeGrade', width: 108, render: (_, row) => `${row.size} / ${row.grade}` }, { title: '桶数', dataIndex: 'buckets', width: 72, align: 'right' },
    { title: '净重', dataIndex: 'weight', width: 110, align: 'right', render: value => `${number(value)} kg` },
    { title: '操作', key: 'action', width: 72, render: (_, row) => link('移除', () => removeScannedBasket(row.code)) },
  ];
  const batchBasketColumns: ColumnsType<Basket> = [
    { title: '筐称重码', dataIndex: 'code', fixed: 'left', width: 170, render: value => link(value, () => detailAction(value)) },
    { title: '品种', dataIndex: 'variety', width: 92 }, { title: '果径', dataIndex: 'size', width: 64 }, { title: '等级', dataIndex: 'grade', width: 76 },
    { title: '桶数', dataIndex: 'buckets', width: 72, align: 'right' }, { title: '汇总净重', dataIndex: 'weight', width: 112, align: 'right', render: value => `${number(value)} kg` },
    { title: '称重日期', dataIndex: 'pickedAt', width: 108 }, { title: '大棚', dataIndex: 'greenhouse', width: 88 }, { title: '班组', dataIndex: 'team', width: 80 },
  ];
  const arrangedBatchBasketColumns = arrangedColumns('batch-details', batchBasketColumns, columnKey<Basket>);
  const batchBasketTableScrollWidth = arrangedBatchBasketColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const arrangedScannedColumns = arrangedColumns('outbound-scan', scannedColumns, columnKey<Basket>);
  const scannedTableWidth = arrangedScannedColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const bucketRecords = details ? Array.from({ length: details.buckets }, (_, i) => ({ id: i + 1, worker: ['张三', '李四', '王五'][i % 3], weight: Number((details.weight / details.buckets + ((i % 2) ? 0.12 : -0.12)).toFixed(2)), time: `${details.pickedAt} ${String(8 + i).padStart(2, '0')}:${String(18 + i * 4).padStart(2, '0')}` })) : [];
  const bucketColumns: ColumnsType<(typeof bucketRecords)[number]> = [{ title: '工人', dataIndex: 'worker', width: 90 }, { title: '称重时间', dataIndex: 'time', width: 160 }, { title: '净重', dataIndex: 'weight', width: 100, render: value => `${number(value)} kg` }];
  const arrangedBucketColumns = arrangedColumns('bucket-detail', bucketColumns, columnKey<(typeof bucketRecords)[number]>);
  const bucketTableWidth = arrangedBucketColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const currentBucketPage = Math.min(bucketPage, Math.max(1, Math.ceil(bucketRecords.length / bucketPageSize)));
  const currentScannedPage = Math.min(scannedPage, Math.max(1, Math.ceil(scannedBaskets.length / scannedPageSize)));
  const scannedTableRows = scannedBaskets.slice((currentScannedPage - 1) * scannedPageSize, currentScannedPage * scannedPageSize);
  const arrangedIntakeColumns = arrangedColumns('inbound', intakeColumns, columnKey<IntakeRecord>);
  const arrangedOutboundColumns = arrangedColumns('outbound', outboundColumns, columnKey<OutboundRecord>);
  const intakeScrollWidth = arrangedIntakeColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 40);
  const outboundScrollWidth = arrangedOutboundColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 40);
  const tableContent = tab === 'pending' ? <Table<PendingSubmission> rowKey="batch" size="small" columns={arrangedColumns('pending', pendingColumns, pendingColumnKey)} dataSource={visiblePendingSubmissions} pagination={false} rowSelection={{ columnWidth: 48, selectedRowKeys: selectedPendingBatches, preserveSelectedRowKeys: true, onChange: keys => setSelectedPendingBatches(keys.map(String)) }} scroll={{ x: pendingTableScrollWidth, y: '100%' }} />
    : tab === 'inventory' ? <Table<Basket> rowKey="code" size="small" columns={visibleBasketColumns} dataSource={visibleBaskets.slice(recordPageStart, recordPageStart + recordPageSize)} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedInventoryCodes, preserveSelectedRowKeys: true, onChange: keys => setSelectedInventoryCodes(keys.map(String)) }} scroll={{ x: basketTableScrollWidth, y: '100%' }} />
    : tab === 'inbound' ? <Table<IntakeRecord> rowKey="key" size="small" columns={arrangedIntakeColumns} dataSource={shownIntakes.slice(recordPageStart, recordPageStart + recordPageSize)} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedInboundKeys, preserveSelectedRowKeys: true, onChange: keys => setSelectedInboundKeys(keys.map(String)) }} scroll={{ x: intakeScrollWidth, y: '100%' }} />
    : <Table<OutboundRecord> rowKey="key" size="small" columns={arrangedOutboundColumns} dataSource={shownOutbounds.slice(recordPageStart, recordPageStart + recordPageSize)} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedOutboundKeys, preserveSelectedRowKeys: true, onChange: keys => setSelectedOutboundKeys(keys.map(String)) }} scroll={{ x: outboundScrollWidth, y: '100%' }} />;

  return <div className="raw-page">
    <Tabs className="raw-tabs" activeKey={tab} onChange={setActiveTab} items={tabLabels.map(({ key, label }) => ({ key, label }))} />
    <Card className="raw-filter-card" bordered={false}>
      <div className={`raw-filter-grid raw-filter-grid-${tab}`}>
        {tab === 'pending' && <>
          <label>提交时间<DatePicker.RangePicker allowClear value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null} placeholder={['开始日期', '结束日期']} onChange={dates => setFilters(v => { const next = { ...v }; if (dates?.[0] && dates[1]) { next.dateFrom = dates[0].format('YYYY-MM-DD'); next.dateTo = dates[1].format('YYYY-MM-DD'); } else { delete next.dateFrom; delete next.dateTo; } return next; })} /></label>
          <label>原果入库批次号<Input allowClear value={filters.batch ?? ''} placeholder="请输入批次号" onChange={e => setFilters(v => ({ ...v, batch: e.target.value }))} /></label>
        </>}
        {tab === 'inventory' && <label>原果入库批次号<Input allowClear value={filters.batch ?? ''} placeholder="请输入批次号" onChange={e => setFilters(v => ({ ...v, batch: e.target.value }))} /></label>}
        {tab === 'inventory' && <label>仓库<Select allowClear value={filters.warehouse} placeholder="全部仓库" options={warehouses.map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, warehouse: value ?? '' }))} /></label>}
        {tab === 'inventory' && <label>称重日期<DatePicker.RangePicker allowClear value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null} placeholder={['开始日期', '结束日期']} onChange={dates => setFilters(v => { const next = { ...v }; if (dates?.[0] && dates[1]) { next.dateFrom = dates[0].format('YYYY-MM-DD'); next.dateTo = dates[1].format('YYYY-MM-DD'); } else { delete next.dateFrom; delete next.dateTo; } return next; })} /></label>}
        {tab === 'inventory' && <><label>大棚<Select allowClear value={filters.greenhouse} placeholder="全部大棚" options={['1号棚', '2号棚', '3号棚'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, greenhouse: value ?? '' }))} /></label><label>班组<Select allowClear value={filters.team} placeholder="全部班组" options={['A班', 'B班'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, team: value ?? '' }))} /></label></>}
        {tab === 'inventory' && <label>品种<Select allowClear value={filters.variety} placeholder="全部品种" options={['蓝莓1号', '蓝莓2号', '废果'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, variety: value ?? '' }))} /></label>}
        {tab === 'inventory' && <><label>果径<Select allowClear value={filters.size} placeholder="全部果径" options={['XL', 'L', 'M', 'S', '/'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, size: value ?? '' }))} /></label><label>等级<Select allowClear value={filters.grade} placeholder="全部等级" options={['特级', '一级', '二级', '/'].map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, grade: value ?? '' }))} /></label></>}
        {(tab === 'inbound' || tab === 'outbound') && <><label>{tab === 'inbound' ? '入库批次号' : '出库批次号'}<Input allowClear value={filters.batch ?? ''} placeholder="请输入批次号" onChange={e => setFilters(v => ({ ...v, batch: e.target.value }))} /></label><label>仓库<Select allowClear value={filters.warehouse} placeholder="全部仓库" options={warehouses.map(value => ({ value, label: value }))} onChange={value => setFilters(v => ({ ...v, warehouse: value ?? '' }))} /></label></>}
        <div className="raw-filter-actions"><Button onClick={() => { setFilters({}); setAppliedFilters({}); clearActiveSelection(); setPendingPage(1); setRecordPage(1); }}>重置</Button><Button type="primary" onClick={() => { setAppliedFilters(filters); setPendingPage(1); setRecordPage(1); clearActiveSelection(); }}>查询</Button></div>
      </div>
    </Card>
    <Card className={`raw-table-card${compactTable ? ' raw-table-card-compact' : ''}`} bordered={false}>
      <TableSelectionToolbar title={tabLabels.find(item => item.key === tab)?.label ?? '原果数据'} selectedCount={selectedRecordCount} selectedLabel={selectedRecordLabel} onClear={clearActiveSelection} className="raw-table-toolbar" actions={<Space size={16}>
        {tab === 'pending' && <>
          {selectedPendingBatches.length > 0 && <Button type="primary" onClick={() => openIntake(pendingSubmissions.filter(row => selectedPendingBatches.includes(row.batch)))}>批量入库</Button>}
          {settingsPopover('pending', pendingColumns, pendingColumnKey)}
        </>}
        {tab === 'inventory' && <>
          <Button type="primary" onClick={() => openOutbound(selectedInventoryCodes)}>{selectedInventoryCodes.length ? '出库所选筐' : '扫码出库'}</Button>
          {settingsPopover('inventory', basketColumns, basketColumnKey)}
        </>}
        {tab === 'inbound' && <>{selectedRecordCount > 0 && <Button type="primary" onClick={exportSelectedRecords}>导出所选</Button>}{settingsPopover('inbound', intakeColumns, columnKey<IntakeRecord>)}</>}
        {tab === 'outbound' && <>{selectedRecordCount > 0 && <Button type="primary" onClick={exportSelectedRecords}>导出所选</Button>}{settingsPopover('outbound', outboundColumns, columnKey<OutboundRecord>)}</>}
      </Space>} />
      {tab === 'pending' ? <div className="raw-pending-list">{tableCount === 0 ? <div className="raw-table-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的数据" /></div> : tableContent}<div className="raw-pending-pagination"><Pagination current={currentPendingPage} pageSize={pendingPageSize} total={filteredPendingSubmissions.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setPendingPage(pageSize !== pendingPageSize ? 1 : page); setPendingPageSize(pageSize); }} /></div></div> : <><div className="raw-table-content">{tableCount === 0 ? <div className="raw-table-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的数据" /></div> : tableContent}</div><div className="raw-pagination"><Pagination current={currentRecordPage} pageSize={recordPageSize} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} total={tableCount} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setRecordPage(pageSize !== recordPageSize ? 1 : page); setRecordPageSize(pageSize); }} /></div></>}
    </Card>
    <Modal className="business-modal raw-batch-modal" centered width={1440} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles({ container: { height: 'calc(100dvh - var(--floating-layer-viewport-gap, 48px))' }, body: { display: 'flex', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'hidden' } })} open={!!batchDetails} title={batchDetails ? <span>批次详情 · <Typography.Text copyable={{ text: batchDetails.batch, onCopy: () => message.success('批次号已复制') }}>{batchDetails.batch}</Typography.Text></span> : '批次详情'} footer={null} onCancel={() => setBatchDetails(undefined)}>
      {batchDetails && <div className="raw-batch-modal-content">
        <div className="raw-batch-modal-toolbar"><div className="raw-batch-modal-filters">
          <label className="filter-keyword">称重码<Input allowClear value={batchFilterDraft.keyword} onChange={event => updateBatchFilter('keyword', event.target.value)} placeholder="请输入称重码" /></label>
          <label className="filter-date">称重日期<DatePicker.RangePicker allowClear format="YYYY-MM-DD" placeholder={['开始日期', '结束日期']} value={batchFilterDraft.pickedRange ? [dayjs(batchFilterDraft.pickedRange[0]), dayjs(batchFilterDraft.pickedRange[1])] as [dayjs.Dayjs, dayjs.Dayjs] : null} onChange={dates => updateBatchFilter('pickedRange', dates?.[0] && dates?.[1] ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] : undefined)} /></label>
          <label className="filter-greenhouse">大棚<Select allowClear value={batchFilterDraft.greenhouse} onChange={value => updateBatchFilter('greenhouse', value)} placeholder="全部大棚" options={[...new Set(batchBasketRows.map(basket => basket.greenhouse))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-team">班组<Select allowClear value={batchFilterDraft.team} onChange={value => updateBatchFilter('team', value)} placeholder="全部班组" options={[...new Set(batchBasketRows.map(basket => basket.team))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-variety">品种<Select allowClear value={batchFilterDraft.variety} onChange={value => updateBatchFilter('variety', value)} placeholder="全部品种" options={[...new Set(batchBasketRows.map(basket => basket.variety))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-size">果径<Select allowClear value={batchFilterDraft.size} onChange={value => updateBatchFilter('size', value)} placeholder="全部果径" options={[...new Set(batchBasketRows.map(basket => basket.size))].map(value => ({ value, label: value }))} /></label>
          <label className="filter-grade">等级<Select allowClear value={batchFilterDraft.grade} onChange={value => updateBatchFilter('grade', value)} placeholder="全部等级" options={[...new Set(batchBasketRows.map(basket => basket.grade))].map(value => ({ value, label: value }))} /></label>
          <div className="raw-batch-filter-actions"><Button onClick={() => { setBatchFilterDraft({ keyword: '' }); setBatchFilters({ keyword: '' }); setBatchPage(1); }}>重置</Button><Button type="primary" onClick={() => { setBatchFilters(batchFilterDraft); setBatchPage(1); }}>查询</Button></div>
        </div></div>
        <TableSelectionToolbar title="批次筐明细" selectedCount={0} onClear={() => undefined} className="raw-batch-table-toolbar" actions={settingsPopover('batch-details', batchBasketColumns, columnKey<Basket>)} />
        <div className="raw-batch-table-area">{filteredBatchBasketRows.length ? <Table<Basket> size="small" rowKey="code" columns={arrangedBatchBasketColumns} dataSource={visibleBatchBasketRows} pagination={false} scroll={{ x: batchBasketTableScrollWidth, y: '100%' }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的筐信息" />}</div>
        <div className="raw-batch-pagination"><span className="record-total">共 {filteredBatchBasketRows.length.toLocaleString('zh-CN')} 项数据</span><Pagination current={currentBatchPage} pageSize={batchPageSize} total={filteredBatchBasketRows.length} pageSizeOptions={[10, 20, 50, 100]} showSizeChanger showQuickJumper onChange={(page, pageSize) => { setBatchPage(pageSize !== batchPageSize ? 1 : page); setBatchPageSize(pageSize); }} /></div>
      </div>}
    </Modal>
    <Drawer className="raw-drawer" width={FLOATING_LAYER_WIDTHS.detailDrawer} open={!!details} onClose={() => setDetails(undefined)} closable={false} title={<Space><Button type="text" aria-label="关闭筐详情" icon={<ArrowLeftOutlined />} onClick={() => setDetails(undefined)} />筐详情</Space>} styles={getDrawerStyles()}>
      {details && <><Descriptions column={2} bordered size="small"><Descriptions.Item label="称重码" span={2}>{details.code}</Descriptions.Item><Descriptions.Item label="品种">{details.variety}</Descriptions.Item><Descriptions.Item label="果径 / 等级">{details.size} / {details.grade}</Descriptions.Item><Descriptions.Item label="称重日期">{details.pickedAt}</Descriptions.Item><Descriptions.Item label="大棚 / 班组">{details.greenhouse} / {details.team}</Descriptions.Item><Descriptions.Item label="桶数">{details.buckets} 桶</Descriptions.Item><Descriptions.Item label="汇总净重">{number(details.weight)} kg</Descriptions.Item><Descriptions.Item label="原果入库批次号" span={2}>{details.batch}</Descriptions.Item></Descriptions><TableSelectionToolbar title="逐桶称重记录" selectedCount={0} onClear={() => undefined} className="raw-detail-table-toolbar" actions={settingsPopover('bucket-detail', bucketColumns, columnKey<(typeof bucketRecords)[number]>)} /><Table size="small" pagination={false} rowKey="id" dataSource={bucketRecords.slice((currentBucketPage - 1) * bucketPageSize, currentBucketPage * bucketPageSize)} columns={arrangedBucketColumns} scroll={{ x: bucketTableWidth }} /><div className="raw-detail-pagination"><Pagination current={currentBucketPage} pageSize={bucketPageSize} total={bucketRecords.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setBucketPage(pageSize !== bucketPageSize ? 1 : page); setBucketPageSize(pageSize); }} /></div></>}
    </Drawer>
    <Modal className="business-modal raw-modal" centered width={FLOATING_LAYER_WIDTHS.formModal} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles()} open={!!intakeBatch} title="确认原果入库" okText="确认整批入库" cancelText="取消" onCancel={() => setIntakeBatch(undefined)} onOk={confirmIntake}>
      {intakeBatch && <label className="raw-modal-label">入库仓库<Select value={intakeWarehouse} onChange={setIntakeWarehouse} options={warehouses.map(value => ({ value, label: value }))} /></label>}
    </Modal>
    <Modal className="business-modal raw-outbound-modal" centered width={860} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} open={outboundModalOpen} title="原果扫码出库" okText={`确认出库（${scannedBaskets.length} 筐）`} cancelText="取消" okButtonProps={{ disabled: scannedBaskets.length === 0 }} onCancel={() => { setOutboundModalOpen(false); setScanActive(false); }} onOk={confirmOutbound}>
      <div className="raw-scan-panel">
        <div className="raw-scan-controls"><Button type="primary" onClick={startScanning}>{scanActive ? '扫码中' : '开始扫码'}</Button><Input ref={scanInputRef} value={scanValue} disabled={!scanActive} placeholder={scanActive ? '请用扫码枪扫描筐码，扫码后自动识别' : '点击“开始扫码”后再扫描'} onChange={event => setScanValue(event.target.value)} onPressEnter={event => receiveScan(event.currentTarget.value)} /><span className={`raw-scan-indicator ${scanActive ? 'is-active' : ''}`}>{scanActive ? '等待扫码枪输入' : '未启动'}</span></div>
        <p className="raw-scan-note">扫码枪扫描筐码后会自动回车，筐信息将即时加入下方清单。可扫码示例：BK202610190021、BK202610190022、BK202610190025。</p>
        <div className="raw-scan-summary"><strong>已扫描 {scannedTally.count} 筐</strong><span>合计净重 {number(scannedTally.weight)} kg</span></div>
        <TableSelectionToolbar title="本次扫码清单" selectedCount={scannedBasketCodes.length} selectedLabel="筐" onClear={() => setScannedBasketCodes([])} className="raw-scan-table-toolbar" actions={settingsPopover('outbound-scan', scannedColumns, columnKey<Basket>)} />
        {scannedBaskets.length ? <><Table<Basket> size="small" rowKey="code" columns={arrangedScannedColumns} dataSource={scannedTableRows} pagination={false} scroll={{ x: scannedTableWidth, y: 280 }} /><div className="raw-scan-pagination"><Pagination current={currentScannedPage} pageSize={scannedPageSize} total={scannedBaskets.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(page, pageSize) => { setScannedPage(pageSize !== scannedPageSize ? 1 : page); setScannedPageSize(pageSize); }} /></div></> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待扫码，扫描成功后自动显示筐信息" />}
      </div>
    </Modal>
  </div>;
}
