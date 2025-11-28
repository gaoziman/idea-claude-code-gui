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
    case 'html':
      return { icon: '<>', color: '#e34c26' };
    case 'sql':
      return { icon: 'DB', color: '#336791' };
    case 'py':
      return { icon: '🐍', color: '#3776ab' };
    default:
      return { icon: '📄', color: '#858585' };
  }
};

// 解析搜索结果，提取文件列表
const parseSearchResults = (result?: ToolResultBlock | null): Array<{ path: string; lines?: string }> => {
  if (!result?.content) {
    return [];
  }

  const content = typeof result.content === 'string'
    ? result.content
    : Array.isArray(result.content)
      ? result.content.map(c => typeof c === 'string' ? c : c.text || '').join('\n')
      : '';

  const files: Array<{ path: string; lines?: string }> = [];
  const lines = content.split('\n');

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

  return files.slice(0, 10); // 最多显示10个结果
};

const SearchBlock = ({ input, toolName, result }: SearchBlockProps) => {
  const [expanded, setExpanded] = useState(false);

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
  const searchResults = parseSearchResults(result);
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
