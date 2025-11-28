import type { MCPServer, MCPServerStatus } from '../types/mcp';

interface MCPServerDetailProps {
  server: MCPServer | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (serverName: string, enable: boolean) => void;
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
      return '用户级别';
    case 'project':
      return '项目级别';
    case 'local':
      return '本地级别';
    default:
      return scope;
  }
};

/**
 * MCP 服务器详情弹窗
 */
const MCPServerDetail = ({ server, isOpen, onClose, onToggle }: MCPServerDetailProps) => {
  if (!isOpen || !server) return null;

  const statusStyle = getStatusStyle(server.status);

  const handleToggle = () => {
    onToggle(server.name, server.status === 'disabled');
  };

  // 阻止弹窗内部点击事件冒泡
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="mcp-detail-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="mcp-detail-modal"
        onClick={handleContentClick}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="codicon codicon-server" style={{ fontSize: '20px', color: 'white' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                {server.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {server.type.toUpperCase()} · {getScopeLabel(server.scope)}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="codicon codicon-close" style={{ fontSize: '16px' }} />
          </button>
        </div>

        {/* 内容区 */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* 状态卡片 */}
          <div
            style={{
              background: statusStyle.bg,
              border: `1px solid ${statusStyle.text}`,
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: statusStyle.dot,
                }}
              />
              <span style={{ fontSize: '13px', color: statusStyle.text, fontWeight: 500 }}>
                {getStatusText(server.status)}
              </span>
            </div>

            <button
              onClick={handleToggle}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: server.status === 'disabled' ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: server.status === 'disabled' ? 'white' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className={`codicon codicon-${server.status === 'disabled' ? 'play' : 'debug-pause'}`} />
              {server.status === 'disabled' ? '启用' : '禁用'}
            </button>
          </div>

          {/* 错误信息 */}
          {server.status === 'failed' && server.errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 500, marginBottom: '4px' }}>
                错误信息
              </div>
              <div style={{ fontSize: '12px', color: '#fca5a5', fontFamily: 'monospace' }}>
                {server.errorMessage}
              </div>
            </div>
          )}

          {/* 配置详情 */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              配置详情
            </div>

            {server.type === 'stdio' && (
              <>
                {/* 命令 */}
                {server.command && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      命令
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {server.command}
                    </div>
                  </div>
                )}

                {/* 参数 */}
                {server.args && server.args.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      参数
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                      }}
                    >
                      {server.args.map((arg, i) => (
                        <div key={i} style={{ marginBottom: i < server.args!.length - 1 ? '4px' : 0 }}>
                          {arg}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 环境变量 */}
                {server.env && Object.keys(server.env).length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      环境变量
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                      }}
                    >
                      {Object.entries(server.env).map(([key, value], i, arr) => (
                        <div key={key} style={{ marginBottom: i < arr.length - 1 ? '4px' : 0 }}>
                          <span style={{ color: 'var(--accent-color)' }}>{key}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>=</span>
                          <span>{value.length > 30 ? value.substring(0, 30) + '...' : value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {server.type === 'http' && (
              <>
                {/* URL */}
                {server.url && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      URL
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {server.url}
                    </div>
                  </div>
                )}

                {/* Headers */}
                {server.headers && Object.keys(server.headers).length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      请求头
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                      }}
                    >
                      {Object.entries(server.headers).map(([key, value], i, arr) => (
                        <div key={key} style={{ marginBottom: i < arr.length - 1 ? '4px' : 0 }}>
                          <span style={{ color: 'var(--accent-color)' }}>{key}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>: </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 可用工具 */}
          {server.tools && server.tools.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                可用工具 ({server.tools.length})
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {server.tools.map((tool) => (
                  <span
                    key={tool}
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-tertiary)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MCPServerDetail;
