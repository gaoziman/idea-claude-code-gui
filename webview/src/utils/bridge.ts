const BRIDGE_UNAVAILABLE_WARNED = new Set<string>();

const callBridge = (payload: string) => {
  if (window.sendToJava) {
    window.sendToJava(payload);
    return true;
  }
  if (!BRIDGE_UNAVAILABLE_WARNED.has(payload)) {
    console.warn('[Claude Bridge] sendToJava not available. payload=', payload);
    BRIDGE_UNAVAILABLE_WARNED.add(payload);
  }
  return false;
};

export const sendBridgeEvent = (event: string, content = '') => {
  callBridge(`${event}:${content}`);
};

export const openFile = (filePath?: string) => {
  if (!filePath) {
    return;
  }
  sendBridgeEvent('open_file', filePath);
};

export const openBrowser = (url?: string) => {
  if (!url) {
    return;
  }
  sendBridgeEvent('open_browser', url);
};

/**
 * 将代码插入到 IDEA 编辑器光标处
 * @param code 要插入的代码
 * @param language 代码语言（可选，用于格式化）
 */
export const insertCodeAtCursor = (code: string, language?: string) => {
  if (!code) {
    return;
  }
  const payload = JSON.stringify({ code, language: language || '' });
  sendBridgeEvent('insert_at_cursor', payload);
};

/**
 * 将代码添加到新文件
 * @param code 代码内容
 * @param language 代码语言（用于确定文件扩展名）
 */
export const addCodeToNewFile = (code: string, language?: string) => {
  if (!code) {
    return;
  }
  const payload = JSON.stringify({ code, language: language || '' });
  sendBridgeEvent('add_to_new_file', payload);
};

