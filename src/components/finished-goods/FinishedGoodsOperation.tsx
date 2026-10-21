import { useState } from 'react';
import { Alert, Breadcrumb, Button, Checkbox, Empty, Input, Modal, Result, Segmented, Select, Space, Table, Tag } from 'antd';
import { ArrowLeftOutlined, ScanOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { finishedWarehouses, formatWeight, totalWeight, useFinishedGoods, type FinishedBox } from '../../finishedGoods';
import type { FinishedView } from './FinishedGoodsDetails';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../floatingLayer';
import TableSelectionToolbar from '../TableSelectionToolbar';
export default function FinishedGoodsOperation({ mode, onView }: { mode: 'group' | 'dispatch'; onView: (view: FinishedView) => void }) {
  const { state, transact } = useFinishedGoods();
  const grouping = mode === 'group';
  const [codes, setCodes] = useState<string[]>([]);
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [warehouse, setWarehouse] = useState<string | undefined>(grouping ? undefined : finishedWarehouses[0]);
  const [selectionMode, setSelectionMode] = useState('托盘');
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ id: string; count: number; weight: number }>();
  const boxes = codes.map(code => state.boxes.find(box => box.code === code)).filter((box): box is FinishedBox => !!box);
  const available = state.boxes.filter(box => box.state === 'stock' && box.warehouse === warehouse);
  const pending = state.boxes.filter(box => box.state === 'pending');
  const back = () => { location.hash = `/finished-goods/${grouping ? 'inventory' : 'outbound'}`; };
  const changeCodes = (next: string[]) => { setCodes([...new Set(next)]); setError(''); };
  const add = (value: string) => {
    const code = value.trim();
    if (!code) { setError('请扫描或输入箱码' + (grouping ? '。' : ' / 托盘码。')); return; }
    if (grouping) {
      const box = state.boxes.find(item => item.code === code);
      if (!box) { setError('箱码不存在，请核对已打印的成品标签。'); return; }
      if (codes.includes(code)) { setError('此箱已在本次清单中，不重复计数。'); return; }
      if (box.state !== 'pending' || box.pallet) { setError('此箱已组托或已入库，不能再次加入。'); return; }
      if (boxes[0] && (box.variety !== boxes[0].variety || box.spec !== boxes[0].spec)) { setError('同一托盘必须为同品种、同包装规格，请另建托盘。'); return; }
      changeCodes([...codes, code]);
    } else {
      const pallet = state.pallets.find(item => item.code === code);
      const found = available.filter(box => box.code === code || pallet?.codes.includes(box.code));
      if (!found.length) { setError('未找到当前仓库可出库货物，请检查码、仓库和在库状态。'); return; }
      if (found.every(box => codes.includes(box.code))) { setError('货物已全部选中，不重复计数。'); return; }
      changeCodes([...codes, ...found.map(box => box.code)]);
    }
    setInput('');
  };
  const commit = () => {
    if (!checked) return;
    const action = grouping ? { type: 'inbound' as const, codes, warehouse: warehouse ?? '', time: dayjs().format('YYYY-MM-DD HH:mm:ss') } : { type: 'outbound' as const, codes, time: dayjs().format('YYYY-MM-DD HH:mm:ss') };
    const saved = transact(action);
    if (!saved.ok) { setConfirming(false); setError(saved.error ?? '请重新核对清单'); return; }
    setResult({ id: saved.id!, count: boxes.length, weight: totalWeight(boxes) }); setConfirming(false);
  };
  const columns: ColumnsType<FinishedBox> = [
    { title: '箱码', dataIndex: 'code', width: 180 }, { title: '品种', dataIndex: 'variety', width: 96 }, { title: '果径', dataIndex: 'size', width: 72 }, { title: '等级', dataIndex: 'grade', width: 82 },
    { title: '包装规格', dataIndex: 'spec', width: 150 }, { title: '标准净重 (kg)', dataIndex: 'weight', width: 150, render: formatWeight },
    ...(!grouping ? [{ title: '原组托托盘', dataIndex: 'pallet', width: 170 }, { title: '仓库', dataIndex: 'warehouse', width: 96 }] : []),
  ];
  const columnsWidth = columns.reduce((sum, column) => sum + Number(column.width ?? 100), 0);
  const listColumnsWidth = columnsWidth + 80;
  const title = grouping ? '组托入库' : '成品出库';
  const palletRows = state.pallets.map(pallet => ({ ...pallet, boxes: available.filter(box => pallet.codes.includes(box.code)) })).filter(pallet => pallet.boxes.length);
  const addSelectedSource = () => {
    const selectedPalletBoxes = palletRows.filter(row => selectedSourceKeys.includes(row.code)).flatMap(row => row.boxes.map(box => box.code));
    const selectedBoxCodes = available.filter(box => selectedSourceKeys.includes(box.code)).map(box => box.code);
    const nextCodes = [...new Set([...selectedPalletBoxes, ...selectedBoxCodes])];
    if (!nextCodes.length) return;
    changeCodes([...codes, ...nextCodes]);
    setSelectedSourceKeys([]);
  };
  const palletColumns = [
    { title: '原组托托盘码', dataIndex: 'code', width: 180 },
    { title: '品种', width: 96, render: (_: unknown, row: (typeof palletRows)[number]) => row.boxes[0].variety },
    { title: '包装规格', width: 150, render: (_: unknown, row: (typeof palletRows)[number]) => row.boxes[0].spec },
    { title: '当前在库箱数', width: 112, render: (_: unknown, row: (typeof palletRows)[number]) => row.boxes.length },
    { title: '标准净重 (kg)', width: 128, render: (_: unknown, row: (typeof palletRows)[number]) => formatWeight(totalWeight(row.boxes)) },
  ];
  const palletTableScrollWidth = palletColumns.reduce((sum, column) => sum + column.width, 40);
  return <div className="finished-operation ds-page-shell">
    <div className="ds-page-header-with-breadcrumb"><Breadcrumb separator="/" items={[{ title: <a href="#/finished-goods/inventory">成品管理</a> }, { title }]} /><div className="ds-page-header"><h1 className="ds-page-title">{title}</h1><Button aria-label="返回成品管理" icon={<ArrowLeftOutlined />} onClick={back}>返回成品管理</Button></div></div>
    {result ? <section className="ds-page-card"><Result status="success" title={grouping ? '组托入库完成' : '成品出库完成'} subTitle={`${result.count} 箱 · ${formatWeight(result.weight)} kg；${grouping ? '托盘码' : '出库批次'}：${result.id}`}
      extra={<Space wrap><Button type="primary" onClick={() => onView({ type: grouping ? 'label' : 'document', id: result.id })}>{grouping ? '查看托盘标签' : '查看出库单'}</Button><Button onClick={() => onView({ type: grouping ? 'pallet' : 'outbound', id: result.id })}>查看{grouping ? '托盘' : '出库'}详情</Button><Button onClick={() => { setResult(undefined); setCodes([]); setInput(''); setError(''); }}>继续{title}</Button><Button onClick={back}>返回列表</Button></Space>} />{grouping && <Alert showIcon type="info" title="库存和箱托记录已保存；托盘标签可预览，未连接实体打印机。" />}</section> : <>
      <section className="ds-page-card finished-operation-setup">
        <div className="ds-card-title-row"><strong className="ds-table-title">{grouping ? '逐箱扫码，人工确认入库' : '核对货物，确认出库'}</strong><Tag>{grouping ? '不设固定满托箱数' : '确认出库后扣减库存'}</Tag></div>
        <div className="finished-scan-row"><label> {grouping ? '入库仓库' : '出库仓库'}<Select aria-label={grouping ? '入库仓库' : '出库仓库'} value={warehouse} placeholder="请选择仓库" options={finishedWarehouses.map(value => ({ value, label: value }))} onChange={value => { setWarehouse(value); if (!grouping) changeCodes([]); }} /></label>
          <Input aria-label="扫码输入" value={input} onChange={event => setInput(event.target.value)} onPressEnter={() => add(input)} placeholder={grouping ? '扫描或输入成品箱码' : '扫描或输入箱码 / 托盘码'} prefix={<ScanOutlined />} allowClear />
          <Button type="primary" onClick={() => add(input)}>{grouping ? '加入本托' : '加入出库清单'}</Button></div>
        {error && <Alert role="alert" type="error" showIcon title={error} />}
        {grouping ? <div className="finished-demo-codes"><span>模拟扫码：</span>{pending.slice(0, 6).map(box => <Button key={box.code} size="small" disabled={codes.includes(box.code)} onClick={() => add(box.code)}>{box.code}</Button>)}<span className="finished-muted">点击箱码模拟扫描已贴码成品；可手动输入其他演示码。</span></div> : <p className="finished-muted">本演示按仓库分别办理出库。收货方、运输信息及正式单据版式待确认。</p>}
      </section>
      {!grouping && <section className="ds-page-card"><div className="ds-card-title-row"><TableSelectionToolbar className="finished-source-toolbar" title="选择在库货物" selectedCount={selectedSourceKeys.length} onClear={() => setSelectedSourceKeys([])} actions={selectedSourceKeys.length > 0 && <Button type="primary" onClick={addSelectedSource}>加入所选货物</Button>} /><Segmented aria-label="出库选择方式" value={selectionMode} options={['托盘', '整箱']} onChange={value => { setSelectionMode(value); setSelectedSourceKeys([]); }} /></div>
        {selectionMode === '整箱' ? <Table size="small" rowKey="code" columns={columns} dataSource={available} pagination={{ pageSize: 5, showSizeChanger: false }} scroll={{ x: columnsWidth + 40 }} rowSelection={{ selectedRowKeys: selectedSourceKeys, preserveSelectedRowKeys: true, onChange: keys => setSelectedSourceKeys(keys.map(String)) }} /> : <Table size="small" rowKey="code" dataSource={palletRows} columns={palletColumns} pagination={false} scroll={{ x: palletTableScrollWidth }}
          rowSelection={{ selectedRowKeys: selectedSourceKeys, onChange: keys => setSelectedSourceKeys(keys.map(String)) }}
          expandable={{ expandedRowRender: row => <Table size="small" rowKey="code" columns={columns} dataSource={row.boxes} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedSourceKeys.filter(code => row.boxes.some(box => box.code === code)), preserveSelectedRowKeys: true, onChange: keys => setSelectedSourceKeys(current => [...current.filter(code => !row.boxes.some(box => box.code === code)), ...keys.map(String)]) }} scroll={{ x: columnsWidth + 40 }} /> }}
          />}
      </section>}
      <section className="ds-page-card"><div className="ds-card-title-row"><strong className="ds-table-title">{grouping ? '本次组托清单' : '本次出库清单'} <span className="finished-muted">（{boxes.length} 箱）</span></strong><Button type="link" disabled={!codes.length} onClick={() => changeCodes([])}>清空清单</Button></div>
        <Table size="small" rowKey="code" dataSource={boxes} columns={[...columns, { title: '操作', key: 'operation', width: 80, fixed: 'right', render: (_, box) => <Button type="link" className="finished-link" onClick={() => changeCodes(codes.filter(code => code !== box.code))}>移除</Button> }]} pagination={false} scroll={{ x: listColumnsWidth + 40, y: 300 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={grouping ? '扫描成品箱码后加入本次组托清单' : '请勾选在库货物或扫码添加'} /> }} />
        {grouping && <p className="finished-muted">屏幕报数：当前 {boxes.length} 箱。语音播报与实体音响未接入。</p>}
      </section>
      <section className="ds-page-card finished-operation-summary"><div><span>{grouping ? '本托有效箱数' : '本次出库箱数'}</span><strong>{boxes.length} <small>箱</small></strong></div><div><span>标准净重合计</span><strong>{formatWeight(totalWeight(boxes))} <small>kg</small></strong></div><div className="finished-summary-actions"><Button onClick={back}>取消并返回</Button><Button type="primary" disabled={!boxes.length} onClick={() => { if (!warehouse) { setError('请选择入库仓库。'); return; } setChecked(false); setConfirming(true); }}>确认{grouping ? '组托入库' : '出库'}</Button></div></section>
    </>}
    <Modal open={confirming} centered title={grouping ? '确认组托入库' : '确认成品出库'} width={FLOATING_LAYER_WIDTHS.formModal} className="finished-confirm" style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} onCancel={() => setConfirming(false)} onOk={commit} okText={grouping ? '确认入库并生成托盘码' : '确认扣减库存并生成出库单'} okButtonProps={{ disabled: !checked }}>
      <div className="finished-detail-stack"><Alert showIcon type="info" title={`${warehouse} · ${boxes.length} 箱 · 标准净重 ${formatWeight(totalWeight(boxes))} kg`} /><p>{grouping ? '保存后增加成品库存，生成唯一托盘码，可查看标签预览。' : '确认后立即扣减本次成品库存，装车不再次扣账。'}</p><Checkbox checked={checked} onChange={event => setChecked(event.target.checked)}>我已核对货物清单及箱数，确认办理{grouping ? '组托入库' : '出库'}</Checkbox></div>
    </Modal>
  </div>;
}
