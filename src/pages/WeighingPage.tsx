// 基于 ant-design-skill ToolbarTable 模板，保留卡片、工具栏、ProTable 分区。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Key } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { App, Badge, Button, Checkbox, Descriptions, Drawer, Empty, Pagination, Space, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined } from '@ant-design/icons';
import FilterPanel from '../components/FilterPanel';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import { exportCsv, filterRecords, initialFilters, records, summarize, type FilterValues, type WeighingRecord, type WorkerSummary } from '../data';
import { FLOATING_LAYER_WIDTHS, getDrawerStyles } from '../components/floatingLayer';

const statusNode = (status: WeighingRecord['status']) => <Badge status={status === 'valid' ? 'success' : 'default'} text={status === 'valid' ? '有效' : '作废'} />;
type WeighingTab = 'detail' | 'summary';
const getTab = (): WeighingTab => location.hash.includes('/summary') ? 'summary' : 'detail';

export default function WeighingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const tableCardRef = useRef<HTMLElement>(null);
  const [tableScrollY, setTableScrollY] = useState(320);
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // 筛选项换行时同步预留高度，确保固定区不会遮挡下方表格。
    const updateHeight = () => pageRef.current?.style.setProperty('--page-controls-height', `${controls.getBoundingClientRect().height}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(controls);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const card = tableCardRef.current;
    if (!card) return;
    const updateScrollHeight = () => {
      const toolbar = card.querySelector<HTMLElement>('.ds-card-toolbar');
      const footer = card.querySelector<HTMLElement>('.table-footer');
      const tableHead = card.querySelector<HTMLElement>('.ant-table-thead');
      if (!toolbar || !footer || !tableHead) return;
      const style = getComputedStyle(card);
      const reserved = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        + toolbar.offsetHeight + parseFloat(getComputedStyle(toolbar).marginBottom)
        + footer.offsetHeight + parseFloat(getComputedStyle(footer).marginTop)
        + tableHead.offsetHeight;
      // 表格滚动区填满分页前可用高度，分页分隔线上方仍保留 footer 的 16px 间距。
      setTableScrollY(Math.max(96, Math.floor(card.clientHeight - reserved)));
    };
    updateScrollHeight();
    const observer = new ResizeObserver(updateScrollHeight);
    observer.observe(card);
    window.addEventListener('resize', updateScrollHeight);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateScrollHeight); };
  }, []);
  const { message } = App.useApp();
  const [tab, setTab] = useState<WeighingTab>(getTab);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Key[]>([]);
  const [hiddenByTab, setHiddenByTab] = useState<Record<'detail' | 'summary', string[]>>({ detail: [], summary: [] });
  const [orderByTab, setOrderByTab] = useState<Record<'detail' | 'summary', string[]>>({ detail: [], summary: [] });
  const [batchHiddenColumns, setBatchHiddenColumns] = useState<string[]>([]);
  const [batchColumnOrder, setBatchColumnOrder] = useState<string[]>([]);
  const [record, setRecord] = useState<WeighingRecord>();
  const [batchCode, setBatchCode] = useState<string>();
  useEffect(() => {
    if (!location.hash) history.replaceState(null, '', '#/weighing/detail');
    const change = () => { setTab(getTab()); setPage(1); setSelected([]); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const filtered = useMemo(() => filterRecords(records, filters), [filters]);
  const summaries = useMemo(() => summarize(filtered), [filtered]);
  const detail = tab === 'detail';
  const hidden = hiddenByTab[tab];
  const total = detail ? filtered.length : summaries.length;
  const query = (values: FilterValues) => { setFilters(values); setPage(1); setSelected([]); };
  const pageRecords = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: ProColumns<WeighingRecord>[] = [
    { title: <Checkbox aria-label="选择本页全部记录" checked={pageRecords.length > 0 && pageRecords.every(row => selected.includes(row.id))} indeterminate={pageRecords.some(row => selected.includes(row.id)) && !pageRecords.every(row => selected.includes(row.id))} onChange={event => setSelected(previous => event.target.checked ? [...new Set([...previous, ...pageRecords.map(row => row.id)])] : previous.filter(id => !pageRecords.some(row => row.id === id)))} />, key: 'selection', width: 48, fixed: 'left', align: 'center', render: (_, row) => <Checkbox aria-label={`选择${row.code}称重记录`} checked={selected.includes(row.id)} onChange={event => setSelected(previous => event.target.checked ? [...new Set([...previous, row.id])] : previous.filter(id => id !== row.id))} /> },
    { title: '称重时间', dataIndex: 'time', width: 152 },
    { title: '工人姓名', dataIndex: 'worker', width: 96 },
    { title: '工号', dataIndex: 'workerId', width: 80 },
    { title: '大棚号', dataIndex: 'greenhouse', width: 88 },
    { title: '班组', dataIndex: 'team', width: 72 },
    { title: '品种', dataIndex: 'variety', width: 96 },
    { title: '果径', dataIndex: 'size', width: 64, align: 'center' },
    { title: '等级', dataIndex: 'grade', width: 76 },
    { title: '净重（桶/kg）', dataIndex: 'weight', width: 150, align: 'right', render: (_, row) => <span className="weight-value">{row.weight.toFixed(2)}</span> },
    { title: '记录状态', dataIndex: 'status', width: 92, render: (_, row) => statusNode(row.status) },
    { title: '操作', key: 'action', width: 80, fixed: 'right', align: 'center', render: (_, row) => <Space size={8} className="table-action-cell weigh-action-cell"><Button type="link" className="cell-link" onClick={() => setRecord(row)}>查看</Button></Space> },
  ];
  const summaryColumns: ProColumns<WorkerSummary>[] = [
    { title: '工人姓名', dataIndex: 'worker', width: 100 },
    { title: '工号', dataIndex: 'workerId', width: 82 },
    { title: '班组', dataIndex: 'teams', width: 100 },
    { title: '称重记录数', dataIndex: 'count', width: 110, align: 'right' },
    { title: '有效记录数', dataIndex: 'validCount', width: 110, align: 'right' },
    { title: '作废记录数', dataIndex: 'voidCount', width: 110, align: 'right' },
    { title: '有效净重合计（kg）', dataIndex: 'weight', width: 178, align: 'right', render: (_, row) => <strong>{row.weight.toFixed(2)}</strong> },
  ];
  const activeColumns = detail ? columns : summaryColumns;
  const columnKey = (column: { key?: Key; dataIndex?: unknown }) => String(column.key ?? column.dataIndex);
  const fixedColumnKeys = ['selection'];
  const configurableColumns = activeColumns.filter(column => ![...fixedColumnKeys, 'action'].includes(columnKey(column)));
  const columnOptions: ColumnOption[] = configurableColumns.map(column => ({ key: columnKey(column), label: String(column.title) }));
  const setColumnVisible = (key: string, visible: boolean) => setHiddenByTab(previous => ({
    ...previous,
    [tab]: visible ? previous[tab].filter(hiddenKey => hiddenKey !== key) : [...previous[tab], key],
  }));
  const arrangeColumns = <T,>(source: ProColumns<T>[]) => {
    const fixedKeys = ['selection'];
    const configurable = source.filter(column => ![...fixedKeys, 'action'].includes(columnKey(column)));
    const ordered = [...configurable].sort((left, right) => {
      const leftIndex = orderByTab[tab].indexOf(columnKey(left));
      const rightIndex = orderByTab[tab].indexOf(columnKey(right));
      return (leftIndex < 0 ? configurable.indexOf(left) : leftIndex) - (rightIndex < 0 ? configurable.indexOf(right) : rightIndex);
    });
    return [
      ...source.filter(column => fixedKeys.includes(columnKey(column))),
      ...ordered.filter(column => !hidden.includes(columnKey(column))),
      ...source.filter(column => columnKey(column) === 'action'),
    ];
  };
  const detailColumns = arrangeColumns(columns);
  const workerColumns = arrangeColumns(summaryColumns);
  const visibleActiveColumns = detail ? detailColumns : workerColumns;
  const activeTableScrollWidth = visibleActiveColumns.reduce((sum, column) => sum + Number(column.width ?? 100), detail ? 0 : 42);

  const exportData = (selectedOnly = false) => {
    if (detail) {
      const rows = selectedOnly || selected.length ? filtered.filter(row => selected.includes(row.id)) : filtered;
      exportCsv(['筐称重码', '称重时间', '工人姓名', '工号', '大棚号', '班组', '品种', '果径', '等级', '净重（桶/kg）', '记录状态'], rows.map(row => [row.code, row.time, row.worker, row.workerId, row.greenhouse, row.team, row.variety, row.size, row.grade, row.weight.toFixed(2), row.status === 'valid' ? '有效' : '作废']), '逐桶称重明细.csv');
      message.success(`已导出${selectedOnly ? '所选' : ''} ${rows.length} 条称重记录`);
    } else {
      const rows = selectedOnly || selected.length ? summaries.filter(row => selected.includes(row.workerId)) : summaries;
      exportCsv(['工人姓名', '工号', '班组', '称重记录数', '有效记录数', '作废记录数', '有效净重合计（kg）'], rows.map(row => [row.worker, row.workerId, row.teams, row.count, row.validCount, row.voidCount, row.weight.toFixed(2)]), '工人产量汇总.csv');
      message.success(`已导出${selected.length ? '所选' : ''} ${rows.length} 位工人的产量汇总`);
    }
  };
  const batch = records.filter(row => row.code === batchCode);
  const batchColumns: ColumnsType<WeighingRecord> = [
    { title: '工人姓名', key: 'worker', dataIndex: 'worker', width: '34%' },
    { title: '桶净重（kg）', key: 'weight', dataIndex: 'weight', width: '33%', align: 'right', render: (_, row) => <span className="weigh-batch-weight">{row.weight.toFixed(2)}</span> },
    { title: '称重时间', key: 'time', dataIndex: 'time', width: '33%' },
  ];
  const batchColumnOptions: ColumnOption[] = batchColumns.map(column => ({ key: String(column.key), label: String(column.title) }));
  const orderedBatchColumns = [...batchColumns].sort((left, right) => {
    const order = batchColumnOrder.length ? batchColumnOrder : batchColumnOptions.map(column => column.key);
    return order.indexOf(String(left.key)) - order.indexOf(String(right.key));
  }).filter(column => !batchHiddenColumns.includes(String(column.key)));
  return <div ref={pageRef} className="ds-page-shell weighing-page">
    <div ref={controlsRef} className="page-controls">
    <section className="page-tabs"><Tabs activeKey={tab} onChange={key => { setTab(key as WeighingTab); location.hash = `/weighing/${key}`; }} items={[{ key: 'detail', label: '逐桶称重明细' }, { key: 'summary', label: '工人产量汇总' }]} /></section>
    <FilterPanel onSearch={query} />
    </div>
    <section ref={tableCardRef} className="ds-page-card ds-table-card-padded ds-pro-table-card weigh-table-card">
      <TableSelectionToolbar className="ds-card-toolbar" title={detail ? '逐桶称重明细' : '工人产量汇总'} selectedCount={selected.length} onClear={() => setSelected([])}
        batchActions={<Button onClick={() => exportData(true)}>批量导出</Button>}
        fixedActions={<Space size={8}><Button onClick={() => exportData()} disabled={!total}>导出</Button>
        <ColumnSettingsPopover
          columns={columnOptions}
          hiddenKeys={hidden}
          onHiddenKeysChange={keys => setHiddenByTab(previous => ({ ...previous, [tab]: keys }))}
          order={orderByTab[tab].length ? orderByTab[tab] : columnOptions.map(column => column.key)}
          onOrderChange={keys => setOrderByTab(previous => ({ ...previous, [tab]: keys }))}
        /></Space>} />
      {detail ? <ProTable<WeighingRecord>
        rowKey="id" size="small" columns={detailColumns} dataSource={pageRecords}
        search={false} options={false} toolBarRender={false} tableAlertRender={false} tableAlertOptionRender={false} pagination={false} dateFormatter="string"
        scroll={{ x: activeTableScrollWidth, y: tableScrollY }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的称重记录" /> }}
      /> : <ProTable<WorkerSummary>
        rowKey="workerId" size="small" columns={workerColumns} dataSource={summaries.slice((page - 1) * pageSize, page * pageSize)}
        search={false} options={false} toolBarRender={false} tableAlertRender={false} tableAlertOptionRender={false} pagination={false} rowSelection={{ selectedRowKeys: selected, onChange: keys => setSelected(keys), columnWidth: 42, preserveSelectedRowKeys: true }} scroll={{ x: activeTableScrollWidth, y: tableScrollY }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的工人产量" /> }}
      />}
      <div className="table-footer"><span className="record-total">共 {total.toLocaleString('en-US')} 项数据</span><Pagination current={page} total={total} pageSize={pageSize} pageSizeOptions={[10, 20, 50, 100]} showSizeChanger showQuickJumper onChange={(nextPage, nextSize) => { setPage(nextSize !== pageSize ? 1 : nextPage); setPageSize(nextSize); }} /></div>
    </section>
    <Drawer open={!!record} onClose={() => setRecord(undefined)} width={FLOATING_LAYER_WIDTHS.detailDrawer} closable={false} title={<Space><Button type="text" aria-label="关闭称重记录详情" icon={<ArrowLeftOutlined />} onClick={() => setRecord(undefined)} />称重记录详情</Space>} styles={getDrawerStyles()}>
      {record && <Descriptions column={1} bordered size="small" items={[
        { key: 'code', label: '筐称重码', children: record.code },
        { key: 'time', label: '称重时间', children: record.time },
        { key: 'worker', label: '工人姓名', children: record.worker },
        { key: 'workerId', label: '工号', children: record.workerId },
        { key: 'greenhouse', label: '大棚号', children: record.greenhouse },
        { key: 'team', label: '班组', children: record.team },
        { key: 'variety', label: '品种', children: record.variety },
        { key: 'size', label: '果径', children: record.size },
        { key: 'grade', label: '等级', children: record.grade },
        { key: 'weight', label: '净重（桶/kg）', children: `${record.weight.toFixed(2)} kg` },
        { key: 'status', label: '记录状态', children: statusNode(record.status) },
      ]} />}
    </Drawer>
    <Drawer className="raw-drawer" open={!!batchCode} onClose={() => setBatchCode(undefined)} width={FLOATING_LAYER_WIDTHS.detailDrawer} closable={false} title={<Space><Button type="text" aria-label="关闭筐详情" icon={<ArrowLeftOutlined />} onClick={() => setBatchCode(undefined)} />筐详情</Space>} styles={getDrawerStyles()}>
      {batchCode && <>
        <TableSelectionToolbar title="逐桶称重记录" selectedCount={0} onClear={() => undefined} className="raw-detail-table-toolbar" fixedActions={<Space size={8}>
          <Button onClick={() => exportCsv(['称重时间', '工人姓名', '工号', '净重(kg)', '记录状态'], batch.map(row => [row.time, row.worker, row.workerId, row.weight.toFixed(2), row.status === 'valid' ? '有效' : '作废']), '逐桶称重明细.csv')} disabled={!batch.length}>导出</Button>
          <ColumnSettingsPopover columns={batchColumnOptions} hiddenKeys={batchHiddenColumns} onHiddenKeysChange={setBatchHiddenColumns} order={batchColumnOrder.length ? batchColumnOrder : batchColumnOptions.map(column => column.key)} onOrderChange={setBatchColumnOrder} />
        </Space>} />
        <Table className="weigh-batch-table" rowKey="id" size="small" dataSource={batch} pagination={false} columns={orderedBatchColumns} scroll={{ x: 560 }} />
      </>}
    </Drawer>
  </div>;
}
