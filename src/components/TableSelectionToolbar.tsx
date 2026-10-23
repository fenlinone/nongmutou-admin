import type { ReactNode } from 'react';
import { Button } from 'antd';

type TableSelectionToolbarProps = {
  title: ReactNode;
  leadingContent?: ReactNode;
  selectedCount: number;
  selectedLabel?: string;
  onClear: () => void;
  batchActions?: ReactNode;
  fixedActions?: ReactNode;
  className?: string;
};

type TableActionGroupsProps = {
  selectedCount: number;
  batchActions?: ReactNode;
  fixedActions?: ReactNode;
  className?: string;
};

/** 复用于普通表格工具栏及 ProTable 的 toolBarRender。 */
export function TableActionGroups({ selectedCount, batchActions, fixedActions, className = '' }: TableActionGroupsProps) {
  const showBatchActions = selectedCount > 0 && Boolean(batchActions);
  if (!showBatchActions && !fixedActions) return null;

  return <div className={`table-selection-toolbar-actions ${className}`.trim()}>
    {showBatchActions && <div className="table-selection-toolbar-batch-actions">{batchActions}</div>}
    {showBatchActions && fixedActions && <span className="table-selection-toolbar-divider" aria-hidden="true" />}
    {fixedActions && <div className="table-selection-toolbar-fixed-actions">{fixedActions}</div>}
  </div>;
}

export default function TableSelectionToolbar({ title, leadingContent, selectedCount, selectedLabel = '项', onClear, batchActions, fixedActions, className = '' }: TableSelectionToolbarProps) {
  return <div className={`table-selection-toolbar ${className}`.trim()}>
    <div className="table-selection-toolbar-leading">
      <strong className="table-selection-toolbar-title">{title}</strong>
      {selectedCount > 0 && <div className="table-selection-toolbar-selection" aria-live="polite">
        <span>已选 <strong>{selectedCount}</strong> {selectedLabel}</span>
        <Button type="link" size="small" className="table-selection-toolbar-clear" onClick={onClear}>清空</Button>
      </div>}
      {leadingContent}
    </div>
    <TableActionGroups selectedCount={selectedCount} batchActions={batchActions} fixedActions={fixedActions} />
  </div>;
}
