import type { ReactNode } from 'react';
import { Button } from 'antd';

type TableSelectionToolbarProps = {
  title: ReactNode;
  selectedCount: number;
  selectedLabel?: string;
  onClear: () => void;
  actions?: ReactNode;
  className?: string;
};

export default function TableSelectionToolbar({ title, selectedCount, selectedLabel = '项', onClear, actions, className = '' }: TableSelectionToolbarProps) {
  return <div className={`table-selection-toolbar ${className}`.trim()}>
    <div className="table-selection-toolbar-leading">
      <strong className="table-selection-toolbar-title">{title}</strong>
      {selectedCount > 0 && <div className="table-selection-toolbar-selection" aria-live="polite">
        <span>已选 <strong>{selectedCount}</strong> {selectedLabel}</span>
        <Button type="link" size="small" className="table-selection-toolbar-clear" onClick={onClear}>清空</Button>
      </div>}
    </div>
    {actions && <div className="table-selection-toolbar-actions">{actions}</div>}
  </div>;
}
