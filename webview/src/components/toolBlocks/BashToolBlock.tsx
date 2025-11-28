/**
 * BashToolBlock - 命令行工具卡片组件
 * 使用新的 ToolExecutionCard 风格
 */

import { useState } from 'react';
import type { ToolInput, ToolResultBlock } from '../../types';

interface BashToolBlockProps {
  name?: string;
  input?: ToolInput;
  result?: ToolResultBlock | null;
}

const BashToolBlock = ({ input, result }: BashToolBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!input) {
    return null;
  }

  const command = (input.command as string | undefined) ?? '';
  const description = (input.description as string | undefined) ?? '';

  // 确定状态
  let status: 'pending' | 'running' | 'success' | 'error' = 'pending';
  let isError = false;
  let output = '';

  if (result) {
    status = 'success';
    if (result.is_error) {
      status = 'error';
      isError = true;
    }

    const content = result.content;
    if (typeof content === 'string') {
      output = content;
    } else if (Array.isArray(content)) {
      output = content.map((block) => block.text ?? '').join('\n');
    }
  } else {
    status = 'running';
  }

  // 获取状态类名
  const getStatusClass = () => {
    if (!result) return 'running';
    return isError ? 'error' : 'success';
  };

  return (
    <div className={`tool-card ${getStatusClass()}`}>
      {/* 头部 */}
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-card-header-left">
          <span className="tool-card-icon bash">
            <span className="codicon codicon-terminal" />
          </span>
          <div className="tool-card-info">
            <div className="tool-card-title">
              <span className="tool-card-type">命令行</span>
              {description && (
                <span className="tool-card-file">{description}</span>
              )}
            </div>
            {!expanded && command && (
              <div className="tool-card-subtitle">{command.length > 60 ? command.substring(0, 60) + '...' : command}</div>
            )}
          </div>
        </div>

        <div className="tool-card-header-right">
          <span className={`tool-card-status ${status}`} />
          <span className={`tool-card-toggle codicon codicon-chevron-down ${expanded ? 'expanded' : ''}`} />
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="tool-card-content">
          <div className="tool-card-content-inner">
            {/* 命令 */}
            <div className="bash-command">
              <span className="bash-prompt">$</span>
              <span className="bash-command-text">{command}</span>
            </div>

            {/* 输出 */}
            {output && (
              <div className={`bash-result ${isError ? 'error' : ''}`}>
                {output}
              </div>
            )}

            {/* 退出码 */}
            {result && (
              <div className={`bash-exit-code ${isError ? 'error' : 'success'}`}>
                <span className={`codicon ${isError ? 'codicon-error' : 'codicon-check'}`} />
                <span>{isError ? '执行失败' : '执行成功'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BashToolBlock;
