// 基于 ant-design-skill 的 05-QueryFilter 模板，复用搜索卡与查询/重置分区。
import { ProFormDateRangePicker, ProFormSelect, ProFormText, QueryFilter } from '@ant-design/pro-components';
import { Card, Col, Space } from 'antd';
import { finishedGrades, finishedSizes, finishedSpecs, finishedWarehouses } from '../finishedGoods';

export type FinishedTab = 'inventory' | 'inbound' | 'outbound';
export type FinishedFilters = { boxCode?: string; palletCode?: string; warehouse?: string; variety?: string; size?: string; grade?: string; spec?: string; dates?: [string, string]; batch?: string; document?: string; restored?: string };
export default function FinishedGoodsFilter({ tab, onSearch }: { tab: FinishedTab; onSearch: (values: FinishedFilters) => void }) {
  // 本地模拟筛选同步完成，避免无网络任务仍进入异步加载态。
  return <Card variant="borderless" className="ds-search-panel ds-form-panel finished-filter">
    <QueryFilter<FinishedFilters> autoFocusFirstInput={false} defaultCollapsed defaultFormItemsNumber={8} span={8} labelWidth="auto" split={false} searchGutter={[24, 16]}
      onFinish={values => onSearch(values)} onReset={() => onSearch({})}
      submitter={{ searchConfig: { submitText: '查询', resetText: '重置' }, render: (_, dom) => <Col flex="auto" className="finished-filter-actions"><Space size={8}>{dom}</Space></Col> }}>
      {tab === 'outbound' ? <ProFormText name="batch" label="出库批次号" placeholder="请输入完整批次号" fieldProps={{ allowClear: true }} /> : <ProFormText name="palletCode" label="托盘码" placeholder="请输入完整托盘码" fieldProps={{ allowClear: true }} />}
      {tab === 'outbound' ? <ProFormText name="document" label="出库单号" placeholder="请输入完整出库单号" fieldProps={{ allowClear: true }} /> : tab !== 'inbound' ? <ProFormText name="boxCode" label="箱码反查" placeholder="请输入完整箱码" fieldProps={{ allowClear: true }} /> : null}
      <ProFormSelect name="warehouse" label="仓库" options={finishedWarehouses} placeholder="全部仓库" />
      {tab === 'outbound' && <ProFormSelect name="restored" label="恢复状态" options={[{ value: 'no', label: '未恢复' }, { value: 'yes', label: '已恢复' }]} placeholder="全部状态" />}
      <ProFormSelect name="variety" label="品种" options={['蓝莓1号', '蓝莓2号']} placeholder="全部品种" />
      <ProFormSelect name="size" label="果径" options={finishedSizes} placeholder="全部果径" />
      <ProFormSelect name="grade" label="等级" options={finishedGrades} placeholder="全部等级" />
      {tab !== 'outbound' && <ProFormSelect name="spec" label="包装规格" options={finishedSpecs} placeholder="全部规格" />}
      <ProFormDateRangePicker name="dates" label={tab === 'inventory' ? '组托日期' : tab === 'outbound' ? '出库日期' : '入库日期'} fieldProps={{ format: 'YYYY-MM-DD', placeholder: ['开始日期', '结束日期'] }} />
    </QueryFilter>
  </Card>;
}
