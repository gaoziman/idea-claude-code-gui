/**
 * MCP (Model Context Protocol) 服务器相关类型定义
 */

/** MCP 服务器类型 */
export type MCPServerType = 'stdio' | 'http';

/** MCP 服务器状态 */
export type MCPServerStatus = 'connected' | 'failed' | 'disabled';

/** MCP 配置范围 */
export type MCPServerScope = 'user' | 'project' | 'local';

/** MCP 服务器配置 */
export interface MCPServer {
  /** 服务器名称 */
  name: string;
  /** 服务器类型 */
  type: MCPServerType;
  /** 连接状态 */
  status: MCPServerStatus;
  /** 配置范围 */
  scope: MCPServerScope;

  // stdio 类型配置
  /** 命令（stdio 类型） */
  command?: string;
  /** 命令参数（stdio 类型） */
  args?: string[];
  /** 环境变量（stdio 类型） */
  env?: Record<string, string>;

  // http 类型配置
  /** URL 地址（http 类型） */
  url?: string;
  /** 请求头（http 类型） */
  headers?: Record<string, string>;

  // 元数据
  /** 错误信息 */
  errorMessage?: string;
  /** 可用工具列表 */
  tools?: string[];
}

/** MCP 配置结果 */
export interface MCPConfigResult {
  /** 服务器列表 */
  servers: MCPServer[];
  /** 用户配置文件路径 */
  userConfigPath?: string;
  /** 项目配置文件路径 */
  projectConfigPath?: string;
  /** 本地配置路径 */
  localConfigPath?: string;
  /** 已连接数量 */
  connectedCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 禁用数量 */
  disabledCount: number;
}

/** MCP 状态统计 */
export interface MCPStatusStats {
  connected: number;
  failed: number;
  disabled: number;
  total: number;
}

/** 服务器详情弹窗状态 */
export interface MCPServerDetailProps {
  server: MCPServer | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (serverName: string, enable: boolean) => void;
}

/** MCP Section 组件 Props */
export interface MCPSectionProps {
  onRefresh?: () => void;
}
