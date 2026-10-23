// 基于 ant-design-skill 的 05-QueryFilter 模板，复用搜索卡与查询/重置分区。
import { ProFormDateRangePicker, ProFormSelect, ProFormText, QueryFilter } from '@ant-design/pro-components';
import { AutoComplete, Card, Form, Space } from 'antd';
import { finishedGrades, finishedSizes, finishedSpecs, finishedWarehouses } from '../finishedGoods';

export type FinishedTab = 'inventory' | 'inbound' | 'outbound' | 'pallets';
export type FinishedFilters = { boxCode?: string; palletCode?: string; warehouse?: string; variety?: string; size?: string; grade?: string; spec?: string; dates?: [string, string]; batch?: string; document?: string; restored?: string };
export default function FinishedGoodsFilter({ tab, onSearch, palletCodes = [], boxCodes = [] }: { tab: FinishedTab; onSearch: (values: FinishedFilters) => void; palletCodes?: string[]; boxCodes?: string[] }) {
  // 本地模拟筛选同步完成，避免无网络任务仍进入异步加载态。
  const keepExpanded = tab === 'inventory' || tab === 'inbound' || tab === 'outbound';
  return <Card variant="borderless" className="ds-search-panel ds-form-panel finished-filter">
    <QueryFilter<FinishedFilters> autoFocusFirstInput={false} defaultCollapsed={!keepExpanded} defaultFormItemsNumber={tab === 'inventory' ? 8 : tab === 'inbound' || tab === 'outbound' ? 8 : 3} collapseRender={keepExpanded ? false : undefined} submitterColSpanProps={tab === 'inventory' ? { span: 4, xs: { span: 24, offset: 0 }, sm: { span: 24, offset: 0 }, md: { span: 24, offset: 0 }, lg: { span: 4, offset: 0 }, xl: { span: 4, offset: 0 }, xxl: { span: 4, offset: 0 } } : undefined} span={tab === 'inventory' ? { xs: 24, sm: 12, md: 8, lg: 5, xl: 5, xxl: 5 } : { xs: 24, sm: 12, md: 8, lg: 6, xl: 6, xxl: 6 }} labelWidth="auto" split={false} searchGutter={[16, 12]}
      onFinish={values => onSearch(values)} onReset={() => onSearch({})}
      submitter={{ searchConfig: { submitText: '查询', resetText: '重置' }, render: (_, dom) => <div className="finished-filter-actions"><Space size={8}>{dom}</Space></div> }}>
      {tab === 'outbound' ? <ProFormText name="batch" label="出库批次号" placeholder="请输入完整批次号" fieldProps={{ allowClear: true, style: { width: 280, maxWidth: '100%' } }} /> : tab === 'inventory' ? <Form.Item name="palletCode" label="托盘码"><AutoComplete allowClear placeholder="请输入完整托盘码" style={{ width: 320, maxWidth: '100%' }} options={palletCodes.map(value => ({ value }))} filterOption={(input, option) => !!input.trim() && String(option?.value ?? '').toLowerCase().includes(input.trim().toLowerCase())} /></Form.Item> : <ProFormText name="palletCode" label="托盘码" placeholder="请输入完整托盘码" fieldProps={{ allowClear: true, style: { width: 320, maxWidth: '100%' } }} />}
      {tab === 'outbound' ? <ProFormText name="document" label="出库单号" placeholder="请输入完整出库单号" fieldProps={{ allowClear: true, style: { width: 320, maxWidth: '100%' } }} /> : tab === 'inventory' ? <Form.Item name="boxCode" label="箱码反查"><AutoComplete allowClear placeholder="请输入完整箱码" style={{ width: 320, maxWidth: '100%' }} options={boxCodes.map(value => ({ value }))} filterOption={(input, option) => !!input.trim() && String(option?.value ?? '').toLowerCase().includes(input.trim().toLowerCase())} /></Form.Item> : tab !== 'inbound' ? <ProFormText name="boxCode" label="箱码反查" placeholder="请输入完整箱码" fieldProps={{ allowClear: true, style: { width: 320, maxWidth: '100%' } }} /> : null}
      <ProFormSelect name="warehouse" label="仓库" options={finishedWarehouses} placeholder="全部仓库" fieldProps={{ style: { width: 220, maxWidth: '100%' } }} />
      {tab === 'outbound' && <ProFormSelect name="restored" label="恢复状态" options={[{ value: 'no', label: '未恢复' }, { value: 'yes', label: '已恢复' }]} placeholder="全部状态" fieldProps={{ style: { width: 170, maxWidth: '100%' } }} />}
      <ProFormSelect name="variety" label="品种" options={['蓝莓1号', '蓝莓2号']} placeholder="全部品种" fieldProps={{ style: { width: 180, maxWidth: '100%' } }} />
      <ProFormSelect name="size" label="果径" options={finishedSizes} placeholder="全部果径" fieldProps={{ style: { width: 150, maxWidth: '100%' } }} />
      <ProFormSelect name="grade" label="等级" options={finishedGrades} placeholder="全部等级" fieldProps={{ style: { width: 180, maxWidth: '100%' } }} />
      {tab !== 'outbound' && <ProFormSelect name="spec" label="包装规格" options={finishedSpecs} placeholder="全部规格" fieldProps={{ style: { width: 220, maxWidth: '100%' } }} />}
      <ProFormDateRangePicker name="dates" label={tab === 'inventory' || tab === 'pallets' ? '组托日期' : tab === 'outbound' ? '出库日期' : '入库日期'} fieldProps={{ format: 'YYYY-MM-DD', placeholder: ['开始日期', '结束日期'], style: { width: 'var(--date-range-picker-width)', maxWidth: '100%' } }} />
    </QueryFilter>
  </Card>;
}
