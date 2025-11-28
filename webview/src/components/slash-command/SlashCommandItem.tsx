import type { SlashCommand } from '../../types';

interface SlashCommandItemProps {
  command: SlashCommand;
  isSelected: boolean;
  query?: string;
  onClick: () => void;
  onMouseEnter: () => void;
  style?: React.CSSProperties;
}

/**
 * 高亮匹配的文本
 */
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}
      <span className="slash-highlight">{text.slice(index, index + query.length)}</span>
      {text.slice(index + query.length)}
    </>
  );
};

/**
 * 获取命令图标的 codicon 类名
 */
const getIconClass = (icon?: string): string => {
  if (!icon) {
    return 'codicon codicon-terminal';
  }
  return `codicon codicon-${icon}`;
};

const SlashCommandItem = ({
  command,
  isSelected,
  query = '',
  onClick,
  onMouseEnter,
  style,
}: SlashCommandItemProps) => {
  return (
    <div
      className={`slash-command-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={style}
    >
      {/* 左侧来源指示条 */}
      <div
        className={`slash-indicator ${command.source === 'system' ? 'system' : 'user'}`}
      />

      {/* 命令图标 */}
      <span className={`slash-icon ${getIconClass(command.icon)}`} />

      {/* 命令信息 */}
      <div className="slash-info">
        <div className="slash-name-row">
          {/* 命令名 */}
          <span className="slash-name">
            {highlightMatch(command.name, query)}
          </span>

          {/* 别名标签 */}
          {command.aliases && command.aliases.length > 0 && (
            <div className="slash-aliases">
              {command.aliases.map((alias) => (
                <span key={alias} className="slash-alias">
                  {highlightMatch(alias, query)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 命令描述 */}
        <span className="slash-description">
          {highlightMatch(command.description, query)}
        </span>
      </div>

      {/* 用户命令标记 */}
      {command.source === 'user' && (
        <span className="slash-source-badge">(user)</span>
      )}
    </div>
  );
};

export default SlashCommandItem;
