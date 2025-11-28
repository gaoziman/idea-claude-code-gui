import { useEffect, useRef, useMemo } from 'react';
import type { SlashCommand } from '../../types';
import SlashCommandItem from './SlashCommandItem';
import { groupCommandsBySource } from './system-commands';

interface SlashCommandMenuProps {
  isOpen: boolean;
  commands: SlashCommand[];
  query: string;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  onSelectedIndexChange: (index: number) => void;
}

const SlashCommandMenu = ({
  isOpen,
  commands,
  query,
  selectedIndex,
  onSelect,
  onClose,
  onSelectedIndexChange,
}: SlashCommandMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 按来源分组
  const groupedCommands = useMemo(() => groupCommandsBySource(commands), [commands]);

  // 构建扁平化的命令列表用于索引
  const flatCommands = useMemo(() => {
    return [...groupedCommands.system, ...groupedCommands.user];
  }, [groupedCommands]);

  // 处理点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // 滚动选中项到可见区域
  useEffect(() => {
    if (listRef.current && flatCommands.length > 0 && selectedIndex >= 0) {
      const selectedItem = listRef.current.querySelector(
        `.slash-command-item:nth-child(${selectedIndex + 1})`
      ) as HTMLElement;

      // 尝试使用 data-index 查找
      if (!selectedItem) {
        const itemByIndex = listRef.current.querySelector(
          `[data-index="${selectedIndex}"]`
        ) as HTMLElement;
        if (itemByIndex) {
          itemByIndex.scrollIntoView({ block: 'nearest' });
        }
      } else {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, flatCommands.length]);

  if (!isOpen) return null;

  // 计算每个命令在扁平列表中的索引
  const getGlobalIndex = (source: 'system' | 'user', localIndex: number): number => {
    if (source === 'system') {
      return localIndex;
    }
    return groupedCommands.system.length + localIndex;
  };

  return (
    <div className="slash-command-menu" ref={menuRef}>
      {/* 头部 */}
      <div className="slash-menu-header">
        <span className="slash-menu-title">
          <span className="codicon codicon-terminal" />
          Commands
        </span>
        {query && (
          <span className="slash-menu-query">
            Filtering: <strong>/{query}</strong>
          </span>
        )}
      </div>

      {/* 命令列表 */}
      <div className="slash-menu-list" ref={listRef}>
        {commands.length === 0 ? (
          <div className="slash-menu-empty">
            <span className="codicon codicon-search" />
            <span>No commands found</span>
          </div>
        ) : (
          <>
            {/* 系统命令组 */}
            {groupedCommands.system.length > 0 && (
              <div className="slash-command-group">
                <div className="slash-group-label">
                  <span className="slash-group-line" />
                  <span>SYSTEM</span>
                  <span className="slash-group-line" />
                </div>
                {groupedCommands.system.map((cmd, localIndex) => {
                  const globalIndex = getGlobalIndex('system', localIndex);
                  return (
                    <SlashCommandItem
                      key={cmd.id}
                      command={cmd}
                      isSelected={selectedIndex === globalIndex}
                      query={query}
                      onClick={() => onSelect(cmd)}
                      onMouseEnter={() => onSelectedIndexChange(globalIndex)}
                      style={{ '--item-index': localIndex } as React.CSSProperties}
                    />
                  );
                })}
              </div>
            )}

            {/* 用户自定义命令组 */}
            {groupedCommands.user.length > 0 && (
              <div className="slash-command-group">
                <div className="slash-group-label">
                  <span className="slash-group-line" />
                  <span>CUSTOM</span>
                  <span className="slash-group-line" />
                </div>
                {groupedCommands.user.map((cmd, localIndex) => {
                  const globalIndex = getGlobalIndex('user', localIndex);
                  return (
                    <SlashCommandItem
                      key={cmd.id}
                      command={cmd}
                      isSelected={selectedIndex === globalIndex}
                      query={query}
                      onClick={() => onSelect(cmd)}
                      onMouseEnter={() => onSelectedIndexChange(globalIndex)}
                      style={{ '--item-index': localIndex } as React.CSSProperties}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部快捷键提示 */}
      <div className="slash-menu-footer">
        <span className="slash-shortcut">
          <kbd>↑</kbd><kbd>↓</kbd> Navigate
        </span>
        <span className="slash-shortcut">
          <kbd>↵</kbd> Select
        </span>
        <span className="slash-shortcut">
          <kbd>⎋</kbd> Close
        </span>
      </div>
    </div>
  );
};

export default SlashCommandMenu;
