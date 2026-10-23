import { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Input, Modal, Pagination, Space, Table } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useFinishedGoods, type FinishedBox } from '../../finishedGoods';
import { FLOATING_LAYER_MAX_WIDTH, getModalStyles } from '../floatingLayer';
import TableSelectionToolbar from '../TableSelectionToolbar';
import ColumnSettingsPopover from '../ColumnSettingsPopover';
import type { ColumnOption } from '../ColumnSettingsPopover';
import { exportCsv } from '../../data';

type PalletScanRow = {
  code: string;
  boxes: FinishedBox[];
  variety: string;
  size: string;
  grade: string;
  spec: string;
  warehouse: string;
  time: string;
  count: number;
};

const columns: ColumnsType<PalletScanRow> = [
  { title: '托盘码', key: 'code', dataIndex: 'code', width: 190 },
  { title: '品种', key: 'variety', dataIndex: 'variety', width: 100 },
  { title: '果径', key: 'size', dataIndex: 'size', width: 76 },
  { title: '等级', key: 'grade', dataIndex: 'grade', width: 84 },
  { title: '包装规格', key: 'spec', dataIndex: 'spec', width: 170 },
  { title: '出库箱数', key: 'count', dataIndex: 'count', width: 100, align: 'right', render: value => `${value} 箱` },
  { title: '仓库', key: 'warehouse', dataIndex: 'warehouse', width: 110 },
  { title: '组托时间', key: 'time', dataIndex: 'time', width: 170 },
];
const columnOptions: ColumnOption[] = columns.map(column => ({ key: String(column.key), label: String(column.title) }));

export default function FinishedGoodsOutboundModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const { state, transact } = useFinishedGoods();
  const [scanActive, setScanActive] = useState(false);
  const [input, setInput] = useState('');
  const [scannedPalletCodes, setScannedPalletCodes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const palletRows = useMemo<PalletScanRow[]>(() => state.pallets.flatMap(pallet => {
    const boxes = state.boxes.filter(box => box.pallet === pallet.code && box.state === 'stock');
    if (!boxes.length) return [];
    const first = boxes[0];
    return [{ code: pallet.code, boxes, variety: first.variety, size: first.size, grade: first.grade, spec: first.spec, warehouse: pallet.warehouse, time: pallet.time, count: boxes.length }];
  }), [state.boxes, state.pallets]);
  const scannedRows = scannedPalletCodes.map(code => palletRows.find(row => row.code === code)).filter((row): row is PalletScanRow => Boolean(row));
  const visibleColumns = [...columns].sort((left, right) => {
    const leftIndex = columnOrder.indexOf(String(left.key));
    const rightIndex = columnOrder.indexOf(String(right.key));
    return (leftIndex < 0 ? columns.indexOf(left) : leftIndex) - (rightIndex < 0 ? columns.indexOf(right) : rightIndex);
  }).filter(column => !hiddenColumns.includes(String(column.key)));
  const tableWidth = visibleColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 0);
  const pageRows = scannedRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (!open) return;
    setScanActive(false);
    setInput('');
    setScannedPalletCodes([]);
    setPage(1);
    setPageSize(20);
    setHiddenColumns([]);
    setColumnOrder([]);
  }, [open]);

  const startScanning = () => {
    setScanActive(true);
    window.setTimeout(() => document.getElementById('finished-pallet-outbound-scan')?.focus(), 0);
  };

  const receiveScan = (value: string) => {
    const code = value.trim();
    setInput('');
    if (!code) return;
    const pallet = palletRows.find(row => row.code === code);
    if (!pallet) {
      message.warning(state.pallets.some(row => row.code === code) ? '该托盘当前没有在库成品，不能出库。' : '未找到该托盘码，请核对托盘标签。');
      return;
    }
    if (scannedPalletCodes.includes(code)) {
      message.info('该托盘已在本次出库列表中。');
      return;
    }
    const firstScanned = scannedRows[0];
    if (firstScanned && firstScanned.warehouse !== pallet.warehouse) {
      message.warning(`本次出库已选择${firstScanned.warehouse}，不能加入${pallet.warehouse}的托盘。`);
      return;
    }
    setScannedPalletCodes(current => [...current, code]);
    setPage(1);
  };

  const confirmOutbound = () => {
    const selectedRows = scannedPalletCodes.map(code => palletRows.find(row => row.code === code)).filter((row): row is PalletScanRow => Boolean(row));
    if (selectedRows.length !== scannedPalletCodes.length) {
      message.warning('部分托盘已不在库存中，请重新扫码核对。');
      return;
    }
    const codes = selectedRows.flatMap(row => row.boxes.map(box => box.code));
    if (!codes.length) {
      message.warning('请先扫描在库托盘码。');
      return;
    }
    const result = transact({ type: 'outbound', codes, time: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    if (!result.ok) {
      message.error(result.error ?? '托盘出库失败，请重新核对库存。');
      return;
    }
    message.success(`已确认 ${selectedRows.length} 托、${codes.length} 箱出库，成品库存已更新。`);
    setScanActive(false);
    setScannedPalletCodes([]);
    onClose();
  };

  const handleClose = () => {
    setScanActive(false);
    setInput('');
    setScannedPalletCodes([]);
    onClose();
  };

  return <Modal
    className="business-modal raw-outbound-modal finished-pallet-outbound-modal"
    centered
    width={FLOATING_LAYER_MAX_WIDTH}
    style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }}
    styles={getModalStyles({ container: { height: 'calc(100dvh - var(--floating-layer-viewport-gap, 48px))' }, body: { display: 'flex', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'auto' } })}
    open={open}
    title="成品扫码出库"
    okText={`确认出库（${scannedRows.length} 托）`}
    cancelText="取消"
    okButtonProps={{ disabled: scannedRows.length === 0 }}
    onCancel={handleClose}
    onOk={confirmOutbound}
  >
    <div className="raw-scan-panel">
      <div className="raw-scan-controls">
        <Button type="primary" icon={<ScanOutlined />} onClick={startScanning}>{scanActive ? '扫码中' : '开始扫码'}</Button>
        <Input id="finished-pallet-outbound-scan" aria-label="扫码枪输入" className="raw-scan-capture" value={input} disabled={!scanActive} onChange={event => setInput(event.target.value)} onPressEnter={event => receiveScan(event.currentTarget.value)} />
      </div>
      <TableSelectionToolbar title="托盘列表" selectedCount={0} onClear={() => undefined} className="raw-scan-table-toolbar"
        fixedActions={<Space size={8}>
          <Button onClick={() => exportCsv(['托盘码', '品种', '果径', '等级', '包装规格', '出库箱数', '仓库', '组托时间'], scannedRows.map(row => [row.code, row.variety, row.size, row.grade, row.spec, row.count, row.warehouse, row.time]), '成品扫码出库清单.csv')} disabled={!scannedRows.length}>导出</Button>
          <ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenColumns} onHiddenKeysChange={setHiddenColumns} order={columnOrder.length ? columnOrder : columnOptions.map(column => column.key)} onOrderChange={setColumnOrder} />
        </Space>} />
      <Table<PalletScanRow> size="small" rowKey="code" columns={visibleColumns} dataSource={pageRows} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无出库托盘" /> }} scroll={{ x: tableWidth, y: 'max(120px, calc(100dvh - 470px))' }} />
      {scannedRows.length > 0 && <div className="raw-scan-pagination"><Pagination current={page} pageSize={pageSize} total={scannedRows.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(nextPage, nextPageSize) => { setPage(nextPageSize !== pageSize ? 1 : nextPage); setPageSize(nextPageSize); }} /></div>}
      {scanActive && <p className="finished-muted">请用扫码枪扫描托盘码，扫码后自动加入本次出库列表；一次出库仅支持同一仓库。</p>}
    </div>
  </Modal>;
}
