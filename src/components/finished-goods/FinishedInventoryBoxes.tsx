// 基于 ant-design-skill 03-NestedTable 模板的展开子表，展示当前组托在库箱明细。
import type { TableColumnsType } from 'antd';
import { Button, Table, Tag } from 'antd';
import { formatWeight, type FinishedBox } from '../../finishedGoods';
import type { FinishedView } from './FinishedGoodsDetails';

export default function FinishedInventoryBoxes({ boxes, originalCount, includeHistory = false, onView }: { boxes: FinishedBox[]; originalCount: number; includeHistory?: boolean; onView: (view: FinishedView) => void }) {
  const columns: TableColumnsType<FinishedBox> = [
    { title: '箱码', dataIndex: 'code', key: 'code', width: 180, render: code => <Button type="link" className="finished-link" onClick={() => onView({ type: 'box', id: code })}>{code}</Button> },
    { title: '品种', dataIndex: 'variety', key: 'variety', width: 96 },
    { title: '果径', dataIndex: 'size', key: 'size', width: 72 },
    { title: '等级', dataIndex: 'grade', key: 'grade', width: 82 },
    { title: '包装规格', dataIndex: 'spec', key: 'spec', width: 150 },
    { title: '每箱标准净重 (kg)', dataIndex: 'weight', key: 'weight', width: 150, render: formatWeight },
    ...(includeHistory ? [{ title: '当前状态', key: 'state', width: 96, render: (_: unknown, box: FinishedBox) => <Tag color={box.state === 'stock' ? 'success' : 'default'}>{box.state === 'stock' ? '在库' : '已出库'}</Tag> }] : []),
    { title: '操作', key: 'operation', width: 100, render: (_, box) => <Button type="link" className="finished-link" onClick={() => onView({ type: 'box', id: box.code })}>查看详情</Button> },
  ];
  const scrollWidth = columns.reduce((sum, column) => sum + Number(column.width ?? 100), 40);
  return <div className="finished-inventory-boxes">
    <div className="finished-inventory-boxes-heading"><strong>{includeHistory ? '组托箱清单' : '当前在库箱清单'}</strong><span>原组托 {originalCount} 箱，当前在库 {boxes.filter(box => box.state === 'stock').length} 箱</span></div>
    <Table<FinishedBox> rowKey="code" columns={columns} dataSource={boxes} pagination={false} size="small" scroll={{ x: scrollWidth }} />
  </div>;
}
