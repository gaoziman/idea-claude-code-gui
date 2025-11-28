/**
 * MarkdownBlock - Markdown 渲染组件
 * 集成 CodeBlock 组件，支持代码块复制功能
 */

import { marked, type Token, type Tokens } from 'marked';
import { useMemo, useCallback } from 'react';
import { openBrowser, openFile } from '../utils/bridge';
import { CodeBlock } from './messages';

marked.setOptions({
  breaks: false,
  gfm: true,
});

interface MarkdownBlockProps {
  content?: string;
}

const MarkdownBlock = ({ content = '' }: MarkdownBlockProps) => {
  // 解析 markdown 为 tokens
  const tokens = useMemo(() => {
    try {
      return marked.lexer(content);
    } catch (error) {
      console.error('[MarkdownBlock] Failed to parse markdown', error);
      return [];
    }
  }, [content]);

  // 处理链接点击
  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) {
      return;
    }

    event.preventDefault();
    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }

    if (/^(https?:|mailto:)/.test(href)) {
      openBrowser(href);
    } else {
      openFile(href);
    }
  }, []);

  // 渲染 inline tokens 为 HTML
  const renderInlineTokens = useCallback((tokens: Token[]): string => {
    return tokens.map((token) => {
      switch (token.type) {
        case 'text':
          return (token as Tokens.Text).text;
        case 'strong':
          return `<strong>${renderInlineTokens((token as Tokens.Strong).tokens)}</strong>`;
        case 'em':
          return `<em>${renderInlineTokens((token as Tokens.Em).tokens)}</em>`;
        case 'codespan':
          return `<code>${(token as Tokens.Codespan).text}</code>`;
        case 'link': {
          const linkToken = token as Tokens.Link;
          return `<a href="${linkToken.href}" title="${linkToken.title || ''}">${renderInlineTokens(linkToken.tokens)}</a>`;
        }
        case 'br':
          return '<br/>';
        default:
          return 'raw' in token ? (token as Tokens.Generic).raw : '';
      }
    }).join('');
  }, []);

  // 渲染单个 token
  const renderToken = useCallback((token: Token, index: number): React.ReactNode => {
    switch (token.type) {
      case 'code': {
        const codeToken = token as Tokens.Code;
        return (
          <CodeBlock
            key={index}
            code={codeToken.text}
            language={codeToken.lang || ''}
            showLineNumbers={true}
          />
        );
      }
      case 'paragraph': {
        const paragraphToken = token as Tokens.Paragraph;
        const html = renderInlineTokens(paragraphToken.tokens);
        return (
          <p
            key={index}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      case 'heading': {
        const headingToken = token as Tokens.Heading;
        const html = renderInlineTokens(headingToken.tokens);
        const HeadingTag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'][headingToken.depth - 1] || 'h6';
        return (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: `<${HeadingTag}>${html}</${HeadingTag}>` }}
          />
        );
      }
      case 'list': {
        const listToken = token as Tokens.List;
        const items = listToken.items.map((item, i) => (
          <li key={i}>
            {item.tokens.map((t, j) => renderToken(t, j))}
          </li>
        ));
        return listToken.ordered ? (
          <ol key={index}>{items}</ol>
        ) : (
          <ul key={index}>{items}</ul>
        );
      }
      case 'blockquote': {
        const blockquoteToken = token as Tokens.Blockquote;
        return (
          <blockquote key={index}>
            {blockquoteToken.tokens.map((t, i) => renderToken(t, i))}
          </blockquote>
        );
      }
      case 'hr':
        return <hr key={index} />;
      case 'space':
        return null;
      case 'html': {
        const htmlToken = token as Tokens.HTML;
        return (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: htmlToken.raw }}
          />
        );
      }
      case 'table': {
        const tableToken = token as Tokens.Table;
        return (
          <table key={index}>
            <thead>
              <tr>
                {tableToken.header.map((cell, i) => (
                  <th
                    key={i}
                    style={{ textAlign: tableToken.align[i] || 'left' }}
                    dangerouslySetInnerHTML={{ __html: renderInlineTokens(cell.tokens) }}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {tableToken.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{ textAlign: tableToken.align[j] || 'left' }}
                      dangerouslySetInnerHTML={{ __html: renderInlineTokens(cell.tokens) }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      default: {
        // 对于其他 token，使用 marked 默认解析
        const html = marked.parser([token]);
        return (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
    }
  }, [renderInlineTokens]);

  return (
    <div className="markdown-content" onClick={handleClick}>
      {tokens.map((token, index) => renderToken(token, index))}
    </div>
  );
};

export default MarkdownBlock;
