/**
 * CopyButton - 复制按钮组件
 * 用于代码块等需要复制功能的场景
 */

import { useState, useCallback } from 'react';

interface CopyButtonProps {
  text: string;
  className?: string;
  showLabel?: boolean;
}

const CopyButton = ({ text, className = '', showLabel = true }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      className={`copy-button ${copied ? 'copied' : ''} ${className}`}
      onClick={handleCopy}
      title={copied ? '已复制' : '复制代码'}
    >
      <span className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} />
      {showLabel && <span>{copied ? '已复制' : '复制'}</span>}
    </button>
  );
};

export default CopyButton;
