/**
 * ModelSelector - Claude 模型选择器
 * 下拉选择切换模型
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// 模型选项（与 Claude 官方保持一致）
const MODEL_OPTIONS = [
  { id: 'sonnet', name: 'Sonnet 4.5', description: '推荐' },
  { id: 'opus', name: 'Opus 4.5', description: '高级' },
  { id: 'haiku', name: 'Haiku 4.5', description: '快速' },
];

interface ModelSelectorProps {
  /** 当前选中的模型 */
  model: string;
  /** 模型变更回调 */
  onChange: (model: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 从完整模型ID中提取简短名称
 */
const parseModelId = (modelId: string): string => {
  const lowerId = modelId.toLowerCase();
  if (lowerId.includes('opus')) return 'opus';
  if (lowerId.includes('haiku')) return 'haiku';
  return 'sonnet';
};

const ModelSelector = ({ model, onChange, disabled = false }: ModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取当前选中的模型配置
  const currentModelId = parseModelId(model);
  const currentOption = MODEL_OPTIONS.find(opt => opt.id === currentModelId) || MODEL_OPTIONS[0];

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 选择模型
  const handleSelect = useCallback((optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
  }, [onChange]);

  // 切换下拉
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  return (
    <div className="model-selector" ref={containerRef}>
      <button
        className={`model-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleDropdown}
        disabled={disabled}
        title="切换模型"
      >
        <span className="model-selector-name">{currentOption.name}</span>
        <span className={`model-selector-arrow ${isOpen ? 'open' : ''}`}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="model-selector-dropdown">
          {MODEL_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`model-selector-option ${option.id === currentModelId ? 'selected' : ''}`}
              onClick={() => handleSelect(option.id)}
            >
              <span className="model-option-name">{option.name}</span>
              <span className="model-option-desc">{option.description}</span>
              {option.id === currentModelId && (
                <span className="model-option-check">
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                    <path d="M1 4L4.5 7.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
