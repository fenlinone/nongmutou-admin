import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Pagination, Select, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined } from '@ant-design/icons';
import { exportCsv } from '../data';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../components/floatingLayer';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';

type PackagingSpec = { key: string; code: string; name: string; packageType: string; netWeight: number; unit: string; enabled: boolean; updated: string };
const initialRows: PackagingSpec[] = [
  { key: 'PS001', code: 'PS001', name: '125g小果盒', packageType: '塑料盒', netWeight: 0.125, unit: '盒', enabled: true, updated: '2026-10-20 09:30' },
  { key: 'PS002', code: 'PS002', name: '250g标准盒', packageType: '塑料盒', netWeight: 0.25, unit: '盒', enabled: true, updated: '2026-10-20 09:30' },
  { key: 'PS003', code: 'PS003', name: '500g家庭装', packageType: '塑料盒', netWeight: 0.5, unit: '盒', enabled: true, updated: '2026-10-18 15:12' },
  { key: 'PS004', code: 'PS004', name: '1kg礼盒装', packageType: '礼品纸盒', netWeight: 1, unit: '盒', enabled: true, updated: '2026-10-17 11:05' },
  { key: 'PS005', code: 'PS005', name: '2.5kg周转箱', packageType: '周转箱', netWeight: 2.5, unit: '箱', enabled: true, updated: '2026-10-16 16:40' },
  { key: 'PS006', code: 'PS006', name: '5kg批发箱', packageType: '纸箱', netWeight: 5, unit: '箱', enabled: false, updated: '2026-10-12 10:22' },
];
const keys = ['code', 'name', 'packageType', 'netWeight', 'unit', 'enabled', 'updated'];

export default function PackagingSpecPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState({ keyword: '', packageType: '', status: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm<Omit<PackagingSpec, 'key' | 'updated'>>();
  const [editing, setEditing] = useState<PackagingSpec>();
  const [modalOpen, setModalOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [order, setOrder] = useState(keys);
  const filtered = useMemo(() => rows.filter(row => (!applied.keyword || `${row.code}${row.name}`.toLowerCase().includes(applied.keyword.trim().toLowerCase())) && (!applied.packageType || row.packageType === applied.packageType) && (!applied.status || (applied.status === '启用' ? row.enabled : !row.enabled))), [rows, applied]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const selectedRows = filtered.filter(row => selected.includes(row.key));
  const openForm = (row?: PackagingSpec) => { setEditing(row); form.setFieldsValue(row ? { code: row.code, name: row.name, packageType: row.packageType, netWeight: row.netWeight, unit: row.unit, enabled: row.enabled } : { code: '', name: '', packageType: '塑料盒', netWeight: undefined, unit: '盒', enabled: true }); setModalOpen(true); };
  const save = async () => {
    const value = await form.validateFields();
    if (rows.some(row => row.code === value.code && row.key !== editing?.key)) { form.setFields([{ name: 'code', errors: ['规格编码已存在'] }]); return; }
    if (editing) setRows(current => current.map(row => row.key === editing.key ? { ...row, ...value, updated: '2026-10-23 10:00' } : row));
    else setRows(current => [{ ...value, key: value.code, updated: '2026-10-23 10:00' }, ...current]);
    setModalOpen(false); message.success(editing ? '包装规格已更新' : '包装规格已新增');
  };
  const removeRows = (targets: PackagingSpec[]) => Modal.confirm({ title: targets.length > 1 ? '批量删除包装规格' : '删除包装规格', content: `确定删除${targets.length > 1 ? `已选的 ${targets.length} 条` : `「${targets[0].name}」`}包装规格吗？`, centered: true, width: FLOATING_LAYER_WIDTHS.confirmModal, style: { maxWidth: FLOATING_LAYER_MAX_WIDTH }, styles: getModalStyles(), okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', onOk: () => { const targetKeys = new Set(targets.map(row => row.key)); setRows(current => current.filter(row => !targetKeys.has(row.key))); setSelected(current => current.filter(key => !targetKeys.has(key))); message.success(`已删除 ${targets.length} 条包装规格`); } });
  const allColumns: ColumnsType<PackagingSpec> = [
    { title: '规格编码', dataIndex: 'code', key: 'code', width: 120 }, { title: '规格名称', dataIndex: 'name', key: 'name', width: 180 }, { title: '包装类型', dataIndex: 'packageType', key: 'packageType', width: 140 },
    { title: '标准净重', dataIndex: 'netWeight', key: 'netWeight', width: 120, render: value => `${value} kg` }, { title: '包装单位', dataIndex: 'unit', key: 'unit', width: 100 },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 110, render: (enabled: boolean, row) => <Switch checked={enabled} checkedChildren="启用" unCheckedChildren="停用" onChange={checked => setRows(current => current.map(item => item.key === row.key ? { ...item, enabled: checked, updated: '2026-10-23 10:00' } : item))} /> },
    { title: '更新时间', dataIndex: 'updated', key: 'updated', width: 170 },
    { title: '操作', key: 'action', width: 116, fixed: 'right', align: 'center', render: (_value, row) => <Space size={12}><Button type="link" className="packaging-link" onClick={() => openForm(row)}>编辑</Button><Button type="link" danger className="packaging-link" onClick={() => removeRows([row])}>删除</Button></Space> },
  ];
  const dataColumns = allColumns.slice(0, -1);
  const ordered = [...dataColumns].sort((a, b) => order.indexOf(String(a.key)) - order.indexOf(String(b.key)));
  const columns = [...ordered.filter(column => !hidden.includes(String(column.key))), allColumns[allColumns.length - 1]];
  const columnOptions: ColumnOption[] = dataColumns.map(column => ({ key: String(column.key), label: String(column.title) }));
  const exportRows = (target = selectedRows.length ? selectedRows : filtered) => exportCsv(['规格编码', '规格名称', '包装类型', '标准净重(kg)', '包装单位', '状态', '更新时间'], target.map(row => [row.code, row.name, row.packageType, row.netWeight, row.unit, row.enabled ? '启用' : '停用', row.updated]), '包装规格.csv');
  return <div className="packaging-page">
    <Card className="packaging-filter" bordered={false}><div className="packaging-filters">
      <label>规格编码/名称<Input allowClear placeholder="请输入编码或名称" value={filters.keyword} onChange={event => setFilters({ ...filters, keyword: event.target.value })} /></label>
      <label>包装类型<Select allowClear placeholder="全部类型" value={filters.packageType || undefined} options={['塑料盒', '礼品纸盒', '周转箱', '纸箱'].map(value => ({ value, label: value }))} onChange={packageType => setFilters({ ...filters, packageType: packageType ?? '' })} /></label>
      <label>状态<Select allowClear placeholder="全部状态" value={filters.status || undefined} options={['启用', '停用'].map(value => ({ value, label: value }))} onChange={status => setFilters({ ...filters, status: status ?? '' })} /></label>
      <div className="packaging-filter-actions"><Button onClick={() => { const empty = { keyword: '', packageType: '', status: '' }; setFilters(empty); setApplied(empty); setPage(1); }}>重置</Button><Button type="primary" onClick={() => { setApplied(filters); setPage(1); setSelected([]); }}>查询</Button></div>
    </div></Card>
    <Card className="packaging-table-card" bordered={false}>
      <TableSelectionToolbar title="包装规格" selectedCount={selectedRows.length} selectedLabel="条规格" onClear={() => setSelected([])} className="packaging-toolbar"
        batchActions={<Space size={8}><Button danger icon={<DeleteOutlined />} onClick={() => removeRows(selectedRows)}>批量删除</Button><Button onClick={() => exportRows(selectedRows)}>批量导出</Button></Space>}
        fixedActions={<Space size={8}><Button type="primary" onClick={() => openForm()}>新增规格</Button><Button onClick={() => exportRows()} disabled={!filtered.length}>导出</Button><ColumnSettingsPopover columns={columnOptions} hiddenKeys={hidden} onHiddenKeysChange={setHidden} order={order} onOrderChange={setOrder} /></Space>} />
      <Table<PackagingSpec> rowKey="key" size="small" columns={columns} dataSource={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)} pagination={false} rowSelection={{ selectedRowKeys: selected, onChange: keys => setSelected(keys.map(String)), preserveSelectedRowKeys: true, columnWidth: 40 }} scroll={{ x: columns.reduce((sum, column) => sum + Number(column.width ?? 100), 40) }} locale={{ emptyText: '暂无包装规格' }} />
      <div className="packaging-pagination"><strong>共 {filtered.length.toLocaleString()} 项数据</strong><Pagination current={currentPage} pageSize={pageSize} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} total={filtered.length} onChange={(nextPage, nextSize) => { setPage(nextSize !== pageSize ? 1 : nextPage); setPageSize(nextSize); }} /></div>
    </Card>
    <Modal className="business-modal packaging-edit-modal" centered width={FLOATING_LAYER_WIDTHS.formModal} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} open={modalOpen} title={editing ? '编辑包装规格' : '新增包装规格'} onCancel={() => setModalOpen(false)} onOk={save} okText="保存" cancelText="取消">
      <Form form={form} layout="vertical"><div className="packaging-form-grid">
        <Form.Item name="code" label="规格编码" rules={[{ required: true, message: '请输入规格编码' }]}><Input disabled={!!editing} maxLength={20} placeholder="如 PS007" /></Form.Item>
        <Form.Item name="name" label="规格名称" rules={[{ required: true, message: '请输入规格名称' }]}><Input maxLength={30} placeholder="请输入规格名称" /></Form.Item>
        <Form.Item name="packageType" label="包装类型" rules={[{ required: true, message: '请选择包装类型' }]}><Select options={['塑料盒', '礼品纸盒', '周转箱', '纸箱'].map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="netWeight" label="标准净重（kg）" rules={[{ required: true, message: '请输入标准净重' }]}><InputNumber min={0.001} precision={3} placeholder="请输入净重" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="unit" label="包装单位" rules={[{ required: true, message: '请选择包装单位' }]}><Select options={['盒', '箱', '袋'].map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="enabled" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
      </div></Form>
    </Modal>
  </div>;
}
