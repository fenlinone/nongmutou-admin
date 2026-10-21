import { ProFormDateRangePicker, ProFormSelect, ProFormText, QueryFilter } from '@ant-design/pro-components';
import { Button, Card, Col, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { greenhouseOptions, initialFilters, type FilterValues } from '../data';

export default function FilterPanel({ onSearch }: { onSearch: (values: FilterValues) => void }) {
  return <Card variant="borderless" className="ds-search-panel ds-form-panel filter-panel">
    <QueryFilter<FilterValues>
      initialValues={initialFilters}
      autoFocusFirstInput={false}
      defaultCollapsed={false}
      collapsed={false}
      collapseRender={false}
      split={false}
      span={6}
      labelWidth="auto"
      searchGutter={[16, 12]}
      onFinish={async values => onSearch(values)}
      onReset={() => onSearch(initialFilters)}
      submitter={{
        searchConfig: { submitText: '查询', resetText: '重置' },
        render: props => <Col span={24} className="filter-actions"><Space size={12}><Button type="link" onClick={() => { props.form?.resetFields(); onSearch(initialFilters); }}>重置</Button><Button type="primary" htmlType="submit">查询</Button></Space></Col>,
      }}
    >
      <ProFormDateRangePicker name="dates" label="称重日期" colProps={{ className: 'date-filter', span: 8 }} fieldProps={{ format: 'YYYY-MM-DD', allowClear: true, separator: '~', placeholder: ['开始日期', '结束日期'] }} />
      <ProFormText name="worker" label="工人姓名/工号" colProps={{ className: 'worker-filter', span: 7 }} fieldProps={{ placeholder: '请输入工人姓名或工号', suffix: <SearchOutlined />, allowClear: true }} />
      <ProFormSelect name="greenhouse" label="大棚号" colProps={{ className: 'house-filter', span: 5 }} options={greenhouseOptions} placeholder="搜索或选择大棚" fieldProps={{ showSearch: true, optionFilterProp: 'label', popupMatchSelectWidth: 260, listHeight: 320 }} />
      <ProFormSelect name="team" label="班组" colProps={{ className: 'team-filter', span: 4 }} options={['A班', 'B班']} placeholder="请选择" />
      <ProFormSelect name="variety" label="品种" options={['蓝莓1号', '蓝莓2号', '废果']} placeholder="请选择" />
      <ProFormSelect name="size" label="果径" options={['L', 'M', 'S']} placeholder="请选择" />
      <ProFormSelect name="grade" label="等级" options={['特级', '一级', '/']} placeholder="请选择" />
      <ProFormSelect name="status" label="记录状态" options={[{ value: 'all', label: '全部' }, { value: 'valid', label: '有效' }, { value: 'void', label: '作废' }]} allowClear={false} />
    </QueryFilter>
  </Card>;
}
