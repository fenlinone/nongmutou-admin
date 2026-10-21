// 基于 ant-design-skill ToolbarTable 模板，保留卡片、工具栏、ProTable 分区。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Key } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Alert, App, Badge, Button, Checkbox, Descriptions, Empty, Modal, Pagination, Space, Table, Tabs, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import FilterPanel from '../components/FilterPanel';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import { exportCsv, filterRecords, initialFilters, records, summarize, type FilterValues, type WeighingRecord, type WorkerSummary } from '../data';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../components/floatingLayer';

const floating = { detailWidth: FLOATING_LAYER_WIDTHS.complexModal, batchWidth: FLOATING_LAYER_WIDTHS.detailModal };
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
  const [record, setRecord] = useState<WeighingRecord>();
  const [batchCode, setBatchCode] = useState<string>();
  const [worker, setWorker] = useState<WorkerSummary>();
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
    { title: '序号', key: 'index', width: 64, fixed: 'left', align: 'center', render: (_, __, index) => (page - 1) * pageSize + index + 1 },
    { title: '筐称重码', dataIndex: 'code', width: 176, fixed: 'left', render: (_, row) => <Button type="link" className="cell-link" onClick={() => setBatchCode(row.code)}>{row.code}</Button> },
    { title: '称重时间', dataIndex: 'time', width: 152 },
    { title: '工人姓名', dataIndex: 'worker', width: 96 },
    { title: '工号', dataIndex: 'workerId', width: 80 },
    { title: '大棚号', dataIndex: 'greenhouse', width: 88 },
    { title: '班组', dataIndex: 'team', width: 72 },
    { title: '品种', dataIndex: 'variety', width: 96 },
    { title: '果径', dataIndex: 'size', width: 64, align: 'center' },
    { title: '等级', dataIndex: 'grade', width: 76 },
    { title: '净重（桶/kg）', dataIndex: 'weight', width: 118, align: 'right', render: (_, row) => <span className="weight-value">{row.weight.toFixed(2)}</span> },
    { title: '记录状态', dataIndex: 'status', width: 92, render: (_, row) => statusNode(row.status) },
    { title: '操作', key: 'action', width: 80, fixed: 'right', align: 'center', render: (_, row) => <Space size={8} className="table-action-cell"><Button type="link" className="cell-link" onClick={() => setRecord(row)}>查看</Button></Space> },
  ];
  const summaryColumns: ProColumns<WorkerSummary>[] = [
    { title: '序号', key: 'index', width: 56, align: 'center', render: (_, __, index) => index + 1 },
    { title: '工人姓名', dataIndex: 'worker', width: 100 },
    { title: '工号', dataIndex: 'workerId', width: 82 },
    { title: '班组', dataIndex: 'teams', width: 100 },
    { title: '称重记录数', dataIndex: 'count', width: 110, align: 'right' },
    { title: '有效记录数', dataIndex: 'validCount', width: 110, align: 'right' },
    { title: '作废记录数', dataIndex: 'voidCount', width: 110, align: 'right' },
    { title: '有效净重合计（kg）', dataIndex: 'weight', width: 178, align: 'right', render: (_, row) => <strong>{row.weight.toFixed(2)}</strong> },
    { title: '操作', key: 'action', width: 80, fixed: 'right', align: 'center', render: (_, row) => <Button type="link" className="cell-link" onClick={() => setWorker(row)}>查看</Button> },
  ];
  const activeColumns = detail ? columns : summaryColumns;
  const columnKey = (column: { key?: Key; dataIndex?: unknown }) => String(column.key ?? column.dataIndex);
  const fixedColumnKeys = ['selection', 'index', ...(detail ? ['code'] : [])];
  const configurableColumns = activeColumns.filter(column => ![...fixedColumnKeys, 'action'].includes(columnKey(column)));
  const columnOptions: ColumnOption[] = configurableColumns.map(column => ({ key: columnKey(column), label: String(column.title) }));
  const setColumnVisible = (key: string, visible: boolean) => setHiddenByTab(previous => ({
    ...previous,
    [tab]: visible ? previous[tab].filter(hiddenKey => hiddenKey !== key) : [...previous[tab], key],
  }));
  const arrangeColumns = <T,>(source: ProColumns<T>[]) => {
    const fixedKeys = ['selection', 'index', ...(detail ? ['code'] : [])];
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

  const exportData = () => {
    if (detail) {
      const rows = selected.length ? filtered.filter(row => selected.includes(row.id)) : filtered;
      exportCsv(['筐称重码', '称重时间', '工人姓名', '工号', '大棚号', '班组', '品种', '果径', '等级', '净重（桶/kg）', '记录状态'], rows.map(row => [row.code, row.time, row.worker, row.workerId, row.greenhouse, row.team, row.variety, row.size, row.grade, row.weight.toFixed(2), row.status === 'valid' ? '有效' : '作废']), '逐桶称重明细.csv');
      message.success(`已导出 ${rows.length} 条称重记录`);
    } else {
      const rows = selected.length ? summaries.filter(row => selected.includes(row.workerId)) : summaries;
      exportCsv(['工人姓名', '工号', '班组', '称重记录数', '有效记录数', '作废记录数', '有效净重合计（kg）'], rows.map(row => [row.worker, row.workerId, row.teams, row.count, row.validCount, row.voidCount, row.weight.toFixed(2)]), '工人产量汇总.csv');
      message.success(`已导出${selected.length ? '所选' : ''} ${rows.length} 位工人的产量汇总`);
    }
  };
  const batch = records.filter(row => row.code === batchCode);
  return <div ref={pageRef} className="ds-page-shell weighing-page">
    <div ref={controlsRef} className="page-controls">
    <section className="page-tabs"><Tabs activeKey={tab} onChange={key => { setTab(key as WeighingTab); location.hash = `/weighing/${key}`; }} items={[{ key: 'detail', label: '逐桶称重明细' }, { key: 'summary', label: '工人产量汇总' }]} /></section>
    <FilterPanel onSearch={query} />
    </div>
    <section ref={tableCardRef} className="ds-page-card ds-table-card-padded ds-pro-table-card weigh-table-card">
      <TableSelectionToolbar className="ds-card-toolbar" title={detail ? '逐桶称重明细' : '工人产量汇总'} selectedCount={selected.length} onClear={() => setSelected([])} actions={<Space size={8}>
        <Button aria-label={selected.length > 0 ? '导出所选' : '导出'} icon={<DownloadOutlined />} onClick={exportData} disabled={!total}>{selected.length > 0 ? '导出所选' : '导出'}</Button>
        <ColumnSettingsPopover
          columns={columnOptions}
          hiddenKeys={hidden}
          onHiddenKeysChange={keys => setHiddenByTab(previous => ({ ...previous, [tab]: keys }))}
          order={orderByTab[tab].length ? orderByTab[tab] : columnOptions.map(column => column.key)}
          onOrderChange={keys => setOrderByTab(previous => ({ ...previous, [tab]: keys }))}
          singleColumn
        />
      </Space>} />
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
    <Modal title="称重记录详情" open={!!record} onCancel={() => setRecord(undefined)} centered footer={null} width={floating.detailWidth} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} className="business-modal">
      {record && <><Descriptions column={2} bordered size="small" items={[
        { key: 'time', label: '称重时间', children: record.time }, { key: 'weight', label: '净重（桶/kg）', children: `${record.weight.toFixed(2)} kg` },
        { key: 'worker', label: '工人姓名', children: record.worker }, { key: 'workerId', label: '工号', children: record.workerId },
        { key: 'greenhouse', label: '大棚号', children: record.greenhouse }, { key: 'team', label: '班组', children: record.team },
        { key: 'variety', label: '品种', children: record.variety }, { key: 'size', label: '果径', children: record.size },
        { key: 'grade', label: '等级', children: record.grade }, { key: 'status', label: '记录状态', children: statusNode(record.status) },
        { key: 'code', label: '所属筐称重码', children: record.code, span: 2 },
      ]} />{record.status === 'void' && <Alert className="detail-note" type="warning" showIcon title="该记录已作废，不计入工人有效产量。" />}</>}
    </Modal>
    <Modal title={<div className="weigh-batch-title"><span>筐称重明细</span><span className="weigh-batch-code">{batchCode}</span></div>} open={!!batchCode} onCancel={() => setBatchCode(undefined)} centered footer={null} width={floating.batchWidth} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} className="business-modal weigh-batch-modal">
      <div className="weigh-batch-summary">
        <div className="weigh-batch-stat"><span className="weigh-batch-stat-label">逐桶记录</span><strong>{batch.length}<small> 条</small></strong></div>
        <div className="weigh-batch-stat weigh-batch-stat-weight"><span className="weigh-batch-stat-label">有效净重合计</span><strong>{batch.filter(row => row.status === 'valid').reduce((sum, row) => sum + row.weight, 0).toFixed(2)}<small> kg</small></strong></div>
      </div>
      <Table className="weigh-batch-table" rowKey="id" size="middle" dataSource={batch} pagination={false} columns={[
        { title: '称重时间', dataIndex: 'time', width: '38%' },
        { title: '工人', dataIndex: 'worker', width: '18%' },
        { title: '净重（桶/kg）', dataIndex: 'weight', width: '28%', align: 'right', render: (value: number) => <span className="weigh-batch-weight">{value.toFixed(2)}</span> },
        { title: '状态', dataIndex: 'status', width: '16%', render: statusNode },
      ]} />
    </Modal>
    <Modal title={`工人产量 · ${worker?.worker ?? ''}`} open={!!worker} onCancel={() => setWorker(undefined)} centered footer={null} width={floating.batchWidth} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} className="business-modal worker-detail-modal">
      {worker && <>
        <div className="worker-detail-summary">
          <div><span>工号：</span><strong>{worker.workerId}</strong></div>
          <div><span>有效记录：</span><strong>{worker.validCount}<small> 条</small></strong></div>
          <div><span>有效产量：</span><strong>{worker.weight.toFixed(2)}<small> kg</small></strong></div>
        </div>
        <Table rowKey="id" size="small" dataSource={filtered.filter(row => row.workerId === worker.workerId)} pagination={{ defaultPageSize: 10, showSizeChanger: true, showQuickJumper: true, pageSizeOptions: [10, 20, 50, 100], showTotal: total => `共 ${total} 项数据` }} columns={[
          { title: '称重时间', dataIndex: 'time', width: 160 },
          { title: '大棚号', dataIndex: 'greenhouse', width: 90 },
          { title: '班组', dataIndex: 'team', width: 80 },
          { title: '品种', dataIndex: 'variety', width: 96 },
          { title: '果径', dataIndex: 'size', width: 72, align: 'center' },
          { title: '等级', dataIndex: 'grade', width: 84 },
          { title: '净重（桶/kg）', dataIndex: 'weight', width: 120, align: 'right', render: (value: number) => value.toFixed(2) },
          { title: '状态', dataIndex: 'status', width: 84, render: statusNode },
        ]} scroll={{ x: 826 }} />
      </>}
    </Modal>
  </div>;
}
