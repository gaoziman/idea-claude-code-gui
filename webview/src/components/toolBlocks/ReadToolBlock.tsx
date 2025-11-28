/**
 * ReadToolBlock - 读取文件工具卡片组件
 * 使用新的 ToolExecutionCard 风格
 */

import { useState } from 'react';
import type { ToolInput } from '../../types';
import { getFileName } from '../../utils/helpers';

interface ReadToolBlockProps {
  input?: ToolInput;
}

const ReadToolBlock = ({ input }: ReadToolBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!input) {
    return null;
  }

  const filePath =
    (input.file_path as string | undefined) ??
    (input.target_file as string | undefined) ??
    (input.path as string | undefined);

  const fileName = getFileName(filePath);

  // 构建行信息
  let lineInfo = '';
  if (typeof input.offset === 'number' && typeof input.limit === 'number') {
    const startLine = Number(input.offset) + 1;
    const endLine = Number(input.offset) + Number(input.limit);
    lineInfo = `第 ${startLine}-${endLine} 行`;
  }

  // 获取所有参数（用于展开视图）
  const params = Object.entries(input).filter(
    ([key]) => key !== 'file_path' && key !== 'target_file' && key !== 'path'
  );

  return (
    <div className="tool-card success">
      {/* 头部 */}
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-card-header-left">
          <span className="tool-card-icon read">
            <span className="codicon codicon-eye" />
          </span>
          <div className="tool-card-info">
            <div className="tool-card-title">
              <span className="tool-card-type">读取</span>
              <span className="tool-card-file">{fileName || filePath}</span>
            </div>
            {lineInfo && !expanded && (
              <div className="tool-card-subtitle">{lineInfo}</div>
            )}
          </div>
        </div>

        <div className="tool-card-header-right">
          <span className="tool-card-status success" />
          <span className={`tool-card-toggle codicon codicon-chevron-down ${expanded ? 'expanded' : ''}`} />
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="tool-card-content">
          <div className="tool-card-content-inner">
            <div className="bash-output">
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--tool-read-accent)', fontWeight: 600 }}>文件路径：</span>
                <span style={{ color: 'var(--status-success)' }}>{filePath}</span>
              </div>
              {lineInfo && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--tool-read-accent)', fontWeight: 600 }}>读取范围：</span>
                  <span>{lineInfo}</span>
                </div>
              )}
              {params.map(([key, value]) => (
                <div key={key} style={{ marginBottom: '4px' }}>
                  <span style={{ color: 'var(--tool-read-accent)', fontWeight: 600 }}>{key}：</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadToolBlock;
