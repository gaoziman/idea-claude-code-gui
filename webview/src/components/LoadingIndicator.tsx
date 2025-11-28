/**
 * LoadingIndicator - Claude 思考状态指示器
 * 显示实时计时、Token 统计等信息，参考 Claude Code 命令行风格
 */

import { useState } from 'react';
import { useThinkingTimer } from '../hooks';

interface LoadingIndicatorProps {
  isLoading: boolean;
  thinkingContent?: string;
  inputTokens?: number;
  outputTokens?: number;
}

const LoadingIndicator = ({
  isLoading,
  thinkingContent,
  inputTokens = 0,
  outputTokens = 0,
}: LoadingIndicatorProps) => {
  const [expanded, setExpanded] = useState(false);
  const { seconds, formatted } = useThinkingTimer(isLoading);

  if (!isLoading) return null;

  // 格式化 token 数量
  const formatTokens = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const hasThinkingContent = thinkingContent && thinkingContent.trim().length > 0;

  return (
    <div className="loading-indicator">
      {/* 主要指示器区域 */}
      <div
        className={`loading-indicator-header ${hasThinkingContent ? 'clickable' : ''}`}
        onClick={() => hasThinkingContent && setExpanded(!expanded)}
      >
        {/* 脉冲圆点 */}
        <div className="loading-pulse-container">
          <span className="loading-pulse-dot" />
          <span className="loading-pulse-ring" />
        </div>

        {/* 思考文字 */}
        <span className="loading-label">Thinking</span>

        {/* 展开/折叠按钮和计时器 */}
        <div className="loading-timer-section">
          {hasThinkingContent && (
            <span className={`loading-chevron codicon codicon-chevron-${expanded ? 'up' : 'down'}`} />
          )}
          <span className="loading-timer">
            Thought for <span className="loading-timer-value">{formatted}</span>
          </span>
        </div>
      </div>

      {/* 可展开的思考内容 */}
      {expanded && hasThinkingContent && (
        <div className="loading-content">
          <div className="loading-content-text">{thinkingContent}</div>
        </div>
      )}

      {/* Token 统计 */}
      <div className="loading-stats">
        <span className="loading-stats-time">{seconds}s</span>
        <span className="loading-stats-separator">·</span>
        <span className="loading-stats-tokens loading-stats-up">
          <span className="loading-stats-arrow">↑</span>
          {formatTokens(inputTokens)}
        </span>
        <span className="loading-stats-separator">·</span>
        <span className="loading-stats-tokens loading-stats-down">
          <span className="loading-stats-arrow">↓</span>
          {formatTokens(outputTokens)}
        </span>
        <span className="loading-stats-label">tokens</span>
      </div>
    </div>
  );
};

export default LoadingIndicator;
