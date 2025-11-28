/**
 * LoadingIndicator - Claude 思考状态指示器
 * 简洁设计：只显示"思考中..."和时间
 */

import { useThinkingTimer } from '../hooks';

interface LoadingIndicatorProps {
  isLoading: boolean;
  thinkingContent?: string;
  inputTokens?: number;
  outputTokens?: number;
}

const LoadingIndicator = ({
  isLoading,
}: LoadingIndicatorProps) => {
  const { formatted } = useThinkingTimer(isLoading);

  if (!isLoading) return null;

  return (
    <div className="loading-indicator">
      <span className="loading-text">思考中</span>
      <span className="loading-dots">...</span>
      <span className="loading-time">{formatted}</span>
    </div>
  );
};

export default LoadingIndicator;
