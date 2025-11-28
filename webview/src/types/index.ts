export type ClaudeRole = 'user' | 'assistant' | 'error' | string;

export type ToolInput = Record<string, unknown>;

// Token 使用统计
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export type ClaudeContentBlock =
  | { type: 'text'; text?: string }
  | { type: 'thinking'; thinking?: string; text?: string }
  | { type: 'tool_use'; id?: string; name?: string; input?: ToolInput };

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id?: string;
  content?: string | Array<{ type?: string; text?: string }>;
  is_error?: boolean;
  [key: string]: unknown;
}

export type ClaudeContentOrResultBlock = ClaudeContentBlock | ToolResultBlock;

export interface ClaudeRawMessage {
  content?: string | ClaudeContentOrResultBlock[];
  message?: {
    content?: string | ClaudeContentOrResultBlock[];
    usage?: TokenUsage;
    [key: string]: unknown;
  };
  type?: string;
  [key: string]: unknown;
}

export interface ClaudeMessage {
  type: ClaudeRole;
  content?: string;
  raw?: ClaudeRawMessage | string;
  [key: string]: unknown;
}

export interface TodoItem {
  id?: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

export interface HistorySessionSummary {
  sessionId: string;
  title: string;
  messageCount: number;
  lastTimestamp?: string;
}

export interface HistoryData {
  success: boolean;
  error?: string;
  sessions?: HistorySessionSummary[];
  total?: number;
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export interface PermissionModeOption {
  value: PermissionMode;
  icon: string;
  label: string;
  description: string;
}

export interface PendingImage {
  id: string;
  base64: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
}

// 资源搜索相关类型
export type ResourceSearchType = 'file' | 'folder' | 'code' | 'doc' | 'workspace';

export type ResourceType = 'file' | 'folder' | 'class' | 'interface' | 'method' | 'doc' | 'workspace';

export interface SearchResult {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  type: ResourceType;
  icon: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SelectedResource {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  type: ResourceType;
  icon: string;
}

// 资源类型选项配置
export interface ResourceTypeOption {
  type: ResourceSearchType;
  label: string;
  icon: string;
  description: string;
}

// 内联资源选择器状态
export type InlinePickerState = 'idle' | 'type-select' | 'searching';

// 上下文使用量
export interface ContextUsage {
  /** 已使用的 tokens（输入 + 输出 + 缓存读取） */
  used: number;
  /** 总上下文窗口大小 */
  total: number;
  /** 使用百分比 */
  percentage: number;
}

// ========== 斜杠命令相关类型 ==========

/** 命令来源类型 */
export type CommandSource = 'system' | 'user';

/** 命令分类 */
export type CommandCategory = 'session' | 'context' | 'workflow' | 'custom';

/** 斜杠命令定义 */
export interface SlashCommand {
  id: string;
  name: string;
  aliases?: string[];
  description: string;
  source: CommandSource;
  category: CommandCategory;
  icon?: string;
  requiresInput?: boolean;
  inputPlaceholder?: string;
}

/** 命令执行上下文 */
export interface SlashCommandContext {
  command: SlashCommand;
  args?: string;
}

/** 斜杠命令选择器状态（扩展 InlinePickerState） */
export type SlashPickerState = 'idle' | 'type-select' | 'searching' | 'slash-command';

