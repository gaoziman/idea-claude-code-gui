/**
 * CodeBlock - 代码块组件
 * Trae 风格简洁设计，集成 Shiki 语法高亮
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { codeToHtml } from 'shiki';
import { insertCodeAtCursor, addCodeToNewFile } from '../../utils/bridge';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
  className?: string;
}

// Shiki 高亮缓存
const highlightCache = new Map<string, string>();

// 语言图标映射 (使用 codicon)
const languageIcons: Record<string, string> = {
  javascript: 'symbol-method',
  typescript: 'symbol-method',
  tsx: 'symbol-method',
  jsx: 'symbol-method',
  python: 'symbol-misc',
  java: 'coffee',
  kotlin: 'symbol-interface',
  go: 'symbol-namespace',
  rust: 'gear',
  ruby: 'ruby',
  php: 'code',
  swift: 'symbol-event',
  bash: 'terminal',
  shell: 'terminal',
  sql: 'database',
  html: 'file-code',
  css: 'symbol-color',
  scss: 'symbol-color',
  json: 'json',
  yaml: 'settings-gear',
  xml: 'file-code',
  markdown: 'markdown',
  plaintext: 'file-text',
};

// 语言专属颜色映射 (Trae 风格)
const languageColors: Record<string, string> = {
  javascript: '#f7df1e',  // 黄色
  typescript: '#3178c6',  // 蓝色
  tsx: '#3178c6',         // 蓝色
  jsx: '#61dafb',         // React 青色
  python: '#3776ab',      // 蓝色
  java: '#e76f00',        // 橙红色
  kotlin: '#7f52ff',      // 紫色
  go: '#00add8',          // 青色
  rust: '#dea584',        // 铜色
  ruby: '#cc342d',        // 红色
  php: '#777bb4',         // 紫色
  swift: '#fa7343',       // 橙色
  bash: '#4eaa25',        // 绿色
  shell: '#4eaa25',       // 绿色
  sql: '#e38c00',         // 橙色
  html: '#e34c26',        // 橙红色
  css: '#264de4',         // 蓝色
  scss: '#cd6799',        // 粉色
  json: '#cbcb41',        // 黄色
  yaml: '#cb171e',        // 红色
  xml: '#f26822',         // 橙色
  markdown: '#083fa1',    // 蓝色
  plaintext: '#808080',   // 灰色
  c: '#a8b9cc',           // 浅蓝
  cpp: '#00599c',         // 深蓝
  csharp: '#178600',      // 绿色
  vue: '#42b883',         // Vue 绿
  react: '#61dafb',       // React 青
};

const CodeBlock = ({
  code,
  language = '',
  showLineNumbers = true,
  maxHeight,
  className = '',
}: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // 语言映射
  const normalizedLanguage = useMemo(() => {
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'tsx',
      jsx: 'jsx',
      py: 'python',
      rb: 'ruby',
      yml: 'yaml',
      md: 'markdown',
      sh: 'bash',
      shell: 'bash',
      zsh: 'bash',
      text: 'plaintext',
      txt: 'plaintext',
      '': 'plaintext',
    };
    const lang = language.toLowerCase();
    return langMap[lang] || lang || 'plaintext';
  }, [language]);

  // 获取显示语言名称
  const displayLanguage = useMemo(() => {
    const displayMap: Record<string, string> = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      csharp: 'C#',
      go: 'Go',
      rust: 'Rust',
      ruby: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
      bash: 'Bash',
      shell: 'Shell',
      sql: 'SQL',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      json: 'JSON',
      yaml: 'YAML',
      xml: 'XML',
      markdown: 'Markdown',
      plaintext: 'Text',
      tsx: 'TSX',
      jsx: 'JSX',
    };
    return displayMap[normalizedLanguage] || normalizedLanguage;
  }, [normalizedLanguage]);

  // 获取语言图标
  const languageIcon = useMemo(() => {
    return languageIcons[normalizedLanguage] || 'file-code';
  }, [normalizedLanguage]);

  // 获取语言专属颜色
  const languageColor = useMemo(() => {
    return languageColors[normalizedLanguage] || '#808080';
  }, [normalizedLanguage]);

  // 使用 Shiki 进行语法高亮
  useEffect(() => {
    let cancelled = false;

    const highlight = async () => {
      const cacheKey = `${normalizedLanguage}:${code}`;

      const cached = highlightCache.get(cacheKey);
      if (cached) {
        setHighlightedHtml(cached);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const html = await codeToHtml(code, {
          lang: normalizedLanguage,
          theme: 'one-dark-pro',
        });

        if (!cancelled) {
          highlightCache.set(cacheKey, html);
          setHighlightedHtml(html);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[CodeBlock] Shiki highlight error:', error);
        if (!cancelled) {
          setHighlightedHtml('');
          setIsLoading(false);
        }
      }
    };

    highlight();

    return () => {
      cancelled = true;
    };
  }, [code, normalizedLanguage]);

  // 复制按钮处理
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  // 插入到光标处
  const handleInsertAtCursor = useCallback(() => {
    insertCodeAtCursor(code, normalizedLanguage);
  }, [code, normalizedLanguage]);

  // 添加到新文件
  const handleAddToNewFile = useCallback(() => {
    addCodeToNewFile(code, normalizedLanguage);
  }, [code, normalizedLanguage]);

  // 分割代码行
  const lines = useMemo(() => code.split('\n'), [code]);

  return (
    <div className={`cb-container ${className}`}>
      {/* 头部：语言标识 + 操作按钮 */}
      <div className="cb-header">
        <div className="cb-lang">
          <span
            className={`codicon codicon-${languageIcon}`}
            style={{ color: languageColor }}
          />
          <span className="cb-lang-name">{displayLanguage}</span>
        </div>
        <div className="cb-actions">
          <button
            className={`cb-btn ${copied ? 'cb-btn-success' : ''}`}
            onClick={handleCopy}
            title={copied ? '已复制' : '复制'}
          >
            <span className={`codicon codicon-${copied ? 'check' : 'copy'}`} />
          </button>
          <button
            className="cb-btn"
            onClick={handleInsertAtCursor}
            title="插入到光标"
          >
            <span className="codicon codicon-insert" />
          </button>
          <button
            className="cb-btn"
            onClick={handleAddToNewFile}
            title="新建文件"
          >
            <span className="codicon codicon-new-file" />
          </button>
        </div>
      </div>

      {/* 代码内容 */}
      <div
        className="cb-body"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {isLoading ? (
          <div className="cb-code cb-loading">
            {lines.map((line, index) => (
              <div key={index} className="cb-line">
                {showLineNumbers && (
                  <span className="cb-ln">{index + 1}</span>
                )}
                <span className="cb-content">{line || ' '}</span>
              </div>
            ))}
          </div>
        ) : highlightedHtml ? (
          <div
            className={`cb-code cb-shiki ${showLineNumbers ? 'cb-with-ln' : ''}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <div className="cb-code cb-fallback">
            {lines.map((line, index) => (
              <div key={index} className="cb-line">
                {showLineNumbers && (
                  <span className="cb-ln">{index + 1}</span>
                )}
                <span className="cb-content">{line || ' '}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeBlock;
