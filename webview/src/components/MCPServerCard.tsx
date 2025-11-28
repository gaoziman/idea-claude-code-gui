import type { MCPServer, MCPServerStatus } from '../types/mcp';

interface MCPServerCardProps {
  server: MCPServer;
  onClick: () => void;
  onToggle: (enable: boolean) => void;
}

/**
 * 获取状态对应的样式
 */
const getStatusStyle = (status: MCPServerStatus): { bg: string; text: string; dot: string } => {
  switch (status) {
    case 'connected':
      return {
        bg: 'rgba(74, 222, 128, 0.1)',
        text: '#4ade80',
        dot: '#22c55e',
      };
    case 'failed':
      return {
        bg: 'rgba(248, 113, 113, 0.1)',
        text: '#f87171',
        dot: '#ef4444',
      };
    case 'disabled':
      return {
        bg: 'rgba(156, 163, 175, 0.1)',
        text: '#9ca3af',
        dot: '#6b7280',
      };
  }
};

/**
 * 获取状态文本
 */
const getStatusText = (status: MCPServerStatus): string => {
  switch (status) {
    case 'connected':
      return '已连接';
    case 'failed':
      return '连接失败';
    case 'disabled':
      return '已禁用';
  }
};

/**
 * 获取范围标签
 */
const getScopeLabel = (scope: string): string => {
  switch (scope) {
    case 'user':
      return '用户';
    case 'project':
      return '项目';
    case 'local':
      return '本地';
    default:
      return scope;
  }
};

/**
 * MCP 服务器卡片组件
 */
const MCPServerCard = ({ server, onClick, onToggle }: MCPServerCardProps) => {
  const statusStyle = getStatusStyle(server.status);

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(server.status === 'disabled');
  };

  return (
    <div
      className="mcp-server-card"
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* 头部：名称和状态 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {/* 服务器图标 */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <i
              className="codicon codicon-server"
              style={{ fontSize: '16px', color: 'white' }}
            />
          </div>

          {/* 名称 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: '13px',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {server.name}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                marginTop: '2px',
              }}
            >
              {server.type.toUpperCase()} · {getScopeLabel(server.scope)}
            </div>
          </div>
        </div>

        {/* 状态指示器 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '12px',
            background: statusStyle.bg,
            fontSize: '11px',
            color: statusStyle.text,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusStyle.dot,
            }}
          />
          {getStatusText(server.status)}
        </div>
      </div>

      {/* 命令预览（仅 stdio 类型） */}
      {server.type === 'stdio' && server.command && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
            background: 'var(--bg-tertiary)',
            padding: '6px 8px',
            borderRadius: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          $ {server.command} {server.args?.slice(0, 2).join(' ')}
          {server.args && server.args.length > 2 && '...'}
        </div>
      )}

      {/* URL 预览（仅 http 类型） */}
      {server.type === 'http' && server.url && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
            background: 'var(--bg-tertiary)',
            padding: '6px 8px',
            borderRadius: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {server.url}
        </div>
      )}

      {/* 底部操作区 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
        }}
      >
        {/* 工具数量 */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
          }}
        >
          {server.tools && server.tools.length > 0 ? (
            <span>
              <i className="codicon codicon-tools" style={{ marginRight: '4px' }} />
              {server.tools.length} 个工具
            </span>
          ) : (
            <span style={{ opacity: 0.5 }}>--</span>
          )}
        </div>

        {/* 启用/禁用开关 */}
        <button
          onClick={handleToggleClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: 'none',
            background: server.status === 'disabled' ? 'var(--accent-color)' : 'var(--bg-tertiary)',
            color: server.status === 'disabled' ? 'white' : 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <i
            className={`codicon codicon-${server.status === 'disabled' ? 'play' : 'debug-pause'}`}
          />
          {server.status === 'disabled' ? '启用' : '禁用'}
        </button>
      </div>
    </div>
  );
};

export default MCPServerCard;
