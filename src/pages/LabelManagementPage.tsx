import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Select, Space, Switch, Tag } from 'antd';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../components/floatingLayer';

type LabelTemplate = { key: string; code: string; name: string; scene: string; size: string; fields: string[]; enabled: boolean; updated: string };
const initialRows: LabelTemplate[] = [
  { key: 'LB001', code: 'LB001', name: '采摘筐标签', scene: '采摘称重', size: '100 × 60 mm', fields: ['基地名称', '采摘批次', '果品名称', '果径等级', '筐号', '称重时间'], enabled: true, updated: '2026-10-22 16:30' },
  { key: 'LB002', code: 'LB002', name: '原果周转箱标签', scene: '原果入库', size: '100 × 80 mm', fields: ['基地名称', '入库单号', '果品名称', '果径等级', '箱号', '入库日期'], enabled: true, updated: '2026-10-21 11:20' },
  { key: 'LB003', code: 'LB003', name: '成品箱标签', scene: '成品出库', size: '100 × 60 mm', fields: ['产品名称', '规格', '批次号', '箱号', '净重', '生产日期'], enabled: true, updated: '2026-10-20 09:45' },
  { key: 'LB004', code: 'LB004', name: '成品托盘标签', scene: '成品组托', size: '100 × 150 mm', fields: ['产品名称', '规格', '托盘码', '箱数', '总净重', '组托日期'], enabled: false, updated: '2026-10-18 14:05' },
  { key: 'LB005', code: 'LB005', name: '散果称重标签', scene: '散果称重', size: '70 × 40 mm', fields: ['果品名称', '等级', '重量', '称重时间', '批次号'], enabled: true, updated: '2026-10-16 10:15' },
];
const scenes = ['采摘称重', '原果入库', '成品组托', '成品出库', '散果称重'];
type LabelForm = { code: string; name: string; scene: string; size: string; fieldsText: string; enabled: boolean };

export default function LabelManagementPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState(initialRows);
  const [filters, setFilters] = useState({ keyword: '', scene: '', status: '' });
  const [applied, setApplied] = useState(filters);
  const [form] = Form.useForm<LabelForm>();
  const [editing, setEditing] = useState<LabelTemplate>();
  const [formOpen, setFormOpen] = useState(false);
  const [preview, setPreview] = useState<LabelTemplate>();
  const filtered = useMemo(() => rows.filter(row =>
    (!applied.keyword || `${row.code}${row.name}`.toLowerCase().includes(applied.keyword.trim().toLowerCase())) &&
    (!applied.scene || row.scene === applied.scene) &&
    (!applied.status || (applied.status === '启用' ? row.enabled : !row.enabled))), [rows, applied]);
  const openForm = (row?: LabelTemplate) => {
    setEditing(row);
    form.setFieldsValue(row ? { code: row.code, name: row.name, scene: row.scene, size: row.size, fieldsText: row.fields.join('、'), enabled: row.enabled } : { code: '', name: '', scene: undefined, size: '', fieldsText: '', enabled: true });
    setFormOpen(true);
  };
  const save = async () => {
    const value = await form.validateFields();
    if (rows.some(row => row.code === value.code.trim() && row.key !== editing?.key)) {
      form.setFields([{ name: 'code', errors: ['标签编码已存在'] }]);
      return;
    }
    const updated = '2026-10-23 10:00';
    const next: LabelTemplate = { key: editing?.key ?? value.code.trim(), code: value.code.trim(), name: value.name.trim(), scene: value.scene, size: value.size.trim(), fields: value.fieldsText.split(/[、,，]/).map(field => field.trim()).filter(Boolean), enabled: value.enabled, updated };
    setRows(current => editing ? current.map(row => row.key === editing.key ? next : row) : [next, ...current]);
    setFormOpen(false);
    message.success(editing ? '标签模板已更新' : '标签模板已新增');
  };
  const remove = (row: LabelTemplate) => Modal.confirm({
    title: '删除标签模板',
    content: `确定删除「${row.name}」吗？`,
    centered: true,
    width: FLOATING_LAYER_WIDTHS.confirmModal,
    style: { maxWidth: FLOATING_LAYER_MAX_WIDTH },
    styles: getModalStyles(),
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: () => {
      setRows(current => current.filter(item => item.key !== row.key));
      message.success('标签模板已删除');
    },
  });
  return <div className="label-page">
    <Card className="label-filter" variant="borderless"><div className="label-filters">
      <label>关键词<Input allowClear placeholder="输入编码或模板名称" value={filters.keyword} onChange={event => setFilters({ ...filters, keyword: event.target.value })} onPressEnter={() => setApplied(filters)} /></label>
      <label>使用场景<Select allowClear placeholder="全部场景" value={filters.scene || undefined} options={scenes.map(value => ({ value, label: value }))} onChange={scene => setFilters({ ...filters, scene: scene ?? '' })} /></label>
      <label>状态<Select allowClear placeholder="全部状态" value={filters.status || undefined} options={['启用', '停用'].map(value => ({ value, label: value }))} onChange={status => setFilters({ ...filters, status: status ?? '' })} /></label>
      <div className="label-filter-actions"><Button onClick={() => { const empty = { keyword: '', scene: '', status: '' }; setFilters(empty); setApplied(empty); }}>重置</Button><Button type="primary" onClick={() => setApplied(filters)}>查询</Button></div>
    </div></Card>
    <Card className="label-results-card ds-list-card" variant="borderless">
      <div className="label-card-toolbar">
        <div className="label-card-toolbar-leading">
          <strong className="label-card-toolbar-title">标签模板</strong>
        </div>
        <div className="label-card-toolbar-actions">
          <Button type="primary" onClick={() => openForm()}>新增模板</Button>
        </div>
      </div>
      {filtered.length ? <div className="label-card-grid">
        {filtered.map(row => {
          return <Card key={row.key} className="card-item label-template-card">
            <div className="label-template-heading">
              <div className="label-template-title-wrap"><div className="label-template-title-line"><strong title={row.name}>{row.name}</strong></div><span>{row.code} · {row.scene}</span></div>
              <Switch checked={row.enabled} checkedChildren="启用" unCheckedChildren="停用" onChange={enabled => setRows(current => current.map(item => item.key === row.key ? { ...item, enabled, updated: '2026-10-23 10:00' } : item))} />
            </div>
            <div className="label-template-preview-stage">
              <div className="label-template-preview-paper">
                <div className="label-template-preview-brand">新疆农牧投 · 蓝莓</div>
                <strong>{row.name}</strong>
                <div className="label-template-preview-fields">{row.fields.slice(0, 3).map((field, index) => <div key={`${field}-${index}`}><span>{field}</span><b>{index === 0 ? '蓝莓1号' : index === 1 ? '示例批次' : '—'}</b></div>)}</div>
                <div className="label-template-preview-barcode" aria-label={`标签编码 ${row.code}`}><span />{row.code}</div>
              </div>
            </div>
            <div className="label-template-meta"><span>尺寸 <strong>{row.size}</strong></span><span>更新于 {row.updated.slice(0, 10)}</span></div>
            <div className="label-template-footer">
              <Space size={16}><Button type="link" className="label-link" onClick={() => setPreview(row)}>预览</Button><Button type="link" className="label-link" onClick={() => openForm(row)}>编辑</Button><Button type="link" danger className="label-link" onClick={() => remove(row)}>删除</Button></Space>
            </div>
          </Card>;
        })}
      </div> : <div className="label-empty-state">暂无符合条件的标签模板</div>}
    </Card>
    <Modal className="business-modal label-edit-modal" centered width={FLOATING_LAYER_WIDTHS.formModal} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} open={formOpen} title={editing ? '编辑标签模板' : '新增标签模板'} onCancel={() => setFormOpen(false)} onOk={save} okText="保存" cancelText="取消">
      <Form form={form} layout="vertical"><div className="label-form-grid">
        <Form.Item name="code" label="标签编码" rules={[{ required: true, message: '请输入标签编码' }]}><Input disabled={!!editing} maxLength={20} placeholder="如 LB006" /></Form.Item>
        <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}><Input maxLength={30} placeholder="请输入模板名称" /></Form.Item>
        <Form.Item name="scene" label="使用场景" rules={[{ required: true, message: '请选择使用场景' }]}><Select placeholder="请选择" options={scenes.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="size" label="标签尺寸" rules={[{ required: true, message: '请输入标签尺寸' }]}><Input maxLength={30} placeholder="如 100 × 60 mm" /></Form.Item>
        <Form.Item className="label-form-fields" name="fieldsText" label="打印字段" rules={[{ required: true, message: '请输入至少一个打印字段' }]} extra="用顿号或逗号分隔字段名称"><Input.TextArea rows={3} maxLength={160} placeholder="如 产品名称、规格、批次号、净重" /></Form.Item>
        <Form.Item name="enabled" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
      </div></Form>
    </Modal>
    <Modal className="business-modal label-preview-modal" centered width={FLOATING_LAYER_WIDTHS.formModal} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} open={!!preview} title="标签预览" onCancel={() => setPreview(undefined)} footer={<Button type="primary" onClick={() => setPreview(undefined)}>完成</Button>}>
      {preview && <div className="label-preview-wrap"><div className="label-preview-paper"><div className="label-preview-brand">新疆农牧投 · 蓝莓</div><strong>{preview.name}</strong><Tag color={preview.enabled ? 'blue' : 'default'}>{preview.scene}</Tag><div className="label-preview-size">{preview.size}</div><div className="label-preview-fields">{preview.fields.map((field, index) => <div key={`${field}-${index}`}><span>{field}</span><b>{index === 0 ? '示例内容' : '—'}</b></div>)}</div><div className="label-preview-code">{preview.code}</div></div><p>此处为模板内容示意，打印效果取决于后续连接的打印服务与设备。</p></div>}
    </Modal>
  </div>;
}
