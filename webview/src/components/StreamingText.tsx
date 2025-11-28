import { useEffect, useRef, useState, useCallback, memo } from 'react';
import MarkdownBlock from './MarkdownBlock';
import './StreamingText.css';

interface StreamingTextProps {
  /** 完整的文本内容 */
  content: string;
  /** 每个字符的显示间隔（毫秒），默认 20ms */
  speed?: number;
  /** 是否启用智能分段（在标点处停顿） */
  smartPause?: boolean;
  /** 打字完成后的回调 */
  onComplete?: () => void;
  /** 是否显示光标 */
  showCursor?: boolean;
  /** 唯一标识符，用于追踪同一个消息块 */
  blockId?: string;
}

// 全局状态存储：追踪每个消息块已完成打字的内容长度
const completedLengthMap = new Map<string, number>();

/**
 * StreamingText 组件
 *
 * 实现打字机效果，支持：
 * - 逐字显示文本
 * - 智能分段：在标点符号处稍作停顿
 * - 光标闪烁动画
 * - 增量更新：只对新增内容应用打字机效果
 * - Markdown 渲染兼容
 */
const StreamingText = memo(({
  content,
  speed = 20,
  smartPause = true,
  onComplete,
  showCursor = true,
  blockId,
}: StreamingTextProps) => {
  // 当前显示的字符位置
  const [displayIndex, setDisplayIndex] = useState(0);
  // 是否正在打字
  const [isTyping, setIsTyping] = useState(false);
  // 是否已完成
  const [isComplete, setIsComplete] = useState(false);

  // 使用 ref 追踪内容变化
  const prevContentRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // 生成唯一 ID
  const uniqueId = blockId || `streaming_${content.slice(0, 20)}`;

  // 计算停顿时间
  const getPauseTime = useCallback((char: string): number => {
    if (!smartPause) return speed;

    // 句号、问号、感叹号 - 长停顿
    if (/[。！？.!?]/.test(char)) {
      return speed * 4;
    }
    // 逗号、分号、冒号 - 中等停顿
    if (/[，；：,;:]/.test(char)) {
      return speed * 2;
    }
    // 换行 - 稍长停顿
    if (char === '\n') {
      return speed * 3;
    }
    return speed;
  }, [speed, smartPause]);

  // 初始化：检查是否有已完成的内容
  useEffect(() => {
    const completedLength = completedLengthMap.get(uniqueId) || 0;

    if (completedLength > 0 && completedLength <= content.length) {
      // 有已完成的内容，从该位置开始
      setDisplayIndex(completedLength);

      if (completedLength >= content.length) {
        // 内容没有变化，标记为完成
        setIsComplete(true);
        setIsTyping(false);
      } else {
        // 有新内容，继续打字
        setIsTyping(true);
        setIsComplete(false);
      }
    } else if (content.length > 0) {
      // 全新内容，从头开始打字
      setDisplayIndex(0);
      setIsTyping(true);
      setIsComplete(false);
    }

    prevContentRef.current = content;
  }, [uniqueId]); // 只在 uniqueId 变化时初始化

  // 监听内容变化
  useEffect(() => {
    const prevContent = prevContentRef.current;

    if (content !== prevContent) {
      if (content.length > prevContent.length && content.startsWith(prevContent)) {
        // 内容是追加的，继续打字
        setIsTyping(true);
        setIsComplete(false);
      } else if (content.length > 0) {
        // 内容完全改变，重新开始
        const completedLength = completedLengthMap.get(uniqueId) || 0;
        if (completedLength < content.length) {
          setDisplayIndex(completedLength);
          setIsTyping(true);
          setIsComplete(false);
        }
      }
      prevContentRef.current = content;
    }
  }, [content, uniqueId]);

  // 打字动画
  useEffect(() => {
    if (!isTyping || displayIndex >= content.length) {
      if (displayIndex >= content.length && content.length > 0) {
        setIsComplete(true);
        setIsTyping(false);
        completedLengthMap.set(uniqueId, content.length);
        onComplete?.();
      }
      return;
    }

    const char = content[displayIndex];
    const pauseTime = getPauseTime(char);

    timerRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(() => {
        setDisplayIndex((prev) => {
          const newIndex = prev + 1;
          // 更新已完成的长度
          completedLengthMap.set(uniqueId, newIndex);
          return newIndex;
        });
      });
    }, pauseTime);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isTyping, displayIndex, content, getPauseTime, onComplete, uniqueId]);

  // 获取当前显示的文本
  const displayedText = content.slice(0, displayIndex);

  // 如果内容为空，不渲染
  if (!content) {
    return null;
  }

  return (
    <div className="streaming-text-container">
      <MarkdownBlock content={displayedText} />
      {showCursor && isTyping && !isComplete && (
        <span className="streaming-cursor">|</span>
      )}
    </div>
  );
});

StreamingText.displayName = 'StreamingText';

export default StreamingText;

/**
 * 清除特定消息块的打字状态
 * 当消息被删除或会话重置时调用
 */
export const clearStreamingState = (blockId: string) => {
  completedLengthMap.delete(blockId);
};

/**
 * 清除所有打字状态
 * 当会话重置时调用
 */
export const clearAllStreamingState = () => {
  completedLengthMap.clear();
};
