/**
 * ThinkingBlock - 思考过程展示组件
 * 用于展示 AI 的推理/思考过程，参考 Trae 编辑器风格
 */

import { useState, useMemo } from 'react';
import { ProgressBar } from '../ui';

interface ThinkingBlockProps {
  content: string;
  isThinking?: boolean;
  summary?: string;
}

const ThinkingBlock = ({ content, isThinking = false, summary }: ThinkingBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  // 解析思考内容为步骤
  const steps = useMemo(() => {
    if (!content) return [];
    // 按行分割，过滤空行
    return content
      .split('\n')
      .filter((line) => line.trim())
      .slice(0, 10); // 最多显示10条
  }, [content]);

  // 生成摘要
  const displaySummary = useMemo(() => {
    if (summary) return summary;
    if (steps.length > 0) {
      const firstStep = steps[0].trim();
      return firstStep.length > 50 ? firstStep.substring(0, 50) + '...' : firstStep;
    }
    return isThinking ? '正在思考中...' : '思考完成';
  }, [summary, steps, isThinking]);

  if (!content && !isThinking) return null;

  return (
    <div className="thinking-block">
      <div className="thinking-header" onClick={() => setExpanded(!expanded)}>
        <div className="thinking-header-left">
          <span className={`thinking-icon ${isThinking ? 'is-thinking' : 'is-complete'}`}>
            <span className={`codicon ${isThinking ? 'codicon-sync' : 'codicon-check'}`} />
          </span>
          <span className="thinking-title">
            {isThinking ? '深度思考' : '思考完成'}
          </span>
          {!expanded && (
            <span className="thinking-status">{displaySummary}</span>
          )}
        </div>
        <span className={`thinking-toggle codicon codicon-chevron-down ${expanded ? 'expanded' : ''}`} />
      </div>

      {expanded && (
        <div className="thinking-content">
          <div className="thinking-timeline">
            {steps.map((step, index) => (
              <div key={index} className="thinking-step">
                {step}
              </div>
            ))}
          </div>

          {isThinking && (
            <div className="thinking-progress">
              <ProgressBar progress={100} variant="thinking" animated />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;
