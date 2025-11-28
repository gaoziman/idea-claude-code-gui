import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownBlock from './components/MarkdownBlock';
import UserMessageContent from './components/messages/UserMessageContent';
import HistoryView from './components/history/HistoryView';
import SettingsView from './components/SettingsView';
import ConfirmDialog from './components/ConfirmDialog';
import PermissionModeSelector from './components/PermissionModeSelector';
import ImagePreview from './components/ImagePreview';
import LoadingIndicator from './components/LoadingIndicator';
import ContextUsageIndicator from './components/ContextUsageIndicator';
import ModelSelector from './components/ModelSelector';
import { InlineResourcePicker } from './components/inline-picker';
import {
  TaskExecutionBlock,
  TodoListBlock,
  FileRefBlock,
  SearchBlock,
} from './components/toolBlocks';
import TaskSummaryBar from './components/TaskSummaryBar';
import { BackIcon, ClawdIcon, SendIcon, StopIcon } from './components/Icons';
import type {
  ClaudeContentBlock,
  ClaudeMessage,
  ClaudeRawMessage,
  HistoryData,
  PendingImage,
  PermissionMode,
  SelectedResource,
  TodoItem,
  TokenUsage,
  ToolResultBlock,
} from './types';

type ViewMode = 'chat' | 'history' | 'settings';

const DEFAULT_STATUS = '就绪';

// 图片限制常量
const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

const isTruthy = (value: unknown) => value === true || value === 'true';

const sendBridgeMessage = (event: string, payload = '') => {
  if (window.sendToJava) {
    window.sendToJava(`${event}:${payload}`);
  } else {
    console.warn('[Frontend] sendToJava is not ready yet');
  }
};

const App = () => {
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [currentView, setCurrentView] = useState<ViewMode>('chat');
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');
  const [selectedModel, setSelectedModel] = useState('sonnet');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [savedImagePaths, setSavedImagePaths] = useState<Record<string, string>>({});
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [triggerTypeSelect, setTriggerTypeSelect] = useState(0);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    window.updateMessages = (json) => {
      try {
        const parsed = JSON.parse(json) as ClaudeMessage[];
        setMessages(parsed);
      } catch (error) {
        console.error('[Frontend] Failed to parse messages:', error);
      }
    };

    window.updateStatus = (text) => setStatus(text);
    window.showLoading = (value) => setLoading(isTruthy(value));
    window.setHistoryData = (data) => setHistoryData(data);
    window.clearMessages = () => setMessages([]);
    window.addErrorMessage = (message) =>
      setMessages((prev) => [...prev, { type: 'error', content: message }]);

    window.onImageSaved = (imageId: string, filePath: string) => {
      setSavedImagePaths((prev) => ({ ...prev, [imageId]: filePath }));
    };

    // 拖拽文件解析回调
    window.onDroppedFileResolved = (jsonStr: string) => {
      try {
        const resource = JSON.parse(jsonStr) as SelectedResource;
        if (resource && resource.id && resource.path) {
          setSelectedResources((prev) => {
            // 避免重复添加
            if (prev.some((r) => r.path === resource.path)) {
              return prev;
            }
            return [...prev, resource];
          });
        }
      } catch (e) {
        console.error('[App] Failed to parse dropped file:', e);
      }
    };
  }, []);

  useEffect(() => {
    if (currentView !== 'history') {
      return;
    }

    const requestHistoryData = () => {
      if (window.sendToJava) {
        sendBridgeMessage('load_history_data');
      } else {
        setTimeout(requestHistoryData, 100);
      }
    };

    const timer = setTimeout(requestHistoryData, 50);
    return () => clearTimeout(timer);
  }, [currentView]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    const message = inputMessage.trim();
    const hasContent = message || pendingImages.length > 0 || selectedResources.length > 0;
    if (!hasContent || loading) {
      return;
    }

    // 构建完整消息
    let fullMessage = message;

    // 如果有选中的资源，添加资源引用
    if (selectedResources.length > 0) {
      const resourcePrompts = selectedResources.map((r) => {
        if (r.type === 'folder') {
          return `[文件夹: ${r.path}]`;
        } else if (r.type === 'class' || r.type === 'interface' || r.type === 'method') {
          return `[代码: ${r.path}]`;
        } else {
          return `[文件: ${r.path}]`;
        }
      });
      const resourceText = resourcePrompts.join('\n');
      fullMessage = resourceText + (message ? '\n\n' + message : '');
    }

    // 如果有图片，构建包含图片路径的消息
    if (pendingImages.length > 0) {
      const imagePaths = pendingImages
        .map((img) => savedImagePaths[img.id])
        .filter(Boolean);

      if (imagePaths.length !== pendingImages.length) {
        setStatus('图片正在保存中，请稍候...');
        return;
      }

      // 构建消息：文本 + 图片路径
      const imagePrompt = imagePaths
        .map((path) => `请分析这张图片：${path}`)
        .join('\n');
      fullMessage = fullMessage ? `${fullMessage}\n\n${imagePrompt}` : imagePrompt;
    }

    sendBridgeMessage('send_message', fullMessage);
    setInputMessage('');
    setPendingImages([]);
    setSavedImagePaths({});
    setSelectedResources([]);
  };

  // 公共图片处理函数
  const processImageFile = useCallback(
    (file: File, currentCount: number): boolean => {
      // 检查图片数量限制
      if (currentCount >= MAX_IMAGE_COUNT) {
        setStatus(`最多只能添加 ${MAX_IMAGE_COUNT} 张图片`);
        return false;
      }

      // 检查文件大小
      if (file.size > MAX_IMAGE_SIZE) {
        setStatus('图片大小不能超过 10MB');
        return false;
      }

      // 检查文件类型
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setStatus('不支持的图片格式，请使用 PNG、JPG、GIF 或 WEBP');
        return false;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (!base64) return;

        const img = new Image();
        img.onload = () => {
          const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const ext = file.type.split('/')[1] || 'png';
          const newImage: PendingImage = {
            id: imageId,
            base64,
            name: file.name || `image_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.${ext}`,
            size: file.size,
            width: img.width,
            height: img.height,
          };

          setPendingImages((prev) => [...prev, newImage]);

          // 发送图片到后端保存
          sendBridgeMessage(
            'save_clipboard_image',
            JSON.stringify({ id: imageId, base64, name: newImage.name })
          );
          setStatus('图片已添加，可以继续输入或直接发送');
        };
        img.src = `data:${file.type};base64,${base64}`;
      };
      reader.readAsDataURL(file);
      return true;
    },
    []
  );

  // 粘贴处理
  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          setPendingImages((prev) => {
            processImageFile(file, prev.length);
            return prev;
          });
          break; // 只处理第一张图片
        }
      }
    },
    [processImageFile]
  );

  // 文件选择处理
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      let currentCount = pendingImages.length;
      const filesToProcess = Array.from(files);

      for (const file of filesToProcess) {
        if (currentCount >= MAX_IMAGE_COUNT) {
          setStatus(`最多只能添加 ${MAX_IMAGE_COUNT} 张图片，已达上限`);
          break;
        }
        if (processImageFile(file, currentCount)) {
          currentCount++;
        }
      }

      // 清空 input 值，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [pendingImages.length, processImageFile]
  );

  // 点击图片按钮
  const handleImageButtonClick = useCallback(() => {
    if (pendingImages.length >= MAX_IMAGE_COUNT) {
      setStatus(`最多只能添加 ${MAX_IMAGE_COUNT} 张图片`);
      return;
    }
    fileInputRef.current?.click();
  }, [pendingImages.length]);

  const removeImage = useCallback((imageId: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== imageId));
    setSavedImagePaths((prev) => {
      const newPaths = { ...prev };
      delete newPaths[imageId];
      return newPaths;
    });
  }, []);

  // 资源选择处理
  const handleResourceSelect = useCallback((resource: SelectedResource) => {
    setSelectedResources((prev) => {
      // 避免重复添加
      if (prev.some((r) => r.id === resource.id)) {
        return prev;
      }
      return [...prev, resource];
    });
  }, []);

  // 移除选中的资源
  const removeResource = useCallback((resourceId: string) => {
    setSelectedResources((prev) => prev.filter((r) => r.id !== resourceId));
  }, []);

  // 打开文件（在编辑器中）
  const openResourceInEditor = useCallback((resource: SelectedResource) => {
    if (resource.type === 'file' || resource.type === 'doc') {
      sendBridgeMessage('open_file', resource.path);
    }
  }, []);

  const interruptSession = () => {
    sendBridgeMessage('interrupt_session');
    setStatus('已发送中断请求');
  };

  // const restartSession = () => {
  //   if (window.confirm('确定要重启会话吗？这将清空当前对话历史。')) {
  //     sendBridgeMessage('restart_session');
  //     setMessages([]);
  //     setStatus('正在重启会话...');
  //   }
  // };

  const createNewSession = () => {
    if (messages.length === 0) {
      setStatus('当前会话为空，可以直接使用');
      return;
    }
    setShowNewSessionConfirm(true);
  };

  const handleConfirmNewSession = () => {
    setShowNewSessionConfirm(false);
    sendBridgeMessage('create_new_session');
    setMessages([]);
    setStatus('正在创建新会话...');
  };

  const handleCancelNewSession = () => {
    setShowNewSessionConfirm(false);
  };

  const handlePermissionModeChange = (mode: PermissionMode) => {
    setPermissionMode(mode);
    sendBridgeMessage('change_permission_mode', mode);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    sendBridgeMessage('change_model', model);
  };

  const toggleThinking = (messageIndex: number, blockIndex: number) => {
    const key = `${messageIndex}_${blockIndex}`;
    setExpandedThinking((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isThinkingExpanded = (messageIndex: number, blockIndex: number) =>
    Boolean(expandedThinking[`${messageIndex}_${blockIndex}`]);

  const loadHistorySession = (sessionId: string) => {
    sendBridgeMessage('load_session', sessionId);
    setCurrentView('chat');
  };

  const getMessageText = (message: ClaudeMessage) => {
    if (message.content) {
      return message.content;
    }
    const raw = message.raw;
    if (!raw) {
      return '(空消息)';
    }
    if (typeof raw === 'string') {
      return raw;
    }
    if (typeof raw.content === 'string') {
      return raw.content;
    }
    if (Array.isArray(raw.content)) {
      return raw.content
        .filter((block) => block && block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');
    }
    if (raw.message?.content && Array.isArray(raw.message.content)) {
      return raw.message.content
        .filter((block) => block && block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');
    }
    return '(空消息)';
  };

  const shouldShowMessage = (message: ClaudeMessage) => {
    if (message.type === 'assistant') {
      return true;
    }
    if (message.type === 'user' || message.type === 'error') {
      const text = getMessageText(message);
      return Boolean(text && text.trim() && text !== '(空消息)');
    }
    return true;
  };

  const normalizeBlocks = (raw?: ClaudeRawMessage | string) => {
    if (!raw) {
      return null;
    }
    if (typeof raw === 'string') {
      return [{ type: 'text' as const, text: raw }];
    }
    const buildBlocksFromArray = (entries: unknown[]): ClaudeContentBlock[] => {
      const blocks: ClaudeContentBlock[] = [];
      entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const candidate = entry as Record<string, unknown>;
        const type = candidate.type;
        if (type === 'text') {
          blocks.push({
            type: 'text',
            text: typeof candidate.text === 'string' ? candidate.text : '',
          });
        } else if (type === 'thinking') {
          const thinking =
            typeof candidate.thinking === 'string'
              ? candidate.thinking
              : typeof candidate.text === 'string'
                ? candidate.text
                : '';
          blocks.push({
            type: 'thinking',
            thinking,
            text: thinking,
          });
        } else if (type === 'tool_use') {
          blocks.push({
            type: 'tool_use',
            id: typeof candidate.id === 'string' ? candidate.id : undefined,
            name: typeof candidate.name === 'string' ? candidate.name : 'Unknown',
            input: (candidate.input as Record<string, unknown>) ?? {},
          });
        }
      });
      return blocks;
    };

    const pickContent = (content: unknown): ClaudeContentBlock[] | null => {
      if (!content) {
        return null;
      }
      if (typeof content === 'string') {
        return [{ type: 'text' as const, text: content }];
      }
      if (Array.isArray(content)) {
        const result = buildBlocksFromArray(content);
        return result.length ? result : null;
      }
      return null;
    };

    return (
      pickContent(raw.message?.content ?? raw.content) ?? [
        { type: 'text' as const, text: '(无法解析内容)' },
      ]
    );
  };

  const getContentBlocks = (message: ClaudeMessage): ClaudeContentBlock[] => {
    const rawBlocks = normalizeBlocks(message.raw);
    if (rawBlocks) {
      return rawBlocks;
    }
    if (message.content) {
      return [{ type: 'text', text: message.content }];
    }
    return [{ type: 'text', text: '(空消息)' }];
  };

  const findToolResult = (toolUseId?: string, messageIndex?: number): ToolResultBlock | null => {
    if (!toolUseId || typeof messageIndex !== 'number') {
      return null;
    }
    for (let i = messageIndex + 1; i < messages.length; i += 1) {
      const candidate = messages[i];
      if (candidate.type !== 'user') {
        continue;
      }
      const raw = candidate.raw;
      if (!raw || typeof raw === 'string') {
        continue;
      }
      // 修复：同时检查 raw.message.content 和 raw.content
      const content = raw.message?.content ?? raw.content;
      if (!Array.isArray(content)) {
        continue;
      }
      const resultBlock = content.find(
        (block): block is ToolResultBlock =>
          Boolean(block) && block.type === 'tool_result' && block.tool_use_id === toolUseId,
      );
      if (resultBlock) {
        return resultBlock;
      }
    }
    return null;
  };

  const sessionTitle = useMemo(() => {
    if (messages.length === 0) {
      return '新会话';
    }
    const firstUserMessage = messages.find((message) => message.type === 'user');
    if (!firstUserMessage) {
      return '新会话';
    }
    const text = getMessageText(firstUserMessage);
    return text.length > 15 ? `${text.substring(0, 15)}...` : text;
  }, [messages]);

  // 获取最新的 TodoList
  const latestTodos = useMemo((): TodoItem[] => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.type !== 'assistant') continue;

      const blocks = getContentBlocks(message);
      for (let j = blocks.length - 1; j >= 0; j--) {
        const block = blocks[j];
        if (block.type === 'tool_use' && block.name?.toLowerCase() === 'todowrite') {
          const todos = (block.input as { todos?: TodoItem[] })?.todos;
          if (Array.isArray(todos) && todos.length > 0) {
            return todos;
          }
        }
      }
    }
    return [];
  }, [messages]);

  // 计算累计 token 使用量和上下文使用量
  const { tokenUsage, contextUsed } = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;

    messages.forEach((message) => {
      if (message.type === 'assistant' && message.raw) {
        try {
          const raw = typeof message.raw === 'string' ? JSON.parse(message.raw) : message.raw;
          const usage = raw?.message?.usage as TokenUsage | undefined;
          if (usage) {
            // 输入 tokens
            inputTokens += usage.input_tokens || 0;
            // 缓存读取 tokens
            cacheReadTokens += usage.cache_read_input_tokens || 0;
            // 输出 tokens
            outputTokens += usage.output_tokens || 0;
          }
        } catch {
          // 忽略解析错误
        }
      }
    });

    // 上下文使用量 = 输入 + 输出 + 缓存读取
    const contextUsed = inputTokens + outputTokens + cacheReadTokens;

    return {
      tokenUsage: { inputTokens: inputTokens + cacheReadTokens, outputTokens },
      contextUsed,
    };
  }, [messages]);

  return (
    <>
      <div className="header">
        <div className="header-left">
          {currentView === 'history' ? (
            <button className="back-button" onClick={() => setCurrentView('chat')} data-tooltip="返回聊天">
              <BackIcon /> 返回
            </button>
          ) : (
            <div
              className="session-title"
              style={{
                fontWeight: 600,
                fontSize: '14px',
                color: '#e0e0e0',
                paddingLeft: '8px',
              }}
            >
              {sessionTitle}
            </div>
          )}
          <span className="status-indicator">{status !== DEFAULT_STATUS ? status : ''}</span>
        </div>
        <div className="header-right">
          {currentView === 'chat' && (
            <>
              <button className="icon-button" onClick={createNewSession} data-tooltip="新会话">
                <span className="codicon codicon-plus" />
              </button>
              <button
                className="icon-button"
                onClick={() => setCurrentView('history')}
                data-tooltip="历史记录"
              >
                <span className="codicon codicon-history" />
              </button>
              <button
                className="icon-button"
                onClick={() => setCurrentView('settings')}
                data-tooltip="设置"
              >
                <span className="codicon codicon-settings-gear" />
              </button>
            </>
          )}
        </div>
      </div>

      {currentView === 'settings' ? (
        <SettingsView onClose={() => setCurrentView('chat')} />
      ) : currentView === 'chat' ? (
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#555',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ClawdIcon />
              </div>
              <div>给 Claude Code 发送消息</div>
            </div>
          )}

          {messages.map((message, messageIndex) => {
            if (!shouldShowMessage(message)) {
              return null;
            }

            return (
              <div key={messageIndex} className={`message ${message.type}`}>
                <div className="message-role-label">
                  {message.type === 'assistant' ? null : message.type === 'user' ? 'You' : message.type}
                </div>
                <div className="message-content">
                  {message.type === 'user' ? (
                    <UserMessageContent content={getMessageText(message)} />
                  ) : message.type === 'error' ? (
                    <MarkdownBlock content={getMessageText(message)} />
                  ) : (
                    getContentBlocks(message).map((block, blockIndex) => (
                      <div key={`${messageIndex}-${blockIndex}`} className="content-block">
                        {block.type === 'text' && <MarkdownBlock content={block.text ?? ''} />}

                        {block.type === 'thinking' && (
                          <div className="thinking-block">
                            <div
                              className="thinking-header"
                              onClick={() => toggleThinking(messageIndex, blockIndex)}
                            >
                              <span className="thinking-title">思考过程</span>
                              <span className="thinking-icon">
                                {isThinkingExpanded(messageIndex, blockIndex) ? '▼' : '▶'}
                              </span>
                            </div>
                            {isThinkingExpanded(messageIndex, blockIndex) && (
                              <div className="thinking-content">
                                {block.thinking ?? block.text ?? '(无思考内容)'}
                              </div>
                            )}
                          </div>
                        )}

                        {block.type === 'tool_use' && (
                          <>
                            {(() => {
                              const toolName = block.name?.toLowerCase() || '';

                              // TodoWrite -> TodoListBlock
                              if (toolName === 'todowrite' &&
                                  Array.isArray((block.input as { todos?: TodoItem[] })?.todos)) {
                                return (
                                  <TodoListBlock
                                    todos={(block.input as { todos?: TodoItem[] })?.todos ?? []}
                                  />
                                );
                              }

                              // Task -> TaskExecutionBlock
                              if (toolName === 'task') {
                                return <TaskExecutionBlock input={block.input} />;
                              }

                              // Read/Edit/Write -> FileRefBlock
                              if (toolName === 'read' || toolName === 'edit' || toolName === 'write') {
                                return (
                                  <FileRefBlock
                                    input={block.input}
                                    toolName={block.name}
                                  />
                                );
                              }

                              // Glob/Grep -> SearchBlock
                              if (toolName === 'glob' || toolName === 'grep') {
                                return (
                                  <SearchBlock
                                    input={block.input}
                                    toolName={block.name}
                                    result={findToolResult(block.id, messageIndex)}
                                  />
                                );
                              }

                              // Bash -> 隐藏（不显示）
                              if (toolName === 'bash') {
                                return null;
                              }

                              // 其他工具 -> 隐藏
                              return null;
                            })()}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          <LoadingIndicator
            isLoading={loading}
            inputTokens={tokenUsage.inputTokens}
            outputTokens={tokenUsage.outputTokens}
          />
        </div>
      ) : (
        <HistoryView historyData={historyData} onLoadSession={loadHistorySession} />
      )}

      {currentView === 'chat' && (
        <div className="input-area">
          <TaskSummaryBar todos={latestTodos} />
          <div className="input-container">
            <ImagePreview images={pendingImages} onRemove={removeImage} />
            <InlineResourcePicker
              inputValue={inputMessage}
              onInputChange={setInputMessage}
              selectedResources={selectedResources}
              onResourceSelect={handleResourceSelect}
              onResourceRemove={removeResource}
              onResourceOpen={openResourceInEditor}
              onSend={sendMessage}
              onPaste={handlePaste}
              triggerTypeSelect={triggerTypeSelect}
              disabled={loading}
              placeholder="输入消息..."
            />
            <div className="input-footer">
              <div className="input-tools-left">
                <button
                  className="tool-icon-button"
                  onClick={() => setTriggerTypeSelect((n) => n + 1)}
                  disabled={loading}
                  title="添加资源 (#)"
                >
                  <span className="codicon codicon-symbol-keyword" />
                </button>
                <button
                  className="tool-icon-button"
                  onClick={handleImageButtonClick}
                  disabled={loading || pendingImages.length >= MAX_IMAGE_COUNT}
                  title={pendingImages.length >= MAX_IMAGE_COUNT ? `最多添加 ${MAX_IMAGE_COUNT} 张图片` : '添加图片'}
                >
                  <span className="codicon codicon-file-media" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <PermissionModeSelector
                  value={permissionMode}
                  onChange={handlePermissionModeChange}
                  disabled={loading}
                />
              </div>
              <div className="input-actions">
                <ModelSelector
                  model={selectedModel}
                  onChange={handleModelChange}
                  disabled={loading}
                />
                <ContextUsageIndicator used={contextUsed} />
                {loading ? (
                  <button className="action-button stop-button" onClick={interruptSession} title="中断生成">
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    className="action-button send-button"
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() && pendingImages.length === 0 && selectedResources.length === 0}
                    title="发送消息"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showNewSessionConfirm}
        title="创建新会话"
        message="当前会话已有消息，确定要创建新会话吗？"
        confirmText="确定"
        cancelText="取消"
        onConfirm={handleConfirmNewSession}
        onCancel={handleCancelNewSession}
      />
    </>
  );
};

export default App;

