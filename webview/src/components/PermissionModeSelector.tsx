import { useState, useRef, useEffect } from 'react';
import type { PermissionMode, PermissionModeOption } from '../types';

const PERMISSION_MODE_OPTIONS: PermissionModeOption[] = [
  {
    value: 'default',
    icon: 'codicon-shield',
    label: '默认模式',
    description: '每次工具调用都需要确认',
  },
  {
    value: 'acceptEdits',
    icon: 'codicon-edit',
    label: '允许编辑',
    description: '自动允许编辑操作，其他操作需确认',
  },
  {
    value: 'bypassPermissions',
    icon: 'codicon-pass',
    label: '信任模式',
    description: '自动允许所有工具调用',
  },
  {
    value: 'plan',
    icon: 'codicon-list-tree',
    label: '规划模式',
    description: '仅规划不执行，需手动确认',
  },
];

interface PermissionModeSelectorProps {
  value: PermissionMode;
  onChange: (mode: PermissionMode) => void;
  disabled?: boolean;
}

const PermissionModeSelector = ({ value, onChange, disabled }: PermissionModeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = PERMISSION_MODE_OPTIONS.find((opt) => opt.value === value) || PERMISSION_MODE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (mode: PermissionMode) => {
    onChange(mode);
    setIsOpen(false);
  };

  return (
    <div className="permission-mode-selector" ref={containerRef}>
      <button
        className="permission-mode-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        data-tooltip={currentOption.description}
      >
        <span className={`codicon ${currentOption.icon}`} />
        <span className="permission-mode-label">{currentOption.label}</span>
        <span className="codicon codicon-chevron-down" />
      </button>

      {isOpen && (
        <div className="permission-mode-dropdown">
          {PERMISSION_MODE_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`permission-mode-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className={`codicon ${option.icon}`} />
              <div className="permission-mode-option-content">
                <span className="permission-mode-option-label">{option.label}</span>
                <span className="permission-mode-option-desc">{option.description}</span>
              </div>
              {option.value === value && <span className="codicon codicon-check" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PermissionModeSelector;
