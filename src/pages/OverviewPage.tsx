import { useState } from 'react';
import { Button, DatePicker, Descriptions, Empty, Modal, Tooltip } from 'antd';
import { StatisticCard } from '@ant-design/pro-components';
import { ArrowDownOutlined, ArrowUpOutlined, ClockCircleOutlined, DownloadOutlined, ExportOutlined, InboxOutlined, ReloadOutlined, ShopOutlined, TruckOutlined, UploadOutlined, BlockOutlined, ClusterOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import './overview.css';
import { formatWeight, totalWeight, useFinishedGoods } from '../finishedGoods';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../components/floatingLayer';
import { sumScatteredWeights, useScatteredFruit } from '../scatteredFruit';

const metrics = [
  { title: '采摘重量', value: 2480, unit: 'kg', tone: 'green', icon: <InboxOutlined />, parts: [['正常果', 2350], ['采摘废果', 130]], change: 12 },
  { title: '原果入库量', value: 2120, unit: 'kg', tone: 'sky', icon: <DownloadOutlined />, parts: [['正常果', 2000], ['废果', 120]], change: 8 },
  { title: '原果出库量', value: 1860, unit: 'kg', tone: 'purple', icon: <ExportOutlined />, parts: [['正常果', 1760], ['废果', 100]], change: 15 },
  { title: '成品入库', value: 1280, unit: '箱', tone: 'orange', icon: <BlockOutlined />, parts: [['标准净重', 16640]], change: 10 },
  { title: '成品出库', value: 960, unit: '箱', tone: 'blue', icon: <TruckOutlined />, parts: [['标准净重', 12480]], change: -5 },
  { title: '散果入库', value: 520, unit: 'kg', tone: 'teal', icon: <ClusterOutlined />, parts: [['散果出库', 200]], change: 20 },
];
const quick = [
  { title: '原果入库', note: '确认待入库量', tone: 'green', icon: <InboxOutlined /> },
  { title: '原果出库', note: '整理扫码出库', tone: 'purple', icon: <ExportOutlined /> },
  { title: '成品码打印', note: '按规格打印箱码', tone: 'orange', icon: <BlockOutlined /> },
  { title: '组托入库', note: '逐箱扫码组托', tone: 'sky', icon: <UploadOutlined /> },
  { title: '成品出库', note: '办理出库装车', tone: 'blue', icon: <TruckOutlined /> },
  { title: '散果入库', note: '登记散果入库', tone: 'green', icon: <ClusterOutlined /> },
  { title: '散果出库', note: '登记散果出库', tone: 'red', icon: <ExportOutlined /> },
];
const number = (value: number) => value.toLocaleString('en-US');
function TileIcon({ tone, children }: { tone: string; children: ReactNode }) { return <span className={`overview-icon tone-${tone}`}>{children}</span>; }

export default function OverviewPage() {
  const { state: finishedState } = useFinishedGoods();
  const { rows: scatteredRows, balance: scatteredBalance } = useScatteredFruit();
  const finishedStock = finishedState.boxes.filter(box => box.state === 'stock');
  const finishedWeight = totalWeight(finishedStock);
  const openFinished = () => { location.hash = '/finished-goods/inventory'; };
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-10-01'), dayjs('2026-10-16')]);
  const [updated, setUpdated] = useState('2026-10-16 16:30');
  const finishedUpdated = [...finishedState.inbound.map(row => row.time), ...finishedState.outbound.flatMap(row => [row.time, row.restoration?.time ?? ''])].reduce((latest, time) => time > latest ? time : latest, updated);
  const [entry, setEntry] = useState<string>();
  // 按所选日期累加演示日数据；当前库存不受期间筛选影响。
  const days = Array.from({ length: 16 }, (_, i) => dayjs('2026-10-01').add(i, 'day')).filter(date => !date.isBefore(range[0], 'day') && !date.isAfter(range[1], 'day'));
  const factor = days.length / 16;
  const inPeriod = (time: string) => time.slice(0, 10) >= range[0].format('YYYY-MM-DD') && time.slice(0, 10) <= range[1].format('YYYY-MM-DD');
  const finishedInbound = finishedState.inbound.filter(row => inPeriod(row.time));
  const finishedOutbound = finishedState.outbound.filter(row => inPeriod(row.time));
  const scatteredInbound = sumScatteredWeights(scatteredRows.filter(row => row.type === '入库' && inPeriod(row.businessDate)));
  const scatteredOutbound = sumScatteredWeights(scatteredRows.filter(row => row.type === '出库' && inPeriod(row.businessDate)));
  const displayMetrics = metrics.map(item => item.title === '成品入库' ? { ...item, value: finishedInbound.reduce((sum, row) => sum + row.boxes.length, 0), parts: [['标准净重', finishedInbound.reduce((sum, row) => sum + totalWeight(row.boxes), 0)]], actual: true } : item.title === '成品出库' ? { ...item, value: finishedOutbound.reduce((sum, row) => sum + row.boxes.length, 0), parts: [['标准净重', finishedOutbound.reduce((sum, row) => sum + totalWeight(row.boxes), 0)]], actual: true } : item.title === '散果入库' ? { ...item, value: scatteredInbound, parts: [['散果出库', scatteredOutbound]], actual: true } : { ...item, actual: false });
  // 图表与成品记录共用账本，展示所选期间最后七天，恢复不计为首次入库。
  const chartStart = range[1].subtract(6, 'day').isAfter(range[0]) ? range[1].subtract(6, 'day') : range[0];
  const visibleChart = Array.from({ length: Math.min(7, range[1].diff(chartStart, 'day') + 1) }, (_, i) => {
    const date = chartStart.add(i, 'day');
    return { date, values: [finishedState.inbound, finishedState.outbound].map(rows => rows.filter(row => row.time.startsWith(date.format('YYYY-MM-DD'))).reduce((sum, row) => sum + row.boxes.length, 0)) };
  });
  const chartMax = Math.max(6, Math.ceil(Math.max(...visibleChart.flatMap(row => row.values), 0) / 6) * 6);
  const openScattered = (operation?: 'inbound' | 'outbound') => { location.hash = operation ? `/scattered-fruit/${operation}?register=1` : '/scattered-fruit/inbound'; };

  return <div className="overview-page">
    <section className="overview-section inventory-section">
      <div className="overview-heading"><h2>当前库存 <small>（截至当前，实时数据）</small></h2><div className="inventory-update"><ClockCircleOutlined /><span>最后更新：{finishedUpdated}</span><Tooltip title="刷新库存"><Button type="text" aria-label="刷新库存" icon={<ReloadOutlined />} onClick={() => setUpdated(dayjs().format('YYYY-MM-DD HH:mm:ss'))} /></Tooltip></div></div>
      <div className="inventory-grid">
        <div className="inventory-card"><div className="inventory-main"><TileIcon tone="purple"><ShopOutlined /></TileIcon><div><h3>原果库存</h3><div className="stock-values"><strong>128 <small>筐</small></strong><strong>5,760 <small>kg</small></strong></div></div></div><div className="stock-details"><span>正常果 <b>5,320 kg</b></span><i /><span>废果 <b>440 kg</b></span></div></div>
        <div className="inventory-card finished-stock-link" role="button" tabIndex={0} aria-label="查看成品库存" onClick={openFinished} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFinished(); } }}><div className="inventory-main"><TileIcon tone="orange"><BlockOutlined /></TileIcon><div><h3>成品库存</h3><div className="stock-values"><strong data-testid="overview-finished-count">{finishedStock.length} <small>箱</small></strong><strong>{formatWeight(finishedWeight)} <small>kg</small></strong></div></div></div><div className="stock-details"><span>标准净重 <b>{formatWeight(finishedWeight)} kg</b></span><i /><span>涉及托盘 <b>{new Set(finishedStock.map(box => box.pallet)).size} 托</b></span></div></div>
        <div className="inventory-card scattered-stock-link" role="button" tabIndex={0} aria-label="查看散果库存" onClick={() => openScattered()} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openScattered(); } }}><div className="inventory-main"><TileIcon tone="green"><ClusterOutlined /></TileIcon><div><h3>散果库存</h3><div className="stock-values"><strong>{formatWeight(scatteredBalance)} <small>kg</small></strong></div></div></div><div className="stock-details"><span>累计入库 <b>{formatWeight(sumScatteredWeights(scatteredRows.filter(row => row.type === '入库')))} kg</b></span><i /><span>累计出库 <b>{formatWeight(sumScatteredWeights(scatteredRows.filter(row => row.type === '出库')))} kg</b></span></div></div>
      </div>
    </section>
    <section className="overview-section metrics-section"><div className="overview-heading"><h2>期间业务指标</h2><DatePicker.RangePicker aria-label="业务统计日期" allowClear={false} value={range} format="YYYY-MM-DD" separator="～" onChange={value => { if (value?.[0] && value[1]) setRange([value[0], value[1]]); }} /></div>
      <div className="metrics-grid">{displayMetrics.map(item => <StatisticCard key={item.title} className="overview-metric" bordered={false} statistic={{ title: <span className="metric-label"><TileIcon tone={item.tone}>{item.icon}</TileIcon>{item.title}</span>, value: item.actual ? item.value : Math.round(item.value * factor), suffix: item.unit, styles: { content: { fontSize: 26, fontWeight: 600 } } }}><div className="metric-parts">{item.parts.map(([label, value]) => <div key={label}><span>{label}</span><span>{item.actual ? formatWeight(Number(value)) : number(Math.round(Number(value) * factor))} kg</span></div>)}</div><div className="metric-trend"><span>{item.actual ? item.title === '散果入库' ? '按实际散果流水汇总' : '按实际成品记录汇总' : '较上期'}</span>{!item.actual && <b className={item.change < 0 ? 'decrease' : 'increase'}>{item.change < 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}{days.length ? Math.abs(item.change) : 0}%</b>}</div></StatisticCard>)}</div>
    </section>
    <div className="overview-bottom"><section className="overview-section chart-section"><div className="overview-heading"><h2>成品出入库分析 <small>（所选期间最后7天）</small></h2><div className="chart-legend"><span><i />成品入库</span><span><i />成品出库</span></div></div><div className="chart-unit">数量（箱）</div>
      {visibleChart.some(row => row.values.some(value => value > 0)) ? <div className="bar-chart"><div className="chart-y">{Array.from({ length: 7 }, (_, i) => chartMax - i * chartMax / 6).map(v => <span key={v}>{v}</span>)}</div><div className="chart-plot"><div className="chart-grid">{Array.from({length:7},(_,i)=><i key={i} />)}</div><div className="chart-columns">{visibleChart.map(row => <div className="chart-group" key={row.date.format('MM-DD')}><div className="bar-pair">{row.values.map((v,i)=><Tooltip key={i} title={`${row.date.format('MM-DD')} 成品${i ? '出库' : '入库'}：${v} 箱`}><div className={`chart-bar bar-${i}`} style={{ height: `${v / chartMax * 100}%` }}><span>{v}</span></div></Tooltip>)}</div><span className="chart-x">{row.date.format('MM-DD')}</span></div>)}</div></div></div> : <Empty description="所选期间暂无成品出入库记录" />}
    </section><section className="overview-section quick-section"><div className="overview-heading"><h2>业务快捷入口</h2></div><div className="quick-grid">{quick.map(item => <button key={item.title} onClick={() => item.title === '组托入库' ? location.hash = '/finished-goods/group' : item.title === '成品出库' ? location.hash = '/finished-goods/dispatch' : item.title === '散果入库' ? openScattered('inbound') : item.title === '散果出库' ? openScattered('outbound') : setEntry(item.title)}><TileIcon tone={item.tone}>{item.icon}</TileIcon><span><strong>{item.title}</strong><small>{item.note}</small></span></button>)}</div></section></div>
    <Modal className="business-modal" centered width={FLOATING_LAYER_WIDTHS.formModal} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles()} open={!!entry} title={entry} footer={<Button type="primary" onClick={() => setEntry(undefined)}>返回业务概览</Button>} onCancel={() => setEntry(undefined)}><Descriptions column={1} items={[{ key:'base', label:'当前基地', children:'新疆·阿克苏基地' },{key:'operation',label:'业务操作',children:entry},{key:'scope',label:'演示范围',children:'此入口展示业务操作说明，暂未制作完整作业页面，不会变更库存。'}]} /></Modal>
  </div>;
}
