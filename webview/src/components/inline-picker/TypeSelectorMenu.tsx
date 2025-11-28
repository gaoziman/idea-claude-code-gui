import { useEffect, useRef } from 'react';
import type { ResourceSearchType, ResourceTypeOption } from '../../types';

interface TypeSelectorMenuProps {
  isOpen: boolean;
  onSelect: (type: ResourceSearchType) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}

export const RESOURCE_TYPE_OPTIONS: ResourceTypeOption[] = [
  {
    type: 'file',
    label: 'File',
    icon: 'codicon-file',
    description: '搜索所有文件',
  },
  {
    type: 'folder',
    label: 'Folder',
    icon: 'codicon-folder',
    description: '搜索文件夹',
  },
  {
    type: 'doc',
    label: 'Doc',
    icon: 'codicon-notebook',
    description: '搜索文档 (.md, .txt 等)',
  },
  {
    type: 'code',
    label: 'Code',
    icon: 'codicon-symbol-class',
    description: '搜索源代码文件',
  },
  {
    type: 'workspace',
    label: 'Workspace',
    icon: 'codicon-root-folder',
    description: '引用整个工作空间',
  },
];

const TypeSelectorMenu = ({
  isOpen,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange,
}: TypeSelectorMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

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

  // 注意：键盘导航由 InlineResourcePicker 统一处理，这里不再监听 document 键盘事件
  // 以避免事件被重复处理导致跳格问题

  if (!isOpen) return null;

  return (
    <div className="type-selector-menu" ref={menuRef}>
      {RESOURCE_TYPE_OPTIONS.map((option, index) => (
        <div
          key={option.type}
          className={`type-selector-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(option.type)}
          onMouseEnter={() => onSelectedIndexChange(index)}
        >
          <span className={`type-selector-icon codicon ${option.icon}`} />
          <span className="type-selector-label">{option.label}</span>
          <span className="type-selector-arrow codicon codicon-chevron-right" />
        </div>
      ))}
    </div>
  );
};

export default TypeSelectorMenu;
