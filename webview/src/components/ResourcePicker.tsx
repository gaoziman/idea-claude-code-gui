import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResourceSearchType, SearchResult, SelectedResource, SearchResponse } from '../types';

interface ResourcePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (resource: SelectedResource) => void;
  initialQuery?: string;
}

const SEARCH_TYPES: { type: ResourceSearchType; label: string; icon: string }[] = [
  { type: 'file', label: 'File', icon: 'codicon-file' },
  { type: 'folder', label: 'Folder', icon: 'codicon-folder' },
  { type: 'code', label: 'Code', icon: 'codicon-symbol-class' },
];

const sendBridgeMessage = (event: string, payload = '') => {
  if (window.sendToJava) {
    window.sendToJava(`${event}:${payload}`);
  }
};

const getIconClass = (icon: string, type: string): string => {
  // 根据类型返回合适的图标
  switch (type) {
    case 'class':
      return 'codicon codicon-symbol-class';
    case 'interface':
      return 'codicon codicon-symbol-interface';
    case 'method':
      return 'codicon codicon-symbol-method';
    case 'folder':
      return 'codicon codicon-folder';
    case 'file':
    default:
      // 根据文件扩展名返回图标
      if (icon === 'file-code') return 'codicon codicon-file-code';
      if (icon === 'markdown') return 'codicon codicon-markdown';
      if (icon === 'file-media') return 'codicon codicon-file-media';
      if (icon === 'database') return 'codicon codicon-database';
      if (icon === 'terminal') return 'codicon codicon-terminal';
      if (icon === 'settings-gear') return 'codicon codicon-settings-gear';
      return 'codicon codicon-file';
  }
};

const ResourcePicker = ({ isOpen, onClose, onSelect, initialQuery = '' }: ResourcePickerProps) => {
  const [searchType, setSearchType] = useState<ResourceSearchType>('file');
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 注册搜索结果回调
  useEffect(() => {
    window.onSearchResults = (jsonStr: string) => {
      try {
        const response: SearchResponse = JSON.parse(jsonStr);
        setResults(response.results || []);
        setSelectedIndex(0);
        setLoading(false);
      } catch (e) {
        console.error('Failed to parse search results:', e);
        setResults([]);
        setLoading(false);
      }
    };

    return () => {
      window.onSearchResults = undefined;
    };
  }, []);

  // 当打开时重置状态并聚焦输入框
  useEffect(() => {
    if (isOpen) {
      // 清空之前的搜索状态
      setQuery(initialQuery || '');
      setResults([]);
      setSelectedIndex(0);
      setSearchType('file');
      setLoading(false);

      // 聚焦输入框
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isOpen, initialQuery]);

  // 执行搜索
  const doSearch = useCallback((type: ResourceSearchType, q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    sendBridgeMessage('search_project', JSON.stringify({ type, query: q.trim() }));
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(searchType, query);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchType, query, doSearch]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            const result = results[selectedIndex];
            onSelect({
              id: result.id,
              name: result.name,
              path: result.path,
              relativePath: result.relativePath,
              type: result.type,
              icon: result.icon,
            });
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          // 切换搜索类型
          const currentIndex = SEARCH_TYPES.findIndex((t) => t.type === searchType);
          const nextIndex = (currentIndex + 1) % SEARCH_TYPES.length;
          setSearchType(SEARCH_TYPES[nextIndex].type);
          break;
      }
    },
    [results, selectedIndex, searchType, onSelect, onClose]
  );

  // 滚动选中项到可见区域
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 点击外部关闭
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="resource-picker-backdrop" onClick={handleBackdropClick}>
      <div className="resource-picker" onKeyDown={handleKeyDown}>
        {/* 类型选择标签 */}
        <div className="resource-picker-tabs">
          {SEARCH_TYPES.map((t) => (
            <button
              key={t.type}
              className={`resource-picker-tab ${searchType === t.type ? 'active' : ''}`}
              onClick={() => setSearchType(t.type)}
            >
              <span className={`codicon ${t.icon}`} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* 搜索结果列表 */}
        <div className="resource-picker-list" ref={listRef}>
          {loading && (
            <div className="resource-picker-loading">
              <span>搜索中...</span>
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <div className="resource-picker-empty">
              <span>未找到匹配项</span>
            </div>
          )}

          {!loading && results.length === 0 && !query.trim() && (
            <div className="resource-picker-empty">
              <span>输入关键词开始搜索</span>
            </div>
          )}

          {!loading &&
            results.map((result, index) => (
              <div
                key={result.id}
                className={`resource-picker-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelect({
                    id: result.id,
                    name: result.name,
                    path: result.path,
                    relativePath: result.relativePath,
                    type: result.type,
                    icon: result.icon,
                  });
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={getIconClass(result.icon, result.type)} />
                <div className="resource-picker-item-info">
                  <span className="resource-picker-item-name">{result.name}</span>
                  <span className="resource-picker-item-path">{result.relativePath}</span>
                </div>
              </div>
            ))}
        </div>

        {/* 底部搜索输入 */}
        <div className="resource-picker-footer">
          <span className="resource-picker-prefix">#{searchType === 'file' ? 'File' : searchType === 'folder' ? 'Folder' : 'Code'}:</span>
          <input
            ref={inputRef}
            type="text"
            className="resource-picker-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入搜索关键词..."
          />
        </div>
      </div>
    </div>
  );
};

export default ResourcePicker;
