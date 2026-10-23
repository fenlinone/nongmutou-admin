import { useRef, useState } from 'react';
import { Alert, App, Breadcrumb, Button, Checkbox, Empty, Input, Modal, Pagination, Result, Segmented, Select, Space, Table, Tag } from 'antd';
import { ArrowLeftOutlined, ScanOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { finishedWarehouses, formatWeight, totalWeight, useFinishedGoods, type FinishedBox } from '../../finishedGoods';
import type { FinishedView } from './FinishedGoodsDetails';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../floatingLayer';
import TableSelectionToolbar from '../TableSelectionToolbar';
import { exportCsv } from '../../data';
import ColumnSettingsPopover from '../ColumnSettingsPopover';
import type { ColumnOption } from '../ColumnSettingsPopover';

type SelectionMode = '托盘' | '整箱';
type PalletCandidate = { code: string; codes: string[]; warehouse: string; time: string; boxes: FinishedBox[] };

export default function FinishedGoodsOperation({ mode, onView, initialPalletCodes = [], embedded = false, onClose }: { mode: 'group' | 'dispatch'; onView: (view: FinishedView) => void; initialPalletCodes?: string[]; embedded?: boolean; onClose?: () => void }) {
  const { message } = App.useApp();
  const { state, transact } = useFinishedGoods();
  const grouping = mode === 'group';
  const initialPallets = grouping ? [] : state.pallets.filter(pallet => initialPalletCodes.includes(pallet.code));
  const initialWarehouse = grouping ? undefined : initialPallets[0]?.warehouse ?? finishedWarehouses[0];
  const [groupCodes, setGroupCodes] = useState<string[]>([]);
  const [pendingPalletCodes, setPendingPalletCodes] = useState<string[]>(() => initialPallets.map(pallet => pallet.code));
  const [pendingBoxCodes, setPendingBoxCodes] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('托盘');
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<string[]>([]);
  const [tableSettings, setTableSettings] = useState<Record<string, { hidden: string[]; order: string[] }>>({});
  const [input, setInput] = useState('');
  const [scanActive, setScanActive] = useState(false);
  const [scanPage, setScanPage] = useState(1);
  const [scanPageSize, setScanPageSize] = useState(20);
  const scanInputRef = useRef<import('antd').InputRef>(null);
  const [warehouse, setWarehouse] = useState<string | undefined>(initialWarehouse);
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ id: string; count: number; weight: number }>();

  const available = state.boxes.filter(box => box.state === 'stock' && box.warehouse === warehouse);
  const availableByCode = new Map(available.map(box => [box.code, box]));
  const pending = state.boxes.filter(box => box.state === 'pending');
  const palletRows: PalletCandidate[] = state.pallets
    .map(pallet => ({ ...pallet, boxes: pallet.codes.map(code => availableByCode.get(code)).filter((box): box is FinishedBox => !!box) }))
    .filter(pallet => pallet.boxes.length > 0);
  const pendingPalletRows = palletRows.filter(pallet => pendingPalletCodes.includes(pallet.code));
  const pendingPalletBoxCodes = [...new Set(pendingPalletRows.flatMap(pallet => pallet.boxes.map(box => box.code)))];
  const pendingPalletBoxCodeSet = new Set(pendingPalletBoxCodes);
  const codes = grouping ? groupCodes : selectionMode === '托盘' ? pendingPalletBoxCodes : pendingBoxCodes;
  const boxes = codes.map(code => state.boxes.find(box => box.code === code)).filter((box): box is FinishedBox => !!box);
  const currentScanPage = Math.min(scanPage, Math.max(1, Math.ceil(boxes.length / scanPageSize)));
  const scannedPageRows = boxes.slice((currentScanPage - 1) * scanPageSize, currentScanPage * scanPageSize);
  const back = () => {
    if (embedded) { onClose?.(); return; }
    location.hash = `/finished-goods/${grouping ? 'inventory' : 'outbound'}`;
  };
  const changeGroupCodes = (next: string[]) => { setGroupCodes([...new Set(next)]); setError(''); };

  const startScanning = () => {
    setScanActive(true);
    window.setTimeout(() => scanInputRef.current?.focus(), 0);
  };

  const add = (value: string) => {
    const code = value.trim();
    const reject = (reason: string) => {
      if (grouping) { setInput(''); message.warning(reason); }
      else setError(reason);
    };
    if (!code) {
      reject(grouping ? '请扫描箱码。' : selectionMode === '托盘' ? '请扫描或输入托盘码。' : '请扫描或输入箱码。');
      return;
    }

    if (grouping) {
      const box = state.boxes.find(item => item.code === code);
      if (!box) { reject('箱码不存在，请核对已打印的成品标签。'); return; }
      if (groupCodes.includes(code)) { reject('此箱已在本次清单中，不重复计数。'); return; }
      if (box.state !== 'pending' || box.pallet) { reject('此箱已组托或已入库，不能再次加入。'); return; }
      if (boxes[0] && (box.variety !== boxes[0].variety || box.spec !== boxes[0].spec)) { reject('同一托盘必须为同品种、同包装规格，请另建托盘。'); return; }
      changeGroupCodes([...groupCodes, code]);
      setScanPage(1);
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    } else if (selectionMode === '托盘') {
      const pallet = state.pallets.find(item => item.code === code);
      if (!pallet) {
        reject(state.boxes.some(box => box.code === code) ? '托盘模式只接受托盘码，请切换到整箱模式扫描箱码。' : '未找到该托盘码，请核对托盘标签。');
        return;
      }
      if (pallet.warehouse !== warehouse) { reject('该托盘不属于当前出库仓库。'); return; }
      const palletBoxes = available.filter(box => pallet.codes.includes(box.code));
      if (!palletBoxes.length) { reject('该托盘当前没有可出库的在库箱。'); return; }
      if (pendingPalletCodes.includes(code)) { reject('该托盘已在托盘出库清单中。'); return; }
      if (palletBoxes.some(box => pendingBoxCodes.includes(box.code))) { reject('该托盘内有箱码已在整箱清单中，请先从整箱清单移除。'); return; }
      setPendingPalletCodes(current => [...current, code]);
      setError('');
    } else {
      const box = availableByCode.get(code);
      if (!box) {
        reject(state.pallets.some(pallet => pallet.code === code) ? '整箱模式只接受箱码，请切换到托盘模式扫描托盘码。' : '未找到当前仓库可出库箱码，请检查仓库和在库状态。');
        return;
      }
      if (pendingBoxCodes.includes(code)) { reject('此箱已在整箱出库清单中。'); return; }
      if (pendingPalletBoxCodeSet.has(code)) { reject('此箱已包含在托盘出库清单中，请先从托盘清单移除对应托盘。'); return; }
      setPendingBoxCodes(current => [...current, code]);
      setError('');
    }
    setInput('');
  };

  const columns: ColumnsType<FinishedBox> = [
    { title: '箱码', key: 'code', dataIndex: 'code', width: 180 },
    { title: '品种', key: 'variety', dataIndex: 'variety', width: 96 },
    { title: '果径', key: 'size', dataIndex: 'size', width: 72 },
    { title: '等级', key: 'grade', dataIndex: 'grade', width: 82 },
    { title: '包装规格', key: 'spec', dataIndex: 'spec', width: 150 },
    { title: '标准净重 (kg)', key: 'weight', dataIndex: 'weight', width: 150, render: formatWeight },
    ...(!grouping ? [{ title: '原组托托盘', key: 'pallet', dataIndex: 'pallet', width: 170 }, { title: '仓库', key: 'warehouse', dataIndex: 'warehouse', width: 96 }] : []),
  ];
  const palletColumns: ColumnsType<PalletCandidate> = [
    { title: '原组托托盘码', key: 'code', dataIndex: 'code', width: 180 },
    { title: '品种', key: 'variety', width: 96, render: (_: unknown, row) => row.boxes[0].variety },
    { title: '包装规格', key: 'spec', width: 150, render: (_: unknown, row) => row.boxes[0].spec },
    { title: '当前在库箱数', key: 'count', width: 112, render: (_: unknown, row) => row.boxes.length },
    { title: '标准净重 (kg)', key: 'weight', width: 128, render: (_: unknown, row) => formatWeight(totalWeight(row.boxes)) },
  ];
  const optionFor = <T,>(items: ColumnsType<T>): ColumnOption[] => items.map(column => ({ key: String(column.key ?? ('dataIndex' in column ? column.dataIndex : '')), label: String(column.title) }));
  const settingsFor = (id: string, options: ColumnOption[]) => {
    const settings = tableSettings[id] ?? { hidden: [], order: options.map(option => option.key) };
    return <ColumnSettingsPopover columns={options} hiddenKeys={settings.hidden} onHiddenKeysChange={hidden => setTableSettings(current => ({ ...current, [id]: { ...settings, hidden } }))} order={settings.order} onOrderChange={order => setTableSettings(current => ({ ...current, [id]: { ...settings, order } }))} />;
  };
  const visibleFor = <T,>(id: string, items: ColumnsType<T>, options: ColumnOption[]): ColumnsType<T> => {
    const settings = tableSettings[id] ?? { hidden: [], order: options.map(option => option.key) };
    return [...items]
      .sort((left, right) => settings.order.indexOf(String(left.key ?? ('dataIndex' in left ? left.dataIndex : ''))) - settings.order.indexOf(String(right.key ?? ('dataIndex' in right ? right.dataIndex : ''))))
      .filter(column => !settings.hidden.includes(String(column.key ?? ('dataIndex' in column ? column.dataIndex : ''))));
  };

  const candidateSettingsId = selectionMode === '托盘' ? 'candidate-pallet' : 'candidate-box';
  const visibleColumns = visibleFor(candidateSettingsId, columns, optionFor(columns));
  const columnsWidth = visibleColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 0);
  const visiblePalletColumns = visibleFor('candidate-pallet', palletColumns, optionFor(palletColumns));
  const palletTableScrollWidth = visiblePalletColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 40);
  const visibleExpandedColumns = visibleFor('pallet-expanded-boxes', columns, optionFor(columns));
  const expandedWidth = visibleExpandedColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 0) + 40;
  const listBoxSettingsId = grouping ? 'group-list' : 'outbound-list-box';
  const listBoxColumns = visibleFor(listBoxSettingsId, columns, optionFor(columns));
  const listBoxWidth = listBoxColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 0) + 80;
  const listPalletSettingsId = 'outbound-list-pallet';
  const listPalletColumns = visibleFor(listPalletSettingsId, palletColumns, optionFor(palletColumns));
  const listPalletWidth = listPalletColumns.reduce((sum, column) => sum + Number(column.width ?? 100), 0) + 80;
  const title = grouping ? '组托入库' : '成品出库';
  const exportBoxes = (rows: FinishedBox[], filename: string) => exportCsv(['箱码', '品种', '果径', '等级', '包装规格', '标准净重(kg)', '原组托托盘', '仓库'], rows.map(box => [box.code, box.variety, box.size, box.grade, box.spec, formatWeight(box.weight), box.pallet ?? '', box.warehouse ?? '']), filename);
  const exportPallets = (rows: PalletCandidate[], filename: string) => exportCsv(['原组托托盘码', '品种', '包装规格', '当前在库箱数', '标准净重(kg)'], rows.map(row => [row.code, row.boxes[0].variety, row.boxes[0].spec, row.boxes.length, formatWeight(totalWeight(row.boxes))]), filename);
  const selectedPalletRows = selectionMode === '托盘' ? palletRows.filter(row => selectedSourceKeys.includes(row.code)) : [];
  const selectedBoxRows = available.filter(box => selectedSourceKeys.includes(box.code));
  const exportSourceTable = (selectedOnly = false) => {
    if (selectedOnly) {
      if (selectedPalletRows.length) exportPallets(selectedPalletRows, '成品出库候选-所选托盘.csv');
      if (selectedBoxRows.length) exportBoxes(selectedBoxRows, '成品出库候选-所选箱.csv');
      return;
    }
    if (selectionMode === '托盘') exportPallets(palletRows, '成品出库候选托盘.csv');
    else exportBoxes(available, '成品出库候选箱.csv');
  };
  const addSelectedSource = () => {
    const queuedPalletBoxes = new Set(pendingPalletBoxCodes);
    const queuedBoxes = new Set(pendingBoxCodes);
    const addPalletCodes = selectedPalletRows
      .filter(row => !pendingPalletCodes.includes(row.code) && !row.boxes.some(box => queuedBoxes.has(box.code)))
      .map(row => row.code);
    const addBoxCodes = selectedBoxRows
      .filter(box => !queuedBoxes.has(box.code) && !queuedPalletBoxes.has(box.code))
      .map(box => box.code);
    if (!addPalletCodes.length && !addBoxCodes.length) {
      setError('所选货物已在对应的待出库清单中，或与另一清单中的货物重复。');
      return;
    }
    setPendingPalletCodes(current => [...new Set([...current, ...addPalletCodes])]);
    setPendingBoxCodes(current => [...new Set([...current, ...addBoxCodes])]);
    setSelectedSourceKeys([]);
    setError(addPalletCodes.length + addBoxCodes.length < selectedPalletRows.length + selectedBoxRows.length ? '部分所选货物已在另一待出库清单中，仅加入了不重复的记录。' : '');
  };
  const clearCurrentQueue = () => {
    if (grouping) { changeGroupCodes([]); setScanPage(1); }
    else if (selectionMode === '托盘') { setPendingPalletCodes([]); setError(''); }
    else { setPendingBoxCodes([]); setError(''); }
  };
  const removeFromCurrentQueue = (code: string) => {
    if (grouping) changeGroupCodes(groupCodes.filter(item => item !== code));
    else if (selectionMode === '托盘') { setPendingPalletCodes(current => current.filter(item => item !== code)); setError(''); }
    else { setPendingBoxCodes(current => current.filter(item => item !== code)); setError(''); }
  };
  const activePalletQueue = !grouping && selectionMode === '托盘';
  const activeQueueTitle = grouping ? '本次组托清单' : activePalletQueue ? '本次托盘出库清单' : '本次整箱出库清单';
  const exportCurrentQueue = () => {
    if (grouping || !activePalletQueue) exportBoxes(boxes, `${grouping ? '本次组托' : '本次整箱出库'}清单.csv`);
    else exportPallets(pendingPalletRows, '本次托盘出库清单.csv');
  };
  const activeQueueColumns = activePalletQueue ? listPalletColumns : listBoxColumns;
  const activeQueueWidth = activePalletQueue ? listPalletWidth : listBoxWidth;
  const commit = () => {
    if (!checked) return;
    const action = grouping
      ? { type: 'inbound' as const, codes, warehouse: warehouse ?? '', time: dayjs().format('YYYY-MM-DD HH:mm:ss') }
      : { type: 'outbound' as const, codes, time: dayjs().format('YYYY-MM-DD HH:mm:ss') };
    const saved = transact(action);
    if (!saved.ok) {
      setConfirming(false);
      const reason = saved.error ?? '请重新核对清单';
      if (grouping) {
        message.warning(reason);
        window.setTimeout(() => scanInputRef.current?.focus(), 0);
      } else setError(reason);
      return;
    }
    setResult({ id: saved.id!, count: boxes.length, weight: totalWeight(boxes) });
    if (!grouping && selectionMode === '托盘') setPendingPalletCodes([]);
    if (!grouping && selectionMode === '整箱') setPendingBoxCodes([]);
    setConfirming(false);
    if (grouping) setScanActive(false);
  };
  const focusScanInput = () => document.getElementById('finished-outbound-scan')?.focus();
  const changeWarehouse = (value: string) => {
    setWarehouse(value);
    if (!grouping) { setPendingPalletCodes([]); setPendingBoxCodes([]); setSelectedSourceKeys([]); }
    else { changeGroupCodes([]); setScanActive(false); setInput(''); setScanPage(1); }
    setError('');
  };
  const changeSelectionMode = (value: string) => {
    setSelectionMode(value as SelectionMode);
    setSelectedSourceKeys([]);
    setInput('');
    setError('');
  };

  return <div className={`finished-operation ds-page-shell${embedded ? ' finished-operation-embedded' : ''}`}>
    {!embedded && <div className="ds-page-header-with-breadcrumb">
      <Breadcrumb separator="/" items={[{ title: <a href="#/finished-goods/inventory">成品管理</a> }, { title }]} />
      <div className="ds-page-header"><h1 className="ds-page-title">{title}</h1><Button aria-label="返回成品管理" icon={<ArrowLeftOutlined />} onClick={back}>返回成品管理</Button></div>
    </div>}
    {result ? <section className="ds-page-card">
      <Result status="success" title={grouping ? '组托入库完成' : '成品出库完成'} subTitle={`${result.count} 箱 · ${formatWeight(result.weight)} kg；${grouping ? '托盘码' : '出库批次'}：${result.id}`}
        extra={<Space wrap>
          <Button type="primary" onClick={() => onView({ type: grouping ? 'label' : 'document', id: result.id })}>{grouping ? '查看托盘标签' : '查看出库单'}</Button>
          <Button onClick={() => onView({ type: grouping ? 'pallet' : 'outbound', id: result.id })}>查看{grouping ? '托盘' : '出库'}详情</Button>
          <Button onClick={() => { setResult(undefined); setGroupCodes([]); setInput(''); setError(''); setScanActive(false); setScanPage(1); }}>继续{title}</Button>
          <Button onClick={back}>返回列表</Button>
        </Space>} />
      {grouping && <Alert showIcon type="info" title="库存和箱托记录已保存；托盘标签可预览，未连接实体打印机。" />}
    </section> : <>
      <section className="ds-page-card finished-operation-setup">
        <div className="ds-card-title-row"><strong className="ds-table-title">{grouping ? '逐箱扫码，人工确认入库' : '核对货物，确认出库'}</strong><Tag>{grouping ? '不设固定满托箱数' : '确认出库后扣减库存'}</Tag></div>
        {grouping ? <>
          <div className="finished-group-warehouse"><label>入库仓库<Select aria-label="入库仓库" value={warehouse} placeholder="请选择仓库" options={finishedWarehouses.map(value => ({ value, label: value }))} onChange={changeWarehouse} /></label></div>
          <div className="finished-group-scan-panel">
            <div className="finished-group-scan-controls">
              <Button type="primary" icon={<ScanOutlined />} onClick={startScanning}>{scanActive ? '扫码中' : '开始扫码'}</Button>
              <Input ref={scanInputRef} aria-label="扫码输入" value={input} disabled={!scanActive} onChange={event => setInput(event.target.value)} onPressEnter={event => add(event.currentTarget.value)} placeholder={scanActive ? '请用扫码枪扫描箱码，扫码后自动识别' : '点击“开始扫码”后再扫描'} />
              <span className={`finished-group-scan-indicator${scanActive ? ' is-active' : ''}`} role="status" aria-live="polite">{scanActive ? '等待扫码枪输入' : '未启动'}</span>
            </div>
            <p className="finished-group-scan-note">扫码枪扫描箱码后会自动回车，箱信息将即时加入下方清单。请扫描待组托的成品箱码。</p>
            <div className="finished-group-scan-summary"><strong>已扫描 {boxes.length} 箱</strong><span>合计标准净重 {formatWeight(totalWeight(boxes))} kg</span></div>
            <div className="finished-demo-codes"><span>模拟扫码：</span>{pending.slice(0, 6).map(box => <Button key={box.code} size="small" disabled={!scanActive || groupCodes.includes(box.code)} onClick={() => add(box.code)}>{box.code}</Button>)}<span className="finished-muted">点击箱码模拟扫码枪输入；实际扫码需先点击“开始扫码”。</span></div>
          </div>
        </> : <>
          <div className="finished-scan-row">
            <label>出库仓库<Select aria-label="出库仓库" value={warehouse} placeholder="请选择仓库" options={finishedWarehouses.map(value => ({ value, label: value }))} onChange={changeWarehouse} /></label>
            <Input id="finished-outbound-scan" aria-label="扫码输入" value={input} onChange={event => setInput(event.target.value)} onPressEnter={() => add(input)} placeholder={`扫描或输入${selectionMode === '托盘' ? '托盘码' : '箱码'}`} prefix={<ScanOutlined />} allowClear />
            <Button type="primary" onClick={() => add(input)}>{selectionMode === '托盘' ? '加入托盘清单' : '加入整箱清单'}</Button>
          </div>
          {error && <Alert role="alert" type="error" showIcon title={error} />}
          <p className="finished-muted">本演示按仓库分别办理出库。托盘码与箱码分别加入各自清单；确认当前清单后才扣减对应库存。</p>
        </>}
      </section>
      {!grouping && <section className="ds-page-card">
        <TableSelectionToolbar className="finished-source-toolbar" title="选择在库货物" leadingContent={<Segmented aria-label="出库选择方式" value={selectionMode} options={[{ value: '托盘', label: `托盘（${pendingPalletCodes.length}）` }, { value: '整箱', label: `整箱（${pendingBoxCodes.length}）` }]} onChange={changeSelectionMode} />} selectedCount={selectedSourceKeys.length} onClear={() => setSelectedSourceKeys([])}
          batchActions={<Space size={8}><Button type="primary" onClick={addSelectedSource}>加入所选货物</Button><Button onClick={() => exportSourceTable(true)}>批量导出</Button></Space>}
          fixedActions={<Space size={8}>
            <Button type="primary" aria-label={`${selectionMode}模式扫码出库`} onClick={focusScanInput}>扫码出库</Button>
            <Button onClick={() => exportSourceTable(selectedSourceKeys.length > 0)} disabled={selectionMode === '托盘' ? !palletRows.length : !available.length}>导出</Button>
            {selectionMode === '托盘' ? settingsFor('candidate-pallet', optionFor(palletColumns)) : settingsFor('candidate-box', optionFor(columns))}
          </Space>} />
        {selectionMode === '整箱'
          ? <Table<FinishedBox> size="small" rowKey="code" columns={visibleColumns} dataSource={available} pagination={{ size: 'middle', pageSize: 5, showSizeChanger: false }} scroll={{ x: columnsWidth + 40 }} rowSelection={{ selectedRowKeys: selectedSourceKeys, preserveSelectedRowKeys: true, getCheckboxProps: box => ({ disabled: pendingPalletBoxCodeSet.has(box.code) || pendingBoxCodes.includes(box.code) }), onChange: keys => setSelectedSourceKeys(keys.map(String)) }} />
          : <Table<PalletCandidate> size="small" rowKey="code" dataSource={palletRows} columns={visiblePalletColumns} pagination={false} scroll={{ x: palletTableScrollWidth }}
            rowSelection={{ selectedRowKeys: selectedSourceKeys, preserveSelectedRowKeys: true, getCheckboxProps: row => ({ disabled: pendingPalletCodes.includes(row.code) || row.boxes.some(box => pendingBoxCodes.includes(box.code)) }), onChange: keys => setSelectedSourceKeys(current => [...current.filter(key => availableByCode.has(key)), ...keys.map(String)]) }}
            expandable={{ expandedRowRender: row => {
              const selectedBoxesInRow = selectedSourceKeys.filter(code => row.boxes.some(box => box.code === code));
              return <>
                <TableSelectionToolbar title={`托盘箱明细（${row.boxes.length} 箱）`} selectedCount={selectedBoxesInRow.length} onClear={() => setSelectedSourceKeys(current => current.filter(code => !row.boxes.some(box => box.code === code)))}
                  batchActions={<Button onClick={() => exportBoxes(row.boxes.filter(box => selectedBoxesInRow.includes(box.code)), `${row.code}-所选成品箱.csv`)}>批量导出</Button>}
                  fixedActions={<Space size={8}>
                  <Button onClick={() => exportBoxes(selectedBoxesInRow.length ? row.boxes.filter(box => selectedBoxesInRow.includes(box.code)) : row.boxes, `${row.code}-成品箱明细.csv`)} disabled={!row.boxes.length}>导出</Button>
                  {settingsFor('pallet-expanded-boxes', optionFor(columns))}
                </Space>} />
                <Table<FinishedBox> size="small" rowKey="code" columns={visibleExpandedColumns} dataSource={row.boxes} pagination={false} rowSelection={{ columnWidth: 40, selectedRowKeys: selectedBoxesInRow, preserveSelectedRowKeys: true, getCheckboxProps: box => ({ disabled: pendingPalletBoxCodeSet.has(box.code) || pendingBoxCodes.includes(box.code) }), onChange: keys => setSelectedSourceKeys(current => [...current.filter(code => !row.boxes.some(box => box.code === code)), ...keys.map(String)]) }} scroll={{ x: expandedWidth }} />
              </>;
            } }} />}
      </section>}
      {grouping ? <section className="ds-page-card finished-group-list-card">
        <TableSelectionToolbar title="本次扫码清单" selectedCount={boxes.length} selectedLabel="箱" onClear={clearCurrentQueue} className="finished-group-list-toolbar" fixedActions={<Space size={8}><Button onClick={exportCurrentQueue} disabled={!boxes.length}>导出</Button>{settingsFor(listBoxSettingsId, optionFor(columns))}</Space>} />
        {boxes.length ? <>
          <Table<FinishedBox> size="small" rowKey="code" dataSource={scannedPageRows} columns={[...listBoxColumns, { title: '操作', key: 'operation', width: 80, fixed: 'right', align: 'center', render: (_, box) => <Button type="link" className="finished-link" onClick={() => removeFromCurrentQueue(box.code)}>移除</Button> }]} pagination={false} scroll={{ x: listBoxWidth + 40, y: 300 }} />
          <div className="finished-group-pagination"><Pagination size="middle" current={currentScanPage} pageSize={scanPageSize} total={boxes.length} showSizeChanger showQuickJumper pageSizeOptions={[10, 20, 50, 100]} showTotal={total => `共 ${total.toLocaleString('zh-CN')} 项数据`} onChange={(nextPage, nextPageSize) => { setScanPage(nextPageSize !== scanPageSize ? 1 : nextPage); setScanPageSize(nextPageSize); }} /></div>
        </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待扫码，扫描成功后自动显示成品箱信息" />}
        <p className="finished-muted">屏幕实时显示箱数和标准净重；语音播报与实体音响未接入。</p>
      </section> : <section className="ds-page-card">
        <div className="ds-card-title-row">
          <strong className="ds-table-title">{activeQueueTitle} <span className="finished-muted">（{activePalletQueue ? pendingPalletRows.length : boxes.length} {activePalletQueue ? '托' : '箱'} · {boxes.length} 箱）</span></strong>
          <Space size={8}>
            <Button type="link" disabled={!boxes.length} onClick={clearCurrentQueue}>清空清单</Button>
            <Button onClick={exportCurrentQueue} disabled={!boxes.length}>导出</Button>
            {activePalletQueue ? settingsFor(listPalletSettingsId, optionFor(palletColumns)) : settingsFor(listBoxSettingsId, optionFor(columns))}
          </Space>
        </div>
        {activePalletQueue
          ? <Table<PalletCandidate> size="small" rowKey="code" dataSource={pendingPalletRows} columns={[...activeQueueColumns as ColumnsType<PalletCandidate>, { title: '操作', key: 'operation', width: 80, fixed: 'right', align: 'center', render: (_, pallet) => <Button type="link" className="finished-link" onClick={() => removeFromCurrentQueue(pallet.code)}>移除</Button> }]} pagination={false} scroll={{ x: activeQueueWidth + 40, y: 300 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="扫描或选择托盘后加入托盘出库清单" /> }} />
          : <Table<FinishedBox> size="small" rowKey="code" dataSource={boxes} columns={[...listBoxColumns, { title: '操作', key: 'operation', width: 80, fixed: 'right', align: 'center', render: (_, box) => <Button type="link" className="finished-link" onClick={() => removeFromCurrentQueue(box.code)}>移除</Button> }]} pagination={false} scroll={{ x: listBoxWidth + 40, y: 300 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="扫描或选择箱码后加入整箱出库清单" /> }} />}
      </section>}
      <section className="ds-page-card finished-operation-actions"><div className="finished-summary-actions"><Button onClick={back}>取消并返回</Button><Button type="primary" disabled={!boxes.length} onClick={() => { if (!warehouse) { setError('请选择入库仓库。'); return; } setChecked(false); setConfirming(true); }}>确认{grouping ? '组托入库' : selectionMode === '托盘' ? '托盘出库' : '整箱出库'}</Button></div></section>
    </>}
    <Modal open={confirming} centered title={grouping ? '确认组托入库' : selectionMode === '托盘' ? '确认托盘出库' : '确认整箱出库'} width={FLOATING_LAYER_WIDTHS.formModal} className="finished-confirm" style={{ maxWidth: FLOATING_LAYER_MAX_WIDTH }} styles={getModalStyles()} onCancel={() => { setConfirming(false); if (grouping && scanActive) window.setTimeout(() => scanInputRef.current?.focus(), 0); }} onOk={commit} okText={grouping ? '确认入库并生成托盘码' : '确认扣减库存并生成出库单'} okButtonProps={{ disabled: !checked }}>
      <div className="finished-detail-stack"><Alert showIcon type="info" title={`${warehouse} · ${boxes.length} 箱 · 标准净重 ${formatWeight(totalWeight(boxes))} kg`} /><p>{grouping ? '保存后增加成品库存，生成唯一托盘码，可查看标签预览。' : `确认后只扣减${selectionMode === '托盘' ? '托盘' : '整箱'}待出库清单中的成品库存。`}</p><Checkbox checked={checked} onChange={event => setChecked(event.target.checked)}>我已核对货物清单及箱数，确认办理{grouping ? '组托入库' : selectionMode === '托盘' ? '托盘出库' : '整箱出库'}</Checkbox></div>
    </Modal>
  </div>;
}
