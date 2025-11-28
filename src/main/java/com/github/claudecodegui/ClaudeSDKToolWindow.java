package com.github.claudecodegui;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowFactory;
import com.intellij.ui.content.Content;
import com.intellij.ui.content.ContentFactory;
import com.intellij.ui.jcef.JBCefBrowser;
import com.intellij.ui.jcef.JBCefJSQuery;
import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.handler.CefLoadHandlerAdapter;
import org.jetbrains.annotations.NotNull;
import com.intellij.ide.BrowserUtil;
import com.intellij.openapi.fileEditor.FileEditorManager;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.openapi.vfs.LocalFileSystem;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.command.WriteCommandAction;
import com.intellij.openapi.fileEditor.FileEditor;
import com.intellij.openapi.fileEditor.TextEditor;
import com.intellij.ide.scratch.ScratchFileService;
import com.intellij.ide.scratch.ScratchRootType;
import com.intellij.lang.Language;
import com.intellij.openapi.fileTypes.PlainTextLanguage;
import com.github.claudecodegui.permission.PermissionDialog;
import com.github.claudecodegui.permission.PermissionRequest;
import com.github.claudecodegui.permission.PermissionService;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import javax.swing.*;
import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.dnd.*;
import java.util.List;
import java.io.File;
import java.util.concurrent.CompletableFuture;

/**
 * Claude SDK 聊天工具窗口
 */
public class ClaudeSDKToolWindow implements ToolWindowFactory {

    @Override
    public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow toolWindow) {
        ClaudeChatWindow chatWindow = new ClaudeChatWindow(project);
        ContentFactory contentFactory = ContentFactory.getInstance();
        Content content = contentFactory.createContent(
            chatWindow.getContent(),
            "Claude Claude",
            false
        );
        toolWindow.getContentManager().addContent(content);
    }

    /**
     * 聊天窗口内部类
     */
    private static class ClaudeChatWindow {
        private final JPanel mainPanel;
        private final ClaudeSDKBridge sdkBridge;
        private final Project project;
        private JBCefBrowser browser;
        private ClaudeSession session; // 添加 Session 管理
        private ToolInterceptor toolInterceptor; // 工具拦截器
        private CCSwitchSettingsService settingsService; // 配置服务
        private ProjectSearchService searchService; // 项目搜索服务
        private ClaudeConfigReader configReader; // MCP 配置读取器

        public ClaudeChatWindow(Project project) {
            this.project = project;
            this.sdkBridge = new ClaudeSDKBridge();
            this.session = new ClaudeSession(sdkBridge); // 创建新会话
            this.toolInterceptor = new ToolInterceptor(project); // 创建工具拦截器
            this.settingsService = new CCSwitchSettingsService(); // 创建配置服务
            this.searchService = new ProjectSearchService(project); // 创建搜索服务
            this.configReader = new ClaudeConfigReader(); // 创建 MCP 配置读取器
            try {
                this.settingsService.applyActiveProviderToClaudeSettings();
            } catch (Exception e) {
                System.err.println("[ClaudeChatWindow] Failed to sync active provider on startup: " + e.getMessage());
            }
            this.mainPanel = new JPanel(new BorderLayout());

            // 启动权限服务
            PermissionService permissionService = PermissionService.getInstance(project);
            permissionService.start();
            permissionService.setDecisionListener(decision -> {
                if (decision != null &&
                    decision.getResponse() == PermissionService.PermissionResponse.DENY) {
                    interruptDueToPermissionDenial();
                }
            });
            System.out.println("[ClaudeChatWindow] Started permission service");

            // 先设置回调，再初始化会话信息
            setupSessionCallbacks();

            // 初始化会话，确保 cwd 正确设置
            String workingDirectory = determineWorkingDirectory();
            // sessionId 设置为 null，让 SDK 自动生成
            // cwd 设置为合适的工作目录
            this.session.setSessionInfo(null, workingDirectory);
            System.out.println("[ClaudeChatWindow] Initialized with working directory: " + workingDirectory);

            createUIComponents();
            registerSessionLoadListener(); // 注册会话加载监听器
        }

        private void createUIComponents() {
            // 首先检查环境
            if (!sdkBridge.checkEnvironment()) {
                showErrorPanel("环境检查失败",
                    "无法找到 Node.js 或 claude-bridge 目录。\n\n" +
                    "请确保:\n" +
                    "1. Node.js 已安装 (运行: node --version)\n" +
                    "2. claude-bridge 目录存在\n" +
                    "3. 已运行: cd claude-bridge && npm install\n\n" +
                    "Node.js 路径: " + sdkBridge.getNodeExecutable());
                return;
            }

            try {
                browser = new JBCefBrowser();

                // 创建 JavaScript 桥接
                JBCefJSQuery jsQuery = JBCefJSQuery.create((JBCefBrowser) browser);

                // 处理来自 JavaScript 的消息
                jsQuery.addHandler((msg) -> {
                    handleJavaScriptMessage(msg);
                    return new JBCefJSQuery.Response("ok");
                });

                // 生成 HTML 内容
                String htmlContent = generateChatHTML(jsQuery);

                // 加载完成后注入 Java 桥接函数
                browser.getJBCefClient().addLoadHandler(new CefLoadHandlerAdapter() {
                    @Override
                    public void onLoadEnd(CefBrowser browser, CefFrame frame, int httpStatusCode) {
                        // 注入 Java 调用函数
                        String injection = "window.sendToJava = function(msg) { " +
                            jsQuery.inject("msg") +
                            " };";
                        browser.executeJavaScript(injection, browser.getURL(), 0);
                    }
                }, browser.getCefBrowser());

                // 加载 HTML
                browser.loadHTML(htmlContent);

                // 添加拖拽支持
                setupDropTarget(browser.getComponent());

                mainPanel.add(browser.getComponent(), BorderLayout.CENTER);

            } catch (Exception e) {
                // 备用显示
                e.printStackTrace();
                showErrorPanel("无法加载聊天界面",
                    e.getMessage() + "\n\n" +
                    "请确保:\n" +
                    "1. Node.js 已安装 (运行: node --version)\n" +
                    "2. claude-bridge 目录存在\n" +
                    "3. 已运行: cd claude-bridge && npm install\n\n" +
                    "检测到的 Node.js 路径: " + sdkBridge.getNodeExecutable());
            }
        }

        /**
         * 显示错误面板
         */
        private void showErrorPanel(String title, String message) {
            JPanel errorPanel = new JPanel(new BorderLayout());
            errorPanel.setBackground(new Color(30, 30, 30));

            JLabel titleLabel = new JLabel(title);
            titleLabel.setFont(new Font("SansSerif", Font.BOLD, 16));
            titleLabel.setForeground(Color.WHITE);
            titleLabel.setBorder(BorderFactory.createEmptyBorder(20, 20, 10, 20));

            JTextArea textArea = new JTextArea(message);
            textArea.setEditable(false);
            textArea.setFont(new Font("Monospaced", Font.PLAIN, 12));
            textArea.setBackground(new Color(40, 40, 40));
            textArea.setForeground(new Color(220, 220, 220));
            textArea.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
            textArea.setLineWrap(true);
            textArea.setWrapStyleWord(true);

            errorPanel.add(titleLabel, BorderLayout.NORTH);
            errorPanel.add(new JScrollPane(textArea), BorderLayout.CENTER);

            mainPanel.add(errorPanel, BorderLayout.CENTER);
        }

        /**
         * 处理来自 JavaScript 的消息
         */
        private void handleJavaScriptMessage(String message) {
            System.out.println("[Backend] ========== 收到 JS 消息 ==========");
            System.out.println("[Backend] 原始消息: " + message);

            // 解析消息（简单的格式：type:content）
            String[] parts = message.split(":", 2);
            if (parts.length < 1) {
                System.err.println("[Backend] 错误: 消息格式无效");
                return;
            }

            String type = parts[0];
            String content = parts.length > 1 ? parts[1] : "";
            System.out.println("[Backend] 消息类型: '" + type + "'");
            System.out.println("[Backend] 消息内容: '" + content + "'");

            switch (type) {
                case "send_message":
                    System.out.println("[Backend] 处理: send_message");
                    sendMessageToClaude(content);
                    break;

                case "interrupt_session":
                    System.out.println("[Backend] 处理: interrupt_session");
                    session.interrupt().thenRun(() -> {
                        SwingUtilities.invokeLater(() -> {
                            callJavaScript("updateStatus", escapeJs("会话已中断"));
                        });
                    });
                    break;

                case "restart_session":
                    System.out.println("[Backend] 处理: restart_session");
                    session.restart().thenRun(() -> {
                        SwingUtilities.invokeLater(() -> {
                            callJavaScript("updateStatus", escapeJs("会话已重启"));
                        });
                    });
                    break;

                case "create_new_session":
                    System.out.println("[Backend] 处理: create_new_session");
                    createNewSession();
                    break;

                case "open_file":
                    System.out.println("[Backend] 处理: open_file");
                    openFileInEditor(content);
                    break;

                case "open_browser":
                    System.out.println("[Backend] 处理: open_browser");
                    openBrowser(content);
                    break;

                case "permission_decision":
                    System.out.println("[Backend] 处理: permission_decision");
                    handlePermissionDecision(content);
                    break;

                case "load_history_data":
                    System.out.println("[Backend] 处理: load_history_data");
                    loadAndInjectHistoryData();
                    break;

                case "load_session":
                    System.out.println("[Backend] 处理: load_session");
                    loadHistorySession(content, project.getBasePath());
                    break;

                case "get_providers":
                    System.out.println("[Backend] 处理: get_providers");
                    handleGetProviders();
                    break;

                case "add_provider":
                    System.out.println("[Backend] 处理: add_provider");
                    handleAddProvider(content);
                    break;

                case "update_provider":
                    System.out.println("[Backend] 处理: update_provider");
                    handleUpdateProvider(content);
                    break;

                case "delete_provider":
                    System.out.println("[Backend] 处理: delete_provider");
                    handleDeleteProvider(content);
                    break;

                case "switch_provider":
                    System.out.println("[Backend] 处理: switch_provider");
                    handleSwitchProvider(content);
                    break;

                case "get_active_provider":
                    System.out.println("[Backend] 处理: get_active_provider");
                    handleGetActiveProvider();
                    break;

                case "get_usage_statistics":
                    System.out.println("[Backend] 处理: get_usage_statistics");
                    handleGetUsageStatistics(content);
                    break;

                case "change_permission_mode":
                    System.out.println("[Backend] 处理: change_permission_mode - " + content);
                    handleChangePermissionMode(content);
                    break;

                case "change_model":
                    System.out.println("[Backend] 处理: change_model - " + content);
                    handleChangeModel(content);
                    break;

                case "save_clipboard_image":
                    System.out.println("[Backend] 处理: save_clipboard_image");
                    handleSaveClipboardImage(content);
                    break;

                case "search_project":
                    System.out.println("[Backend] 处理: search_project");
                    handleSearchProject(content);
                    break;

                case "insert_at_cursor":
                    System.out.println("[Backend] 处理: insert_at_cursor");
                    handleInsertAtCursor(content);
                    break;

                case "add_to_new_file":
                    System.out.println("[Backend] 处理: add_to_new_file");
                    handleAddToNewFile(content);
                    break;

                case "resolve_dropped_file":
                    System.out.println("[Backend] 处理: resolve_dropped_file - " + content);
                    handleResolveDroppedFile(content);
                    break;

                case "execute_slash_command":
                    System.out.println("[Backend] 处理: execute_slash_command");
                    handleExecuteSlashCommand(content);
                    break;

                case "load_user_commands":
                    System.out.println("[Backend] 处理: load_user_commands");
                    handleLoadUserCommands();
                    break;

                case "get_mcp_servers":
                    System.out.println("[Backend] 处理: get_mcp_servers");
                    handleGetMCPServers();
                    break;

                case "toggle_mcp_server":
                    System.out.println("[Backend] 处理: toggle_mcp_server");
                    handleToggleMCPServer(content);
                    break;

                default:
                    System.err.println("[Backend] 警告: 未知的消息类型: " + type);
            }
            System.out.println("[Backend] ========== 消息处理完成 ==========");
        }

        /**
         * 注册会话加载监听器
         */
        private void registerSessionLoadListener() {
            SessionLoadService.getInstance().setListener((sessionId, projectPath) -> {
                SwingUtilities.invokeLater(() -> {
                    loadHistorySession(sessionId, projectPath);
                });
            });
        }

        /**
         * 确定合适的工作目录
         * 优先级：
         * 1. 项目根目录（确保 Claude 能访问整个项目）
         * 2. 用户主目录（作为最后回退）
         *
         * 注意：不再使用当前打开文件的目录，因为那会导致 Glob 等工具无法搜索整个项目
         */
        private String determineWorkingDirectory() {
            // 1. 优先使用项目根目录（确保 Claude 能访问整个项目结构）
            String projectPath = project.getBasePath();
            if (projectPath != null && new File(projectPath).exists()) {
                System.out.println("[ClaudeChatWindow] Using project base path: " + projectPath);
                return projectPath;
            }

            // 2. 最后使用用户主目录
            String userHome = System.getProperty("user.home");
            System.out.println("[ClaudeChatWindow] WARNING: Using user home directory as fallback: " + userHome);
            System.out.println("[ClaudeChatWindow] Files will be written to: " + userHome);

            // 显示警告
            SwingUtilities.invokeLater(() -> {
                callJavaScript("updateStatus", escapeJs("警告: 工作目录设置为 " + userHome));
            });

            return userHome;
        }

        /**
         * 加载并注入历史数据到前端
         */
        private void loadAndInjectHistoryData() {
            System.out.println("[Backend] ========== 开始加载历史数据 ==========");

            try {
                String projectPath = project.getBasePath();
                System.out.println("[Backend] 项目路径: " + projectPath);

                ClaudeHistoryReader historyReader = new ClaudeHistoryReader();
                System.out.println("[Backend] 创建 ClaudeHistoryReader 成功");

                String historyJson = historyReader.getProjectDataAsJson(projectPath);
                System.out.println("[Backend] 读取历史数据成功");
                System.out.println("[Backend] JSON 长度: " + historyJson.length());
                System.out.println("[Backend] JSON 预览 (前200字符): " + historyJson.substring(0, Math.min(200, historyJson.length())));

                // 转义 JSON 字符串
                String escapedJson = escapeJs(historyJson);
                System.out.println("[Backend] JSON 转义成功，转义后长度: " + escapedJson.length());

                // 调用 JavaScript 函数设置历史数据
                SwingUtilities.invokeLater(() -> {
                    System.out.println("[Backend] 准备执行 JavaScript 注入...");
                    String jsCode = "console.log('[Backend->Frontend] Starting to inject history data');" +
                        "if (window.setHistoryData) { " +
                        "  console.log('[Backend->Frontend] setHistoryData is available'); " +
                        "  try { " +
                        "    var jsonStr = '" + escapedJson + "'; " +
                        "    console.log('[Backend->Frontend] JSON string length:', jsonStr.length); " +
                        "    var data = JSON.parse(jsonStr); " +
                        "    console.log('[Backend->Frontend] JSON parsed successfully:', data); " +
                        "    window.setHistoryData(data); " +
                        "    console.log('[Backend->Frontend] setHistoryData called'); " +
                        "  } catch(e) { " +
                        "    console.error('[Backend->Frontend] Failed to parse/set history data:', e); " +
                        "    console.error('[Backend->Frontend] Error message:', e.message); " +
                        "    console.error('[Backend->Frontend] Error stack:', e.stack); " +
                        "    window.setHistoryData({ success: false, error: '解析历史数据失败: ' + e.message }); " +
                        "  } " +
                        "} else { " +
                        "  console.error('[Backend->Frontend] setHistoryData not available!'); " +
                        "  console.log('[Backend->Frontend] Available window properties:', Object.keys(window).filter(k => k.includes('set') || k.includes('History'))); " +
                        "}";

                    System.out.println("[Backend] 执行 JavaScript 代码");
                    browser.getCefBrowser().executeJavaScript(jsCode, browser.getCefBrowser().getURL(), 0);
                    System.out.println("[Backend] JavaScript 代码已提交执行");
                });

            } catch (Exception e) {
                System.err.println("[Backend] ❌ 加载历史数据失败!");
                System.err.println("[Backend] 错误信息: " + e.getMessage());
                System.err.println("[Backend] 错误堆栈:");
                e.printStackTrace();

                // 发送错误信息到前端
                SwingUtilities.invokeLater(() -> {
                    String errorMsg = escapeJs(e.getMessage() != null ? e.getMessage() : "未知错误");
                    String jsCode = "console.error('[Backend->Frontend] Error from backend:', '" + errorMsg + "'); " +
                        "if (window.setHistoryData) { " +
                        "  window.setHistoryData({ success: false, error: '" + errorMsg + "' }); " +
                        "} else { " +
                        "  console.error('[Backend->Frontend] Cannot report error - setHistoryData not available'); " +
                        "}";
                    browser.getCefBrowser().executeJavaScript(jsCode, browser.getCefBrowser().getURL(), 0);
                });
            }

            System.out.println("[Backend] ========== 历史数据加载流程结束 ==========");
        }

        /**
         * 加载历史会话
         */
        private void loadHistorySession(String sessionId, String projectPath) {
            System.out.println("Loading history session: " + sessionId + " from project: " + projectPath);

            // 清空当前消息
            callJavaScript("clearMessages");

            // 更新状态
            callJavaScript("updateStatus", escapeJs("正在加载历史会话..."));

            // 创建新的 Session 并设置会话信息
            session = new ClaudeSession(sdkBridge);
            setupSessionCallbacks();

            // 如果历史会话没有projectPath或无效，使用智能方法确定
            String workingDir = projectPath;
            if (workingDir == null || !new File(workingDir).exists()) {
                workingDir = determineWorkingDirectory();
                System.out.println("[ClaudeChatWindow] Historical projectPath invalid, using: " + workingDir);
            }
            session.setSessionInfo(sessionId, workingDir);

            // 从服务器加载会话消息
            session.loadFromServer().thenRun(() -> {
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("updateStatus", escapeJs("会话已加载，可以继续提问"));
                });
            }).exceptionally(ex -> {
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("addErrorMessage", escapeJs("加载会话失败: " + ex.getMessage()));
                    callJavaScript("updateStatus", escapeJs("加载失败"));
                });
                return null;
            });
        }

        /**
         * 设置会话回调
         */
        private void setupSessionCallbacks() {
            session.setCallback(new ClaudeSession.SessionCallback() {
                @Override
                public void onMessageUpdate(List<ClaudeSession.Message> messages) {
                    System.out.println("[ClaudeChatWindow] onMessageUpdate called with " + messages.size() + " messages");
                    SwingUtilities.invokeLater(() -> {
                        // 将消息列表转换为 JSON
                        com.google.gson.Gson gson = new com.google.gson.Gson();
                        com.google.gson.JsonArray messagesArray = new com.google.gson.JsonArray();

                        for (ClaudeSession.Message msg : messages) {
                            com.google.gson.JsonObject msgObj = new com.google.gson.JsonObject();
                            msgObj.addProperty("type", msg.type.toString().toLowerCase());
                            msgObj.addProperty("timestamp", msg.timestamp);

                            // 始终传递 content 作为 fallback
                            msgObj.addProperty("content", msg.content != null ? msg.content : "");

                            // 如果有原始数据，也传递它
                            if (msg.raw != null) {
                                msgObj.add("raw", msg.raw);
                            }

                            messagesArray.add(msgObj);
                            System.out.println("[ClaudeChatWindow] Message: type=" + msg.type +
                                ", content.length=" + (msg.content != null ? msg.content.length() : 0) +
                                ", hasRaw=" + (msg.raw != null));

                            // 特别打印 user 消息的 raw 结构用于调试
                            if (msg.type == ClaudeSession.Message.Type.USER && msg.raw != null) {
                                System.out.println("[ClaudeChatWindow] USER raw keys: " + msg.raw.keySet());
                                if (msg.raw.has("message")) {
                                    com.google.gson.JsonElement msgElem = msg.raw.get("message");
                                    System.out.println("[ClaudeChatWindow] raw.message type: " + (msgElem.isJsonObject() ? "object" : "other"));
                                    if (msgElem.isJsonObject()) {
                                        com.google.gson.JsonObject innerMsg = msgElem.getAsJsonObject();
                                        System.out.println("[ClaudeChatWindow] raw.message keys: " + innerMsg.keySet());
                                    }
                                }
                            }
                        }

                        String messagesJson = gson.toJson(messagesArray);
                        String escapedJson = escapeJs(messagesJson);

                        // 调用 JavaScript 更新消息
                        callJavaScript("updateMessages", escapedJson);
                    });
                }

                @Override
                public void onStateChange(boolean busy, boolean loading, String error) {
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("showLoading", String.valueOf(busy));

                        if (error != null) {
                            callJavaScript("updateStatus", escapeJs("错误: " + error));
                        } else if (busy) {
                            callJavaScript("updateStatus", escapeJs("正在处理..."));
                        } else if (loading) {
                            callJavaScript("updateStatus", escapeJs("加载中..."));
                        } else {
                            callJavaScript("updateStatus", escapeJs("就绪"));
                        }
                    });
                }

                @Override
                public void onSessionIdReceived(String sessionId) {
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("会话 ID: " + sessionId));
                        System.out.println("Session ID: " + sessionId);
                    });
                }

                @Override
                public void onPermissionRequested(PermissionRequest request) {
                    SwingUtilities.invokeLater(() -> {
                        showPermissionDialog(request);
                    });
                }
            });
        }

        /**
         * 创建新会话
         */
        private void createNewSession() {
            System.out.println("Creating new session...");

            // 更新状态
            callJavaScript("updateStatus", escapeJs("正在创建新会话..."));

            // 创建新的 Session 实例（不设置 sessionId，让 SDK 自动生成）
            session = new ClaudeSession(sdkBridge);
            setupSessionCallbacks();

            // 智能确定工作目录
            String workingDirectory = determineWorkingDirectory();
            session.setSessionInfo(null, workingDirectory);  // sessionId 为 null 表示新会话
            System.out.println("New session created with cwd: " + workingDirectory);

            // 在UI中显示当前工作目录
            callJavaScript("updateStatus", escapeJs("工作目录: " + workingDirectory));

            // 更新 UI
            SwingUtilities.invokeLater(() -> {
                callJavaScript("updateStatus", escapeJs("新会话已创建，可以开始提问"));
            });
        }

        /**
         * 发送消息到 Claude（使用 Session）
         */
        private void sendMessageToClaude(String prompt) {
            // 将整个处理过程移到后台线程，避免 EDT 死锁
            CompletableFuture.runAsync(() -> {
                // 每次发送消息前，动态更新工作目录（确保使用最新的当前文件目录）
                String currentWorkingDir = determineWorkingDirectory();
                String previousCwd = session.getCwd();

                // 如果工作目录变化了，更新它
                if (!currentWorkingDir.equals(previousCwd)) {
                    session.setCwd(currentWorkingDir);
                    System.out.println("[ClaudeChatWindow] Updated working directory: " + currentWorkingDir);
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("工作目录: " + currentWorkingDir));
                    });
                }

                // 权限模式由用户通过前端选择，不再强制覆盖
                // 用户选择的权限模式已通过 handleChangePermissionMode 正确设置

                // 直接发送原始消息，工作目录已经在底层正确处理
                // 不再需要关键词匹配和提示，因为ProcessBuilder和channel-manager.js已经智能处理了工作目录

                // 使用 Session 发送消息
                session.send(prompt).exceptionally(ex -> {
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("addErrorMessage", escapeJs("发送失败: " + ex.getMessage()));
                    });
                    return null;
                });
            });
        }

        private void interruptDueToPermissionDenial() {
            session.interrupt().thenRun(() -> SwingUtilities.invokeLater(() -> {
                callJavaScript("updateStatus", escapeJs("权限被拒，已中断会话"));
            }));
        }

        /**
         * 打开浏览器
         */
        private void openBrowser(String url) {
            SwingUtilities.invokeLater(() -> {
                try {
                    BrowserUtil.browse(url);
                } catch (Exception e) {
                    System.err.println("无法打开浏览器: " + e.getMessage());
                }
            });
        }

        /**
         * 在编辑器中打开文件
         */
        private void openFileInEditor(String filePath) {
            System.out.println("请求打开文件: " + filePath);

            SwingUtilities.invokeLater(() -> {
                try {
                    // 检查文件是否存在
                    File file = new File(filePath);
                    
                    // 如果文件不存在且是相对路径，尝试相对于项目根目录解析
                    if (!file.exists() && !file.isAbsolute() && project.getBasePath() != null) {
                        File projectFile = new File(project.getBasePath(), filePath);
                        System.out.println("尝试相对于项目根目录解析: " + projectFile.getAbsolutePath());
                        if (projectFile.exists()) {
                            file = projectFile;
                        }
                    }
                    
                    if (!file.exists()) {
                        System.err.println("文件不存在: " + filePath);
                        callJavaScript("addErrorMessage", escapeJs("无法打开文件: 文件不存在 (" + filePath + ")"));
                        return;
                    }

                    // 使用 LocalFileSystem 获取 VirtualFile
                    VirtualFile virtualFile = LocalFileSystem.getInstance().findFileByIoFile(file);
                    if (virtualFile == null) {
                        System.err.println("无法获取 VirtualFile: " + filePath);
                        return;
                    }

                    // 在编辑器中打开文件
                    FileEditorManager.getInstance(project).openFile(virtualFile, true);
                    System.out.println("成功打开文件: " + filePath);

                } catch (Exception e) {
                    System.err.println("打开文件失败: " + e.getMessage());
                    e.printStackTrace();
                }
            });
        }

        /**
         * 调用 JavaScript 函数
         */
        private void callJavaScript(String functionName, String... args) {
            if (browser == null) {
                System.out.println("[Backend] callJavaScript: browser is null!");
                return;
            }

            StringBuilder js = new StringBuilder();
            // 添加调试日志
            js.append("console.log('[JS] callJavaScript executing: ").append(functionName).append("'); ");
            // 使用 window. 前缀确保能访问到全局函数
            js.append("if (window.").append(functionName).append(") { ");
            js.append("console.log('[JS] Function found, calling...'); ");
            js.append("window.").append(functionName).append("(");

            for (int i = 0; i < args.length; i++) {
                if (i > 0) js.append(", ");
                js.append("'").append(args[i]).append("'");
            }

            js.append("); console.log('[JS] Function called successfully'); ");
            js.append("} else { console.error('[JS] Function not found: ").append(functionName).append("'); }");

            String jsCode = js.toString();
            System.out.println("[Backend] 执行 JS: " + jsCode.substring(0, Math.min(200, jsCode.length())) + "...");
            browser.getCefBrowser().executeJavaScript(jsCode, browser.getCefBrowser().getURL(), 0);
        }

        /**
         * 转义 JavaScript 字符串
         */
        private String escapeJs(String str) {
            return str
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
        }

        /**
         * 生成聊天界面 HTML
         */
        private String generateChatHTML(JBCefJSQuery jsQuery) {
            // 尝试从资源文件加载 HTML
            try {
                java.io.InputStream is = getClass().getResourceAsStream("/html/claude-chat.html");
                if (is != null) {
                    String html = new String(is.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    is.close();
                    
                    // 仅在旧版 HTML 中存在注入标记时才进行替换
                    if (html.contains("<!-- LOCAL_LIBRARY_INJECTION_POINT -->")) {
                        html = injectLocalLibraries(html);
                    } else {
                        System.out.println("✓ 检测到打包好的现代前端资源，无需额外注入库文件");
                    }
                    
                    return html;
                }
            } catch (Exception e) {
                System.err.println("无法加载 claude-chat.html: " + e.getMessage());
            }

            // 备用：返回简单的 HTML
            return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }

                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            background: #1e1e1e;
                            color: #cccccc;
                            height: 100vh;
                            display: flex;
                            flex-direction: column;
                        }

                        .header {
                            padding: 16px;
                            background: #252526;
                            border-bottom: 1px solid #3e3e42;
                        }

                        .header h1 {
                            font-size: 16px;
                            font-weight: 600;
                            margin-bottom: 4px;
                        }

                        .header .status {
                            font-size: 12px;
                            color: #858585;
                        }

                        .messages {
                            flex: 1;
                            overflow-y: auto;
                            padding: 16px;
                        }

                        .message {
                            margin-bottom: 16px;
                            padding: 12px;
                            border-radius: 8px;
                            max-width: 80%;
                            word-wrap: break-word;
                        }

                        .message.user {
                            background: #2d5a8c;
                            margin-left: auto;
                            text-align: right;
                        }

                        .message.assistant {
                            background: #2d2d2d;
                        }

                        .message.error {
                            background: #5a1d1d;
                            color: #f48771;
                        }

                        .message .role {
                            font-size: 11px;
                            opacity: 0.7;
                            margin-bottom: 4px;
                            text-transform: uppercase;
                        }

                        .loading {
                            display: none;
                            padding: 12px;
                            text-align: center;
                            color: #858585;
                        }

                        .loading.show {
                            display: block;
                        }

                        .loading::after {
                            content: '...';
                            animation: dots 1.5s steps(4, end) infinite;
                        }

                        @keyframes dots {
                            0%, 20% { content: '.'; }
                            40% { content: '..'; }
                            60%, 100% { content: '...'; }
                        }

                        .input-area {
                            padding: 16px;
                            background: #252526;
                            border-top: 1px solid #3e3e42;
                        }

                        .input-container {
                            display: flex;
                            gap: 8px;
                        }

                        #messageInput {
                            flex: 1;
                            padding: 10px 12px;
                            background: #3c3c3c;
                            border: 1px solid #555;
                            border-radius: 4px;
                            color: #cccccc;
                            font-size: 14px;
                            resize: none;
                            font-family: inherit;
                        }

                        #messageInput:focus {
                            outline: none;
                            border-color: #4a90e2;
                        }

                        #sendButton {
                            padding: 10px 20px;
                            background: #4a90e2;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            font-size: 14px;
                            cursor: pointer;
                            font-weight: 500;
                        }

                        #sendButton:hover {
                            background: #5a9ee8;
                        }

                        #sendButton:active {
                            background: #3a80d2;
                        }

                        #sendButton:disabled {
                            background: #555;
                            cursor: not-allowed;
                        }

                        ::-webkit-scrollbar {
                            width: 8px;
                        }

                        ::-webkit-scrollbar-track {
                            background: #1e1e1e;
                        }

                        ::-webkit-scrollbar-thumb {
                            background: #424242;
                            border-radius: 4px;
                        }

                        ::-webkit-scrollbar-thumb:hover {
                            background: #4f4f4f;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <h1>Claude Code GUI</h1>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="interruptSession()" style="padding: 4px 12px; background: #5a5a5a; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">⏸ 中断</button>
                                <button onclick="restartSession()" style="padding: 4px 12px; background: #5a5a5a; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">🔄 重启</button>
                            </div>
                        </div>
                        <div class="status" id="status">就绪</div>
                    </div>

                    <div class="messages" id="messages">
                    </div>

                    <div class="loading" id="loading">Claude 正在思考</div>

                    <div class="input-area">
                        <div class="input-container">
                            <textarea
                                id="messageInput"
                                placeholder="输入消息... (Shift+Enter 换行, Enter 发送)"
                                rows="1"
                            ></textarea>
                            <button id="sendButton" onclick="sendMessage()">发送</button>
                        </div>
                    </div>

                    <script>
                        const messagesDiv = document.getElementById('messages');
                        const messageInput = document.getElementById('messageInput');
                        const sendButton = document.getElementById('sendButton');
                        const loadingDiv = document.getElementById('loading');
                        const statusDiv = document.getElementById('status');

                        // 更新消息列表
                        function updateMessages(messagesJson) {
                            const messages = JSON.parse(messagesJson);
                            messagesDiv.innerHTML = '';

                            messages.forEach(msg => {
                                if (msg.type === 'user') {
                                    addUserMessage(msg.content);
                                } else if (msg.type === 'assistant') {
                                    addAssistantMessage(msg.content);
                                } else if (msg.type === 'error') {
                                    addErrorMessage(msg.content);
                                }
                            });
                            scrollToBottom();
                        }

                        // 发送消息
                        function sendMessage() {
                            const message = messageInput.value.trim();
                            if (!message) return;

                            // 通过桥接发送到 Java
                            window.sendToJava('send_message:' + message);

                            // 清空输入框
                            messageInput.value = '';
                            messageInput.style.height = 'auto';
                        }

                        // 添加用户消息
                        function addUserMessage(text) {
                            const msgDiv = document.createElement('div');
                            msgDiv.className = 'message user';
                            msgDiv.innerHTML = '<div class="role">You</div><div>' + text + '</div>';
                            messagesDiv.appendChild(msgDiv);
                            scrollToBottom();
                        }

                        // 添加助手消息
                        function addAssistantMessage(text) {
                            const msgDiv = document.createElement('div');
                            msgDiv.className = 'message assistant';
                            msgDiv.innerHTML = '<div class="role">Assistant</div><div>' + text + '</div>';
                            messagesDiv.appendChild(msgDiv);
                            scrollToBottom();
                        }

                        // 添加错误消息
                        function addErrorMessage(text) {
                            const msgDiv = document.createElement('div');
                            msgDiv.className = 'message error';
                            msgDiv.innerHTML = '<div class="role">Error</div><div>' + text + '</div>';
                            messagesDiv.appendChild(msgDiv);
                            scrollToBottom();
                        }

                        // 显示/隐藏加载状态
                        function showLoading(show) {
                            if (show === 'true') {
                                loadingDiv.classList.add('show');
                                sendButton.disabled = true;
                            } else {
                                loadingDiv.classList.remove('show');
                                sendButton.disabled = false;
                            }
                        }

                        // 更新状态
                        function updateStatus(text) {
                            statusDiv.textContent = text;
                        }

                        // 滚动到底部
                        function scrollToBottom() {
                            messagesDiv.scrollTop = messagesDiv.scrollHeight;
                        }

                        // 清空所有消息
                        function clearMessages() {
                            messagesDiv.innerHTML = '';
                        }

                        // 中断会话
                        function interruptSession() {
                            window.sendToJava('interrupt_session:');
                            updateStatus('已发送中断请求');
                        }

                        // 重启会话
                        function restartSession() {
                            if (confirm('确定要重启会话吗？这将清空当前对话历史。')) {
                                window.sendToJava('restart_session:');
                                clearMessages();
                                updateStatus('正在重启会话...');
                            }
                        }

                        // 处理键盘事件
                        messageInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        });

                        // 自动调整输入框高度
                        messageInput.addEventListener('input', function() {
                            this.style.height = 'auto';
                            this.style.height = (this.scrollHeight) + 'px';
                        });
                    </script>
                </body>
                </html>
                """;
        }

        /**
         * 显示权限请求对话框
         */
        private void showPermissionDialog(PermissionRequest request) {
            System.out.println("显示权限请求对话框: " + request.getToolName());

            PermissionDialog dialog = new PermissionDialog(project, request);
            dialog.setDecisionCallback(decision -> {
                // 处理权限决策
                session.handlePermissionDecision(
                    decision.channelId,
                    decision.allow,
                    decision.remember,
                    decision.rejectMessage
                );
                if (!decision.allow) {
                    interruptDueToPermissionDenial();
                }
            });
            dialog.show();
        }

        /**
         * 处理来自JavaScript的权限决策消息
         */
        private void handlePermissionDecision(String jsonContent) {
            try {
                Gson gson = new Gson();
                JsonObject decision = gson.fromJson(jsonContent, JsonObject.class);

                String channelId = decision.get("channelId").getAsString();
                boolean allow = decision.get("allow").getAsBoolean();
                boolean remember = decision.get("remember").getAsBoolean();
                String rejectMessage = decision.has("rejectMessage") ?
                    decision.get("rejectMessage").getAsString() : "";

                session.handlePermissionDecision(channelId, allow, remember, rejectMessage);
                if (!allow) {
                    interruptDueToPermissionDenial();
                }
            } catch (Exception e) {
                System.err.println("处理权限决策失败: " + e.getMessage());
                e.printStackTrace();
            }
        }

        /**
         * 将本地库文件内容注入到 HTML 中
         */
        private String injectLocalLibraries(String html) {
            try {
                // 读取本地库文件
                String reactJs = loadResourceAsString("/libs/react.production.min.js");
                String reactDomJs = loadResourceAsString("/libs/react-dom.production.min.js");
                String babelJs = loadResourceAsString("/libs/babel.min.js");
                String markedJs = loadResourceAsString("/libs/marked.min.js");
                String codiconCss = loadResourceAsString("/libs/codicon.css");
                
                // 将字体文件转换为 base64 并嵌入到 CSS 中
                String fontBase64 = loadResourceAsBase64("/libs/codicon.ttf");
                codiconCss = codiconCss.replaceAll(
                    "url\\(\"\\./codicon\\.ttf\\?[^\"]*\"\\)",
                    "url(\"data:font/truetype;base64," + fontBase64 + "\")"
                );
                
                // 构建要注入的库内容
                StringBuilder injectedLibs = new StringBuilder();
                injectedLibs.append("\n    <!-- React 和相关库 (本地版本) -->\n");
                injectedLibs.append("    <script>/* React 18 */\n").append(reactJs).append("\n    </script>\n");
                injectedLibs.append("    <script>/* ReactDOM 18 */\n").append(reactDomJs).append("\n    </script>\n");
                injectedLibs.append("    <script>/* Babel Standalone */\n").append(babelJs).append("\n    </script>\n");
                injectedLibs.append("    <script>/* Marked */\n").append(markedJs).append("\n    </script>\n");
                injectedLibs.append("    <style>/* VS Code Codicons (含内嵌字体) */\n").append(codiconCss).append("\n    </style>");
                
                // 在标记位置注入库文件
                html = html.replace("<!-- LOCAL_LIBRARY_INJECTION_POINT -->", injectedLibs.toString());
                
                System.out.println("✓ 成功注入本地库文件 (React + ReactDOM + Babel + Codicons)");
            } catch (Exception e) {
                System.err.println("✗ 注入本地库文件失败: " + e.getMessage());
                e.printStackTrace();
                // 如果注入失败，HTML 保持原样（但没有库文件，可能无法正常工作）
            }
            
            return html;
        }
        
        /**
         * 从资源文件中读取内容为字符串
         */
        private String loadResourceAsString(String resourcePath) throws Exception {
            java.io.InputStream is = getClass().getResourceAsStream(resourcePath);
            if (is == null) {
                throw new Exception("无法找到资源: " + resourcePath);
            }
            String content = new String(is.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            is.close();
            return content;
        }
        
        /**
         * 从资源文件中读取内容并转换为 base64
         */
        private String loadResourceAsBase64(String resourcePath) throws Exception {
            java.io.InputStream is = getClass().getResourceAsStream(resourcePath);
            if (is == null) {
                throw new Exception("无法找到资源: " + resourcePath);
            }
            byte[] bytes = is.readAllBytes();
            is.close();
            return java.util.Base64.getEncoder().encodeToString(bytes);
        }

        /**
         * 获取所有供应商
         */
        private void handleGetProviders() {
            try {
                List<JsonObject> providers = settingsService.getClaudeProviders();
                Gson gson = new Gson();
                String providersJson = gson.toJson(providers);

                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.updateProviders", escapeJs(providersJson));
                });
            } catch (Exception e) {
                System.err.println("[Backend] Failed to get providers: " + e.getMessage());
                e.printStackTrace();
            }
        }

        /**
         * 添加供应商
         */
        private void handleAddProvider(String content) {
            try {
                Gson gson = new Gson();
                JsonObject provider = gson.fromJson(content, JsonObject.class);
                settingsService.addClaudeProvider(provider);

                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.updateStatus", escapeJs("供应商添加成功"));
                    handleGetProviders(); // 刷新列表
                });
            } catch (Exception e) {
                System.err.println("[Backend] Failed to add provider: " + e.getMessage());
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.showError", escapeJs("添加供应商失败: " + e.getMessage()));
                });
            }
        }

        /**
         * 更新供应商
         */
        private void handleUpdateProvider(String content) {
            try {
                Gson gson = new Gson();
                JsonObject data = gson.fromJson(content, JsonObject.class);
                String id = data.get("id").getAsString();
                JsonObject updates = data.getAsJsonObject("updates");

                settingsService.updateClaudeProvider(id, updates);

                boolean syncedActiveProvider = false;
                JsonObject activeProvider = settingsService.getActiveClaudeProvider();
                if (activeProvider != null &&
                    activeProvider.has("id") &&
                    id.equals(activeProvider.get("id").getAsString())) {
                    settingsService.applyProviderToClaudeSettings(activeProvider);
                    syncedActiveProvider = true;
                }

                final boolean finalSynced = syncedActiveProvider;
                SwingUtilities.invokeLater(() -> {
                    if (finalSynced) {
                        callJavaScript("window.updateStatus", escapeJs("供应商更新成功，已同步到 ~/.claude/settings.json"));
                    } else {
                        callJavaScript("window.updateStatus", escapeJs("供应商更新成功"));
                    }
                    handleGetProviders(); // 刷新列表
                });
            } catch (Exception e) {
                System.err.println("[Backend] Failed to update provider: " + e.getMessage());
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.showError", escapeJs("更新供应商失败: " + e.getMessage()));
                });
            }
        }

        /**
         * 删除供应商
         */
        private void handleDeleteProvider(String content) {
            try {
                Gson gson = new Gson();
                JsonObject data = gson.fromJson(content, JsonObject.class);
                String id = data.get("id").getAsString();

                settingsService.deleteClaudeProvider(id);

                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.updateStatus", escapeJs("供应商删除成功"));
                    handleGetProviders(); // 刷新列表
                });
            } catch (Exception e) {
                System.err.println("[Backend] Failed to delete provider: " + e.getMessage());
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.showError", escapeJs("删除供应商失败: " + e.getMessage()));
                });
            }
        }

        /**
         * 切换供应商
         */
        private void handleSwitchProvider(String content) {
            try {
                Gson gson = new Gson();
                JsonObject data = gson.fromJson(content, JsonObject.class);
                String id = data.get("id").getAsString();

                settingsService.switchClaudeProvider(id);
                settingsService.applyActiveProviderToClaudeSettings();

                SwingUtilities.invokeLater(() -> {
                    callJavaScript("alert", escapeJs("✅ 供应商切换成功！\n\n已自动同步到 ~/.claude/settings.json，下一次提问将使用新的配置。"));
                    callJavaScript("window.updateStatus", escapeJs("供应商切换成功，已同步到 ~/.claude/settings.json"));
                    handleGetProviders(); // 刷新列表
                });
            } catch (Exception e) {
                System.err.println("[Backend] Failed to switch provider: " + e.getMessage());
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.showError", escapeJs("切换供应商失败: " + e.getMessage()));
                });
            }
        }

        /**
         * 获取当前激活的供应商
         */
        private void handleGetActiveProvider() {
            try {
                JsonObject provider = settingsService.getActiveClaudeProvider();
                Gson gson = new Gson();
                String providerJson = gson.toJson(provider);

                SwingUtilities.invokeLater(() -> {
                    callJavaScript("window.updateActiveProvider", escapeJs(providerJson));
                });
            } catch (Exception e) {
                System.err.println("[Backend] Failed to get active provider: " + e.getMessage());
                e.printStackTrace();
            }
        }

        /**
         * 处理权限模式变更
         */
        private void handleChangePermissionMode(String mode) {
            try {
                // 验证模式值
                if (mode == null || mode.isEmpty()) {
                    System.err.println("[Backend] 无效的权限模式: 空值");
                    return;
                }

                // 支持的模式: default, acceptEdits, bypassPermissions, plan
                switch (mode) {
                    case "default":
                    case "acceptEdits":
                    case "bypassPermissions":
                    case "plan":
                        session.setPermissionMode(mode);
                        System.out.println("[Backend] 权限模式已更改为: " + mode);

                        // 更新前端状态
                        SwingUtilities.invokeLater(() -> {
                            String statusMessage = switch (mode) {
                                case "default" -> "权限模式: 默认 (每次确认)";
                                case "acceptEdits" -> "权限模式: 允许编辑";
                                case "bypassPermissions" -> "权限模式: 信任模式";
                                case "plan" -> "权限模式: 规划模式";
                                default -> "权限模式已更改";
                            };
                            callJavaScript("updateStatus", escapeJs(statusMessage));
                        });
                        break;
                    default:
                        System.err.println("[Backend] 未知的权限模式: " + mode);
                }
            } catch (Exception e) {
                System.err.println("[Backend] 处理权限模式变更失败: " + e.getMessage());
                e.printStackTrace();
            }
        }

        /**
         * 处理模型变更
         */
        private void handleChangeModel(String model) {
            try {
                // 验证模型值
                if (model == null || model.isEmpty()) {
                    System.err.println("[Backend] 无效的模型: 空值");
                    return;
                }

                // 支持的模型: sonnet, opus, haiku
                switch (model.toLowerCase()) {
                    case "sonnet":
                    case "opus":
                    case "haiku":
                        session.setModel(model.toLowerCase());
                        System.out.println("[Backend] 模型已更改为: " + model);

                        // 更新前端状态
                        SwingUtilities.invokeLater(() -> {
                            String statusMessage = switch (model.toLowerCase()) {
                                case "sonnet" -> "模型: Claude Sonnet 4.5";
                                case "opus" -> "模型: Claude Opus";
                                case "haiku" -> "模型: Claude Haiku";
                                default -> "模型已更改";
                            };
                            callJavaScript("updateStatus", escapeJs(statusMessage));
                        });
                        break;
                    default:
                        System.err.println("[Backend] 未知的模型: " + model);
                }
            } catch (Exception e) {
                System.err.println("[Backend] 处理模型变更失败: " + e.getMessage());
                e.printStackTrace();
            }
        }

        /**
         * 处理保存剪贴板图片
         */
        private void handleSaveClipboardImage(String content) {
            CompletableFuture.runAsync(() -> {
                try {
                    Gson gson = new Gson();
                    JsonObject data = gson.fromJson(content, JsonObject.class);

                    String imageId = data.get("id").getAsString();
                    String base64 = data.get("base64").getAsString();
                    String fileName = data.get("name").getAsString();

                    // 创建临时目录
                    String tempDir = System.getProperty("java.io.tmpdir");
                    File claudeImagesDir = new File(tempDir, "claude-images");
                    if (!claudeImagesDir.exists()) {
                        claudeImagesDir.mkdirs();
                    }

                    // 保存图片文件
                    File imageFile = new File(claudeImagesDir, fileName);
                    byte[] imageBytes = java.util.Base64.getDecoder().decode(base64);
                    java.nio.file.Files.write(imageFile.toPath(), imageBytes);

                    String filePath = imageFile.getAbsolutePath();
                    System.out.println("[Backend] 图片已保存: " + filePath);

                    // 回调通知前端图片保存成功
                    SwingUtilities.invokeLater(() -> {
                        String js = "if (window.onImageSaved) { window.onImageSaved('" +
                            escapeJs(imageId) + "', '" + escapeJs(filePath) + "'); }";
                        browser.getCefBrowser().executeJavaScript(js, browser.getCefBrowser().getURL(), 0);
                    });

                } catch (Exception e) {
                    System.err.println("[Backend] 保存图片失败: " + e.getMessage());
                    e.printStackTrace();
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("保存图片失败: " + e.getMessage()));
                    });
                }
            });
        }

        /**
         * 处理项目搜索请求
         */
        private void handleSearchProject(String content) {
            CompletableFuture.runAsync(() -> {
                try {
                    Gson gson = new Gson();
                    JsonObject data = gson.fromJson(content, JsonObject.class);

                    String searchType = data.has("type") ? data.get("type").getAsString() : "file";
                    String query = data.has("query") ? data.get("query").getAsString() : "";

                    System.out.println("[Backend] 搜索类型: " + searchType + ", 查询: " + query);

                    // 获取当前编辑器文件的父目录作为上下文目录
                    String contextDir = null;
                    if ("folder".equals(searchType)) {
                        VirtualFile[] selectedFiles = FileEditorManager.getInstance(project).getSelectedFiles();
                        if (selectedFiles.length > 0) {
                            VirtualFile currentFile = selectedFiles[0];
                            VirtualFile parentDir = currentFile.getParent();
                            if (parentDir != null) {
                                contextDir = parentDir.getPath();
                                System.out.println("[Backend] 当前编辑器文件: " + currentFile.getPath());
                                System.out.println("[Backend] 上下文目录: " + contextDir);
                            }
                        }
                    }

                    String resultJson = searchService.search(searchType, query, contextDir);

                    SwingUtilities.invokeLater(() -> {
                        String js = "if (window.onSearchResults) { window.onSearchResults('" +
                            escapeJs(resultJson) + "'); }";
                        browser.getCefBrowser().executeJavaScript(js, browser.getCefBrowser().getURL(), 0);
                    });

                } catch (Exception e) {
                    System.err.println("[Backend] 搜索失败: " + e.getMessage());
                    e.printStackTrace();
                    SwingUtilities.invokeLater(() -> {
                        String js = "if (window.onSearchResults) { window.onSearchResults('{\"results\":[]}'); }";
                        browser.getCefBrowser().executeJavaScript(js, browser.getCefBrowser().getURL(), 0);
                    });
                }
            });
        }

        /**
         * 处理插入代码到光标位置
         */
        private void handleInsertAtCursor(String content) {
            SwingUtilities.invokeLater(() -> {
                try {
                    Gson gson = new Gson();
                    JsonObject data = gson.fromJson(content, JsonObject.class);

                    String code = data.get("code").getAsString();

                    // 获取当前编辑器
                    FileEditor[] editors = FileEditorManager.getInstance(project).getSelectedEditors();
                    if (editors.length == 0) {
                        callJavaScript("updateStatus", escapeJs("没有打开的编辑器"));
                        return;
                    }

                    Editor editor = null;
                    for (FileEditor fe : editors) {
                        if (fe instanceof TextEditor) {
                            editor = ((TextEditor) fe).getEditor();
                            break;
                        }
                    }

                    if (editor == null) {
                        callJavaScript("updateStatus", escapeJs("当前编辑器不支持文本编辑"));
                        return;
                    }

                    // 在光标位置插入代码
                    final Editor finalEditor = editor;
                    final int offset = editor.getCaretModel().getOffset();

                    WriteCommandAction.runWriteCommandAction(project, () -> {
                        Document document = finalEditor.getDocument();
                        document.insertString(offset, code);
                    });

                    System.out.println("[Backend] 代码已插入到光标位置");
                    callJavaScript("updateStatus", escapeJs("代码已插入"));

                } catch (Exception e) {
                    System.err.println("[Backend] 插入代码失败: " + e.getMessage());
                    e.printStackTrace();
                    callJavaScript("updateStatus", escapeJs("插入代码失败: " + e.getMessage()));
                }
            });
        }

        /**
         * 处理添加代码到新文件
         */
        private void handleAddToNewFile(String content) {
            SwingUtilities.invokeLater(() -> {
                try {
                    Gson gson = new Gson();
                    JsonObject data = gson.fromJson(content, JsonObject.class);

                    String code = data.get("code").getAsString();
                    String language = data.has("language") ? data.get("language").getAsString() : "";

                    // 根据语言确定文件扩展名
                    String extension = getExtensionForLanguage(language);

                    // 创建 Scratch 文件
                    ScratchRootType rootType = ScratchRootType.getInstance();

                    String fileName = "scratch" + extension;
                    VirtualFile scratchFile = rootType.createScratchFile(
                        project,
                        fileName,
                        getLanguageForLanguageName(language),
                        code
                    );

                    if (scratchFile != null) {
                        // 打开新创建的文件
                        FileEditorManager.getInstance(project).openFile(scratchFile, true);
                        System.out.println("[Backend] 已创建新文件: " + scratchFile.getPath());
                        callJavaScript("updateStatus", escapeJs("已创建新文件"));
                    } else {
                        callJavaScript("updateStatus", escapeJs("创建文件失败"));
                    }

                } catch (Exception e) {
                    System.err.println("[Backend] 创建新文件失败: " + e.getMessage());
                    e.printStackTrace();
                    callJavaScript("updateStatus", escapeJs("创建文件失败: " + e.getMessage()));
                }
            });
        }

        /**
         * 根据语言获取文件扩展名
         */
        private String getExtensionForLanguage(String language) {
            if (language == null || language.isEmpty()) {
                return ".txt";
            }
            return switch (language.toLowerCase()) {
                case "javascript", "js" -> ".js";
                case "typescript", "ts" -> ".ts";
                case "tsx" -> ".tsx";
                case "jsx" -> ".jsx";
                case "java" -> ".java";
                case "python", "py" -> ".py";
                case "ruby", "rb" -> ".rb";
                case "go", "golang" -> ".go";
                case "rust", "rs" -> ".rs";
                case "c" -> ".c";
                case "cpp", "c++" -> ".cpp";
                case "csharp", "c#", "cs" -> ".cs";
                case "php" -> ".php";
                case "swift" -> ".swift";
                case "kotlin", "kt" -> ".kt";
                case "scala" -> ".scala";
                case "html" -> ".html";
                case "css" -> ".css";
                case "scss" -> ".scss";
                case "less" -> ".less";
                case "json" -> ".json";
                case "xml" -> ".xml";
                case "yaml", "yml" -> ".yaml";
                case "markdown", "md" -> ".md";
                case "sql" -> ".sql";
                case "bash", "sh", "shell" -> ".sh";
                case "powershell", "ps1" -> ".ps1";
                case "dockerfile" -> "";
                case "plaintext", "text" -> ".txt";
                default -> "." + language.toLowerCase();
            };
        }

        /**
         * 根据语言名称获取 Language 对象
         */
        private Language getLanguageForLanguageName(String languageName) {
            if (languageName == null || languageName.isEmpty()) {
                return PlainTextLanguage.INSTANCE;
            }

            // 尝试通过语言ID查找
            String langId = switch (languageName.toLowerCase()) {
                case "javascript", "js" -> "JavaScript";
                case "typescript", "ts" -> "TypeScript";
                case "tsx" -> "TypeScript JSX";
                case "jsx" -> "JSX Harmony";
                case "java" -> "JAVA";
                case "python", "py" -> "Python";
                case "ruby", "rb" -> "ruby";
                case "go", "golang" -> "go";
                case "rust", "rs" -> "Rust";
                case "c" -> "ObjectiveC";
                case "cpp", "c++" -> "ObjectiveC";
                case "kotlin", "kt" -> "kotlin";
                case "scala" -> "Scala";
                case "html" -> "HTML";
                case "css" -> "CSS";
                case "json" -> "JSON";
                case "xml" -> "XML";
                case "yaml", "yml" -> "yaml";
                case "markdown", "md" -> "Markdown";
                case "sql" -> "SQL";
                case "bash", "sh", "shell" -> "Shell Script";
                default -> languageName;
            };

            Language lang = Language.findLanguageByID(langId);
            return lang != null ? lang : PlainTextLanguage.INSTANCE;
        }

        /**
         * 获取使用统计数据
         */
        private void handleGetUsageStatistics(String content) {
            CompletableFuture.runAsync(() -> {
                try {
                    String projectPath = "all";
                    // 解析请求内容
                    // 简单处理：如果内容是 "current"，则使用当前项目路径
                    // 否则如果是路径，则使用该路径
                    // 默认为 "all"

                    if (content != null && !content.isEmpty() && !content.equals("{}")) {
                        // 尝试解析 JSON
                         try {
                            Gson gson = new Gson();
                            JsonObject json = gson.fromJson(content, JsonObject.class);
                            if (json.has("scope")) {
                                String scope = json.get("scope").getAsString();
                                if ("current".equals(scope)) {
                                    projectPath = project.getBasePath();
                                } else {
                                    projectPath = "all";
                                }
                            }
                        } catch (Exception e) {
                            // 不是 JSON，按字符串处理
                            if ("current".equals(content)) {
                                projectPath = project.getBasePath();
                            } else {
                                projectPath = content;
                            }
                        }
                    }

                    System.out.println("[Backend] Getting usage statistics for path: " + projectPath);

                    ClaudeHistoryReader reader = new ClaudeHistoryReader();
                    ClaudeHistoryReader.ProjectStatistics stats = reader.getProjectStatistics(projectPath);

                    Gson gson = new Gson();
                    String json = gson.toJson(stats);

                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("window.updateUsageStatistics", escapeJs(json));
                    });
                } catch (Exception e) {
                    System.err.println("[Backend] Failed to get usage statistics: " + e.getMessage());
                    e.printStackTrace();
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("window.showError", escapeJs("获取统计数据失败: " + e.getMessage()));
                    });
                }
            });
        }

        /**
         * 设置拖拽目标，接收从 IDEA Project View 拖拽的文件
         */
        private void setupDropTarget(Component component) {
            new DropTarget(component, DnDConstants.ACTION_COPY_OR_MOVE, new DropTargetAdapter() {
                @Override
                public void dragEnter(DropTargetDragEvent dtde) {
                    if (isAcceptableDrop(dtde.getTransferable())) {
                        dtde.acceptDrag(DnDConstants.ACTION_COPY);
                        // 通知前端显示拖拽状态
                        SwingUtilities.invokeLater(() -> {
                            callJavaScript("window.onDragEnter", "");
                        });
                    } else {
                        dtde.rejectDrag();
                    }
                }

                @Override
                public void dragOver(DropTargetDragEvent dtde) {
                    if (isAcceptableDrop(dtde.getTransferable())) {
                        dtde.acceptDrag(DnDConstants.ACTION_COPY);
                    } else {
                        dtde.rejectDrag();
                    }
                }

                @Override
                public void dragExit(DropTargetEvent dte) {
                    // 通知前端隐藏拖拽状态
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("window.onDragLeave", "");
                    });
                }

                @Override
                public void drop(DropTargetDropEvent dtde) {
                    try {
                        Transferable transferable = dtde.getTransferable();

                        // 检查可用的数据类型
                        for (DataFlavor flavor : transferable.getTransferDataFlavors()) {
                            String mimeType = flavor.getMimeType();
                            // IDEA 的 VirtualFile 数据类型（保留用于未来扩展）
                            if (mimeType.contains("VirtualFile") || mimeType.contains("PsiFile") ||
                                mimeType.contains("PsiElement") || mimeType.contains("application/x-java-jvm-local-objectref")) {
                                // virtualFileFlavor = flavor;
                            }
                        }

                        dtde.acceptDrop(DnDConstants.ACTION_COPY);
                        boolean processed = false;

                        // 尝试处理 Java File List（标准文件拖拽）
                        if (transferable.isDataFlavorSupported(DataFlavor.javaFileListFlavor)) {
                            @SuppressWarnings("unchecked")
                            List<File> files = (List<File>) transferable.getTransferData(DataFlavor.javaFileListFlavor);
                            for (File file : files) {
                                String filePath = file.getAbsolutePath();
                                handleResolveDroppedFile(filePath);
                            }
                            processed = true;
                        }

                        // 尝试处理字符串格式（可能包含路径）
                        if (!processed && transferable.isDataFlavorSupported(DataFlavor.stringFlavor)) {
                            String data = (String) transferable.getTransferData(DataFlavor.stringFlavor);
                            // 检查是否是文件路径
                            if (data != null && !data.isEmpty()) {
                                String[] lines = data.split("\n");
                                for (String line : lines) {
                                    String trimmed = line.trim();
                                    if (trimmed.startsWith("/") || trimmed.matches("^[A-Za-z]:.*")) {
                                        handleResolveDroppedFile(trimmed);
                                        processed = true;
                                    } else if (trimmed.startsWith("file://")) {
                                        String path = trimmed.replace("file://", "");
                                        if (path.matches("^/[A-Za-z]:.*")) {
                                            path = path.substring(1); // Windows 路径
                                        }
                                        handleResolveDroppedFile(path);
                                        processed = true;
                                    }
                                }
                            }
                        }

                        // 尝试处理 URI List
                        if (!processed) {
                            DataFlavor uriListFlavor = new DataFlavor("text/uri-list;class=java.lang.String");
                            if (transferable.isDataFlavorSupported(uriListFlavor)) {
                                String data = (String) transferable.getTransferData(uriListFlavor);
                                if (data != null) {
                                    String[] uris = data.split("\n");
                                    for (String uri : uris) {
                                        String trimmed = uri.trim();
                                        if (trimmed.startsWith("file://")) {
                                            String path = java.net.URLDecoder.decode(
                                                trimmed.replace("file://", ""), "UTF-8");
                                            if (path.matches("^/[A-Za-z]:.*")) {
                                                path = path.substring(1);
                                            }
                                            handleResolveDroppedFile(path);
                                            processed = true;
                                        }
                                    }
                                }
                            }
                        }

                        // 通知前端隐藏拖拽状态
                        SwingUtilities.invokeLater(() -> {
                            callJavaScript("window.onDragLeave", "");
                        });

                        dtde.dropComplete(processed);

                    } catch (Exception e) {
                        System.err.println("[DnD] 处理拖拽失败: " + e.getMessage());
                        dtde.rejectDrop();
                    }
                }

                private boolean isAcceptableDrop(Transferable transferable) {
                    // 接受文件列表、字符串或 URI 列表
                    return transferable.isDataFlavorSupported(DataFlavor.javaFileListFlavor) ||
                           transferable.isDataFlavorSupported(DataFlavor.stringFlavor);
                }
            }, true);
        }

        /**
         * 处理拖拽文件解析
         * 将文件路径解析为资源信息，返回给前端
         */
        private void handleResolveDroppedFile(String filePath) {
            CompletableFuture.runAsync(() -> {
                try {
                    if (filePath == null || filePath.isEmpty()) {
                        System.err.println("[Backend] 拖拽文件路径为空");
                        return;
                    }

                    // 查找文件
                    VirtualFile file = LocalFileSystem.getInstance().findFileByPath(filePath);
                    if (file == null) {
                        System.err.println("[Backend] 无法找到文件: " + filePath);
                        return;
                    }

                    // 计算相对路径
                    String projectBasePath = project.getBasePath();
                    String relativePath;
                    if (projectBasePath != null && filePath.startsWith(projectBasePath)) {
                        relativePath = filePath.substring(projectBasePath.length());
                        if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
                            relativePath = relativePath.substring(1);
                        }
                    } else {
                        relativePath = file.getName();
                    }

                    // 确定资源类型
                    String resourceType = file.isDirectory() ? "folder" : "file";

                    // 确定图标
                    String icon = file.isDirectory() ? "folder" : getFileIcon(file.getName());

                    // 构建资源 JSON
                    JsonObject resource = new JsonObject();
                    resource.addProperty("id", resourceType + "_" + System.currentTimeMillis() + "_" + file.getName().hashCode());
                    resource.addProperty("name", file.getName());
                    resource.addProperty("path", filePath);
                    resource.addProperty("relativePath", relativePath);
                    resource.addProperty("type", resourceType);
                    resource.addProperty("icon", icon);

                    Gson gson = new Gson();
                    String resourceJson = gson.toJson(resource);

                    System.out.println("[Backend] 解析拖拽文件成功: " + file.getName() + " -> " + resourceType);

                    // 回调通知前端
                    SwingUtilities.invokeLater(() -> {
                        String js = "if (window.onDroppedFileResolved) { window.onDroppedFileResolved('" +
                            escapeJs(resourceJson) + "'); }";
                        browser.getCefBrowser().executeJavaScript(js, browser.getCefBrowser().getURL(), 0);
                    });

                } catch (Exception e) {
                    System.err.println("[Backend] 解析拖拽文件失败: " + e.getMessage());
                    e.printStackTrace();
                }
            });
        }

        /**
         * 处理斜杠命令执行
         */
        private void handleExecuteSlashCommand(String content) {
            CompletableFuture.runAsync(() -> {
                try {
                    Gson gson = new Gson();
                    JsonObject cmdObj = gson.fromJson(content, JsonObject.class);
                    String commandName = cmdObj.has("command") ? cmdObj.get("command").getAsString() : "";
                    String source = cmdObj.has("source") ? cmdObj.get("source").getAsString() : "system";

                    System.out.println("[Backend] 执行斜杠命令: /" + commandName + " (source: " + source + ")");

                    // 处理系统命令
                    switch (commandName) {
                        // ========== 会话管理 ==========
                        case "clear":
                        case "reset":
                        case "new":
                            SwingUtilities.invokeLater(() -> {
                                createNewSession();
                                callJavaScript("updateStatus", escapeJs("对话已清空"));
                            });
                            break;

                        case "compact":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("上下文已压缩"));
                            });
                            break;

                        case "resume":
                            SwingUtilities.invokeLater(() -> {
                                // 切换到历史视图让用户选择会话
                                callJavaScript("updateStatus", escapeJs("请从历史记录中选择要恢复的会话"));
                            });
                            break;

                        // ========== 项目配置 ==========
                        case "init":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("初始化 CLAUDE.md 配置..."));
                                sendMessageToClaude("/init - 请帮我初始化项目的 CLAUDE.md 配置文件");
                            });
                            break;

                        case "add-dir":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("添加目录功能开发中..."));
                            });
                            break;

                        case "memory":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("记忆管理功能开发中..."));
                            });
                            break;

                        case "context":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("上下文管理功能开发中..."));
                            });
                            break;

                        // ========== MCP 服务器 ==========
                        case "mcp":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("MCP 服务器管理功能开发中..."));
                            });
                            break;

                        case "install-github-mcp":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("GitHub MCP 安装功能开发中..."));
                            });
                            break;

                        // ========== 配置设置 ==========
                        case "config":
                            System.out.println("[Backend] 进入 config case, 准备调用 updateStatus");
                            SwingUtilities.invokeLater(() -> {
                                System.out.println("[Backend] SwingUtilities.invokeLater 执行中...");
                                callJavaScript("updateStatus", escapeJs("配置管理功能开发中..."));
                                System.out.println("[Backend] callJavaScript 已调用");
                            });
                            break;

                        case "permissions":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("权限管理功能开发中..."));
                            });
                            break;

                        case "model":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("模型切换功能开发中..."));
                            });
                            break;

                        case "allowed-tools":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("工具管理功能开发中..."));
                            });
                            break;

                        case "terminal-setup":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("终端设置功能开发中..."));
                            });
                            break;

                        // ========== 账户相关 ==========
                        case "login":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("登录功能开发中..."));
                            });
                            break;

                        case "logout":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("登出功能开发中..."));
                            });
                            break;

                        case "status":
                            SwingUtilities.invokeLater(() -> {
                                String statusInfo = "当前状态: 已连接 | 项目: " + project.getName();
                                callJavaScript("updateStatus", escapeJs(statusInfo));
                            });
                            break;

                        // ========== 帮助诊断 ==========
                        case "help":
                            String helpMessage = "Claude Code 可用命令:\\n\\n" +
                                "会话管理:\\n" +
                                "  /clear - 清空对话历史\\n" +
                                "  /compact - 压缩上下文\\n" +
                                "  /resume - 恢复会话\\n\\n" +
                                "项目配置:\\n" +
                                "  /init - 初始化 CLAUDE.md\\n" +
                                "  /add-dir - 添加工作目录\\n" +
                                "  /memory - 管理记忆\\n\\n" +
                                "MCP 服务器:\\n" +
                                "  /mcp - MCP 管理\\n" +
                                "  /install-github-mcp - 安装 MCP\\n\\n" +
                                "帮助:\\n" +
                                "  /help - 显示帮助\\n" +
                                "  /doctor - 诊断问题\\n" +
                                "  /cost - 查看费用";
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("addErrorMessage", escapeJs(helpMessage));
                            });
                            break;

                        case "doctor":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("诊断功能开发中..."));
                            });
                            break;

                        case "bug":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("Bug 报告功能开发中..."));
                            });
                            break;

                        case "cost":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("费用统计功能开发中..."));
                            });
                            break;

                        // ========== 工作流 ==========
                        case "agents":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("代理管理功能开发中..."));
                            });
                            break;

                        case "review":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("代码审查模式开发中..."));
                            });
                            break;

                        case "pr-comments":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("PR 评论功能开发中..."));
                            });
                            break;

                        case "vim":
                            SwingUtilities.invokeLater(() -> {
                                callJavaScript("updateStatus", escapeJs("Vim 模式开发中..."));
                            });
                            break;

                        default:
                            // 用户自定义命令
                            if ("user".equals(source)) {
                                handleUserCommand(commandName);
                            } else {
                                SwingUtilities.invokeLater(() -> {
                                    callJavaScript("updateStatus", escapeJs("未知命令: /" + commandName));
                                });
                            }
                            break;
                    }
                } catch (Exception e) {
                    System.err.println("[Backend] 执行斜杠命令失败: " + e.getMessage());
                    e.printStackTrace();
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("命令执行失败: " + e.getMessage()));
                    });
                }
            });
        }

        /**
         * 处理用户自定义命令
         */
        private void handleUserCommand(String commandName) {
            try {
                // 读取用户命令文件 ~/.claude/commands/{commandName}.md
                String userHome = System.getProperty("user.home");
                java.nio.file.Path commandPath = java.nio.file.Paths.get(userHome, ".claude", "commands", commandName + ".md");

                if (!java.nio.file.Files.exists(commandPath)) {
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("未找到命令文件: " + commandName + ".md"));
                    });
                    return;
                }

                String commandContent = java.nio.file.Files.readString(commandPath);
                System.out.println("[Backend] 加载用户命令: " + commandName + " (" + commandContent.length() + " chars)");

                // 将命令内容作为消息发送给 Claude
                SwingUtilities.invokeLater(() -> {
                    sendMessageToClaude("/" + commandName + "\n\n" + commandContent);
                });

            } catch (Exception e) {
                System.err.println("[Backend] 加载用户命令失败: " + e.getMessage());
                SwingUtilities.invokeLater(() -> {
                    callJavaScript("updateStatus", escapeJs("加载命令失败: " + e.getMessage()));
                });
            }
        }

        /**
         * 加载用户自定义命令列表
         */
        private void handleLoadUserCommands() {
            CompletableFuture.runAsync(() -> {
                try {
                    String userHome = System.getProperty("user.home");
                    java.nio.file.Path commandsDir = java.nio.file.Paths.get(userHome, ".claude", "commands");

                    com.google.gson.JsonArray commandsArray = new com.google.gson.JsonArray();

                    if (java.nio.file.Files.exists(commandsDir) && java.nio.file.Files.isDirectory(commandsDir)) {
                        java.nio.file.Files.list(commandsDir)
                            .filter(p -> p.toString().endsWith(".md"))
                            .forEach(p -> {
                                try {
                                    String fileName = p.getFileName().toString();
                                    String cmdName = fileName.substring(0, fileName.length() - 3); // 去掉 .md

                                    // 读取文件内容
                                    String content = java.nio.file.Files.readString(p);
                                    String description = "";

                                    // 尝试解析 YAML frontmatter 格式
                                    // 格式: ---\ndescription: 描述内容\n---
                                    if (content.startsWith("---")) {
                                        int endIndex = content.indexOf("---", 3);
                                        if (endIndex > 3) {
                                            String frontmatter = content.substring(3, endIndex);
                                            // 查找 description: 字段
                                            java.util.regex.Pattern descPattern = java.util.regex.Pattern.compile(
                                                "description:\\s*(.+?)(?:\n|$)",
                                                java.util.regex.Pattern.CASE_INSENSITIVE
                                            );
                                            java.util.regex.Matcher matcher = descPattern.matcher(frontmatter);
                                            if (matcher.find()) {
                                                description = matcher.group(1).trim();
                                                // 去掉可能的引号
                                                if ((description.startsWith("\"") && description.endsWith("\"")) ||
                                                    (description.startsWith("'") && description.endsWith("'"))) {
                                                    description = description.substring(1, description.length() - 1);
                                                }
                                            }
                                        }
                                    }

                                    // 如果没有从 frontmatter 获取到描述，尝试取第一个非空行
                                    if (description.isEmpty()) {
                                        String[] lines = content.split("\n");
                                        for (String line : lines) {
                                            String trimmed = line.trim();
                                            // 跳过空行和 frontmatter 分隔符
                                            if (trimmed.isEmpty() || trimmed.equals("---")) continue;
                                            // 跳过 frontmatter 内容行
                                            if (trimmed.matches("^[a-zA-Z_-]+:.*")) continue;
                                            // 去掉 markdown 标记
                                            description = trimmed
                                                .replaceAll("^#+\\s*", "")
                                                .replaceAll("^\\*+\\s*", "")
                                                .trim();
                                            if (!description.isEmpty()) break;
                                        }
                                    }

                                    // 截断过长的描述
                                    if (description.length() > 60) {
                                        description = description.substring(0, 60) + "...";
                                    }

                                    JsonObject cmd = new JsonObject();
                                    cmd.addProperty("id", "user_" + cmdName);
                                    cmd.addProperty("name", cmdName);
                                    cmd.addProperty("description", description.isEmpty() ? cmdName : description);
                                    cmd.addProperty("source", "user");
                                    cmd.addProperty("category", "custom");
                                    cmd.addProperty("icon", "file");

                                    commandsArray.add(cmd);
                                } catch (Exception e) {
                                    System.err.println("[Backend] 读取命令文件失败: " + p + " - " + e.getMessage());
                                }
                            });
                    }

                    Gson gson = new Gson();
                    String commandsJson = gson.toJson(commandsArray);

                    System.out.println("[Backend] 加载用户命令列表: " + commandsArray.size() + " 个命令");

                    // 回调通知前端
                    SwingUtilities.invokeLater(() -> {
                        String js = "if (window.onUserCommandsLoaded) { window.onUserCommandsLoaded('" +
                            escapeJs(commandsJson) + "'); }";
                        browser.getCefBrowser().executeJavaScript(js, browser.getCefBrowser().getURL(), 0);
                    });

                } catch (Exception e) {
                    System.err.println("[Backend] 加载用户命令列表失败: " + e.getMessage());
                    e.printStackTrace();
                }
            });
        }

        /**
         * 根据文件名获取图标
         */
        private String getFileIcon(String fileName) {
            if (fileName == null) return "file";

            String lowerName = fileName.toLowerCase();

            // 根据文件扩展名返回对应的 codicon 图标
            if (lowerName.endsWith(".java")) return "file-code";
            if (lowerName.endsWith(".kt") || lowerName.endsWith(".kts")) return "file-code";
            if (lowerName.endsWith(".js") || lowerName.endsWith(".jsx")) return "file-code";
            if (lowerName.endsWith(".ts") || lowerName.endsWith(".tsx")) return "file-code";
            if (lowerName.endsWith(".py")) return "file-code";
            if (lowerName.endsWith(".go")) return "file-code";
            if (lowerName.endsWith(".rs")) return "file-code";
            if (lowerName.endsWith(".c") || lowerName.endsWith(".cpp") || lowerName.endsWith(".h")) return "file-code";
            if (lowerName.endsWith(".cs")) return "file-code";
            if (lowerName.endsWith(".rb")) return "file-code";
            if (lowerName.endsWith(".php")) return "file-code";
            if (lowerName.endsWith(".swift")) return "file-code";
            if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "file-code";
            if (lowerName.endsWith(".css") || lowerName.endsWith(".scss") || lowerName.endsWith(".less")) return "file-code";
            if (lowerName.endsWith(".json")) return "json";
            if (lowerName.endsWith(".xml")) return "file-code";
            if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) return "file-code";
            if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) return "markdown";
            if (lowerName.endsWith(".sql")) return "database";
            if (lowerName.endsWith(".sh") || lowerName.endsWith(".bash")) return "terminal";
            if (lowerName.endsWith(".gradle") || lowerName.endsWith(".gradle.kts")) return "file-code";
            if (lowerName.endsWith(".pom") || lowerName.equals("pom.xml")) return "file-code";
            if (lowerName.endsWith(".properties")) return "settings-gear";
            if (lowerName.endsWith(".txt")) return "file-text";
            if (lowerName.endsWith(".log")) return "file-text";
            if (lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".gif") || lowerName.endsWith(".svg") || lowerName.endsWith(".webp")) return "file-media";
            if (lowerName.endsWith(".pdf")) return "file-pdf";
            if (lowerName.endsWith(".zip") || lowerName.endsWith(".tar") || lowerName.endsWith(".gz") ||
                lowerName.endsWith(".rar") || lowerName.endsWith(".7z")) return "file-zip";

            // 特殊文件名
            if (lowerName.equals("dockerfile") || lowerName.startsWith("dockerfile.")) return "file-code";
            if (lowerName.equals(".gitignore") || lowerName.equals(".gitattributes")) return "git-commit";
            if (lowerName.equals("package.json") || lowerName.equals("package-lock.json")) return "json";
            if (lowerName.equals("tsconfig.json") || lowerName.equals("jsconfig.json")) return "json";

            return "file";
        }

        /**
         * 获取 MCP 服务器列表
         */
        private void handleGetMCPServers() {
            CompletableFuture.runAsync(() -> {
                try {
                    String projectPath = project.getBasePath();
                    String mcpJson = configReader.getMCPServersAsJson(projectPath);

                    System.out.println("[Backend] MCP 服务器配置: " + mcpJson.substring(0, Math.min(200, mcpJson.length())) + "...");

                    SwingUtilities.invokeLater(() -> {
                        String js = "if (window.updateMCPServers) { window.updateMCPServers('" +
                            escapeJs(mcpJson) + "'); }";
                        browser.getCefBrowser().executeJavaScript(js, browser.getCefBrowser().getURL(), 0);
                    });

                } catch (Exception e) {
                    System.err.println("[Backend] 获取 MCP 服务器失败: " + e.getMessage());
                    e.printStackTrace();
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("获取 MCP 配置失败: " + e.getMessage()));
                    });
                }
            });
        }

        /**
         * 切换 MCP 服务器启用/禁用状态
         */
        private void handleToggleMCPServer(String content) {
            CompletableFuture.runAsync(() -> {
                try {
                    Gson gson = new Gson();
                    JsonObject data = gson.fromJson(content, JsonObject.class);

                    String serverName = data.get("serverName").getAsString();
                    boolean enable = data.get("enable").getAsBoolean();
                    String projectPath = project.getBasePath();

                    System.out.println("[Backend] 切换 MCP 服务器: " + serverName + " -> " + (enable ? "启用" : "禁用"));

                    boolean success = configReader.toggleMCPServer(serverName, projectPath, enable);

                    if (success) {
                        // 刷新 MCP 服务器列表
                        handleGetMCPServers();

                        SwingUtilities.invokeLater(() -> {
                            callJavaScript("updateStatus", escapeJs("MCP 服务器 " + serverName + " 已" + (enable ? "启用" : "禁用")));
                        });
                    } else {
                        SwingUtilities.invokeLater(() -> {
                            callJavaScript("updateStatus", escapeJs("切换 MCP 服务器状态失败"));
                        });
                    }

                } catch (Exception e) {
                    System.err.println("[Backend] 切换 MCP 服务器状态失败: " + e.getMessage());
                    e.printStackTrace();
                    SwingUtilities.invokeLater(() -> {
                        callJavaScript("updateStatus", escapeJs("操作失败: " + e.getMessage()));
                    });
                }
            });
        }

        public JPanel getContent() {
            return mainPanel;
        }
    }
}
