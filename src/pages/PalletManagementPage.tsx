import { useEffect, useState } from 'react';
import { App, Button, Empty, Form, Input, Modal, Pagination, Select, Space, Table, Tooltip } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import FinishedGoodsFilter, { type FinishedFilters } from '../components/FinishedGoodsFilter';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import { exportCsv } from '../data';
import { formatWeight, totalWeight, useFinishedGoods, type FinishedBox, type Pallet } from '../finishedGoods';
import { FLOATING_LAYER_MAX_WIDTH, getModalStyles } from '../components/floatingLayer';
import FinishedGoodsOperation from '../components/finished-goods/FinishedGoodsOperation';
import type { FinishedView } from '../components/finished-goods/FinishedGoodsDetails';
import './pallet-management.css';

const PALLET_DETAIL_MODAL_WIDTH = 1280;

type PalletRow = {
  key: string;
  pallet: Pallet;
  boxes: FinishedBox[];
  currentBoxes: FinishedBox[];
  variety: string;
  size: string;
  grade: string;
  spec: string;
};

type PalletBoxFilters = { boxCode?: string; variety?: string; size?: string; grade?: string; spec?: string };

function summarize(values: string[]) {
  return [...new Set(values.filter(Boolean))].join('、') || '—';
}

export default function PalletManagementPage({ onView }: { onView: (view: FinishedView) => void }) {
  const { state } = useFinishedGoods();
  const { message } = App.useApp();
  const [filters, setFilters] = useState<FinishedFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedPalletCodes, setSelectedPalletCodes] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [palletModalCode, setPalletModalCode] = useState<string>();
  const [groupingOpen, setGroupingOpen] = useState(false);

  const rows: PalletRow[] = state.pallets.map(pallet => {
    const boxes = state.boxes.filter(box => pallet.codes.includes(box.code));
    return {
      key: pallet.code,
      pallet,
      boxes,
      currentBoxes: boxes.filter(box => box.state === 'stock'),
      variety: summarize(boxes.map(box => box.variety)),
      size: summarize(boxes.map(box => box.size)),
      grade: summarize(boxes.map(box => box.grade)),
      spec: summarize(boxes.map(box => box.spec)),
    };
  }).filter(row => row.currentBoxes.length > 0);

  const filtered = rows.filter(row => {
    const f = filters;
    if (f.palletCode?.trim() && row.pallet.code !== f.palletCode.trim()) return false;
    if (f.boxCode?.trim() && !row.boxes.some(box => box.code === f.boxCode!.trim())) return false;
    if (f.warehouse && row.pallet.warehouse !== f.warehouse) return false;
    if (f.variety && !row.boxes.some(box => box.variety === f.variety)) return false;
    if (f.size && !row.boxes.some(box => box.size === f.size)) return false;
    if (f.grade && !row.boxes.some(box => box.grade === f.grade)) return false;
    if (f.spec && !row.boxes.some(box => box.spec === f.spec)) return false;
    const date = row.pallet.time.slice(0, 10);
    return (!f.dates?.[0] || date >= f.dates[0].slice(0, 10)) && (!f.dates?.[1] || date <= f.dates[1].slice(0, 10));
  });

  const openPalletBoxes = (palletCode: string) => {
    setPalletModalCode(palletCode);
  };
  const allColumns: ColumnsType<PalletRow> = [
    { title: '托盘码', key: 'palletCode', width: 190, ellipsis: true, render: (_, row) => <Tooltip title={row.pallet.code}><Button type="link" className="finished-link" onClick={() => openPalletBoxes(row.pallet.code)}>{row.pallet.code}</Button></Tooltip> },
    { title: '品种', key: 'variety', width: 110, ellipsis: true, render: (_, row) => <Tooltip title={row.variety}>{row.variety}</Tooltip> },
    { title: '果径', key: 'size', width: 90, ellipsis: true, render: (_, row) => <Tooltip title={row.size}>{row.size}</Tooltip> },
    { title: '等级', key: 'grade', width: 90, ellipsis: true, render: (_, row) => <Tooltip title={row.grade}>{row.grade}</Tooltip> },
    { title: '包装规格', key: 'spec', width: 170, ellipsis: true, render: (_, row) => <Tooltip title={row.spec}>{row.spec}</Tooltip> },
    { title: '原组托箱数', key: 'boxCount', width: 115, render: (_, row) => row.boxes.length },
    { title: '当前在库箱数', key: 'currentBoxCount', width: 125, render: (_, row) => row.currentBoxes.length },
    { title: '当前在库标准净重 (kg)', key: 'currentWeight', width: 185, render: (_, row) => formatWeight(totalWeight(row.currentBoxes)) },
    { title: '仓库', key: 'warehouse', width: 105, dataIndex: ['pallet', 'warehouse'] },
    { title: '组托时间', key: 'palletTime', width: 170, dataIndex: ['pallet', 'time'] },
    { title: '操作', key: 'option', fixed: 'right', width: 105, align: 'center', render: (_, row) => <Button type="link" className="finished-link" onClick={() => openPalletBoxes(row.pallet.code)}>托盘详情</Button> },
  ];
  const columnKey = (column: ColumnType<PalletRow>) => String(column.key ?? column.dataIndex ?? column.title);
  const configurableColumns = allColumns.filter(column => columnKey(column) !== 'option');
  const orderedColumns = [...configurableColumns].sort((left, right) => {
    const leftIndex = columnOrder.indexOf(columnKey(left));
    const rightIndex = columnOrder.indexOf(columnKey(right));
    return (leftIndex < 0 ? configurableColumns.indexOf(left) : leftIndex) - (rightIndex < 0 ? configurableColumns.indexOf(right) : rightIndex);
  });
  const visibleColumns = [
    ...orderedColumns.filter(column => !hiddenColumns.includes(columnKey(column))),
    ...allColumns.filter(column => columnKey(column) === 'option'),
  ];
  const columnOptions: ColumnOption[] = configurableColumns.map(column => ({ key: columnKey(column), label: String(column.title) }));
  const scrollWidth = visibleColumns.reduce((sum, column) => sum + Number(column.width ?? 120), 48);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = rows.filter(row => selectedPalletCodes.includes(row.key));
  const selectedWarehouse = selectedRows[0]?.pallet.warehouse;
  const startOutbound = () => {
    if (!selectedPalletCodes.length) return;
    const query = new URLSearchParams({ pallets: selectedPalletCodes.join(',') });
    window.location.hash = `/finished-goods/dispatch?${query.toString()}`;
  };

  const startGrouping = () => {
    setGroupingOpen(true);
  };

  const exportPalletRows = (exporting: PalletRow[], filename: string) => {
    exportCsv(
    ['托盘码', '品种', '果径', '等级', '包装规格', '原组托箱数', '当前在库箱数', '当前在库标准净重 (kg)', '仓库', '组托时间'],
    exporting.map(row => [row.pallet.code, row.variety, row.size, row.grade, row.spec, row.boxes.length, row.currentBoxes.length, totalWeight(row.currentBoxes), row.pallet.warehouse, row.pallet.time]),
    filename,
    );
  };
  const exportRows = () => exportPalletRows(selectedRows.length ? selectedRows : filtered, '托盘管理-查询结果.csv');

  return <div className="ds-page-shell pallet-content">
    <FinishedGoodsFilter tab="pallets" onSearch={values => { setFilters(values); setPage(1); setSelectedPalletCodes([]); }} />
    <section className="ds-page-card ds-table-card-padded ds-pro-table-card finished-table-card pallet-table-card">
      <TableSelectionToolbar title="托盘明细" selectedCount={selectedPalletCodes.length} selectedLabel="个托盘" onClear={() => setSelectedPalletCodes([])}
        batchActions={<Space size={8}><Button type="primary" onClick={startOutbound}>托盘出库</Button><Button onClick={() => exportPalletRows(selectedRows, '托盘管理-所选记录.csv')}>批量导出</Button></Space>}
        fixedActions={<Space size={8}>
          <Button type="primary" onClick={startGrouping}>扫码组托</Button>
          <Button disabled={!filtered.length} onClick={exportRows}>导出</Button>
          <ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenColumns} onHiddenKeysChange={setHiddenColumns} order={columnOrder.length ? columnOrder : columnOptions.map(column => column.key)} onOrderChange={setColumnOrder} />
        </Space>} />
      <div className="pallet-table-content">
        <Table<PalletRow> rowKey="key" columns={visibleColumns} dataSource={pageRows} pagination={false} rowSelection={{ type: 'checkbox', fixed: true, columnWidth: 48, selectedRowKeys: selectedPalletCodes, preserveSelectedRowKeys: true,
          getCheckboxProps: row => ({ disabled: row.currentBoxes.length === 0 || (!!selectedWarehouse && row.pallet.warehouse !== selectedWarehouse) }),
          onChange: keys => {
            const selectedKeys = new Set(keys.map(String));
            const nextRows = rows.filter(row => selectedKeys.has(row.key));
            const warehouse = nextRows[0]?.pallet.warehouse;
            const sameWarehouseRows = nextRows.filter(row => row.pallet.warehouse === warehouse);
            if (sameWarehouseRows.length !== nextRows.length) message.warning('一次出库仅支持同一仓库托盘，已保留首个仓库的选择。');
            setSelectedPalletCodes(sameWarehouseRows.map(row => row.key));
          },
        }} scroll={{ x: scrollWidth, y: '100%' }} size="small" locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的在库托盘记录" /> }} />
      </div>
      <div className="pallet-pagination">
        <Pagination current={page} pageSize={pageSize} total={filtered.length} showSizeChanger showQuickJumper pageSizeOptions={[20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(nextPage, nextPageSize) => {
          if (nextPageSize !== pageSize) { setPageSize(nextPageSize); setPage(1); }
          else setPage(nextPage);
        }} />
      </div>
    </section>
    <PalletBoxDetailModal palletCode={palletModalCode} onClose={() => setPalletModalCode(undefined)} />
    <Modal
      className="business-modal pallet-grouping-modal"
      open={groupingOpen}
      centered
      width={1440}
      style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }}
      styles={getModalStyles({
        container: { height: 'min(90dvh, 960px)' },
        body: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'auto' },
      })}
      title="扫码组托"
      footer={null}
      onCancel={() => setGroupingOpen(false)}
    >
      {groupingOpen && <FinishedGoodsOperation mode="group" embedded onView={onView} onClose={() => setGroupingOpen(false)} />}
    </Modal>
  </div>;
}

export function PalletBoxDetailModal({ palletCode, onClose }: { palletCode?: string; onClose: () => void }) {
  const { state } = useFinishedGoods();
  const [boxFilterForm] = Form.useForm<PalletBoxFilters>();
  const [boxFilters, setBoxFilters] = useState<PalletBoxFilters>({});
  const [boxPage, setBoxPage] = useState(1);
  const [boxPageSize, setBoxPageSize] = useState(20);
  const [selectedBoxCodes, setSelectedBoxCodes] = useState<string[]>([]);
  const [hiddenBoxColumns, setHiddenBoxColumns] = useState<string[]>([]);
  const [boxColumnOrder, setBoxColumnOrder] = useState<string[]>([]);
  const activePallet = state.pallets.find(pallet => pallet.code === palletCode);
  const currentPalletBoxes = activePallet
    ? state.boxes.filter(box => activePallet.codes.includes(box.code) && box.state === 'stock')
    : [];

  useEffect(() => {
    if (!palletCode) return;
    boxFilterForm.resetFields();
    setBoxFilters({});
    setBoxPage(1);
    setBoxPageSize(20);
    setSelectedBoxCodes([]);
    setHiddenBoxColumns([]);
    setBoxColumnOrder([]);
  }, [palletCode, boxFilterForm]);

  const filteredPalletBoxes = currentPalletBoxes.filter(box =>
    (!boxFilters.boxCode?.trim() || box.code.toLowerCase().includes(boxFilters.boxCode.trim().toLowerCase())) &&
    (!boxFilters.variety || box.variety === boxFilters.variety) &&
    (!boxFilters.size || box.size === boxFilters.size) &&
    (!boxFilters.grade || box.grade === boxFilters.grade) &&
    (!boxFilters.spec || box.spec === boxFilters.spec),
  );
  const boxColumns: ColumnsType<FinishedBox> = [
    { title: '箱码', key: 'code', dataIndex: 'code', width: 165, ellipsis: true },
    { title: '品种', key: 'variety', dataIndex: 'variety', width: 90 },
    { title: '果径', key: 'size', dataIndex: 'size', width: 60 },
    { title: '等级', key: 'grade', dataIndex: 'grade', width: 70 },
    { title: '包装规格', key: 'spec', dataIndex: 'spec', width: 135, ellipsis: true },
    { title: '标准净重 (kg)', key: 'weight', dataIndex: 'weight', width: 110, render: value => formatWeight(Number(value)) },
    { title: '仓库', key: 'warehouse', dataIndex: 'warehouse', width: 85, render: value => value ?? '—' },
    { title: '入库时间', key: 'inboundAt', dataIndex: 'inboundAt', width: 145, render: value => value ?? '—' },
  ];
  const boxColumnKey = (column: ColumnType<FinishedBox>) => String(column.key ?? column.dataIndex ?? column.title);
  const orderedBoxColumns = [...boxColumns].sort((left, right) => {
    const leftIndex = boxColumnOrder.indexOf(boxColumnKey(left));
    const rightIndex = boxColumnOrder.indexOf(boxColumnKey(right));
    return (leftIndex < 0 ? boxColumns.indexOf(left) : leftIndex) - (rightIndex < 0 ? boxColumns.indexOf(right) : rightIndex);
  });
  const visibleBoxColumns = orderedBoxColumns.filter(column => !hiddenBoxColumns.includes(boxColumnKey(column)));
  const boxColumnOptions: ColumnOption[] = boxColumns.map(column => ({ key: boxColumnKey(column), label: String(column.title) }));
  const boxScrollWidth = visibleBoxColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 40);
  const pagePalletBoxes = filteredPalletBoxes.slice((boxPage - 1) * boxPageSize, boxPage * boxPageSize);
  const selectedPalletBoxes = currentPalletBoxes.filter(box => selectedBoxCodes.includes(box.code));
  const exportBoxRows = (boxes: FinishedBox[], suffix: string) => exportCsv(
    ['箱码', '品种', '果径', '等级', '包装规格', '标准净重 (kg)', '仓库', '入库时间'],
    boxes.map(box => [box.code, box.variety, box.size, box.grade, box.spec, box.weight, box.warehouse ?? '', box.inboundAt ?? '']),
    `${activePallet!.code}-${suffix}.csv`,
  );

  return <Modal
    className="business-modal pallet-box-detail-modal"
    zIndex={1010}
    open={!!palletCode}
    centered
    width={PALLET_DETAIL_MODAL_WIDTH}
    style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }}
    styles={getModalStyles({
      container: { height: 'min(90dvh, 960px)' },
      body: { display: 'flex', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'hidden' },
    })}
    title="托盘详情"
    footer={null}
    onCancel={onClose}
  >
    {activePallet && <div className="pallet-box-detail-content">
      <section className="pallet-box-filter-panel">
        <Form form={boxFilterForm} layout="horizontal" className="pallet-box-filter-form" onFinish={values => { setBoxFilters(values); setBoxPage(1); }}>
          <Form.Item name="boxCode" label="箱码"><Input allowClear placeholder="请输入箱码" /></Form.Item>
          <Form.Item name="variety" label="品种"><Select allowClear placeholder="全部品种" options={[...new Set(currentPalletBoxes.map(box => box.variety))].map(value => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="size" label="果径"><Select allowClear placeholder="全部果径" options={[...new Set(currentPalletBoxes.map(box => box.size))].map(value => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="grade" label="等级"><Select allowClear placeholder="全部等级" options={[...new Set(currentPalletBoxes.map(box => box.grade))].map(value => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="spec" label="包装规格"><Select allowClear placeholder="全部规格" options={[...new Set(currentPalletBoxes.map(box => box.spec))].map(value => ({ value, label: value }))} /></Form.Item>
          <div className="pallet-box-filter-actions">
            <Button onClick={() => { boxFilterForm.resetFields(); setBoxFilters({}); setBoxPage(1); }}>重置</Button>
            <Button type="primary" onClick={() => boxFilterForm.submit()}>查询</Button>
          </div>
        </Form>
      </section>
      <section className="pallet-box-stock-section">
        <TableSelectionToolbar title="库存明细" selectedCount={selectedPalletBoxes.length} selectedLabel="箱" onClear={() => setSelectedBoxCodes([])} className="pallet-box-table-toolbar"
          batchActions={<Button onClick={() => exportBoxRows(selectedPalletBoxes, '所选库存明细')}>批量导出</Button>}
          fixedActions={<Space size={8}>
            <Button disabled={!filteredPalletBoxes.length} onClick={() => exportBoxRows(selectedPalletBoxes.length ? selectedPalletBoxes : filteredPalletBoxes, selectedPalletBoxes.length ? '所选库存明细' : '库存明细')}>导出</Button>
            <ColumnSettingsPopover columns={boxColumnOptions} hiddenKeys={hiddenBoxColumns} onHiddenKeysChange={setHiddenBoxColumns} order={boxColumnOrder.length ? boxColumnOrder : boxColumnOptions.map(column => column.key)} onOrderChange={setBoxColumnOrder} />
          </Space>} />
        <Table<FinishedBox> className="pallet-box-stock-table" rowKey="code" size="small" columns={visibleBoxColumns} dataSource={pagePalletBoxes} pagination={false} scroll={{ x: boxScrollWidth, y: '100%' }}
          rowSelection={{ columnWidth: 40, fixed: true, selectedRowKeys: selectedBoxCodes, preserveSelectedRowKeys: true, onChange: keys => setSelectedBoxCodes(keys.map(String)) }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无符合条件的库存明细" /> }} />
        <div className="pallet-box-pagination">
          <Pagination size="middle" current={boxPage} pageSize={boxPageSize} total={filteredPalletBoxes.length} showSizeChanger showQuickJumper pageSizeOptions={[20, 50, 100]}
            showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`}
            onChange={(nextPage, nextPageSize) => {
              if (nextPageSize !== boxPageSize) { setBoxPageSize(nextPageSize); setBoxPage(1); }
              else setBoxPage(nextPage);
            }} />
        </div>
      </section>
    </div>}
  </Modal>;
}
