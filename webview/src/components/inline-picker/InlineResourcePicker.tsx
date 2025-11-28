import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TypeSelectorMenu, { RESOURCE_TYPE_OPTIONS } from './TypeSelectorMenu';
import SearchDropdown from './SearchDropdown';
import InlineResourceTag from './InlineResourceTag';
import { SlashCommandMenu, SYSTEM_COMMANDS, filterCommands } from '../slash-command';
import type {
  ResourceSearchType,
  SearchResult,
  SearchResponse,
  SelectedResource,
  SlashCommand,
  SlashPickerState,
} from '../../types';

interface InlineResourcePickerProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  selectedResources: SelectedResource[];
  onResourceSelect: (resource: SelectedResource) => void;
  onResourceRemove: (id: string) => void;
  onResourceOpen?: (resource: SelectedResource) => void;
  onSend: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFileDrop?: (filePaths: string[]) => void;
  onSlashCommand?: (command: SlashCommand) => void; // 斜杠命令回调
  userCommands?: SlashCommand[]; // 用户自定义命令
  triggerTypeSelect?: number;
  disabled?: boolean;
  placeholder?: string;
}

const sendBridgeMessage = (event: string, payload = '') => {
  if (window.sendToJava) {
    window.sendToJava(`${event}:${payload}`);
  }
};

const InlineResourcePicker = ({
  inputValue,
  onInputChange,
  selectedResources,
  onResourceSelect,
  onResourceRemove,
  onResourceOpen,
  onSend,
  onPaste,
  onFileDrop,
  onSlashCommand,
  userCommands = [],
  triggerTypeSelect,
  disabled = false,
  placeholder = '输入消息...',
}: InlineResourcePickerProps) => {
  const [pickerState, setPickerState] = useState<SlashPickerState>('idle');
  const [searchType, setSearchType] = useState<ResourceSearchType>('file');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeMenuSelectedIndex, setTypeMenuSelectedIndex] = useState(0);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // 斜杠命令相关状态
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTriggerRef = useRef<number | undefined>(triggerTypeSelect);

  // 合并系统命令和用户自定义命令，并过滤
  const allCommands = useMemo(() => [...SYSTEM_COMMANDS, ...userCommands], [userCommands]);
  const filteredCommands = useMemo(
    () => filterCommands(allCommands, slashQuery),
    [allCommands, slashQuery]
  );

  // 监听外部触发类型选择
  useEffect(() => {
    if (triggerTypeSelect !== undefined && triggerTypeSelect !== prevTriggerRef.current) {
      prevTriggerRef.current = triggerTypeSelect;
      if (pickerState === 'idle') {
        setPickerState('type-select');
        setTypeMenuSelectedIndex(0);
        inputRef.current?.focus();
      }
    }
  }, [triggerTypeSelect, pickerState]);

  // 注册搜索结果回调
  useEffect(() => {
    window.onSearchResults = (jsonStr: string) => {
      try {
        const response: SearchResponse = JSON.parse(jsonStr);
        setSearchResults(response.results || []);
        setSearchSelectedIndex(0);
        setLoading(false);
      } catch (e) {
        console.error('Failed to parse search results:', e);
        setSearchResults([]);
        setLoading(false);
      }
    };

    return () => {
      window.onSearchResults = undefined;
    };
  }, []);

  // 监听 Java 端的拖拽事件（从 IDEA Project View 拖拽）
  useEffect(() => {
    window.onDragEnter = () => {
      setIsDragOver(true);
    };

    window.onDragLeave = () => {
      setIsDragOver(false);
    };

    return () => {
      window.onDragEnter = undefined;
      window.onDragLeave = undefined;
    };
  }, []);

  // 执行搜索
  const doSearch = useCallback((type: ResourceSearchType, query: string) => {
    if (type === 'workspace') {
      return; // workspace 不需要搜索
    }

    setLoading(true);
    // 空查询会返回默认结果（根目录文件/文件夹）
    sendBridgeMessage('search_project', JSON.stringify({ type, query: query.trim() }));
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (pickerState !== 'searching') return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(searchType, searchQuery);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, searchType, pickerState, doSearch]);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    if (pickerState === 'searching') {
      // 在搜索模式下，更新搜索查询
      setSearchQuery(newValue);
    } else if (pickerState === 'slash-command') {
      // 在斜杠命令模式下，更新过滤查询
      setSlashQuery(newValue);
      setSlashSelectedIndex(0);
    } else {
      // 在普通模式下，检测 # 和 / 符号
      // 检测斜杠命令触发：空输入或以空格结尾时输入 /
      if (newValue === '/' || (newValue.endsWith('/') && (inputValue === '' || inputValue.endsWith(' ')))) {
        // 用户输入了 /，打开斜杠命令菜单
        setPickerState('slash-command');
        setSlashQuery('');
        setSlashSelectedIndex(0);
        // 不将 / 添加到输入框（如果是独立的 /）
        if (newValue === '/') {
          return;
        }
        // 如果是空格后的 /，保留之前的内容
        onInputChange(inputValue);
        return;
      }
      // 检测 # 触发资源选择
      if (newValue.endsWith('#') && !inputValue.endsWith('#')) {
        // 用户输入了 #，打开类型选择菜单
        setPickerState('type-select');
        setTypeMenuSelectedIndex(0);
        // 不将 # 添加到输入框
        return;
      }
      onInputChange(newValue);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerState === 'type-select') {
      // 类型选择模式下的键盘处理
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setTypeMenuSelectedIndex((prev) => (prev + 1) % RESOURCE_TYPE_OPTIONS.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setTypeMenuSelectedIndex(
            (prev) => (prev - 1 + RESOURCE_TYPE_OPTIONS.length) % RESOURCE_TYPE_OPTIONS.length
          );
          break;
        case 'Enter':
          e.preventDefault();
          handleTypeSelect(RESOURCE_TYPE_OPTIONS[typeMenuSelectedIndex].type);
          break;
        case 'Escape':
          e.preventDefault();
          setPickerState('idle');
          break;
      }
    } else if (pickerState === 'searching') {
      // 搜索模式下的键盘处理
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (searchResults.length > 0) {
            setSearchSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (searchResults.length > 0) {
            setSearchSelectedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults.length > 0 && searchResults[searchSelectedIndex]) {
            handleResultSelect(searchResults[searchSelectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          exitSearchMode();
          break;
        case 'Tab':
          e.preventDefault();
          // 切换搜索类型
          const currentIndex = RESOURCE_TYPE_OPTIONS.findIndex((t) => t.type === searchType);
          const nextIndex = (currentIndex + 1) % (RESOURCE_TYPE_OPTIONS.length - 1); // 排除 workspace
          setSearchType(RESOURCE_TYPE_OPTIONS[nextIndex].type);
          break;
        case 'Backspace':
          if (searchQuery === '') {
            e.preventDefault();
            exitSearchMode();
          }
          break;
      }
    } else if (pickerState === 'slash-command') {
      // 斜杠命令模式下的键盘处理
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (filteredCommands.length > 0) {
            setSlashSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (filteredCommands.length > 0) {
            setSlashSelectedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands.length > 0 && filteredCommands[slashSelectedIndex]) {
            handleSlashCommandSelect(filteredCommands[slashSelectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          exitSlashCommandMode();
          break;
        case 'Backspace':
          if (slashQuery === '') {
            e.preventDefault();
            exitSlashCommandMode();
          }
          break;
      }
    } else {
      // 普通模式
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      } else if (e.key === 'Backspace' && inputValue === '' && selectedResources.length > 0) {
        // 删除最后一个资源标签
        e.preventDefault();
        const lastResource = selectedResources[selectedResources.length - 1];
        onResourceRemove(lastResource.id);
      }
    }
  };

  // 处理类型选择
  const handleTypeSelect = (type: ResourceSearchType) => {
    setSearchType(type);

    if (type === 'workspace') {
      // Workspace 直接添加
      const workspaceResource: SelectedResource = {
        id: `workspace_${Date.now()}`,
        name: 'Workspace',
        path: '',
        relativePath: '',
        type: 'workspace',
        icon: 'root-folder',
      };
      onResourceSelect(workspaceResource);
      setPickerState('idle');
    } else {
      // 其他类型进入搜索模式
      setPickerState('searching');
      setSearchQuery('');
      setSearchSelectedIndex(0);
      // 立即触发搜索获取默认结果
      doSearch(type, '');
    }
  };

  // 处理搜索结果选择
  const handleResultSelect = (result: SearchResult) => {
    const resource: SelectedResource = {
      id: result.id,
      name: result.name,
      path: result.path,
      relativePath: result.relativePath,
      type: result.type,
      icon: result.icon,
    };
    onResourceSelect(resource);
    exitSearchMode();
  };

  // 退出搜索模式
  const exitSearchMode = () => {
    setPickerState('idle');
    setSearchQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  // 关闭类型选择菜单
  const closeTypeMenu = () => {
    setPickerState('idle');
  };

  // 处理斜杠命令选择
  const handleSlashCommandSelect = (command: SlashCommand) => {
    exitSlashCommandMode();
    // 调用外部回调处理命令
    if (onSlashCommand) {
      onSlashCommand(command);
    } else {
      // 默认行为：将命令作为消息发送
      sendBridgeMessage('execute_slash_command', JSON.stringify({
        command: command.name,
        source: command.source,
      }));
    }
  };

  // 退出斜杠命令模式
  const exitSlashCommandMode = () => {
    setPickerState('idle');
    setSlashQuery('');
    setSlashSelectedIndex(0);
    inputRef.current?.focus();
  };

  // 关闭斜杠命令菜单
  const closeSlashMenu = () => {
    exitSlashCommandMode();
  };

  // 处理粘贴事件
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 仅在非搜索模式下允许粘贴图片等
    if (pickerState !== 'idle') {
      return;
    }
    // 调用外部粘贴处理器（如处理图片粘贴）
    onPaste?.(e);
  };

  // ========== 拖拽处理 ==========

  // 解析拖拽数据，提取文件路径
  const parseDroppedFiles = useCallback((dataTransfer: DataTransfer): string[] => {
    const paths: string[] = [];

    // 尝试从 text/uri-list 获取（IDEA 拖拽的标准格式）
    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
      uriList.split('\n').forEach((uri) => {
        const trimmed = uri.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // 处理 file:// URL
          if (trimmed.startsWith('file://')) {
            // macOS: file:///path, Windows: file:///C:/path
            let path = trimmed.replace(/^file:\/\//, '');
            // 解码 URL 编码的字符
            path = decodeURIComponent(path);
            // Windows 路径可能是 /C:/... 需要去掉开头的 /
            if (/^\/[A-Za-z]:/.test(path)) {
              path = path.substring(1);
            }
            if (path) {
              paths.push(path);
            }
          } else if (trimmed.startsWith('/') || /^[A-Za-z]:/.test(trimmed)) {
            // 直接是路径格式
            paths.push(trimmed);
          }
        }
      });
    }

    // 尝试从 text/plain 获取（备用方案）
    if (paths.length === 0) {
      const text = dataTransfer.getData('text/plain');
      if (text) {
        const trimmed = text.trim();
        // 检查是否像文件路径
        if (trimmed.startsWith('/') || /^[A-Za-z]:/.test(trimmed)) {
          // 可能是多行路径
          trimmed.split('\n').forEach((line) => {
            const lineTrimmed = line.trim();
            if (lineTrimmed.startsWith('/') || /^[A-Za-z]:/.test(lineTrimmed)) {
              paths.push(lineTrimmed);
            }
          });
        }
      }
    }

    // 尝试从 Files 获取（某些环境下可能有 path 属性）
    if (paths.length === 0 && dataTransfer.files.length > 0) {
      Array.from(dataTransfer.files).forEach((file) => {
        // Electron/JCEF 环境下 File 对象可能有 path 属性
        const filePath = (file as File & { path?: string }).path;
        if (filePath) {
          paths.push(filePath);
        }
      });
    }

    return paths;
  }, []);

  // 拖拽进入/悬停
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  // 拖拽进入
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  // 拖拽离开
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // 检查是否真的离开了容器（而不是进入子元素）
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsDragOver(false);
      }
    }
  }, []);

  // 拖拽释放
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // 解析文件路径
      const filePaths = parseDroppedFiles(e.dataTransfer);

      if (filePaths.length > 0) {
        // 通知外部处理，或直接发送到 Java 层解析
        if (onFileDrop) {
          onFileDrop(filePaths);
        } else {
          // 默认行为：发送到 Java 层解析每个文件
          filePaths.forEach((filePath) => {
            sendBridgeMessage('resolve_dropped_file', filePath);
          });
        }
      }
    },
    [parseDroppedFiles, onFileDrop]
  );

  // 自动调整输入框高度
  useEffect(() => {
    if (inputRef.current && pickerState === 'idle') {
      const textarea = inputRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue, pickerState]);

  // 获取搜索类型的标签显示
  const getSearchTypeLabel = (): string => {
    const option = RESOURCE_TYPE_OPTIONS.find((o) => o.type === searchType);
    return option ? `#${option.label}:` : '#File:';
  };

  return (
    <div
      className={`inline-picker-container ${isDragOver ? 'drag-over' : ''}`}
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽提示覆盖层 */}
      {isDragOver && (
        <div className="drag-overlay">
          <span className="codicon codicon-file-add" />
          <span>释放以添加文件</span>
        </div>
      )}

      {/* 类型选择菜单 */}
      <TypeSelectorMenu
        isOpen={pickerState === 'type-select'}
        onSelect={handleTypeSelect}
        onClose={closeTypeMenu}
        selectedIndex={typeMenuSelectedIndex}
        onSelectedIndexChange={setTypeMenuSelectedIndex}
      />

      {/* 搜索下拉框 */}
      <SearchDropdown
        isOpen={pickerState === 'searching'}
        results={searchResults}
        loading={loading}
        query={searchQuery}
        selectedIndex={searchSelectedIndex}
        onSelect={handleResultSelect}
        onSelectedIndexChange={setSearchSelectedIndex}
      />

      {/* 斜杠命令菜单 */}
      <SlashCommandMenu
        isOpen={pickerState === 'slash-command'}
        commands={filteredCommands}
        query={slashQuery}
        selectedIndex={slashSelectedIndex}
        onSelect={handleSlashCommandSelect}
        onClose={closeSlashMenu}
        onSelectedIndexChange={setSlashSelectedIndex}
      />

      {/* 输入区域 */}
      <div className="inline-picker-input-wrapper">
        {/* 已选资源标签 */}
        {selectedResources.map((resource) => (
          <InlineResourceTag
            key={resource.id}
            resource={resource}
            onRemove={onResourceRemove}
            onOpen={onResourceOpen}
          />
        ))}

        {/* 搜索模式下显示搜索类型标签 */}
        {pickerState === 'searching' && (
          <span className="search-type-prefix">{getSearchTypeLabel()}</span>
        )}

        {/* 斜杠命令模式下显示前缀 */}
        {pickerState === 'slash-command' && (
          <span className="slash-prefix">/</span>
        )}

        {/* 输入框 */}
        <textarea
          ref={inputRef}
          className="inline-picker-textarea"
          value={
            pickerState === 'searching'
              ? searchQuery
              : pickerState === 'slash-command'
                ? slashQuery
                : inputValue
          }
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            pickerState === 'searching'
              ? '输入搜索关键词...'
              : pickerState === 'slash-command'
                ? '输入命令名称...'
                : selectedResources.length > 0
                  ? '继续输入或按 Enter 发送...'
                  : placeholder
          }
          rows={1}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default InlineResourcePicker;
