import { useEffect, useRef } from 'react';
import type { SearchResult, ResourceType } from '../../types';

interface SearchDropdownProps {
  isOpen: boolean;
  results: SearchResult[];
  loading: boolean;
  query: string;
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onSelectedIndexChange: (index: number) => void;
}

const getIconClass = (icon: string, type: ResourceType): string => {
  switch (type) {
    case 'class':
      return 'codicon codicon-symbol-class';
    case 'interface':
      return 'codicon codicon-symbol-interface';
    case 'method':
      return 'codicon codicon-symbol-method';
    case 'folder':
      return 'codicon codicon-folder';
    case 'doc':
      return 'codicon codicon-notebook';
    case 'workspace':
      return 'codicon codicon-root-folder';
    case 'file':
    default:
      if (icon === 'file-code') return 'codicon codicon-file-code';
      if (icon === 'markdown') return 'codicon codicon-markdown';
      if (icon === 'file-media') return 'codicon codicon-file-media';
      if (icon === 'database') return 'codicon codicon-database';
      if (icon === 'terminal') return 'codicon codicon-terminal';
      if (icon === 'settings-gear') return 'codicon codicon-settings-gear';
      return 'codicon codicon-file';
  }
};

const SearchDropdown = ({
  isOpen,
  results,
  loading,
  query,
  selectedIndex,
  onSelect,
  onSelectedIndexChange,
}: SearchDropdownProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  // 滚动选中项到可见区域
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  if (!isOpen) return null;

  return (
    <div className="search-dropdown">
      <div className="search-dropdown-list" ref={listRef}>
        {loading && (
          <div className="search-dropdown-loading">
            <span className="codicon codicon-loading codicon-modifier-spin" />
            <span>搜索中...</span>
          </div>
        )}

        {!loading && results.length === 0 && query.trim() && (
          <div className="search-dropdown-empty">
            <span>未找到匹配项</span>
          </div>
        )}

        {!loading && results.length === 0 && !query.trim() && (
          <div className="search-dropdown-empty">
            <span>输入关键词开始搜索</span>
          </div>
        )}

        {!loading &&
          results.map((result, index) => (
            <div
              key={result.id}
              className={`search-dropdown-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(result)}
              onMouseEnter={() => onSelectedIndexChange(index)}
            >
              <span className={`search-dropdown-icon ${getIconClass(result.icon, result.type)}`} />
              <div className="search-dropdown-info">
                <span className="search-dropdown-name">{result.name}</span>
                <span className="search-dropdown-path">{result.relativePath}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default SearchDropdown;
