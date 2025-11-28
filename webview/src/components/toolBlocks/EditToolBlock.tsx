/**
 * EditToolBlock - 编辑文件工具卡片组件
 * 使用新的 ToolExecutionCard 风格，展示 diff 视图
 */

import { useState } from 'react';
import type { ToolInput } from '../../types';
import { getFileName } from '../../utils/helpers';
import GenericToolBlock from './GenericToolBlock';

interface EditToolBlockProps {
  name?: string;
  input?: ToolInput;
}

const EditToolBlock = ({ name, input }: EditToolBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!input) {
    return null;
  }

  const filePath =
    (input.file_path as string | undefined) ??
    (input.path as string | undefined) ??
    (input.target_file as string | undefined);

  const oldString = (input.old_string as string | undefined) ?? '';
  const newString = (input.new_string as string | undefined) ?? '';

  if (!oldString && !newString) {
    return <GenericToolBlock name={name} input={input} />;
  }

  const oldLines = oldString ? oldString.split('\n') : [];
  const newLines = newString ? newString.split('\n') : [];
  const fileName = getFileName(filePath);

  // 构建变更摘要
  const changesSummary = [];
  if (newLines.length > 0) {
    changesSummary.push(`+${newLines.length}`);
  }
  if (oldLines.length > 0) {
    changesSummary.push(`-${oldLines.length}`);
  }

  return (
    <div className="tool-card edit">
      {/* 头部 */}
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-card-header-left">
          <span className="tool-card-icon edit">
            <span className="codicon codicon-edit" />
          </span>
          <div className="tool-card-info">
            <div className="tool-card-title">
              <span className="tool-card-type">修改</span>
              <span className="tool-card-file">{fileName || filePath}</span>
              {changesSummary.length > 0 && !expanded && (
                <span className="tool-card-changes">
                  {newLines.length > 0 && (
                    <span className="changes-add">+{newLines.length}</span>
                  )}
                  {oldLines.length > 0 && (
                    <span className="changes-del">-{oldLines.length}</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="tool-card-header-right">
          <span className="tool-card-status success" />
          <span className={`tool-card-toggle codicon codicon-chevron-down ${expanded ? 'expanded' : ''}`} />
        </div>
      </div>

      {/* 展开内容 - Diff 视图 */}
      {expanded && (
        <div className="tool-card-content">
          <div className="tool-card-content-inner">
            {/* 文件路径 */}
            <div className="diff-header">
              <span className="diff-file-path">{filePath}</span>
              <span className="diff-stats">
                {newLines.length > 0 && (
                  <span className="diff-stat-add">+{newLines.length}</span>
                )}
                {oldLines.length > 0 && (
                  <span className="diff-stat-del">-{oldLines.length}</span>
                )}
              </span>
            </div>

            {/* Diff 内容 */}
            <div className="diff-content">
              {/* 删除的行 */}
              {oldLines.map((line, index) => (
                <div key={`old-${index}`} className="diff-line deletion">
                  <span className="diff-line-number" />
                  <span className="diff-line-sign">-</span>
                  <span className="diff-line-content">{line || ' '}</span>
                </div>
              ))}

              {/* 添加的行 */}
              {newLines.map((line, index) => (
                <div key={`new-${index}`} className="diff-line addition">
                  <span className="diff-line-number" />
                  <span className="diff-line-sign">+</span>
                  <span className="diff-line-content">{line || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditToolBlock;
