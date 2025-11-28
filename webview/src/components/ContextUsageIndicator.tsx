/**
 * ContextUsageIndicator - 上下文使用量指示器
 * 显示当前会话的上下文 token 使用情况
 *
 * 设计参考 Claude Code 命令行版本
 */

import { useMemo } from 'react';

interface ContextUsageIndicatorProps {
  /** 已使用的 tokens */
  used: number;
  /** 总上下文窗口大小，默认 200000 */
  total?: number;
  /** 是否显示详细数值，默认 true */
  showDetails?: boolean;
}

// 上下文窗口大小常量
const DEFAULT_CONTEXT_WINDOW = 200_000;

// 颜色分级配置
const COLOR_THRESHOLDS = [
  { max: 50, color: '#4a9eff' },   // 蓝色 - 充足
  { max: 75, color: '#f5a623' },   // 黄色 - 注意
  { max: 90, color: '#ff6b35' },   // 橙色 - 警告
  { max: 100, color: '#ff4444' },  // 红色 - 危险
];

/**
 * 格式化 token 数量
 * @param count token 数量
 * @returns 格式化后的字符串 (如 13.9K)
 */
const formatTokenCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

/**
 * 根据使用百分比获取对应颜色
 */
const getColorByPercentage = (percentage: number): string => {
  for (const threshold of COLOR_THRESHOLDS) {
    if (percentage <= threshold.max) {
      return threshold.color;
    }
  }
  return COLOR_THRESHOLDS[COLOR_THRESHOLDS.length - 1].color;
};

/**
 * 圆形进度环组件
 */
const CircularProgress = ({
  percentage,
  color,
  size = 16,
  strokeWidth = 2
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <svg
      className="context-usage-progress"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* 背景环 */}
      <circle
        className="context-usage-progress-bg"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />
      {/* 进度环 */}
      <circle
        className="context-usage-progress-bar"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
      />
    </svg>
  );
};

const ContextUsageIndicator = ({
  used,
  total = DEFAULT_CONTEXT_WINDOW,
  showDetails = true,
}: ContextUsageIndicatorProps) => {
  // 计算使用百分比
  const percentage = useMemo(() => {
    if (total <= 0) return 0;
    const pct = Math.round((used / total) * 100);
    return Math.min(pct, 100); // 限制最大 100%
  }, [used, total]);

  // 获取当前颜色
  const color = useMemo(() => getColorByPercentage(percentage), [percentage]);

  // 格式化显示值
  const formattedUsed = useMemo(() => formatTokenCount(used), [used]);
  const formattedTotal = useMemo(() => formatTokenCount(total), [total]);

  // 如果没有使用量，不显示
  if (used <= 0) {
    return null;
  }

  return (
    <div
      className="context-usage-indicator"
      title={`上下文使用量: ${used.toLocaleString()} / ${total.toLocaleString()} tokens`}
    >
      <CircularProgress percentage={percentage} color={color} />

      <span className="context-usage-text">
        <span className="context-usage-percentage" style={{ color }}>
          {percentage}%
        </span>

        {showDetails && (
          <>
            <span className="context-usage-separator">·</span>
            <span className="context-usage-values">
              {formattedUsed} / {formattedTotal}
            </span>
          </>
        )}

        <span className="context-usage-label">上下文</span>
      </span>
    </div>
  );
};

export default ContextUsageIndicator;
