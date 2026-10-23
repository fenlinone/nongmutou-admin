// 基于 ant-design-skill 06-ToolbarTable 模板，保留 ProTable、工具栏与 Design Token 容器。
import { useEffect, useState } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Button, Empty, Pagination, Space, Tabs, Tooltip } from 'antd';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import FinishedGoodsFilter, { type FinishedFilters, type FinishedTab } from '../components/FinishedGoodsFilter';
import FinishedGoodsDetails, { FinishedRestoreModal, type FinishedView } from '../components/finished-goods/FinishedGoodsDetails';
import FinishedGoodsOperation from '../components/finished-goods/FinishedGoodsOperation';
import FinishedGoodsOutboundModal from '../components/finished-goods/FinishedGoodsOutboundModal';
import FinishedGoodsBatchDetailsModal from '../components/finished-goods/FinishedGoodsBatchDetailsModal';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import { formatWeight, totalWeight, useFinishedGoods, type FinishedBox, type Inbound, type Outbound, type Pallet } from '../finishedGoods';
import { exportCsv } from '../data';
import PalletManagementPage, { PalletBoxDetailModal } from './PalletManagementPage';
import './finished-goods.css';

type ResultRow = { key: string; code: string; variety: string; size: string; grade: string; spec: string; warehouse: string; time: string; count: number; weight: number; boxes: FinishedBox[]; box?: FinishedBox; pallet?: Pallet; palletStatus?: '整托' | '零托'; inbound?: Inbound; outbound?: Outbound };
const tabs: { key: FinishedTab; label: string }[] = [{ key: 'inventory', label: '成品库存' }, { key: 'inbound', label: '入库记录' }, { key: 'outbound', label: '出库记录' }];
const outboundPalletCount = (outbound?: Outbound) => new Set(outbound?.boxes.flatMap(box => box.pallet ? [box.pallet] : []) ?? []).size;

export default function FinishedGoodsPage({ hash }: { hash: string }) {
  const { state } = useFinishedGoods();
  const [route, query = ''] = hash.split('?');
  const segment = route.split('/')[2];
  const tab: FinishedTab = tabs.some(item => item.key === segment) ? segment as FinishedTab : 'inventory';
  const operation = segment === 'group' || segment === 'dispatch' ? segment : undefined;
  const initialPalletCodes = new URLSearchParams(query).get('pallets')?.split(',').filter(Boolean) ?? [];
  const [filters, setFilters] = useState<FinishedFilters>({});
  const [filterTab, setFilterTab] = useState(tab);
  const [selectedInventoryCodes, setSelectedInventoryCodes] = useState<string[]>([]);
  const [selectedRecordCodes, setSelectedRecordCodes] = useState<Record<'inbound' | 'outbound', string[]>>({ inbound: [], outbound: [] });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hiddenByTab, setHiddenByTab] = useState<Record<FinishedTab, string[]>>({ inventory: [], pallets: [], inbound: [], outbound: [] });
  const [orderByTab, setOrderByTab] = useState<Record<FinishedTab, string[]>>({ inventory: [], pallets: [], inbound: [], outbound: [] });
  const [viewStack, setViewStack] = useState<FinishedView[]>([]);
  const [palletModalCode, setPalletModalCode] = useState<string>();
  const [recordDetails, setRecordDetails] = useState<ResultRow>();
  const [outboundModalOpen, setOutboundModalOpen] = useState(false);
  const [restoreBatch, setRestoreBatch] = useState<string>();
  const stockBoxes = state.boxes.filter(box => box.state === 'stock' && !!box.pallet);
  const stockBoxCodes = stockBoxes.map(box => box.code);
  const stockPalletCodes = [...new Set(stockBoxes.map(box => box.pallet!))];
  useEffect(() => { setFilters({}); setFilterTab(tab); setSelectedInventoryCodes([]); setPage(1); }, [tab]);
  const activeFilters = filterTab === tab ? filters : {};
  const view = viewStack.at(-1);
  const show = (next: FinishedView) => setViewStack(previous => [...previous, next]);
  const openView = (next: FinishedView) => {
    if (next.type === 'pallet') { setPalletModalCode(next.id); return; }
    show(next);
  };
  const link = (type: FinishedView['type'], id: string) => <Tooltip title={id}><Button type="link" className="finished-link" onClick={() => openView({ type, id })}>{id}</Button></Tooltip>;
  // 成品库存按托盘汇总，仅统计当前在库且已组托的箱。
  const inventoryRows: ResultRow[] = state.pallets.flatMap(pallet => {
    const boxes = state.boxes.filter(box => box.pallet === pallet.code && box.state === 'stock');
    if (!boxes.length) return [];
    const firstBox = boxes[0];
    return [{ key: pallet.code, code: pallet.code, variety: firstBox.variety, size: firstBox.size, grade: firstBox.grade, spec: firstBox.spec, warehouse: pallet.warehouse, time: pallet.time, count: boxes.length, weight: totalWeight(boxes), boxes, pallet, palletStatus: boxes.length === pallet.codes.length ? '整托' : '零托' }];
  });
  const rows: ResultRow[] = tab === 'inventory' ? inventoryRows
    : tab === 'inbound' ? state.inbound.map(inbound => ({ key: inbound.id, code: inbound.id, variety: inbound.boxes[0].variety, size: inbound.boxes[0].size, grade: inbound.boxes[0].grade, spec: inbound.boxes[0].spec, warehouse: inbound.warehouse, time: inbound.time, count: inbound.boxes.length, weight: totalWeight(inbound.boxes), boxes: inbound.boxes, inbound }))
    : state.outbound.map(outbound => ({ key: outbound.id, code: outbound.id, variety: outbound.boxes[0]?.variety ?? '', size: outbound.boxes[0]?.size ?? '', grade: outbound.boxes[0]?.grade ?? '', spec: '', warehouse: outbound.warehouse, time: outbound.time, count: outbound.boxes.length, weight: totalWeight(outbound.boxes), boxes: outbound.boxes, outbound }));
  const filtered = rows.filter(row => {
    const f = activeFilters;
    if (f.boxCode?.trim() && !row.boxes.some(box => box.code === f.boxCode!.trim())) return false;
    if (f.palletCode?.trim() && (row.pallet?.code ?? row.inbound?.pallet ?? '') !== f.palletCode.trim()) return false;
    if (f.warehouse && row.warehouse !== f.warehouse) return false;
    if (f.variety && !row.boxes.some(box => box.variety === f.variety)) return false;
    if (f.size && !row.boxes.some(box => box.size === f.size)) return false;
    if (f.grade && !row.boxes.some(box => box.grade === f.grade)) return false;
    if (f.spec && !row.boxes.some(box => box.spec === f.spec)) return false;
    if (f.batch?.trim() && row.outbound?.id !== f.batch.trim()) return false;
    if (f.document?.trim() && row.outbound?.document !== f.document.trim()) return false;
    if (f.restored && !!row.outbound?.restoration !== (f.restored === 'yes')) return false;
    const date = row.time.slice(0, 10);
    return (!f.dates?.[0] || date >= f.dates[0].slice(0, 10)) && (!f.dates?.[1] || date <= f.dates[1].slice(0, 10));
  });
  const selectedInventoryRows = tab === 'inventory'
    ? filtered.filter(row => selectedInventoryCodes.includes(row.key))
    : [];
  const selectedRecordKeys = tab === 'inbound' || tab === 'outbound' ? selectedRecordCodes[tab] : [];
  const selectedTableRows = tab === 'inventory'
    ? selectedInventoryRows
    : rows.filter(row => selectedRecordKeys.includes(row.key));
  const allColumns: ProColumns<ResultRow>[] = [
    { title: tab === 'outbound' ? '成品出库批次号' : tab === 'inbound' ? '入库批次号' : '托盘码', dataIndex: 'code', width: 205, fixed: tab === 'inbound' || tab === 'outbound' ? 'left' : undefined, ellipsis: true, render: (_, row) => tab === 'inbound' || tab === 'outbound' ? <Tooltip title={row.code}><Button type="link" className="finished-link" onClick={() => setRecordDetails(row)}>{row.code}</Button></Tooltip> : link('pallet', row.code) },
    ...(tab === 'inventory' ? [
      { title: '品种', dataIndex: 'variety', width: 85 }, { title: '果径', dataIndex: 'size', width: 55 }, { title: '等级', dataIndex: 'grade', width: 65 }, { title: '包装规格', dataIndex: 'spec', width: 130 },
      { title: '库存箱数', dataIndex: 'count', width: 100, render: (_: unknown, row: ResultRow) => `${row.count} 箱` },
      { title: '托盘状态', dataIndex: 'palletStatus', width: 100 },
    ] as ProColumns<ResultRow>[] : [
      ...(tab === 'inbound' ? [{ title: '入库托数', width: 100, render: (_: unknown, row: ResultRow) => `${row.inbound?.pallet ? 1 : 0} 托` }] as ProColumns<ResultRow>[] : []),
      ...(tab === 'outbound' ? [{ title: '出库托数', key: 'palletCount', width: 105, render: (_: unknown, row: ResultRow) => `${outboundPalletCount(row.outbound)} 托` }] as ProColumns<ResultRow>[] : []),
      { title: tab === 'inbound' ? '入库箱数' : '出库箱数', dataIndex: 'count', width: 105, render: (_: unknown, row: ResultRow) => `${row.count} 箱` },
    ] as ProColumns<ResultRow>[]),
    { title: '仓库', dataIndex: 'warehouse', width: tab === 'inventory' ? 90 : 110 },
    { title: tab === 'inventory' ? '组托时间' : tab === 'outbound' ? '出库时间' : '入库时间', dataIndex: 'time', width: tab === 'inventory' ? 130 : 180 },
    { title: '操作', key: 'option', fixed: 'right', width: tab === 'inventory' ? 96 : tab === 'inbound' ? 96 : 110, align: 'center', render: (_: unknown, row: ResultRow) => tab === 'inventory' ? <Button type="link" className="finished-link" onClick={() => openView({ type: 'pallet', id: row.code })}>托盘详情</Button> : tab === 'outbound' ? <Button type="link" className="finished-link" disabled={!!row.outbound!.restoration} onClick={() => setRestoreBatch(row.key)}>恢复库存</Button> : <Button type="link" className="finished-link" onClick={() => setRecordDetails(row)}>详情</Button> },
  ];
  const columnKey = (column: ProColumns<ResultRow>) => String(column.key ?? column.dataIndex ?? column.title);
  const configurableColumns = allColumns.filter(column => columnKey(column) !== 'option');
  const orderedColumns = [...configurableColumns].sort((left, right) => {
    const leftIndex = orderByTab[tab].indexOf(columnKey(left));
    const rightIndex = orderByTab[tab].indexOf(columnKey(right));
    return (leftIndex < 0 ? configurableColumns.indexOf(left) : leftIndex) - (rightIndex < 0 ? configurableColumns.indexOf(right) : rightIndex);
  });
  const operationColumns = tab === 'pallets' || tab === 'outbound' ? allColumns.filter(column => columnKey(column) === 'option') : [];
  const columns = [...orderedColumns.filter(column => !hiddenByTab[tab].includes(columnKey(column))), ...operationColumns];
  const columnOptions: ColumnOption[] = configurableColumns.map(column => ({ key: columnKey(column), label: String(column.title) }));
  const exportRows = () => {
    const rowsToExport = selectedTableRows.length ? selectedTableRows : filtered;
    const headers = tab === 'inventory'
      ? ['托盘码', '品种', '果径', '等级', '包装规格', '库存箱数', '托盘状态', '仓库', '组托时间']
      : tab === 'inbound'
        ? ['入库批次号', '入库托数', '入库箱数', '仓库', '入库时间']
        : ['成品出库批次号', '品种', '果径', '等级', '包装规格', '出库托数', '出库箱数', '标准净重 (kg)', '仓库', '出库时间'];
    const data = rowsToExport.map(row => tab === 'inventory'
      ? [row.code, row.variety, row.size, row.grade, row.spec, row.count, row.palletStatus ?? '', row.warehouse, row.time]
      : tab === 'inbound'
        ? [row.code, row.inbound?.pallet ? 1 : 0, row.count, row.warehouse, row.time]
        : [row.code, row.variety, row.size, row.grade, row.spec, outboundPalletCount(row.outbound), row.count, row.weight, row.warehouse, row.time]);
    exportCsv(headers, data, `成品管理-${tabs.find(item => item.key === tab)!.label}.csv`);
  };
  const clearSelectedRows = () => {
    if (tab === 'inventory') setSelectedInventoryCodes([]);
    if (tab === 'inbound' || tab === 'outbound') setSelectedRecordCodes(current => ({ ...current, [tab]: [] }));
  };
  return <>
    {operation ? <FinishedGoodsOperation key={operation} mode={operation} onView={show} initialPalletCodes={operation === 'dispatch' ? initialPalletCodes : undefined} /> : <div className={`finished-page ds-page-shell${tab === 'pallets' ? ' finished-page-pallets' : ''}`}>
      <Tabs className="finished-tabs" activeKey={tab} items={tabs} onChange={key => { setFilters({}); setFilterTab(key as FinishedTab); setPage(1); location.hash = `/finished-goods/${key}`; }} />
      {tab === 'pallets' ? <PalletManagementPage onView={show} /> : <>
      <FinishedGoodsFilter key={tab} tab={tab} onSearch={values => { setFilters(values); setFilterTab(tab); setSelectedInventoryCodes([]); if (tab === 'inbound' || tab === 'outbound') setSelectedRecordCodes(current => ({ ...current, [tab]: [] })); setPage(1); }} palletCodes={tab === 'inventory' ? stockPalletCodes : undefined} boxCodes={tab === 'inventory' ? stockBoxCodes : undefined} />
      <section className="ds-page-card ds-table-card-padded ds-pro-table-card finished-table-card">
        <TableSelectionToolbar
          className="ds-card-toolbar finished-record-toolbar"
          title={tab === 'inventory' ? '成品库存' : `${tabs.find(item => item.key === tab)!.label}明细`}
          selectedCount={selectedTableRows.length}
          selectedLabel={tab === 'inventory' ? '托盘' : '条'}
          onClear={clearSelectedRows}
          batchActions={<Button onClick={exportRows}>批量导出</Button>}
          fixedActions={<Space size={8}>
            {tab === 'inventory' && <Button type="primary" onClick={() => setOutboundModalOpen(true)}>扫码出库</Button>}
            <Button disabled={!filtered.length} onClick={exportRows}>导出</Button>
            <ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenByTab[tab]} onHiddenKeysChange={keys => setHiddenByTab(current => ({ ...current, [tab]: keys }))} order={orderByTab[tab].length ? orderByTab[tab] : columnOptions.map(column => column.key)} onOrderChange={keys => setOrderByTab(current => ({ ...current, [tab]: keys }))} />
          </Space>}
        />
        <ProTable<ResultRow> key={tab} rowKey="key" columns={columns} dataSource={filtered.slice((page - 1) * pageSize, page * pageSize)} search={false} dateFormatter="string"
          headerTitle={false} toolBarRender={false} options={false}
          rowSelection={{ columnWidth: 40, fixed: true, selectedRowKeys: tab === 'inventory' ? selectedInventoryCodes : selectedRecordKeys, preserveSelectedRowKeys: true, onChange: keys => {
            const nextKeys = keys.map(String);
            if (tab === 'inventory') setSelectedInventoryCodes(nextKeys);
            if (tab === 'inbound' || tab === 'outbound') setSelectedRecordCodes(current => ({ ...current, [tab]: nextKeys }));
          } }}
          tableAlertRender={false} tableAlertOptionRender={false}
          pagination={false}
          scroll={{ x: columns.reduce((sum, col) => sum + Number(col.width ?? 100), 0) }} size="small" locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的成品记录" /> }} />
        <div className="finished-page-pagination">
          <Pagination size="middle" current={filterTab === tab ? page : 1} pageSize={pageSize} total={filtered.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => tab === 'inventory' ? `共 ${total.toLocaleString('zh-CN')} 托盘` : `共 ${total.toLocaleString('zh-CN')} 条记录`} onChange={(nextPage, nextPageSize) => { setPage(nextPageSize !== pageSize ? 1 : nextPage); setPageSize(nextPageSize); }} />
        </div>
      </section>
      </>}
    </div>}
    <PalletBoxDetailModal palletCode={palletModalCode} onClose={() => setPalletModalCode(undefined)} />
    <FinishedGoodsBatchDetailsModal record={recordDetails?.inbound ?? recordDetails?.outbound} onClose={() => setRecordDetails(undefined)} />
    <FinishedGoodsOutboundModal open={outboundModalOpen} onClose={() => setOutboundModalOpen(false)} />
    <FinishedGoodsDetails key={view?.type === 'pallet' ? view.id : 'details'} view={view} onView={openView} onClose={() => setViewStack(previous => previous.slice(0, -1))} onRestore={record => { setViewStack([]); setRestoreBatch(record.id); }} />
    <FinishedRestoreModal key={restoreBatch ?? 'closed'} batch={restoreBatch} onClose={() => setRestoreBatch(undefined)} onComplete={() => setRestoreBatch(undefined)} />
  </>;
}
