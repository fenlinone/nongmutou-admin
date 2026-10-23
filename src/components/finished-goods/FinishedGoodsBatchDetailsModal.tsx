import { useEffect, useMemo, useState } from 'react';
import { App, Button, DatePicker, Empty, Input, Modal, Pagination, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import ColumnSettingsPopover from '../ColumnSettingsPopover';
import type { ColumnOption } from '../ColumnSettingsPopover';
import TableSelectionToolbar from '../TableSelectionToolbar';
import { exportCsv } from '../../data';
import { formatWeight, totalWeight, type FinishedBox, type Inbound, type Outbound } from '../../finishedGoods';
import { FLOATING_LAYER_MAX_WIDTH, getModalStyles } from '../floatingLayer';

type BatchFilters = {
  keyword: string;
  pickedRange?: [string, string];
  variety?: string;
  size?: string;
  grade?: string;
  spec?: string;
};
type PalletDetailRow = { palletCode: string; variety: string; size: string; grade: string; spec: string; count: number; weight: number; warehouse: string; time: string };

const emptyFilters: BatchFilters = { keyword: '' };

type BatchRecord = Inbound | Outbound;

export default function FinishedGoodsBatchDetailsModal({ record, onClose }: { record?: BatchRecord; onClose: () => void }) {
  const { message } = App.useApp();
  const [filterDraft, setFilterDraft] = useState<BatchFilters>(emptyFilters);
  const [filters, setFilters] = useState<BatchFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!record) return;
    setFilterDraft(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
    setPageSize(20);
    setHiddenColumns([]);
    setColumnOrder([]);
  }, [record?.id]);

  const updateFilter = <K extends keyof BatchFilters>(key: K, value: BatchFilters[K]) => {
    setFilterDraft(current => ({ ...current, [key]: value }));
  };
  const isInbound = !!record && 'pallet' in record;
  const palletRows = useMemo(() => {
    const grouped = new Map<string, FinishedBox[]>();
    (record?.boxes ?? []).forEach(box => {
      const palletCode = box.pallet ?? (record && 'pallet' in record ? record.pallet : `未关联托盘（${box.code}）`);
      grouped.set(palletCode, [...(grouped.get(palletCode) ?? []), box]);
    });
    return [...grouped.entries()].map(([palletCode, boxes]): PalletDetailRow => ({
      palletCode,
      variety: [...new Set(boxes.map(box => box.variety))].join('、'),
      size: [...new Set(boxes.map(box => box.size))].join('、'),
      grade: [...new Set(boxes.map(box => box.grade))].join('、'),
      spec: [...new Set(boxes.map(box => box.spec))].join('、'),
      count: boxes.length,
      weight: totalWeight(boxes),
      warehouse: boxes.find(box => box.warehouse)?.warehouse ?? record?.warehouse ?? '—',
      time: isInbound ? boxes.find(box => box.inboundAt)?.inboundAt ?? record?.time ?? '—' : record?.time ?? '—',
    }));
  }, [record, isInbound]);
  const filterOptions = (key: 'variety' | 'size' | 'grade' | 'spec') => [...new Set(palletRows.map(row => row[key]).filter(Boolean))].map(value => ({ value, label: value }));
  const filteredPallets = useMemo(() => palletRows.filter(row => {
    const code = filters.keyword.trim().toLowerCase();
    const date = row.time.slice(0, 10);
    return (!code || row.palletCode.toLowerCase().includes(code))
      && (!filters.variety || row.variety === filters.variety)
      && (!filters.size || row.size === filters.size)
      && (!filters.grade || row.grade === filters.grade)
      && (!filters.spec || row.spec === filters.spec)
      && (!filters.pickedRange || (date >= filters.pickedRange[0] && date <= filters.pickedRange[1]));
  }), [palletRows, filters]);

  const columns: ColumnsType<PalletDetailRow> = [
    { title: '托盘码', dataIndex: 'palletCode', key: 'palletCode', fixed: 'left', width: 190 },
    { title: '品种', dataIndex: 'variety', key: 'variety', width: 130 },
    { title: '果径', dataIndex: 'size', key: 'size', width: 90 },
    { title: '等级', dataIndex: 'grade', key: 'grade', width: 100 },
    { title: '包装规格', dataIndex: 'spec', key: 'spec', width: 230 },
    { title: isInbound ? '入库箱数' : '出库箱数', dataIndex: 'count', key: 'count', width: 120, align: 'right', render: value => `${value} 箱` },
    { title: '标准净重合计', dataIndex: 'weight', key: 'weight', width: 150, align: 'right', render: value => `${formatWeight(Number(value))} kg` },
    { title: '仓库', dataIndex: 'warehouse', key: 'warehouse', width: 120 },
    { title: isInbound ? '入库时间' : '出库时间', dataIndex: 'time', key: 'time', width: 190 },
  ];
  const keyOf = (column: ColumnsType<PalletDetailRow>[number]) => String(column.key ?? ('dataIndex' in column ? column.dataIndex : undefined) ?? column.title);
  const columnOptions: ColumnOption[] = columns.map(column => ({ key: keyOf(column), label: String(column.title) }));
  const orderedColumns = [...columns]
    .filter(column => !hiddenColumns.includes(keyOf(column)))
    .sort((left, right) => {
      const leftIndex = columnOrder.indexOf(keyOf(left));
      const rightIndex = columnOrder.indexOf(keyOf(right));
      const leftDefault = columns.indexOf(left);
      const rightDefault = columns.indexOf(right);
      return (leftIndex < 0 ? leftDefault : leftIndex) - (rightIndex < 0 ? rightDefault : rightIndex);
    });
  const scrollWidth = orderedColumns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 0), 0);
  const start = (page - 1) * pageSize;

  const exportRows = () => exportCsv(
    ['托盘码', '品种', '果径', '等级', '包装规格', isInbound ? '入库箱数' : '出库箱数', '标准净重合计(kg)', '仓库', isInbound ? '入库时间' : '出库时间'],
    filteredPallets.map(row => [row.palletCode, row.variety, row.size, row.grade, row.spec, row.count, row.weight, row.warehouse, row.time]),
    `成品${isInbound ? '入库' : '出库'}批次托盘明细.csv`,
  );

  return <Modal
    className="business-modal raw-batch-modal finished-batch-modal"
    centered
    width={1440}
    style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }}
    styles={getModalStyles({
      container: { height: 'calc(100dvh - var(--floating-layer-viewport-gap, 48px))' },
      body: { display: 'flex', flex: '1 1 auto', minHeight: 0, maxHeight: 'none', overflow: 'hidden' },
    })}
    open={!!record}
    title={record ? <span>批次详情 · <Typography.Text copyable={{ text: record.id, onCopy: () => message.success('批次号已复制') }}>{record.id}</Typography.Text></span> : '批次详情'}
    footer={null}
    onCancel={onClose}
  >
    {record && <div className="raw-batch-modal-content">
      <div className="raw-batch-modal-toolbar">
        <div className="raw-batch-modal-filters finished-batch-modal-filters">
          <label className="raw-filter-field raw-filter-field-code"><span className="raw-filter-label">托盘码</span><Input allowClear value={filterDraft.keyword} onChange={event => updateFilter('keyword', event.target.value)} placeholder="请输入托盘码" /></label>
          <label className="raw-filter-field raw-filter-field-date"><span className="raw-filter-label">{isInbound ? '入库日期' : '出库日期'}</span><DatePicker.RangePicker allowClear format="YYYY-MM-DD" placeholder={['开始日期', '结束日期']} value={filterDraft.pickedRange ? [dayjs(filterDraft.pickedRange[0]), dayjs(filterDraft.pickedRange[1])] : null} onChange={dates => updateFilter('pickedRange', dates?.[0] && dates?.[1] ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] : undefined)} /></label>
          <label className="raw-filter-field raw-filter-field-variety"><span className="raw-filter-label">品种</span><Select allowClear value={filterDraft.variety} onChange={value => updateFilter('variety', value)} placeholder="全部品种" options={filterOptions('variety')} /></label>
          <label className="raw-filter-field raw-filter-field-size"><span className="raw-filter-label">果径</span><Select allowClear value={filterDraft.size} onChange={value => updateFilter('size', value)} placeholder="全部果径" options={filterOptions('size')} /></label>
          <label className="raw-filter-field raw-filter-field-grade"><span className="raw-filter-label">等级</span><Select allowClear value={filterDraft.grade} onChange={value => updateFilter('grade', value)} placeholder="全部等级" options={filterOptions('grade')} /></label>
          <label className="raw-filter-field"><span className="raw-filter-label">包装规格</span><Select allowClear value={filterDraft.spec} onChange={value => updateFilter('spec', value)} placeholder="全部规格" options={filterOptions('spec')} style={{ width: 220, maxWidth: '100%' }} /></label>
          <div className="raw-batch-filter-actions">
            <Button onClick={() => { setFilterDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }}>重置</Button>
            <Button type="primary" onClick={() => { setFilters(filterDraft); setPage(1); }}>查询</Button>
          </div>
        </div>
      </div>
      <TableSelectionToolbar
        title={`${isInbound ? '入库' : '出库'}明细`}
        selectedCount={0}
        onClear={() => undefined}
        className="raw-batch-table-toolbar"
        fixedActions={<Space size={8}>
          <Button onClick={exportRows} disabled={!filteredPallets.length}>导出</Button>
          <ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenColumns} onHiddenKeysChange={setHiddenColumns} order={columnOrder.length ? columnOrder : columnOptions.map(column => column.key)} onOrderChange={setColumnOrder} />
        </Space>}
      />
      <div className="raw-batch-table-area">
        {filteredPallets.length
          ? <Table<PalletDetailRow> size="small" rowKey="palletCode" columns={orderedColumns} dataSource={filteredPallets.slice(start, start + pageSize)} pagination={false} scroll={{ x: scrollWidth }} />
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的托盘信息" />}
      </div>
      <div className="raw-batch-pagination">
        <span className="record-total">共 {filteredPallets.length.toLocaleString('zh-CN')} 项数据</span>
        <Pagination current={page} pageSize={pageSize} total={filteredPallets.length} pageSizeOptions={[10, 20, 50, 100]} showSizeChanger showQuickJumper onChange={(nextPage, nextPageSize) => { setPage(nextPageSize !== pageSize ? 1 : nextPage); setPageSize(nextPageSize); }} />
      </div>
    </div>}
  </Modal>;
}
