/**
 * ToolLineBlock - 极简行式工具展示组件
 * 参考 Trae 编辑器设计，一行展示工具执行
 * 支持文件点击打开和路径 tooltip
 */

import type { ToolInput } from '../../types';
import { getFileName } from '../../utils/helpers';
import { openFile } from '../../utils/bridge';

interface ToolLineBlockProps {
  name?: string;
  input?: ToolInput;
  isRunning?: boolean;
}

interface ToolDisplay {
  icon: string;
  iconClass: string;
  text: string;
  filePath?: string;
  clickable: boolean;
}

const ToolLineBlock = ({ name, input, isRunning = false }: ToolLineBlockProps) => {
  if (!input) {
    return null;
  }

  // 根据工具类型获取图标和显示内容
  const getToolDisplay = (): ToolDisplay => {
    const toolName = name?.toLowerCase() || '';

    // 读取文件
    if (toolName === 'read' || toolName.includes('read')) {
      const filePath =
        (input.file_path as string) ||
        (input.target_file as string) ||
        (input.path as string) ||
        '';
      const fileName = getFileName(filePath) || filePath;
      return {
        icon: 'link',
        iconClass: 'tool-line-icon-read',
        text: fileName,
        filePath,
        clickable: true,
      };
    }

    // 编辑文件
    if (toolName === 'edit' || toolName.includes('edit') || toolName === 'write') {
      const filePath =
        (input.file_path as string) ||
        (input.path as string) ||
        (input.target_file as string) ||
        '';
      const fileName = getFileName(filePath) || filePath;
      const oldString = (input.old_string as string) || '';
      const newString = (input.new_string as string) || '';
      const oldLines = oldString ? oldString.split('\n').length : 0;
      const newLines = newString ? newString.split('\n').length : 0;

      let stats = '';
      if (newLines > 0 || oldLines > 0) {
        const parts = [];
        if (newLines > 0) parts.push(`+${newLines}`);
        if (oldLines > 0) parts.push(`-${oldLines}`);
        stats = ` ${parts.join(' ')}`;
      }

      return {
        icon: 'edit',
        iconClass: 'tool-line-icon-edit',
        text: `${fileName}${stats}`,
        filePath,
        clickable: true,
      };
    }

    // 命令行
    if (toolName === 'bash' || toolName.includes('bash') || toolName.includes('command')) {
      const description = (input.description as string) || '';
      const command = (input.command as string) || '';
      const displayText = description || (command.length > 50 ? command.substring(0, 50) + '...' : command);
      return {
        icon: 'chevron-right',
        iconClass: 'tool-line-icon-bash',
        text: displayText,
        clickable: false,
      };
    }

    // 搜索/Glob/Grep
    if (toolName === 'glob' || toolName === 'grep' || toolName.includes('search')) {
      const pattern = (input.pattern as string) || (input.query as string) || '';
      return {
        icon: 'search',
        iconClass: 'tool-line-icon-search',
        text: pattern,
        clickable: false,
      };
    }

    // Task/Agent
    if (toolName === 'task' || toolName.includes('task') || toolName.includes('agent')) {
      const description = (input.description as string) || (input.prompt as string) || '';
      const displayText = description.length > 60 ? description.substring(0, 60) + '...' : description;
      return {
        icon: 'run-all',
        iconClass: 'tool-line-icon-task',
        text: displayText,
        clickable: false,
      };
    }

    // 默认
    const firstValue = Object.values(input).find(v => typeof v === 'string') as string;
    return {
      icon: 'circle-outline',
      iconClass: 'tool-line-icon-default',
      text: firstValue || name || 'Unknown',
      clickable: false,
    };
  };

  const { icon, iconClass, text, filePath, clickable } = getToolDisplay();

  // 处理文件点击
  const handleClick = () => {
    if (clickable && filePath) {
      openFile(filePath);
    }
  };

  return (
    <div className={`tool-line ${isRunning ? 'running' : ''}`}>
      <span className={`tool-line-icon ${iconClass}`}>
        <span className={`codicon codicon-${icon}`} />
      </span>
      {clickable && filePath ? (
        <span
          className="tool-line-text clickable"
          onClick={handleClick}
          data-tooltip={filePath}
        >
          {text}
        </span>
      ) : (
        <span className="tool-line-text">{text}</span>
      )}
      {isRunning && <span className="tool-line-spinner" />}
    </div>
  );
};

export default ToolLineBlock;
