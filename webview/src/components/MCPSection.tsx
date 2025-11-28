import { useEffect, useState } from 'react';
import type { MCPServer, MCPConfigResult } from '../types/mcp';
import MCPServerCard from './MCPServerCard';
import MCPServerDetail from './MCPServerDetail';

/**
 * 发送消息到 Java 后端
 */
const sendToJava = (message: string, payload: unknown = {}) => {
  if (window.sendToJava) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    window.sendToJava(`${message}:${payloadStr}`);
  }
};

/**
 * MCP 服务器管理主组件
 */
const MCPSection = () => {
  const [config, setConfig] = useState<MCPConfigResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'failed' | 'disabled'>('all');

  useEffect(() => {
    // 设置全局回调
    window.updateMCPServers = (jsonStr: string) => {
      try {
        const data: MCPConfigResult = JSON.parse(jsonStr);
        setConfig(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to parse MCP servers:', error);
        setLoading(false);
      }
    };

    // 初始加载
    loadMCPServers();

    return () => {
      window.updateMCPServers = undefined;
    };
  }, []);

  const loadMCPServers = () => {
    setLoading(true);
    sendToJava('get_mcp_servers', {});
  };

  const handleRefresh = () => {
    loadMCPServers();
  };

  const handleToggleServer = (serverName: string, enable: boolean) => {
    sendToJava('toggle_mcp_server', { serverName, enable });
  };

  const handleCardClick = (server: MCPServer) => {
    setSelectedServer(server);
    setIsDetailOpen(true);
  };

  const handleDetailClose = () => {
    setIsDetailOpen(false);
    setSelectedServer(null);
  };

  // 过滤服务器
  const filteredServers = config?.servers.filter((server) => {
    if (filterStatus === 'all') return true;
    return server.status === filterStatus;
  }) || [];

  // 统计数据
  const stats = {
    total: config?.servers.length || 0,
    connected: config?.connectedCount || 0,
    failed: config?.failedCount || 0,
    disabled: config?.disabledCount || 0,
  };

  return (
    <div className="mcp-section" style={{ padding: '16px 0' }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            MCP 服务器
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              margin: '4px 0 0',
            }}
          >
            管理 Model Context Protocol 服务器连接
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <i
            className={`codicon codicon-refresh ${loading ? 'spin' : ''}`}
            style={{
              animation: loading ? 'spin 1s linear infinite' : 'none',
            }}
          />
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <StatCard
          label="总计"
          value={stats.total}
          color="var(--text-primary)"
          onClick={() => setFilterStatus('all')}
          active={filterStatus === 'all'}
        />
        <StatCard
          label="已连接"
          value={stats.connected}
          color="#4ade80"
          onClick={() => setFilterStatus('connected')}
          active={filterStatus === 'connected'}
        />
        <StatCard
          label="失败"
          value={stats.failed}
          color="#f87171"
          onClick={() => setFilterStatus('failed')}
          active={filterStatus === 'failed'}
        />
        <StatCard
          label="禁用"
          value={stats.disabled}
          color="#9ca3af"
          onClick={() => setFilterStatus('disabled')}
          active={filterStatus === 'disabled'}
        />
      </div>

      {/* 配置路径信息 */}
      {config && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
          }}
        >
          <div style={{ marginBottom: '4px' }}>
            <i className="codicon codicon-file" style={{ marginRight: '6px' }} />
            用户配置: {config.userConfigPath || '未找到'}
          </div>
          {config.projectConfigPath && (
            <div style={{ marginBottom: '4px' }}>
              <i className="codicon codicon-folder" style={{ marginRight: '6px' }} />
              项目配置: {config.projectConfigPath}
            </div>
          )}
          {config.localConfigPath && (
            <div>
              <i className="codicon codicon-file-symlink-file" style={{ marginRight: '6px' }} />
              本地配置: {config.localConfigPath}
            </div>
          )}
        </div>
      )}

      {/* 服务器列表 */}
      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-secondary)',
          }}
        >
          <i
            className="codicon codicon-loading"
            style={{
              fontSize: '24px',
              marginBottom: '12px',
              display: 'block',
              animation: 'spin 1s linear infinite',
            }}
          />
          加载中...
        </div>
      ) : filteredServers.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-secondary)',
          }}
        >
          <i
            className="codicon codicon-server"
            style={{ fontSize: '32px', marginBottom: '12px', display: 'block', opacity: 0.5 }}
          />
          <div style={{ marginBottom: '8px' }}>
            {filterStatus === 'all' ? '暂无 MCP 服务器配置' : `没有${getFilterLabel(filterStatus)}的服务器`}
          </div>
          <div style={{ fontSize: '11px' }}>
            在 ~/.claude.json 或项目目录的 .mcp.json 中配置 MCP 服务器
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredServers.map((server) => (
            <MCPServerCard
              key={`${server.scope}-${server.name}`}
              server={server}
              onClick={() => handleCardClick(server)}
              onToggle={(enable) => handleToggleServer(server.name, enable)}
            />
          ))}
        </div>
      )}

      {/* 详情弹窗 */}
      <MCPServerDetail
        server={selectedServer}
        isOpen={isDetailOpen}
        onClose={handleDetailClose}
        onToggle={handleToggleServer}
      />

      {/* CSS 动画 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mcp-server-card:hover {
          border-color: var(--accent-color) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

/**
 * 统计卡片组件
 */
interface StatCardProps {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
  active: boolean;
}

const StatCard = ({ label, value, color, onClick, active }: StatCardProps) => (
  <button
    onClick={onClick}
    style={{
      background: active ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
      border: active ? `1px solid ${color}` : '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '10px 12px',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.2s ease',
    }}
  >
    <div style={{ fontSize: '18px', fontWeight: 600, color }}>{value}</div>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
  </button>
);

/**
 * 获取过滤器标签
 */
const getFilterLabel = (status: string): string => {
  switch (status) {
    case 'connected':
      return '已连接';
    case 'failed':
      return '失败';
    case 'disabled':
      return '已禁用';
    default:
      return '';
  }
};

// 扩展 window 类型
declare global {
  interface Window {
    updateMCPServers?: (jsonStr: string) => void;
  }
}

export default MCPSection;
