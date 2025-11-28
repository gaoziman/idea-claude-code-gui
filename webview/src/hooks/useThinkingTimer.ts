import { useEffect, useRef, useState } from 'react';

interface ThinkingTimerState {
  seconds: number;
  isRunning: boolean;
  formatted: string;
}

/**
 * 思考计时器 Hook
 * 用于追踪 Claude 思考的时间
 */
export const useThinkingTimer = (isThinking: boolean): ThinkingTimerState => {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isThinking) {
      // 开始计时
      startTimeRef.current = Date.now();
      setSeconds(0);

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setSeconds(elapsed);
        }
      }, 100); // 100ms 更新一次，确保显示流畅
    } else {
      // 停止计时
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isThinking]);

  // 格式化时间显示
  const formatted = seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return {
    seconds,
    isRunning: isThinking,
    formatted,
  };
};

export default useThinkingTimer;
