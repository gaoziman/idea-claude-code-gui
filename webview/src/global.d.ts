import type { HistoryData } from './types';

declare global {
  interface Window {
    sendToJava?: (payload: string) => void;
    updateMessages?: (json: string) => void;
    updateStatus?: (status: string) => void;
    showLoading?: (show: boolean | string) => void;
    setHistoryData?: (data: HistoryData) => void;
    clearMessages?: () => void;
    addErrorMessage?: (message: string) => void;
    // 配置相关
    updateProviders?: (jsonStr: string) => void;
    updateActiveProvider?: (jsonStr: string) => void;
    showError?: (message: string) => void;
    updateUsageStatistics?: (jsonStr: string) => void;
    // 图片相关
    onImageSaved?: (imageId: string, filePath: string) => void;
    // 搜索相关
    onSearchResults?: (jsonStr: string) => void;
    // 拖拽文件相关
    onDroppedFileResolved?: (jsonStr: string) => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
  }
}

export {};

