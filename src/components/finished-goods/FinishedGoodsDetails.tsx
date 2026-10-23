import { useState } from 'react';
import { Alert, App, Button, Descriptions, Drawer, Modal, Space, Table, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { formatWeight, totalWeight, useFinishedGoods, type FinishedBox, type Outbound } from '../../finishedGoods';
import ColumnSettingsPopover from '../ColumnSettingsPopover';
import type { ColumnOption } from '../ColumnSettingsPopover';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_TOKENS, FLOATING_LAYER_WIDTHS, getDrawerStyles, getModalStyles } from '../floatingLayer';
import { exportCsv } from '../../data';

export type FinishedView = { type: 'box' | 'pallet' | 'inbound' | 'outbound' | 'document' | 'label'; id: string };
const LAYER = { width: FLOATING_LAYER_WIDTHS.complexDrawer, padding: FLOATING_LAYER_TOKENS.contentPadding };
const titles = { box: '成品箱详情', pallet: '托盘详情', inbound: '组托入库详情', outbound: '成品出库批次详情', document: '成品出库单预览', label: '托盘标签预览' };
export function BoxList({ boxes, onView, title = '箱明细' }: { boxes: FinishedBox[]; onView?: (view: FinishedView) => void; title?: string }) {
  const [settingsByTitle, setSettingsByTitle] = useState<Record<string, { hidden: string[]; order: string[] }>>({});
  const columns: ColumnsType<FinishedBox> = [
    { title: '箱码', key: 'code', dataIndex: 'code', width: 180, render: code => onView ? <Button type="link" className="finished-link" onClick={() => onView({ type: 'box', id: code })}>{code}</Button> : code },
    { title: '品种', key: 'variety', dataIndex: 'variety', width: 96 }, { title: '果径', key: 'size', dataIndex: 'size', width: 72 }, { title: '等级', key: 'grade', dataIndex: 'grade', width: 82 }, { title: '包装规格', key: 'spec', dataIndex: 'spec', width: 150 },
    { title: '标准净重 (kg)', key: 'weight', dataIndex: 'weight', width: 150, render: formatWeight },
    { title: '原组托托盘', key: 'pallet', dataIndex: 'pallet', width: 180, render: code => code && onView ? <Button type="link" className="finished-link" onClick={() => onView({ type: 'pallet', id: code })}>{code}</Button> : code ?? '未组托' },
  ];
  const columnOptions: ColumnOption[] = columns.map(column => ({ key: String(column.key), label: String(column.title) }));
  const settings = settingsByTitle[title] ?? { hidden: [], order: columnOptions.map(column => column.key) };
  const orderedColumns = [...columns].sort((left, right) => settings.order.indexOf(String(left.key)) - settings.order.indexOf(String(right.key)));
  const visibleColumns = orderedColumns.filter(column => !settings.hidden.includes(String(column.key)));
  const scrollWidth = visibleColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 40);
  return <>
    <div className="ds-card-title-row"><strong className="ds-table-title">{title}</strong><Space size={8}><Button onClick={() => exportCsv(['箱码', '品种', '果径', '等级', '包装规格', '标准净重(kg)', '原组托托盘'], boxes.map(box => [box.code, box.variety, box.size, box.grade, box.spec, formatWeight(box.weight), box.pallet ?? '未组托']), '成品箱明细.csv')} disabled={!boxes.length}>导出</Button><ColumnSettingsPopover columns={columnOptions} hiddenKeys={settings.hidden} onHiddenKeysChange={hidden => setSettingsByTitle(current => ({ ...current, [title]: { ...settings, hidden } }))} order={settings.order} onOrderChange={order => setSettingsByTitle(current => ({ ...current, [title]: { ...settings, order } }))} /></Space></div>
    <Table className="finished-box-list" rowKey="code" size="small" columns={visibleColumns} dataSource={boxes} pagination={false} scroll={{ x: scrollWidth }} locale={{ emptyText: '暂无成品箱' }} />
  </>;
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
  const drawerWidth = view?.type === 'box' ? FLOATING_LAYER_WIDTHS.detailDrawer : LAYER.width;
  return <Drawer open={!!view} onClose={onClose} size={drawerWidth} rootClassName="finished-drawer" styles={getDrawerStyles({wrapper:{maxWidth:FLOATING_LAYER_MAX_WIDTH},body:{padding:LAYER.padding}})} closable={false}
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
        <BoxList title={palletList === 'original' ? '原组托清单' : '当前在库清单'} boxes={palletList === 'original' ? original : current} onView={onView} />
        <h3>流转记录</h3>
        {state.inbound.filter(row => row.pallet === pallet.code).map(row => <div className="finished-flow" key={row.id}>{link('inbound', row.id)}<span>入库 {row.boxes.length} 箱 · {row.operator} · {row.time}</span></div>)}
        {state.outbound.filter(row => row.boxes.some(item => item.pallet === pallet.code)).map(row => <div className="finished-flow" key={row.id}>{link('outbound', row.id)}<span>本托关联出库 {row.boxes.filter(item => item.pallet === pallet.code).length} 箱 · {row.time}{row.restoration && `；已整批恢复 · ${row.restoration.time}`}</span></div>)}
      </>}
    </div>}
    {view?.type === 'inbound' && inbound && <div className="finished-detail-stack"><Descriptions column={2} items={[{ key: 'id', label: '入库流水号', children: inbound.id }, { key: 'pallet', label: '托盘码', children: link('pallet', inbound.pallet) }, { key: 'warehouse', label: '入库仓库', children: inbound.warehouse }, { key: 'count', label: '入库箱数', children: `${inbound.boxes.length} 箱` }, { key: 'weight', label: '标准净重合计', children: `${formatWeight(totalWeight(inbound.boxes))} kg` }, { key: 'operator', label: '确认人', children: inbound.operator }, { key: 'time', label: '确认时间', children: inbound.time }]} /><BoxList title="本次入库箱清单" boxes={inbound.boxes} onView={onView} /></div>}
    {(view?.type === 'outbound' || view?.type === 'document') && outbound && <div className="finished-detail-stack">
      {view.type === 'document' && <Alert type="info" showIcon title="出库单为演示版，货物清单与原出库记录一致；正式业务字段、版式和打印要求待确认。" />}
      <Descriptions column={2} items={[{ key: 'id', label: '出库批次号', children: outbound.id }, { key: 'document', label: '出库单号', children: outbound.document }, { key: 'warehouse', label: '出库仓库', children: outbound.warehouse }, { key: 'count', label: '原出库箱数', children: `${outbound.boxes.length} 箱` }, { key: 'weight', label: '标准净重合计', children: `${formatWeight(totalWeight(outbound.boxes))} kg` }, { key: 'operator', label: '操作人', children: outbound.operator }, { key: 'time', label: '出库时间', children: outbound.time }, { key: 'restored', label: '库存恢复状态', children: <Tag color={outbound.restoration ? 'success' : 'default'}>{outbound.restoration ? '已恢复库存' : '未恢复'}</Tag> }]} />
      <p className="finished-muted">托盘码保留出库时记录；原出库数量不随库存恢复而改变。</p><BoxList title="原出库完整箱清单" boxes={outbound.boxes} onView={onView} />
      {outbound.restoration && <><h3>整批恢复记录</h3><Descriptions column={1} items={[{ key: 'reason', label: '恢复原因', children: outbound.restoration.reason }, { key: 'operator', label: '恢复操作人', children: outbound.restoration.operator }, { key: 'time', label: '恢复时间', children: outbound.restoration.time }]} /></>}
      {view.type === 'document' && <Button onClick={() => show('outbound', outbound.id)}>返回出库批次详情</Button>}
    </div>}
  </Drawer>;
}

export function FinishedRestoreModal({ batch, onClose, onComplete }: { batch?: string; onClose: () => void; onComplete: (id: string) => void }) {
  const { state, transact } = useFinishedGoods();
  const { message } = App.useApp();
  const record = state.outbound.find(row => row.id === batch);
  const submit = () => {
    if (!record) return;
    const result = transact({ type: 'restore', batch: record.id, reason: '确认恢复库存', time: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    if (!result.ok) { message.error(result.error); return; }
    onComplete(record.id);
  };
  return <Modal open={!!record} centered width={FLOATING_LAYER_WIDTHS.confirmModal} style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} title="确认恢复库存" onCancel={onClose} onOk={submit} okText="确认恢复" cancelText="取消" okButtonProps={{ disabled: !record || !!record.restoration }}>
    {record && <div className="finished-detail-stack"><Alert type="warning" showIcon title={`确认将出库批次 ${record.id} 的全部 ${record.boxes.length} 箱（${formatWeight(totalWeight(record.boxes))} kg）恢复至原出库仓库？同一批次只能恢复一次。`} /><Descriptions column={1} items={[{ key: 'document', label: '原出库单', children: record.document }, { key: 'warehouse', label: '恢复至仓库', children: record.warehouse }]} /></div>}
  </Modal>;
}
