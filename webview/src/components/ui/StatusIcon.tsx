/**
 * StatusIcon - 状态图标组件
 * 用于显示任务/操作的不同状态（待处理、进行中、完成、错误）
 */

interface StatusIconProps {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 12,
  md: 14,
  lg: 16,
};

const StatusIcon = ({ status, size = 'md', className = '' }: StatusIconProps) => {
  const iconSize = sizeMap[size];

  const getIconClass = () => {
    switch (status) {
      case 'pending':
        return 'codicon-circle-outline';
      case 'in_progress':
        return 'codicon-sync';
      case 'completed':
        return 'codicon-check';
      case 'error':
        return 'codicon-error';
      default:
        return 'codicon-circle-outline';
    }
  };

  return (
    <span
      className={`task-plan-status-icon ${status === 'in_progress' ? 'in-progress' : status} ${className}`}
      style={{ fontSize: iconSize }}
    >
      <span className={`codicon ${getIconClass()}`} />
    </span>
  );
};

export default StatusIcon;
