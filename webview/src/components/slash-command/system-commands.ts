import type { SlashCommand } from '../../types';

/**
 * 系统内置斜杠命令 - 完整的 Claude Code 命令列表
 */
export const SYSTEM_COMMANDS: SlashCommand[] = [
  // ========== 会话管理 (Session) ==========
  {
    id: 'clear',
    name: 'clear',
    aliases: ['reset', 'new'],
    description: 'Clear conversation history and free up context',
    source: 'system',
    category: 'session',
    icon: 'clear-all',
  },
  {
    id: 'compact',
    name: 'compact',
    description: 'Clear conversation history but keep a summary in context',
    source: 'system',
    category: 'session',
    icon: 'fold',
  },
  {
    id: 'resume',
    name: 'resume',
    description: 'Resume a previous conversation session',
    source: 'system',
    category: 'session',
    icon: 'history',
  },

  // ========== 项目配置 (Context) ==========
  {
    id: 'init',
    name: 'init',
    description: 'Initialize project with CLAUDE.md configuration',
    source: 'system',
    category: 'context',
    icon: 'file-code',
  },
  {
    id: 'add-dir',
    name: 'add-dir',
    description: 'Add a new working directory to context',
    source: 'system',
    category: 'context',
    icon: 'folder-opened',
  },
  {
    id: 'memory',
    name: 'memory',
    description: 'Manage project memory and notes',
    source: 'system',
    category: 'context',
    icon: 'notebook',
  },
  {
    id: 'context',
    name: 'context',
    description: 'View and manage context files',
    source: 'system',
    category: 'context',
    icon: 'files',
  },

  // ========== MCP 服务器 (MCP) ==========
  {
    id: 'mcp',
    name: 'mcp',
    description: 'View and manage MCP server connections',
    source: 'system',
    category: 'workflow',
    icon: 'plug',
  },
  {
    id: 'install-github-mcp',
    name: 'install-github-mcp',
    description: 'Install an MCP server from GitHub repository',
    source: 'system',
    category: 'workflow',
    icon: 'github',
  },

  // ========== 配置设置 (Config) ==========
  {
    id: 'config',
    name: 'config',
    description: 'View and edit configuration settings',
    source: 'system',
    category: 'workflow',
    icon: 'settings-gear',
  },
  {
    id: 'permissions',
    name: 'permissions',
    description: 'Manage permission modes and tool access',
    source: 'system',
    category: 'workflow',
    icon: 'shield',
  },
  {
    id: 'model',
    name: 'model',
    description: 'Switch between AI models',
    source: 'system',
    category: 'workflow',
    icon: 'symbol-misc',
  },
  {
    id: 'allowed-tools',
    name: 'allowed-tools',
    description: 'Manage list of allowed tools',
    source: 'system',
    category: 'workflow',
    icon: 'tools',
  },
  {
    id: 'terminal-setup',
    name: 'terminal-setup',
    description: 'Configure terminal integration settings',
    source: 'system',
    category: 'workflow',
    icon: 'terminal',
  },

  // ========== 账户相关 (Account) ==========
  {
    id: 'login',
    name: 'login',
    description: 'Log in to your account',
    source: 'system',
    category: 'workflow',
    icon: 'sign-in',
  },
  {
    id: 'logout',
    name: 'logout',
    description: 'Log out of your account',
    source: 'system',
    category: 'workflow',
    icon: 'sign-out',
  },
  {
    id: 'status',
    name: 'status',
    description: 'View current session and account status',
    source: 'system',
    category: 'workflow',
    icon: 'info',
  },

  // ========== 帮助诊断 (Help) ==========
  {
    id: 'help',
    name: 'help',
    description: 'Show available commands and usage',
    source: 'system',
    category: 'workflow',
    icon: 'question',
  },
  {
    id: 'doctor',
    name: 'doctor',
    description: 'Diagnose and fix common issues',
    source: 'system',
    category: 'workflow',
    icon: 'pulse',
  },
  {
    id: 'bug',
    name: 'bug',
    description: 'Report a bug or issue',
    source: 'system',
    category: 'workflow',
    icon: 'bug',
  },
  {
    id: 'cost',
    name: 'cost',
    description: 'View API usage and cost statistics',
    source: 'system',
    category: 'workflow',
    icon: 'credit-card',
  },

  // ========== 工作流 (Workflow) ==========
  {
    id: 'agents',
    name: 'agents',
    description: 'Manage and configure sub-agents',
    source: 'system',
    category: 'workflow',
    icon: 'organization',
  },
  {
    id: 'review',
    name: 'review',
    description: 'Start code review mode',
    source: 'system',
    category: 'workflow',
    icon: 'git-pull-request',
  },
  {
    id: 'pr-comments',
    name: 'pr-comments',
    description: 'View and manage PR comments',
    source: 'system',
    category: 'workflow',
    icon: 'comment-discussion',
  },
  {
    id: 'vim',
    name: 'vim',
    description: 'Toggle vim editing mode',
    source: 'system',
    category: 'workflow',
    icon: 'edit',
  },
];

/**
 * 根据查询过滤命令列表
 * @param commands 命令列表
 * @param query 搜索查询（不含 /）
 */
export const filterCommands = (commands: SlashCommand[], query: string): SlashCommand[] => {
  if (!query.trim()) {
    return commands;
  }

  const lowerQuery = query.toLowerCase();

  return commands.filter((cmd) => {
    // 匹配命令名
    if (cmd.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    // 匹配别名
    if (cmd.aliases?.some((alias) => alias.toLowerCase().includes(lowerQuery))) {
      return true;
    }
    // 匹配描述
    if (cmd.description.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    return false;
  });
};

/**
 * 按来源分组命令
 */
export const groupCommandsBySource = (commands: SlashCommand[]): {
  system: SlashCommand[];
  user: SlashCommand[];
} => {
  return {
    system: commands.filter((cmd) => cmd.source === 'system'),
    user: commands.filter((cmd) => cmd.source === 'user'),
  };
};
