import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Select, Space, Table, Tabs, Tag } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getDrawerStyles, getModalStyles } from '../components/floatingLayer';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import { getScatteredInventory, useScatteredFruit, type ScatteredMovementType, type ScatteredRecord } from '../scatteredFruit';
import { exportCsv } from '../data';
import './scattered-fruit.css';

type MovementType = ScatteredMovementType;
type ScatteredTab = 'inventory' | 'inbound' | 'outbound';
type ScatteredInventoryRow = ScatteredRecord & { balanceAfter: number; outboundWeight: number };
type EntryFormValues = {
  businessDate: Dayjs;
  weight?: number;
  sourceInboundKey?: string;
  operator?: string;
  purpose?: string;
  note?: string;
};
type DateRange = [Dayjs | null, Dayjs | null] | null;

const formModalWidth = 520;
const formatWeight = (weight: number) => weight.toLocaleString('zh-CN', { maximumFractionDigits: 20 });
const createNextInboundNo = (records: ScatteredRecord[], businessDate: Dayjs) => {
  const maxSequence = records.reduce((max, record) => {
    if (record.type !== '入库' || !record.inboundNo) return max;
    const match = /^SGRK\d{8}(\d{4})$/.exec(record.inboundNo);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `SGRK${businessDate.format('YYYYMMDD')}${String(maxSequence + 1).padStart(4, '0')}`;
};
const createNextOutboundNo = (records: ScatteredRecord[], businessDate: Dayjs) => {
  const dateCode = businessDate.format('YYYYMMDD');
  const prefix = `SGCK${dateCode}`;
  const maxSequence = records.reduce((max, record) => {
    if (record.type !== '出库' || !record.outboundNo?.startsWith(prefix)) return max;
    const match = /^SGCK\d{8}(\d{4})$/.exec(record.outboundNo);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(maxSequence + 1).padStart(4, '0')}`;
};

export default function ScatteredFruitPage({ hash = location.hash }: { hash?: string }) {
  const { message } = App.useApp();
  const { rows, addRecord, updateRecord, deleteRecord, balance } = useScatteredFruit();
  const [dateDraft, setDateDraft] = useState<DateRange>(null);
  const [appliedDates, setAppliedDates] = useState<[string | null, string | null]>([null, null]);
  const [activeTab, setActiveTab] = useState<ScatteredTab>('inventory');
  const activeType: MovementType = activeTab === 'outbound' ? '出库' : '入库';
  const [tableSettings, setTableSettings] = useState<Record<ScatteredTab, { hiddenColumns: string[]; columnOrder: string[] }>>({
    inventory: { hiddenColumns: [], columnOrder: [] },
    inbound: { hiddenColumns: [], columnOrder: [] },
    outbound: { hiddenColumns: [], columnOrder: [] },
  });
  const [pages, setPages] = useState<Record<ScatteredTab, number>>({ inventory: 1, inbound: 1, outbound: 1 });
  const [pageSizes, setPageSizes] = useState<Record<ScatteredTab, number>>({ inventory: 20, inbound: 20, outbound: 20 });
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [entryType, setEntryType] = useState<MovementType>();
  const [editingRecord, setEditingRecord] = useState<ScatteredRecord>();
  const [detail, setDetail] = useState<ScatteredRecord>();
  const [tableBodyHeight, setTableBodyHeight] = useState(240);
  const [form] = Form.useForm<EntryFormValues>();
  const watchedBusinessDate = Form.useWatch('businessDate', form);
  const submitting = useRef(false);
  const tableContentRef = useRef<HTMLDivElement>(null);

  const dateFilteredRecords = useMemo(() => rows.filter(record => {
    if (appliedDates[0] && record.businessDate < appliedDates[0]) return false;
    if (appliedDates[1] && record.businessDate > appliedDates[1]) return false;
    return true;
  }), [rows, appliedDates]);
  const allInventoryRows = useMemo(() => getScatteredInventory(rows), [rows]);
  const sourceInboundKey = Form.useWatch('sourceInboundKey', form);
  const selectedStock = allInventoryRows.find(record => record.key === sourceInboundKey);
  const inventoryRows = allInventoryRows.filter(record => (!appliedDates[0] || record.businessDate >= appliedDates[0]) && (!appliedDates[1] || record.businessDate <= appliedDates[1]));
  const filteredRecords = dateFilteredRecords.filter(record => record.type === activeType);
  const currentRows: ScatteredInventoryRow[] = activeTab === 'inventory' ? inventoryRows : filteredRecords.map(record => ({
    ...record,
    balanceAfter: 0,
    outboundWeight: 0,
  }));
  const selectedRows = currentRows.filter(record => selectedKeys.includes(record.key));
  const currentCount = currentRows.length;
  const pageRows = currentRows.slice((pages[activeTab] - 1) * pageSizes[activeTab], pages[activeTab] * pageSizes[activeTab]);

  const openEntry = (type: MovementType) => {
    submitting.current = false;
    setEditingRecord(undefined);
    form.resetFields();
    form.setFieldsValue({ businessDate: dayjs('2026-10-21'), operator: '管理员' });
    setEntryType(type);
  };
  const closeEntry = () => {
    setEntryType(undefined);
    setEditingRecord(undefined);
    form.resetFields();
  };

  const openEdit = (record: ScatteredRecord) => {
    submitting.current = false;
    setEditingRecord(record);
    form.resetFields();
    form.setFieldsValue({
      businessDate: dayjs(record.businessDate),
      weight: record.weight,
      operator: record.operator,
      note: record.note,
    });
    setEntryType('入库');
  };

  useEffect(() => {
    const [path, query = ''] = hash.split('?');
    const operation = path.split('/')[2];
    const nextTab: ScatteredTab = operation === 'inbound' || operation === 'outbound' ? operation : 'inventory';
    const nextType: MovementType = operation === 'outbound' ? '出库' : '入库';
    setActiveTab(nextTab);
    if (new URLSearchParams(query).get('register') === '1') {
      openEntry(nextType);
      // 快捷入口只触发一次登记弹窗，刷新页面后不重复弹出。
      history.replaceState(null, '', path);
    }
    else {
      setEntryType(undefined);
    }
  }, [hash]);

  const changeTab = (tab: string) => {
    const nextTab = tab as ScatteredTab;
    setSelectedKeys([]);
    setActiveTab(nextTab);
    const nextPath = nextTab === 'inventory' ? '/scattered-fruit/inventory' : `/scattered-fruit/${nextTab}`;
    if (hash.split('?')[0] !== `#${nextPath}`) location.hash = nextPath;
  };

  const applyFilters = () => {
    setSelectedKeys([]);
    setAppliedDates([dateDraft?.[0]?.format('YYYY-MM-DD') ?? null, dateDraft?.[1]?.format('YYYY-MM-DD') ?? null]);
    setPages({ inventory: 1, inbound: 1, outbound: 1 });
  };
  const exportRecords = () => {
    const headers = activeTab === 'inventory' ? ['入库编号', '入库日期', '净重（kg）', '经办人', '备注', '确认时间'] : [activeType === '入库' ? '入库编号' : '批次编号', activeType === '入库' ? '入库日期' : '出库日期', '类型', '净重（kg）', '经办人', '备注', '确认时间'];
    const data = activeTab === 'inventory'
      ? (selectedRows.length ? selectedRows : inventoryRows).map(record => [record.inboundNo || '—', record.businessDate, record.weight, record.operator, record.note || '—', record.confirmedAt])
      : (selectedRows.length ? selectedRows : filteredRecords).map(record => [record.inboundNo || '—', record.businessDate, record.type, record.weight, record.operator, record.note || '—', record.confirmedAt]);
    exportCsv(headers, data, activeTab === 'inventory' ? '散果库存记录.csv' : `散果${activeType}流水.csv`);
  };
  const resetFilters = () => {
    setSelectedKeys([]);
    setDateDraft(null);
    setAppliedDates([null, null]);
    setPages({ inventory: 1, inbound: 1, outbound: 1 });
  };

  const saveEntry = (values: EntryFormValues) => {
    if (!entryType || !values.weight || values.weight <= 0 || submitting.current) return;
    if (editingRecord) {
      const currentInventory = allInventoryRows.find(record => record.key === editingRecord.key);
      if (currentInventory && values.weight < currentInventory.outboundWeight) {
        form.setFields([{ name: 'weight', errors: [`入库重量不能低于已出库重量 ${formatWeight(currentInventory.outboundWeight)} kg`] }]);
        return;
      }
      submitting.current = true;
      updateRecord({
        ...editingRecord,
        businessDate: values.businessDate.format('YYYY-MM-DD'),
        weight: values.weight,
        operator: values.operator?.trim() || '管理员',
        note: values.note?.trim() || '',
      });
      closeEntry();
      message.success('散果入库记录已更新');
      return;
    }
    const stock = allInventoryRows.find(record => record.key === values.sourceInboundKey);
    if (entryType === '出库') {
      if (!stock || stock.balanceAfter <= 0) {
        form.setFields([{ name: 'sourceInboundKey', errors: ['请选择有结存的库存记录'] }]);
        return;
      }
      if (values.weight > stock.balanceAfter) {
        form.setFields([{ name: 'weight', errors: [`出库重量不能超过所选库存结存 ${formatWeight(stock.balanceAfter)} kg`] }]);
        return;
      }
    }
    submitting.current = true;
    const record: ScatteredRecord = {
      key: `LOCAL-${rows.length + 1}`,
      // 入库确认时生成稳定编号，筛选、分页和导出共用该编号。
      inboundNo: entryType === '入库' ? createNextInboundNo(rows, values.businessDate) : stock?.inboundNo,
      outboundNo: entryType === '出库' ? createNextOutboundNo(rows, values.businessDate) : undefined,
      sourceInboundKey: entryType === '出库' ? stock?.key : undefined,
      businessDate: values.businessDate.format('YYYY-MM-DD'),
      type: entryType,
      weight: values.weight,
      operator: values.operator?.trim() || '管理员',
      purpose: entryType === '出库' ? values.purpose?.trim() || '—' : '不适用',
      note: values.note?.trim() || '',
      confirmedAt: dayjs('2026-10-21 16:30').add(rows.length, 'minute').format('YYYY-MM-DD HH:mm'),
    };
    addRecord(record);
    const targetTab: ScatteredTab = entryType === '入库' ? 'inbound' : 'outbound';
    setPages(current => ({ ...current, [targetTab]: 1 }));
    closeEntry();
    message.success(`散果${entryType}已确认，独立结存已更新`);
  };

  const detailStock = detail?.type === '入库' ? allInventoryRows.find(record => record.key === detail.key) : undefined;

  const allColumns: ColumnsType<ScatteredInventoryRow> = activeTab === 'inventory' ? [
    { title: '入库编号', dataIndex: 'inboundNo', key: 'inboundNo', width: 200, render: value => value || '—' },
    { title: '入库日期', dataIndex: 'businessDate', key: 'businessDate', width: 130 },
    { title: '净重（kg）', dataIndex: 'weight', key: 'weight', width: 150, align: 'right', render: weight => formatWeight(weight) },
    { title: '经办人', dataIndex: 'operator', key: 'operator', width: 110 },
    { title: '备注', dataIndex: 'note', key: 'note', width: 220, ellipsis: true, render: note => note || '—' },
    { title: '确认时间', dataIndex: 'confirmedAt', key: 'confirmedAt', width: 170 },
    { title: '操作', key: 'action', fixed: 'right', width: 150, align: 'center', render: (_: unknown, record) => <Space size={8} className="sf-row-actions">
      <Button type="link" className="sf-link" onClick={() => openEdit(record)}>编辑</Button>
      <Popconfirm title="确认删除这条散果入库记录？" description="删除后将同步更新散果库存。" okText="删除" cancelText="取消" onConfirm={() => { deleteRecord(record.key); setSelectedKeys(keys => keys.filter(key => key !== record.key)); message.success('散果入库记录已删除'); }}>
        <Button type="link" danger className="sf-link sf-delete-link" disabled={record.outboundWeight > 0} title={record.outboundWeight > 0 ? '已有出库记录，不能删除' : undefined}>删除</Button>
      </Popconfirm>
    </Space> },
  ] : [
    { title: activeType === '入库' ? '入库编号' : '批次编号', dataIndex: 'inboundNo', key: 'inboundNo', width: 200, render: value => value || '—' },
    { title: activeType === '入库' ? '入库日期' : '出库日期', dataIndex: 'businessDate', key: 'businessDate', width: 130 },
    { title: '净重（kg）', dataIndex: 'weight', key: 'weight', width: 150, align: 'right', render: weight => formatWeight(weight) },
    { title: '经办人', dataIndex: 'operator', key: 'operator', width: 110 },
    { title: '备注', dataIndex: 'note', key: 'note', width: 220, ellipsis: true, render: note => note || '—' },
    { title: '确认时间', dataIndex: 'confirmedAt', key: 'confirmedAt', width: 170 },
  ];
  const dataColumns = allColumns.filter(column => column.key !== 'action');
  const keyOf = (column: ColumnsType<ScatteredInventoryRow>[number]) => String(column.key ?? ('dataIndex' in column ? column.dataIndex : ''));
  const { hiddenColumns, columnOrder } = tableSettings[activeTab];
  const order = columnOrder.length ? columnOrder : dataColumns.map(keyOf);
  const visibleColumns = [
    ...[...dataColumns].sort((left, right) => order.indexOf(keyOf(left)) - order.indexOf(keyOf(right))).filter(column => !hiddenColumns.includes(keyOf(column))),
    ...(activeTab === 'inventory' ? [allColumns[allColumns.length - 1]] : []),
  ];
  const columnOptions: ColumnOption[] = dataColumns.map(column => ({ key: keyOf(column), label: String(column.title) }));
  const tableWidth = 48 + visibleColumns.reduce((total, column) => total + Number(column.width ?? 100), 0);

  useEffect(() => {
    const content = tableContentRef.current;
    if (!content) return;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const header = content.querySelector<HTMLElement>('.ant-table-thead');
        const nextHeight = Math.max(1, Math.floor(content.clientHeight - (header?.getBoundingClientRect().height ?? 0)));
        setTableBodyHeight(current => current === nextHeight ? current : nextHeight);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    const header = content.querySelector<HTMLElement>('.ant-table-thead');
    if (header) observer.observe(header);
    measure();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, currentCount, hiddenColumns.length, columnOrder.length]);

  return <div className="scattered-page ds-page-shell">
    <Tabs className="sf-page-tabs" activeKey={activeTab} onChange={changeTab} items={[{ key: 'inventory', label: '散果库存' }, { key: 'inbound', label: '入库记录' }, { key: 'outbound', label: '出库记录' }]} />

    <Card className="ds-search-panel sf-search-card" variant="borderless">
      <div className="sf-search-row">
        <label>业务日期<DatePicker.RangePicker value={dateDraft} onChange={value => setDateDraft(value)} format="YYYY-MM-DD" separator="~" placeholder={['开始日期', '结束日期']} allowClear /></label>
        <div className="sf-search-actions"><Button onClick={resetFilters}>重置</Button><Button type="primary" onClick={applyFilters}>查询</Button></div>
      </div>
    </Card>

    <section className="ds-page-card ds-table-card-padded sf-ledger-card">
      <TableSelectionToolbar className="sf-table-toolbar" title={activeTab === 'inventory' ? '散果库存' : `散果${activeType}流水`} selectedCount={selectedRows.length} onClear={() => setSelectedKeys([])}
        batchActions={<Button onClick={exportRecords}>批量导出</Button>}
        fixedActions={<Space size={8}>
          {activeTab === 'inventory' && <Button type="primary" onClick={() => openEntry('出库')}>新增出库</Button>}
          {activeTab === 'inventory' && <Button type="primary" onClick={() => openEntry('入库')}>新增入库</Button>}
          <Button onClick={exportRecords} disabled={!currentCount}>导出</Button>
          <ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenColumns} onHiddenKeysChange={nextHidden => setTableSettings(current => ({ ...current, [activeTab]: { ...current[activeTab], hiddenColumns: nextHidden } }))} order={order} onOrderChange={nextOrder => setTableSettings(current => ({ ...current, [activeTab]: { ...current[activeTab], columnOrder: nextOrder } }))} buttonLabel="列设置" />
        </Space>} />
      <div ref={tableContentRef} className="sf-table-content">
        {currentCount ? <Table<ScatteredInventoryRow> rowKey="key" size="small" columns={visibleColumns} rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, preserveSelectedRowKeys: true, columnWidth: 48, fixed: true }} dataSource={pageRows} pagination={false} scroll={{ x: tableWidth, y: tableBodyHeight }} /> : <div className="sf-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={activeTab === 'inventory' ? '暂无符合条件的散果库存记录' : `暂无符合条件的散果${activeType}流水`} /></div>}
      </div>
      <div className="sf-pagination">
        <span>共 {currentCount.toLocaleString('zh-CN')} 项数据</span>
        <Pagination current={pages[activeTab]} pageSize={pageSizes[activeTab]} pageSizeOptions={[20, 50, 100]} total={currentCount} showSizeChanger showQuickJumper onChange={(nextPage, nextPageSize) => { setPages(current => ({ ...current, [activeTab]: nextPageSize !== pageSizes[activeTab] ? 1 : nextPage })); setPageSizes(current => ({ ...current, [activeTab]: nextPageSize })); }} />
      </div>
    </section>

    <Modal className="business-modal sf-entry-modal" centered width={formModalWidth} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} open={!!entryType} title={editingRecord ? '编辑散果入库记录' : `散果${entryType ?? ''}登记`} okText={editingRecord ? '保存' : `确认${entryType ?? ''}`} cancelText="取消" onCancel={closeEntry} onOk={() => form.submit()}>
      {entryType === '出库' && <div className="sf-current-balance"><span>当前散果结存</span><strong>{formatWeight(balance)} kg</strong></div>}
      <Form form={form} layout="vertical" onFinish={saveEntry} className="sf-entry-form">
        {entryType === '入库' && <Form.Item label="入库编号"><Input readOnly value={editingRecord?.inboundNo ?? (watchedBusinessDate ? createNextInboundNo(rows, watchedBusinessDate) : '')} /></Form.Item>}
        {entryType === '出库' && <Form.Item label="出库编号"><Input readOnly value={watchedBusinessDate ? createNextOutboundNo(rows, watchedBusinessDate) : ''} /></Form.Item>}
        <Form.Item name="businessDate" label={entryType === '出库' ? '出库日期' : '入库日期'} rules={[{ required: true, message: `请选择${entryType === '出库' ? '出库' : '入库'}日期` }]}><DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} /></Form.Item>
        {entryType === '出库' && <Form.Item name="sourceInboundKey" label="库存记录" rules={[{ required: true, message: '请选择库存记录' }]}>
          <Select showSearch optionFilterProp="label" placeholder="请选择要出库的库存记录" options={allInventoryRows.filter(record => record.balanceAfter > 0).map(record => ({ value: record.key, label: `${record.inboundNo} · 结存 ${formatWeight(record.balanceAfter)} kg` }))} notFoundContent="暂无可出库库存" />
        </Form.Item>}
        <Form.Item name="weight" dependencies={['sourceInboundKey']} label="实际重量（kg）" rules={[
          { required: true, message: '请输入实际重量' },
          { validator: async (_, value: number | undefined) => { if (value == null) return; if (value <= 0) throw new Error('实际重量必须大于 0'); if (entryType === '出库' && selectedStock && value > selectedStock.balanceAfter) throw new Error(`出库重量不能超过所选库存结存 ${formatWeight(selectedStock.balanceAfter)} kg`); } },
        ]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="请输入称重结果" /></Form.Item>
        {entryType === '出库' && <Form.Item name="purpose" label="用途"><Input maxLength={100} placeholder="请输入散果出库用途" /></Form.Item>}
        <Form.Item name="operator" label="经办人"><Input maxLength={50} placeholder="请输入经办人" /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea maxLength={300} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="请输入备注" /></Form.Item>
      </Form>
    </Modal>

    <Drawer className="business-drawer sf-detail-drawer" open={!!detail} size={FLOATING_LAYER_WIDTHS.detailDrawer} closable={false} title={<div className="sf-drawer-title"><Button type="text" aria-label="关闭散果流水详情" icon={<CloseOutlined />} onClick={() => setDetail(undefined)} /><strong>散果流水详情</strong></div>} styles={getDrawerStyles()} onClose={() => setDetail(undefined)}>
      {detail && <Descriptions column={1} items={[
        ...(detail.outboundNo ? [{ key: 'outboundNo', label: '出库编号', children: detail.outboundNo }] : []),
        ...(detail.inboundNo ? [{ key: 'inboundNo', label: '批次编号', children: detail.inboundNo }] : []),
        { key: 'date', label: '业务日期', children: detail.businessDate },
        { key: 'type', label: '类型', children: <Tag color={detail.type === '入库' ? 'blue' : 'orange'}>{detail.type}</Tag> },
        { key: 'weight', label: '实际重量', children: `${formatWeight(detail.weight)} kg` },
        ...(detailStock ? [{ key: 'outboundWeight', label: '累计出库重量', children: `${formatWeight(detailStock.outboundWeight)} kg` }, { key: 'balanceAfter', label: '结存重量', children: `${formatWeight(detailStock.balanceAfter)} kg` }] : []),
        ...(detail.type === '出库' ? [{ key: 'purpose', label: '用途', children: detail.purpose || '—' }] : [{ key: 'purpose', label: '用途', children: '不适用' }]),
        { key: 'operator', label: '经办人', children: detail.operator || '—' },
        { key: 'note', label: '备注', children: detail.note || '—' },
        { key: 'confirmedAt', label: '确认时间', children: detail.confirmedAt },
      ]} />}
    </Drawer>
  </div>;
}
