// 基于 ant-design-skill 06-ToolbarTable 模板，保留 ProTable、工具栏与 Design Token 容器。
import { useEffect, useState } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Button, Empty, Segmented, Space, Tabs, Tag, Tooltip } from 'antd';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import FinishedGoodsFilter, { type FinishedFilters, type FinishedTab } from '../components/FinishedGoodsFilter';
import FinishedGoodsDetails, { FinishedRestoreDrawer, type FinishedView } from '../components/finished-goods/FinishedGoodsDetails';
import FinishedGoodsOperation from '../components/finished-goods/FinishedGoodsOperation';
import { formatWeight, totalWeight, useFinishedGoods, type FinishedBox, type Inbound, type Outbound, type Pallet } from '../finishedGoods';
import { exportCsv } from '../data';
import './finished-goods.css';

type ResultRow = { key: string; code: string; variety: string; size: string; grade: string; spec: string; warehouse: string; time: string; count: number; weight: number; boxes: FinishedBox[]; box?: FinishedBox; pallet?: Pallet; inbound?: Inbound; outbound?: Outbound };
const tabs: { key: FinishedTab; label: string }[] = [{ key: 'inventory', label: '成品库存' }, { key: 'inbound', label: '入库记录' }, { key: 'outbound', label: '出库记录' }];

export default function FinishedGoodsPage({ hash }: { hash: string }) {
  const { state } = useFinishedGoods();
  const segment = hash.split('/')[2];
  const tab: FinishedTab = tabs.some(item => item.key === segment) ? segment as FinishedTab : 'inventory';
  const operation = segment === 'group' || segment === 'dispatch' ? segment : undefined;
  const [inventoryScope, setInventoryScope] = useState<'stock' | 'all'>(segment === 'pallets' ? 'all' : 'stock');
  // 兼容原托盘管理链接，统一进入库存页的全部托盘视图。
  useEffect(() => {
    if (segment === 'pallets') {
      setInventoryScope('all');
      history.replaceState(null, '', '#/finished-goods/inventory');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [segment]);
  const [filters, setFilters] = useState<FinishedFilters>({});
  const [filterTab, setFilterTab] = useState(tab);
  const [page, setPage] = useState(1);
  const [hiddenByTab, setHiddenByTab] = useState<Record<FinishedTab, string[]>>({ inventory: [], inbound: [], outbound: [] });
  const [orderByTab, setOrderByTab] = useState<Record<FinishedTab, string[]>>({ inventory: [], inbound: [], outbound: [] });
  const [viewStack, setViewStack] = useState<FinishedView[]>([]);
  const [restoreBatch, setRestoreBatch] = useState<string>();
  useEffect(() => { setFilters({}); setFilterTab(tab); setPage(1); }, [tab]);
  const activeFilters = filterTab === tab ? filters : {};
  const view = viewStack.at(-1);
  const show = (next: FinishedView) => setViewStack(previous => [...previous, next]);
  const link = (type: FinishedView['type'], id: string) => <Tooltip title={id}><Button type="link" className="finished-link" onClick={() => show({ type, id })}>{id}</Button></Tooltip>;

  // 成品库存逐箱展示；全部托盘范围包含已经组托过的历史箱，不含待组托箱。
  const inventoryRows: ResultRow[] = state.boxes
    .filter(box => !!box.pallet && (inventoryScope === 'all' || box.state === 'stock'))
    .flatMap(box => {
      const pallet = state.pallets.find(item => item.code === box.pallet);
      if (!pallet) return [];
      return [{ key: box.code, code: box.code, variety: box.variety, size: box.size, grade: box.grade, spec: box.spec, warehouse: box.warehouse ?? pallet.warehouse, time: pallet.time, count: box.state === 'stock' ? 1 : 0, weight: box.state === 'stock' ? box.weight : 0, boxes: [box], box, pallet }];
    });
  const rows: ResultRow[] = tab === 'inventory' ? inventoryRows
    : tab === 'inbound' ? state.inbound.map(inbound => ({ key: inbound.id, code: inbound.pallet, variety: inbound.boxes[0].variety, size: inbound.boxes[0].size, grade: inbound.boxes[0].grade, spec: inbound.boxes[0].spec, warehouse: inbound.warehouse, time: inbound.time, count: inbound.boxes.length, weight: totalWeight(inbound.boxes), boxes: inbound.boxes, inbound }))
    : state.outbound.map(outbound => ({ key: outbound.id, code: outbound.id, variety: outbound.boxes[0]?.variety ?? '', size: outbound.boxes[0]?.size ?? '', grade: outbound.boxes[0]?.grade ?? '', spec: '', warehouse: outbound.warehouse, time: outbound.time, count: outbound.boxes.length, weight: totalWeight(outbound.boxes), boxes: outbound.boxes, outbound }));
  const filtered = rows.filter(row => {
    const f = activeFilters;
    if (f.boxCode?.trim() && !row.boxes.some(box => box.code === f.boxCode!.trim())) return false;
    if (f.palletCode?.trim() && (row.pallet?.code ?? (tab === 'inbound' ? row.code : '')) !== f.palletCode.trim()) return false;
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
  const count = filtered.reduce((sum, row) => sum + row.count, 0);
  const weight = filtered.reduce((sum, row) => sum + row.weight, 0);
  const restoredRows = filtered.filter(row => row.outbound?.restoration);
  const allColumns: ProColumns<ResultRow>[] = [
    { title: tab === 'outbound' ? '成品出库批次号' : tab === 'inventory' ? '箱码' : '托盘码', dataIndex: 'code', width: tab === 'inventory' ? 165 : 205, ellipsis: true, render: (_, row) => link(tab === 'outbound' ? 'outbound' : tab === 'inventory' ? 'box' : 'pallet', row.code) },
    ...(tab === 'inventory' ? [
      { title: '托盘码', width: 165, render: (_, row) => link('pallet', row.pallet!.code) },
      { title: '品种', dataIndex: 'variety', width: 85 }, { title: '果径', dataIndex: 'size', width: 55 }, { title: '等级', dataIndex: 'grade', width: 65 }, { title: '包装规格', dataIndex: 'spec', width: 130 },
      ...(inventoryScope === 'all' ? [{ title: '当前状态', width: 105, render: (_: unknown, row: ResultRow) => <Tag color={row.box!.state === 'stock' ? 'success' : 'default'}>{row.box!.state === 'stock' ? '在库' : '已出库'}</Tag> }] : []),
      { title: '单箱净重 (kg)', width: 115, render: (_: unknown, row: ResultRow) => formatWeight(row.box!.weight) },
    ] as ProColumns<ResultRow>[] : tab === 'inbound' ? [
      { title: '品种', dataIndex: 'variety', width: 100 }, { title: '果径', dataIndex: 'size', width: 80 }, { title: '等级', dataIndex: 'grade', width: 90 }, { title: '包装规格', dataIndex: 'spec', width: 165 },
      { title: '入库箱数', dataIndex: 'count', width: 105 }, { title: '标准净重合计 (kg)', dataIndex: 'weight', width: 155, render: (_: unknown, row: ResultRow) => formatWeight(row.weight) },
    ] : [
      { title: '出库单号', width: 195, render: (_: unknown, row: ResultRow) => <Button type="link" className="finished-link" onClick={() => show({ type: 'document', id: row.key })}>{row.outbound!.document}</Button> },
      { title: '原出库箱数', dataIndex: 'count', width: 115 }, { title: '标准净重合计 (kg)', dataIndex: 'weight', width: 160, render: (_: unknown, row: ResultRow) => formatWeight(row.weight) },
    ] as ProColumns<ResultRow>[]),
    { title: '仓库', dataIndex: 'warehouse', width: tab === 'inventory' ? 90 : 110 },
    ...(tab === 'inbound' || tab === 'outbound' ? [{ title: tab === 'inbound' ? '确认人' : '操作人', width: 100, render: () => '管理员' }] as ProColumns<ResultRow>[] : []),
    { title: tab === 'inventory' ? '组托时间' : tab === 'outbound' ? '出库时间' : '入库时间', dataIndex: 'time', width: tab === 'inventory' ? 130 : 180 },
    ...(tab === 'outbound' ? [{ title: '恢复状态', width: 130, render: (_, row) => <Tag color={row.outbound!.restoration ? 'success' : 'default'}>{row.outbound!.restoration ? '已恢复库存' : '未恢复'}</Tag> }] as ProColumns<ResultRow>[] : []),
    { title: '操作', key: 'option', fixed: 'right', width: tab === 'inventory' ? 85 : 220, render: (_: unknown, row: ResultRow) => tab === 'inventory' ? <Button type="link" className="finished-link" onClick={() => show({ type: 'box', id: row.code })}>箱详情</Button> : <Space size={12} className="table-action-cell"><Button type="link" className="finished-link" onClick={() => show({ type: tab === 'inbound' ? 'inbound' : 'outbound', id: row.key })}>详情</Button>{tab === 'outbound' && <Button type="link" className="finished-link" disabled={!!row.outbound!.restoration} onClick={() => setRestoreBatch(row.key)}>整批恢复</Button>}</Space> },
  ];
  const columnKey = (column: ProColumns<ResultRow>) => String(column.key ?? column.dataIndex ?? column.title);
  const configurableColumns = allColumns.filter(column => columnKey(column) !== 'option');
  const orderedColumns = [...configurableColumns].sort((left, right) => {
    const leftIndex = orderByTab[tab].indexOf(columnKey(left));
    const rightIndex = orderByTab[tab].indexOf(columnKey(right));
    return (leftIndex < 0 ? configurableColumns.indexOf(left) : leftIndex) - (rightIndex < 0 ? configurableColumns.indexOf(right) : rightIndex);
  });
  const columns = [...orderedColumns.filter(column => !hiddenByTab[tab].includes(columnKey(column))), ...allColumns.filter(column => columnKey(column) === 'option')];
  const columnOptions: ColumnOption[] = configurableColumns.map(column => ({ key: columnKey(column), label: String(column.title) }));
  const exportRows = () => exportCsv(tab === 'inventory' ? ['箱码', '托盘码', '品种', '果径', '等级', '包装规格', '当前状态', '每箱标准净重 (kg)', '仓库', '组托时间'] : ['托盘码 / 批次号', '品种', '果径', '等级', '包装规格', '箱数', '标准净重 (kg)', '仓库', '时间', '恢复状态'], filtered.map(row => tab === 'inventory' ? [row.code, row.pallet?.code ?? '', row.variety, row.size, row.grade, row.spec, row.box?.state === 'stock' ? '在库' : '已出库', row.box?.weight ?? 0, row.warehouse, row.time] : [row.code, row.variety, row.size, row.grade, row.spec, row.count, row.weight, row.warehouse, row.time, row.outbound ? row.outbound.restoration ? '已恢复库存' : '未恢复' : '—']), `成品管理-${tabs.find(item => item.key === tab)!.label}.csv`);
  return <>
    {operation ? <FinishedGoodsOperation key={operation} mode={operation} onView={show} /> : <div className="finished-page ds-page-shell">
      <Tabs className="finished-tabs" activeKey={tab} items={tabs} onChange={key => { setFilters({}); setFilterTab(key as FinishedTab); setPage(1); location.hash = `/finished-goods/${key}`; }} />
      <FinishedGoodsFilter key={tab} tab={tab} onSearch={values => { setFilters(values); setFilterTab(tab); setPage(1); }} />
      <section className="finished-stats" aria-label="成品汇总">
        <div className="ds-page-card finished-stat"><span>{tab === 'outbound' ? '原始出库箱数' : tab === 'inbound' ? '入库箱数' : '当前在库箱数'}</span><strong data-testid="finished-count">{count}<small>箱</small></strong></div>
        <div className="ds-page-card finished-stat"><span>{tab === 'inventory' ? '当前在库标准净重' : '标准净重合计'}</span><strong data-testid="finished-weight">{formatWeight(weight)}<small>kg</small></strong></div>
        <div className="ds-page-card finished-stat"><span>{tab === 'outbound' ? '已恢复库存（单独统计）' : tab === 'inventory' && inventoryScope === 'all' ? '托盘记录（包含历史）' : tab === 'inbound' ? '组托入库次数' : '涉及托盘'}</span><strong>{tab === 'outbound' ? restoredRows.reduce((sum, row) => sum + row.count, 0) : tab === 'inventory' ? new Set(filtered.map(row => row.pallet?.code).filter(Boolean)).size : filtered.length}<small>{tab === 'outbound' ? `箱 / ${formatWeight(restoredRows.reduce((sum, row) => sum + row.weight, 0))} kg` : tab === 'inbound' ? '次' : '托'}</small></strong></div>
      </section>
      <div className="finished-stat-caption">{tab === 'inventory' ? '逐箱展示 · 汇总随查询条件更新 · 重量按每箱标准净重合计' : '按查询范围汇总 · 历史记录保留当次事实 · 恢复库存不计为新增组托入库'}</div>
      <section className="ds-page-card ds-table-card-padded ds-pro-table-card finished-table-card">
        <ProTable<ResultRow> key={tab} rowKey="key" columns={columns} dataSource={filtered} search={false} dateFormatter="string" options={{ density: false, reload: false, setting: false }}
          headerTitle={tab === 'inventory' ? '成品箱库存明细' : `${tabs.find(item => item.key === tab)!.label}明细`} toolBarRender={() => [tab === 'inventory' ? <Segmented key="scope" aria-label="托盘显示范围" value={inventoryScope} options={[{ value: 'stock', label: '当前在库' }, { value: 'all', label: '全部托盘' }]} onChange={value => { setInventoryScope(value === 'all' ? 'all' : 'stock'); setPage(1); }} /> : null, <Button key="export" disabled={!filtered.length} onClick={exportRows}>导出查询结果</Button>, <ColumnSettingsPopover key="settings" columns={columnOptions} hiddenKeys={hiddenByTab[tab]} onHiddenKeysChange={keys => setHiddenByTab(current => ({ ...current, [tab]: keys }))} order={orderByTab[tab].length ? orderByTab[tab] : columnOptions.map(column => column.key)} onOrderChange={keys => setOrderByTab(current => ({ ...current, [tab]: keys }))} />]}
          pagination={{ current: filterTab === tab ? page : 1, onChange: setPage, defaultPageSize: 10, showSizeChanger: true, showQuickJumper: true, showTotal: total => tab === 'inventory' ? `共 ${total} 箱` : `共 ${total} 条记录` }}
          scroll={{ x: columns.reduce((sum, col) => sum + Number(col.width ?? 100), 0) }} size="small" locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的成品记录" /> }} />
      </section>
    </div>}
    <FinishedGoodsDetails key={view?.type === 'pallet' ? view.id : 'details'} view={view} onView={show} onClose={() => setViewStack(previous => previous.slice(0, -1))} onRestore={record => { setViewStack([]); setRestoreBatch(record.id); }} />
    <FinishedRestoreDrawer key={restoreBatch ?? 'closed'} batch={restoreBatch} onClose={() => setRestoreBatch(undefined)} onComplete={id => { setRestoreBatch(undefined); setViewStack([{ type: 'outbound', id }]); }} />
  </>;
}
