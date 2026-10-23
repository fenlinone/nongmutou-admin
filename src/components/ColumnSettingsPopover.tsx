import { useState } from 'react';
import { Button, Checkbox, Popover, Tooltip } from 'antd';
import { HolderOutlined, SettingOutlined } from '@ant-design/icons';

export type ColumnOption = { key: string; label: string };

type Props = {
  columns: ColumnOption[];
  hiddenKeys: string[];
  onHiddenKeysChange: (keys: string[]) => void;
  order: string[];
  onOrderChange: (keys: string[]) => void;
  buttonLabel?: string;
};

export default function ColumnSettingsPopover({ columns, hiddenKeys, onHiddenKeysChange, order, onOrderChange, buttonLabel = '列设置' }: Props) {
  const [dragging, setDragging] = useState<string>();
  const orderedColumns = [...columns].sort((left, right) => {
    const leftIndex = order.indexOf(left.key);
    const rightIndex = order.indexOf(right.key);
    return (leftIndex < 0 ? columns.indexOf(left) : leftIndex) - (rightIndex < 0 ? columns.indexOf(right) : rightIndex);
  });
  const visibleCount = columns.length - hiddenKeys.filter(key => columns.some(column => column.key === key)).length;
  const content = <div className="column-settings-popover">
    <div className="column-settings-list">
      {orderedColumns.map(column => <div key={column.key} className="column-settings-item" onDragOver={event => event.preventDefault()} onDrop={() => {
        if (!dragging || dragging === column.key) return;
        const current = orderedColumns.map(item => item.key);
        const from = current.indexOf(dragging);
        const to = current.indexOf(column.key);
        current.splice(from, 1);
        current.splice(to, 0, dragging);
        onOrderChange(current);
        setDragging(undefined);
      }}>
        <Tooltip title="拖动调整顺序"><HolderOutlined className="column-settings-drag" aria-label={`拖动${column.label}调整顺序`} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', column.key); setDragging(column.key); }} onDragEnd={() => setDragging(undefined)} /></Tooltip>
        <Checkbox checked={!hiddenKeys.includes(column.key)} disabled={!hiddenKeys.includes(column.key) && visibleCount <= 1} onChange={event => onHiddenKeysChange(event.target.checked ? hiddenKeys.filter(key => key !== column.key) : [...hiddenKeys, column.key])}>{column.label}</Checkbox>
      </div>)}
    </div>
    <div className="column-settings-footer"><Button type="link" size="small" onClick={() => { onHiddenKeysChange([]); onOrderChange(columns.map(column => column.key)); }}>恢复默认</Button></div>
  </div>;
  return <Popover placement="bottomRight" trigger="click" title={null} content={content} overlayClassName="list-column-settings-overlay"><Tooltip title={buttonLabel}><Button aria-label={buttonLabel} icon={<SettingOutlined />} /></Tooltip></Popover>;
}
