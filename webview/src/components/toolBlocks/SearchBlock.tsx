/**
 * SearchBlock - 可折叠搜索结果组件
 * 参考 Trae 编辑器设计，显示搜索操作和结果
 */

import { useState } from 'react';
import type { ToolInput, ToolResultBlock } from '../../types';
import { openFile } from '../../utils/bridge';

interface SearchBlockProps {
  input?: ToolInput;
  toolName?: string;
  result?: ToolResultBlock | null;
}

// 获取文件类型图标和颜色 - Trae 风格简洁配色
const getFileTypeIcon = (fileName: string): { icon: string; color: string } => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'java':
      return { icon: 'J', color: '#e57373' }; // 柔和红色
    case 'js':
      return { icon: 'JS', color: '#ffd54f' }; // 柔和黄色
    case 'ts':
      return { icon: 'TS', color: '#64b5f6' }; // 柔和蓝色
    case 'tsx':
      return { icon: 'TX', color: '#64b5f6' };
    case 'jsx':
      return { icon: 'JX', color: '#4dd0e1' };
    case 'vue':
      return { icon: 'V', color: '#81c784' }; // 柔和绿色
    case 'xml':
      return { icon: 'X', color: '#ce93d8' }; // 柔和紫色
    case 'yml':
    case 'yaml':
      return { icon: 'Y', color: '#90a4ae' }; // 灰色
    case 'json':
      return { icon: '{ }', color: '#ffd54f' };
    case 'md':
      return { icon: 'M', color: '#90a4ae' };
    case 'css':
      return { icon: '#', color: '#64b5f6' };
    case 'scss':
    case 'sass':
      return { icon: 'S', color: '#f48fb1' };
    case 'html':
      return { icon: 'H', color: '#ffb74d' };
    case 'sql':
      return { icon: 'DB', color: '#90a4ae' };
    case 'py':
      return { icon: 'Py', color: '#ffd54f' };
    case 'go':
      return { icon: 'Go', color: '#4dd0e1' };
    case 'rs':
      return { icon: 'Rs', color: '#ffb74d' };
    case 'kt':
      return { icon: 'Kt', color: '#ce93d8' };
    case 'swift':
      return { icon: 'Sw', color: '#ffb74d' };
    case 'rb':
      return { icon: 'Rb', color: '#e57373' };
    case 'php':
      return { icon: 'P', color: '#9fa8da' };
    case 'c':
      return { icon: 'C', color: '#90a4ae' };
    case 'cpp':
    case 'cc':
      return { icon: 'C+', color: '#64b5f6' };
    case 'h':
    case 'hpp':
      return { icon: 'H', color: '#90a4ae' };
    case 'sh':
    case 'bash':
      return { icon: '$', color: '#81c784' };
    default:
      return { icon: 'F', color: '#78909c' }; // 默认灰色
  }
};

// 解析搜索结果，提取文件列表
const parseSearchResults = (result?: ToolResultBlock | null, toolName?: string): Array<{ path: string; lines?: string }> => {
  if (!result) {
    return [];
  }

  // Debug: 打印结果结构
  console.log('[parseSearchResults] Result structure:', {
    hasContent: 'content' in result,
    hasFilenames: 'filenames' in result,
    hasStdout: 'stdout' in result,
    resultKeys: Object.keys(result),
    toolName,
  });

  // 优先使用 filenames 数组（SDK Glob 格式）
  const filenames = (result as Record<string, unknown>).filenames as string[] | undefined;
  if (Array.isArray(filenames) && filenames.length > 0) {
    console.log('[parseSearchResults] Using filenames array:', filenames.length, 'files');
    return filenames.slice(0, 20).map(path => ({ path }));
  }

  // 检查 stdout（Bash 工具格式）
  const stdout = (result as Record<string, unknown>).stdout as string | undefined;
  if (stdout && typeof stdout === 'string') {
    console.log('[parseSearchResults] Using stdout (Bash format):', stdout.substring(0, 200));
    return parseBashOutput(stdout);
  }

  // 后备：解析 content 字符串
  const content = result.content;
  if (!content) {
    return [];
  }

  const contentStr = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map(c => typeof c === 'string' ? c : (c as { text?: string }).text || '').join('\n')
      : '';

  // 如果是 Bash 工具，使用 Bash 输出解析器
  if (toolName?.toLowerCase() === 'bash') {
    return parseBashOutput(contentStr);
  }

  const files: Array<{ path: string; lines?: string }> = [];
  const lines = contentStr.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 匹配文件路径模式
    // 格式1: path/to/file.java:123
    // 格式2: path/to/file.java
    const match = trimmed.match(/^([^\s:]+\.[a-zA-Z0-9]+)(?::(\d+(?:-\d+)?))?/);
    if (match) {
      files.push({
        path: match[1],
        lines: match[2],
      });
    }
  }

  return files.slice(0, 20); // 最多显示20个结果
};

// 解析 Bash find 命令的输出
const parseBashOutput = (output: string): Array<{ path: string; lines?: string }> => {
  const files: Array<{ path: string; lines?: string }> = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 跳过错误信息和非文件路径行
    if (trimmed.startsWith('find:') || trimmed.startsWith('Permission denied')) continue;

    // 匹配文件路径（以 .扩展名 结尾或包含路径分隔符）
    // 格式: ./path/to/file.java 或 path/to/file.java
    if (trimmed.match(/\.[a-zA-Z0-9]+$/) || trimmed.includes('/')) {
      // 确保看起来像是文件路径
      if (!trimmed.includes(' ') || trimmed.startsWith('./') || trimmed.startsWith('/')) {
        files.push({
          path: trimmed.replace(/^\.\//, ''), // 移除开头的 ./
        });
      }
    }
  }

  console.log('[parseBashOutput] Parsed files:', files.length);
  return files.slice(0, 20);
};

const SearchBlock = ({ input, toolName, result }: SearchBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  // Debug: 打印 SearchBlock 接收到的 props
  console.log('[SearchBlock] Component rendered:', {
    hasInput: !!input,
    toolName,
    hasResult: !!result,
    resultContent: result?.content,
    resultType: typeof result?.content,
  });

  if (!input) {
    return null;
  }

  // 获取搜索模式
  const pattern = (input.pattern as string) || (input.query as string) || '';

  if (!pattern) {
    return null;
  }

  // 构建搜索描述
  const isGlob = toolName?.toLowerCase() === 'glob';
  const searchDesc = isGlob
    ? `'${pattern}'`
    : `'${pattern}'`;

  // 解析搜索结果
  const searchResults = parseSearchResults(result, toolName);
  const hasResults = searchResults.length > 0;

  // 处理文件点击
  const handleFileClick = (filePath: string) => {
    openFile(filePath);
  };

  // 获取文件名
  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  return (
    <div className="search-block">
      <div
        className="search-block-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`search-block-toggle codicon codicon-chevron-${expanded ? 'down' : 'right'}`} />
        <span className="search-block-title">
          在工作区搜索 {searchDesc}
        </span>
        {hasResults && (
          <span className="search-block-count">{searchResults.length} 个结果</span>
        )}
      </div>

      {expanded && hasResults && (
        <div className="search-block-results">
          {searchResults.map((file, index) => {
            const fileName = getFileName(file.path);
            const { icon, color } = getFileTypeIcon(fileName);

            return (
              <div
                key={index}
                className="search-result-item"
                onClick={() => handleFileClick(file.path)}
              >
                <span className="search-result-connector">│</span>
                <span className="search-result-icon" style={{ color }}>
                  {icon}
                </span>
                <span className="search-result-name" data-tooltip={file.path}>
                  {fileName}
                </span>
                {file.lines && (
                  <span className="search-result-lines">{file.lines}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {expanded && !hasResults && (
        <div className="search-block-empty">
          <span className="search-result-connector">│</span>
          <span className="search-empty-text">无搜索结果</span>
        </div>
      )}
    </div>
  );
};

export default SearchBlock;
