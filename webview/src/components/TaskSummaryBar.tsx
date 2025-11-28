/**
 * TaskSummaryBar - 输入框顶部任务摘要条
 * 参考 Trae 编辑器设计，显示任务进度摘要
 */

import { useState } from 'react';
import type { TodoItem } from '../types';

interface TaskSummaryBarProps {
  todos?: TodoItem[];
}

const TaskSummaryBar = ({ todos }: TaskSummaryBarProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!todos?.length) {
    return null;
  }

  // 计算进度
  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const totalCount = todos.length;
  const runningTask = todos.find((t) => t.status === 'in_progress');

  // 获取状态图标
  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return <span className="summary-item-icon completed codicon codicon-check" />;
      case 'in_progress':
        return <span className="summary-item-icon running"><span className="summary-spinner" /></span>;
      default:
        return <span className="summary-item-icon pending codicon codicon-circle-outline" />;
    }
  };

  return (
    <div className="task-summary-bar">
      {/* 摘要头部 */}
      <div className="task-summary-header" onClick={() => setExpanded(!expanded)}>
        <div className="task-summary-left">
          <span className="task-summary-icon codicon codicon-checklist" />
          <span className="task-summary-icon-secondary codicon codicon-note" />
          <span className="task-summary-text">
            {completedCount}/{totalCount} 任务完成
          </span>
          {runningTask && (
            <span className="task-summary-current">
              · {runningTask.activeForm || runningTask.content}
            </span>
          )}
        </div>
        <span className={`task-summary-toggle codicon codicon-chevron-${expanded ? 'down' : 'right'}`} />
      </div>

      {/* 展开的任务列表 */}
      {expanded && (
        <div className="task-summary-list">
          {todos.map((todo, index) => {
            const status = todo.status ?? 'pending';
            const displayText = status === 'in_progress' && todo.activeForm
              ? todo.activeForm
              : todo.content;

            return (
              <div key={todo.id ?? index} className={`task-summary-item ${status}`}>
                {getStatusIcon(status)}
                <span className={`task-summary-item-text ${status}`}>
                  {displayText}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskSummaryBar;
