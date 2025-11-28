/**
 * TodoListBlock - Trae 风格任务面板组件
 * 参考 Trae 编辑器设计，独立面板展示任务列表
 */

import { useState } from 'react';
import type { TodoItem } from '../../types';

interface TodoListBlockProps {
  todos?: TodoItem[];
}

const TodoListBlock = ({ todos }: TodoListBlockProps) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!todos?.length) {
    return null;
  }

  // 计算完成进度
  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const totalCount = todos.length;

  // 获取状态图标
  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="todo-status-icon completed">
            <span className="codicon codicon-check" />
          </span>
        );
      case 'in_progress':
        return (
          <span className="todo-status-icon running">
            <span className="todo-spinner" />
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="todo-status-icon pending">
            <span className="codicon codicon-circle-outline" />
          </span>
        );
    }
  };

  return (
    <div className="todo-panel">
      {/* 头部 */}
      <div className="todo-panel-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="todo-panel-header-left">
          <span className="todo-panel-icon">
            <span className="codicon codicon-checklist" />
          </span>
          <span className="todo-panel-progress">
            {completedCount}/{totalCount} 已完成
          </span>
        </div>
        <span className={`todo-panel-toggle codicon codicon-chevron-${collapsed ? 'right' : 'down'}`} />
      </div>

      {/* 任务列表 */}
      {!collapsed && (
        <div className="todo-panel-list">
          {todos.map((todo, index) => {
            const status = todo.status ?? 'pending';
            const displayText = status === 'in_progress' && todo.activeForm
              ? todo.activeForm
              : todo.content;

            return (
              <div
                key={todo.id ?? index}
                className={`todo-panel-item ${status}`}
              >
                {getStatusIcon(status)}
                <span className={`todo-panel-text ${status}`}>
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

export default TodoListBlock;
