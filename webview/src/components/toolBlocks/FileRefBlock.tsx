/**
 * FileRefBlock - 文件引用展示组件
 * 参考 Trae 编辑器设计，使用 ∞ 符号显示文件引用
 * 支持文件点击打开和变更统计显示
 */

import type { ToolInput } from '../../types';
import { getFileName } from '../../utils/helpers';
import { openFile } from '../../utils/bridge';

interface FileRefBlockProps {
  input?: ToolInput;
  toolName?: string;
}

// 获取文件类型图标和颜色
const getFileTypeIcon = (fileName: string): { icon: string; color: string } => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'java':
      return { icon: '☕', color: '#f89820' };
    case 'js':
      return { icon: 'JS', color: '#f7df1e' };
    case 'ts':
      return { icon: 'TS', color: '#3178c6' };
    case 'tsx':
      return { icon: 'TX', color: '#3178c6' };
    case 'jsx':
      return { icon: 'JX', color: '#61dafb' };
    case 'vue':
      return { icon: 'V', color: '#42b883' };
    case 'xml':
      return { icon: '<>', color: '#a78bfa' };
    case 'yml':
    case 'yaml':
      return { icon: '⚙', color: '#858585' };
    case 'json':
      return { icon: '{}', color: '#f7df1e' };
    case 'md':
      return { icon: 'M', color: '#4a90e2' };
    case 'css':
      return { icon: '#', color: '#264de4' };
    case 'scss':
    case 'sass':
      return { icon: 'S', color: '#cc6699' };
    case 'html':
      return { icon: '<>', color: '#e34c26' };
    case 'sql':
      return { icon: 'DB', color: '#336791' };
    case 'py':
      return { icon: '🐍', color: '#3776ab' };
    case 'go':
      return { icon: 'Go', color: '#00add8' };
    case 'rs':
      return { icon: '🦀', color: '#dea584' };
    case 'sh':
    case 'bash':
      return { icon: '$', color: '#4eaa25' };
    default:
      return { icon: '∞', color: '#666666' };
  }
};

const FileRefBlock = ({ input, toolName }: FileRefBlockProps) => {
  if (!input) {
    return null;
  }

  // 获取文件路径
  const filePath =
    (input.file_path as string) ||
    (input.path as string) ||
    (input.target_file as string) ||
    '';

  if (!filePath) {
    return null;
  }

  const fileName = getFileName(filePath) || filePath;
  const { icon, color } = getFileTypeIcon(fileName);

  // 计算变更统计（仅对 Edit 工具）
  let additions = 0;
  let deletions = 0;
  const isEdit = toolName?.toLowerCase() === 'edit' || toolName?.toLowerCase() === 'write';

  if (isEdit) {
    const oldString = (input.old_string as string) || '';
    const newString = (input.new_string as string) || '';
    deletions = oldString ? oldString.split('\n').length : 0;
    additions = newString ? newString.split('\n').length : 0;
  }

  const hasChanges = additions > 0 || deletions > 0;

  // 处理文件点击
  const handleClick = () => {
    openFile(filePath);
  };

  return (
    <div className="file-ref-block">
      <span className="file-ref-icon" style={{ color }}>
        {icon}
      </span>
      <span
        className="file-ref-name"
        onClick={handleClick}
        data-tooltip={filePath}
      >
        {fileName}
      </span>
      {hasChanges && (
        <span className="file-ref-changes">
          {additions > 0 && <span className="changes-add">+{additions}</span>}
          {deletions > 0 && <span className="changes-del">-{deletions}</span>}
        </span>
      )}
    </div>
  );
};

export default FileRefBlock;
