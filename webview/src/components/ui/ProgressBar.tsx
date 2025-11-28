/**
 * ProgressBar - 进度条组件
 * 用于显示任务进度、思考进度等
 */

interface ProgressBarProps {
  progress: number; // 0-100
  variant?: 'default' | 'thinking' | 'success';
  animated?: boolean;
  height?: number;
  className?: string;
}

const ProgressBar = ({
  progress,
  variant = 'default',
  animated = false,
  height = 4,
  className = '',
}: ProgressBarProps) => {
  const getBarClass = () => {
    switch (variant) {
      case 'thinking':
        return 'thinking-progress-fill';
      case 'success':
        return 'task-plan-progress-fill';
      default:
        return 'task-plan-progress-fill';
    }
  };

  const getContainerClass = () => {
    switch (variant) {
      case 'thinking':
        return 'thinking-progress-bar';
      default:
        return 'task-plan-progress-bar';
    }
  };

  return (
    <div
      className={`${getContainerClass()} ${className}`}
      style={{ height }}
    >
      <div
        className={getBarClass()}
        style={{
          width: animated ? '100%' : `${Math.min(100, Math.max(0, progress))}%`,
        }}
      />
    </div>
  );
};

export default ProgressBar;
