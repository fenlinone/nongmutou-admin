import { useState } from 'react';
import { Alert, App, Button, Checkbox, Descriptions, Drawer, Form, Input, Space, Table, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { formatWeight, totalWeight, useFinishedGoods, type FinishedBox, type Outbound } from '../../finishedGoods';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_TOKENS, FLOATING_LAYER_WIDTHS, getDrawerStyles } from '../floatingLayer';

export type FinishedView = { type: 'box' | 'pallet' | 'inbound' | 'outbound' | 'document' | 'label'; id: string };
const LAYER = { width: FLOATING_LAYER_WIDTHS.complexDrawer, padding: FLOATING_LAYER_TOKENS.contentPadding };
const titles = { box: '成品箱详情', pallet: '托盘详情', inbound: '组托入库详情', outbound: '成品出库批次详情', document: '成品出库单预览', label: '托盘标签预览' };
export function BoxList({ boxes, onView }: { boxes: FinishedBox[]; onView?: (view: FinishedView) => void }) {
  const columns: ColumnsType<FinishedBox> = [
    { title: '箱码', dataIndex: 'code', width: 180, render: code => onView ? <Button type="link" className="finished-link" onClick={() => onView({ type: 'box', id: code })}>{code}</Button> : code },
    { title: '品种', dataIndex: 'variety', width: 96 }, { title: '果径', dataIndex: 'size', width: 72 }, { title: '等级', dataIndex: 'grade', width: 82 }, { title: '包装规格', dataIndex: 'spec', width: 150 },
    { title: '标准净重 (kg)', dataIndex: 'weight', width: 150, render: formatWeight },
    { title: '原组托托盘', dataIndex: 'pallet', width: 180, render: code => code && onView ? <Button type="link" className="finished-link" onClick={() => onView({ type: 'pallet', id: code })}>{code}</Button> : code ?? '未组托' },
  ];
  const scrollWidth = columns.reduce((sum, column) => sum + Number(column.width ?? 100), 40);
  return <Table className="finished-box-list" rowKey="code" size="small" columns={columns} dataSource={boxes} pagination={false} scroll={{ x: scrollWidth }} locale={{ emptyText: '暂无成品箱' }} />;
}
export default function FinishedGoodsDetails({ view, onClose, onView, onRestore }: { view?: FinishedView; onClose: () => void; onView: (view: FinishedView) => void; onRestore: (record: Outbound) => void }) {
  const { state } = useFinishedGoods();
  const [palletList, setPalletList] = useState<'original' | 'current'>('original');
  const box = state.boxes.find(item => item.code === view?.id);
  const pallet = state.pallets.find(item => item.code === view?.id);
  const inbound = state.inbound.find(item => item.id === view?.id);
  const outbound = state.outbound.find(item => item.id === view?.id);
  const original = pallet ? state.boxes.filter(item => pallet.codes.includes(item.code)) : [];
  const current = original.filter(item => item.state === 'stock');
  const show = (type: FinishedView['type'], id: string) => onView({ type, id });
  const link = (type: FinishedView['type'], id: string) => <Button type="link" className="finished-link" onClick={() => show(type, id)}>{id}</Button>;
  const headerActions = view?.type === 'pallet' && pallet ? <Button onClick={() => show('label', pallet.code)}>托盘标签预览 / 补打</Button> : view?.type === 'outbound' && outbound ? <Space><Button onClick={() => show('document', outbound.id)}>查看出库单</Button><Button type="primary" disabled={!!outbound.restoration} onClick={() => onRestore(outbound)}>整批恢复库存</Button></Space> : undefined;
  return <Drawer open={!!view} onClose={onClose} size={LAYER.width} rootClassName="finished-drawer" styles={getDrawerStyles({wrapper:{maxWidth:FLOATING_LAYER_MAX_WIDTH},body:{padding:LAYER.padding}})} closable={false}
    title={<Space><Button type="text" aria-label="关闭详情" icon={<ArrowLeftOutlined />} onClick={onClose} />{view && titles[view.type]}</Space>} extra={headerActions}>
    {view?.type === 'box' && box && <div className="finished-detail-stack">
      <Descriptions column={2} items={[
        { key: 'code', label: '箱码', children: box.code }, { key: 'state', label: '当前状态', children: <Tag color={box.state === 'stock' ? 'success' : 'default'}>{box.state === 'stock' ? '在库' : box.state === 'out' ? '已出库' : '待组托'}</Tag> },
        { key: 'variety', label: '品种', children: box.variety }, { key: 'size', label: '果径', children: box.size }, { key: 'grade', label: '等级', children: box.grade }, { key: 'spec', label: '包装规格', children: box.spec }, { key: 'weight', label: '每箱标准净重', children: `${formatWeight(box.weight)} kg` },
        { key: 'pallet', label: '原组托托盘', children: box.pallet ? link('pallet', box.pallet) : '未组托' }, { key: 'warehouse', label: '入库仓库', children: box.warehouse ?? '—' }, { key: 'time', label: '入库时间', children: box.inboundAt ?? '—' },
      ]} />
      <h3>入库与流转记录</h3>
      {state.inbound.filter(row => row.boxes.some(item => item.code === box.code)).map(row => <div className="finished-flow" key={row.id}>{link('inbound', row.id)}<span>组托入库 · {row.time}</span></div>)}
      {state.outbound.filter(row => row.boxes.some(item => item.code === box.code)).map(row => <div className="finished-flow" key={row.id}>{link('outbound', row.id)}<span>出库 · {row.time}{row.restoration && `；整批恢复 · ${row.restoration.time}`}</span></div>)}
      <Alert type="info" showIcon title="净重为包装规格预设的标准净重，不作为逐箱实称重量。" />
    </div>}
    {(view?.type === 'pallet' || view?.type === 'label') && pallet && <div className="finished-detail-stack">
      {view.type === 'label' ? <><Alert type="info" showIcon title="标签仅供演示预览，未连接打印机；补打沿用原托盘码，不改变库存。" /><div className="finished-label"><span>新疆农牧投 · 成品托盘</span><strong>{pallet.code}</strong><p>{original[0]?.variety} · {original[0]?.spec}</p><b>原组托 {original.length} 箱 · {formatWeight(totalWeight(original))} kg</b><p>{pallet.warehouse} · {pallet.time}</p></div><Button onClick={() => show('pallet', pallet.code)}>返回托盘详情</Button></> : <>
        <Descriptions column={2} items={[{ key: 'code', label: '托盘码', children: pallet.code }, { key: 'variety', label: '品种', children: original[0]?.variety }, { key: 'spec', label: '包装规格', children: original[0]?.spec }, { key: 'warehouse', label: '入库仓库', children: pallet.warehouse }, { key: 'original', label: '原组托箱数', children: `${original.length} 箱` }, { key: 'current', label: '关联箱当前在库', children: `${current.length} 箱 / ${formatWeight(totalWeight(current))} kg` }, { key: 'time', label: '组托时间', children: pallet.time }]} />
        <Alert showIcon type="info" title="以下按原组托记录核对关联箱的在库状态。拆零、恢复后的现场托盘归属待确认，本演示不执行解绑或重组托。" />
        <Space><Button type={palletList === 'original' ? 'primary' : 'default'} onClick={() => setPalletList('original')}>原组托清单（{original.length}）</Button><Button type={palletList === 'current' ? 'primary' : 'default'} onClick={() => setPalletList('current')}>当前在库清单（{current.length}）</Button></Space>
        <BoxList boxes={palletList === 'original' ? original : current} onView={onView} />
        <h3>流转记录</h3>
        {state.inbound.filter(row => row.pallet === pallet.code).map(row => <div className="finished-flow" key={row.id}>{link('inbound', row.id)}<span>入库 {row.boxes.length} 箱 · {row.operator} · {row.time}</span></div>)}
        {state.outbound.filter(row => row.boxes.some(item => item.pallet === pallet.code)).map(row => <div className="finished-flow" key={row.id}>{link('outbound', row.id)}<span>本托关联出库 {row.boxes.filter(item => item.pallet === pallet.code).length} 箱 · {row.time}{row.restoration && `；已整批恢复 · ${row.restoration.time}`}</span></div>)}
      </>}
    </div>}
    {view?.type === 'inbound' && inbound && <div className="finished-detail-stack"><Descriptions column={2} items={[{ key: 'id', label: '入库流水号', children: inbound.id }, { key: 'pallet', label: '托盘码', children: link('pallet', inbound.pallet) }, { key: 'warehouse', label: '入库仓库', children: inbound.warehouse }, { key: 'count', label: '入库箱数', children: `${inbound.boxes.length} 箱` }, { key: 'weight', label: '标准净重合计', children: `${formatWeight(totalWeight(inbound.boxes))} kg` }, { key: 'operator', label: '确认人', children: inbound.operator }, { key: 'time', label: '确认时间', children: inbound.time }]} /><h3>本次入库箱清单</h3><BoxList boxes={inbound.boxes} onView={onView} /></div>}
    {(view?.type === 'outbound' || view?.type === 'document') && outbound && <div className="finished-detail-stack">
      {view.type === 'document' && <Alert type="info" showIcon title="出库单为演示版，货物清单与原出库记录一致；正式业务字段、版式和打印要求待确认。" />}
      <Descriptions column={2} items={[{ key: 'id', label: '出库批次号', children: outbound.id }, { key: 'document', label: '出库单号', children: outbound.document }, { key: 'warehouse', label: '出库仓库', children: outbound.warehouse }, { key: 'count', label: '原出库箱数', children: `${outbound.boxes.length} 箱` }, { key: 'weight', label: '标准净重合计', children: `${formatWeight(totalWeight(outbound.boxes))} kg` }, { key: 'operator', label: '操作人', children: outbound.operator }, { key: 'time', label: '出库时间', children: outbound.time }, { key: 'restored', label: '库存恢复状态', children: <Tag color={outbound.restoration ? 'success' : 'default'}>{outbound.restoration ? '已恢复库存' : '未恢复'}</Tag> }]} />
      <h3>原出库完整箱清单</h3><p className="finished-muted">托盘码保留出库时记录；原出库数量不随库存恢复而改变。</p><BoxList boxes={outbound.boxes} onView={onView} />
      {outbound.restoration && <><h3>整批恢复记录</h3><Descriptions column={1} items={[{ key: 'reason', label: '恢复原因', children: outbound.restoration.reason }, { key: 'operator', label: '恢复操作人', children: outbound.restoration.operator }, { key: 'time', label: '恢复时间', children: outbound.restoration.time }]} /></>}
      {view.type === 'document' && <Button onClick={() => show('outbound', outbound.id)}>返回出库批次详情</Button>}
    </div>}
  </Drawer>;
}

export function FinishedRestoreDrawer({ batch, onClose, onComplete }: { batch?: string; onClose: () => void; onComplete: (id: string) => void }) {
  const { state, transact } = useFinishedGoods();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ reason: string; checked: boolean }>();
  const record = state.outbound.find(row => row.id === batch);
  const submit = async () => {
    const values = await form.validateFields().catch(() => undefined);
    if (!values || !record) return;
    const result = transact({ type: 'restore', batch: record.id, reason: values.reason, time: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    if (!result.ok) { message.error(result.error); return; }
    onComplete(record.id);
  };
  return <Drawer open={!!record} size={LAYER.width} rootClassName="finished-drawer" closable={false} onClose={onClose} styles={getDrawerStyles({wrapper:{maxWidth:FLOATING_LAYER_MAX_WIDTH},body:{padding:LAYER.padding}})}
    title={<Space><Button type="text" aria-label="关闭恢复面板" icon={<ArrowLeftOutlined />} onClick={onClose} />整批恢复库存</Space>}
    extra={<Space><Button onClick={onClose}>取消</Button><Button type="primary" disabled={!!record?.restoration} onClick={submit}>确认整批恢复</Button></Space>}>
    {record && <div className="finished-detail-stack"><Alert type="warning" showIcon title={`本次将恢复原批次全部 ${record.boxes.length} 箱（${formatWeight(totalWeight(record.boxes))} kg），同一批次只能恢复一次。`} /><Descriptions column={1} items={[{ key: 'batch', label: '原出库批次', children: record.id }, { key: 'document', label: '原出库单', children: record.document }, { key: 'warehouse', label: '原出库仓库', children: record.warehouse }]} /><BoxList boxes={record.boxes} />
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item name="reason" label="恢复原因" rules={[{ required: true, whitespace: true, message: '请填写取消发货或整批退货回仓的原因' }]}><Input.TextArea rows={3} maxLength={500} showCount placeholder="请说明取消发货或整批退货回仓的原因" /></Form.Item>
        <Form.Item name="checked" valuePropName="checked" rules={[{ validator: (_, checked) => checked ? Promise.resolve() : Promise.reject(new Error('请先确认整批货物已回仓')) }]}><Checkbox>我已核对原批次完整清单，全部货物已回仓或取消发货并放回仓库</Checkbox></Form.Item>
      </Form>
    </div>}
  </Drawer>;
}
