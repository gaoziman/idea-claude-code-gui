# IntelliJ IDEA 插件开发调试指南

本文档介绍如何在 IntelliJ IDEA 中运行和调试 `idea-claude-code-gui` 插件项目。

## 环境要求

| 环境 | 版本要求 | 说明 |
|-----|---------|------|
| JDK | 17+ | 推荐使用 Amazon Corretto 17 |
| Node.js | 18+ | claude-bridge 运行时需要 |
| IntelliJ IDEA | 2023.3+ | 用于开发和调试 |

## 一、用 IDEA 打开项目

1. 打开 IntelliJ IDEA
2. 选择 **File → Open**
3. 选择项目根目录 `idea-claude-code-gui`
4. 等待 Gradle 同步完成（首次可能需要几分钟下载依赖）

## 二、配置 JDK

### 方式一：项目级别配置

1. 打开 **File → Project Structure** (快捷键 `Cmd + ;`)
2. 选择 **Project**
3. 设置 **SDK** 为 Java 17（如 Amazon Corretto 17）
4. 设置 **Language level** 为 `17 - Sealed types, always-strict floating-point semantics`

### 方式二：Gradle 配置

项目已在 `build.gradle` 中配置：
```groovy
sourceCompatibility = 17
targetCompatibility = 17
```

## 三、运行插件

### 方法 1：使用 Gradle 任务面板（推荐）

1. 打开右侧 **Gradle** 工具窗口
2. 展开 `idea-claude-code-gui → Tasks → intellij`
3. 双击 **runIde**

![Gradle runIde](../assets/gradle-runide.png)

### 方法 2：使用 Run Configuration

1. 点击顶部工具栏的 **Run/Debug Configurations** 下拉菜单
2. 选择 **Edit Configurations...**
3. 点击 **+** 添加新配置，选择 **Gradle**
4. 配置如下：
   - **Name**: `Run Plugin`
   - **Run**: `runIde`
   - **Gradle project**: `idea-claude-code-gui`
5. 点击 **OK** 保存

之后可以直接点击绿色运行按钮启动。

### 方法 3：终端命令

```bash
# 设置 Java 17 环境（如果默认不是 Java 17）
export JAVA_HOME="/Users/gaoziman/Library/Java/JavaVirtualMachines/corretto-17.0.16/Contents/Home"

# 运行插件沙箱
./gradlew runIde
```

## 四、调试插件

### 启动调试模式

1. 在需要调试的代码处设置断点（点击行号左侧空白处）
2. 使用以下任一方式启动调试：
   - **Gradle 面板**: 右键点击 `runIde` → **Debug**
   - **Run Configuration**: 点击虫子图标（Debug 按钮）
   - **快捷键**: `Ctrl + D` (Windows/Linux) 或 `Control + D` (Mac)

### 常用调试断点位置

| 文件 | 行号/方法 | 用途 |
|-----|---------|------|
| `ClaudeSDKBridge.java` | `sendMessage()` | 调试消息发送流程 |
| `ClaudeSession.java` | `send()` | 调试会话管理 |
| `ClaudeSDKToolWindow.java` | `handleJavaScriptMessage()` | 调试 JS 桥接通信 |
| `ClaudeHistoryReader.java` | `readHistory()` | 调试历史记录读取 |

### 调试 Node.js 桥接层

由于 `claude-bridge` 是独立的 Node.js 进程，需要单独调试：

```bash
cd claude-bridge

# 测试单次查询
node simple-query.js "你好，测试一下"

# 测试多轮对话
node channel-manager.js send "你好" "" "/path/to/project"
```

### 调试前端 (webview)

1. 启动开发服务器：
   ```bash
   cd webview
   npm run dev
   ```
2. 在浏览器中打开 `http://localhost:5173`
3. 使用浏览器开发者工具调试

> **注意**: 开发模式下的前端与 JCEF 中的行为可能略有不同，最终需要在插件沙箱中验证。

## 五、热重载开发

### 前端热重载

修改 `webview/src/` 下的文件后：

```bash
cd webview
npm run build
```

构建完成后会自动复制到 `src/main/resources/html/claude-chat.html`。

然后在 IDEA 沙箱中：
- 关闭 Claude Code GUI 工具窗口
- 重新打开即可看到更新

### Java 代码热重载

1. 修改 Java 代码后，IDEA 会自动编译
2. 使用 **Run → Reload Changed Classes** (快捷键 `Cmd + F9`)
3. 部分修改（如方法签名变更）需要重启沙箱

## 六、常用 Gradle 任务

| 任务 | 命令 | 说明 |
|-----|------|------|
| 运行插件 | `./gradlew runIde` | 启动 IDEA 沙箱 |
| 构建插件 | `./gradlew buildPlugin` | 打包为 .zip 文件 |
| 清理构建 | `./gradlew clean` | 清理 build 目录 |
| 验证插件 | `./gradlew verifyPlugin` | 验证插件兼容性 |
| 发布准备 | `./gradlew buildSearchableOptions` | 构建可搜索选项 |

## 七、常见问题

### Q1: `instrumentCode` 任务失败

**错误**: `/path/to/java/Packages does not exist`

**解决**: 设置正确的 JAVA_HOME：
```bash
export JAVA_HOME="/Users/gaoziman/Library/Java/JavaVirtualMachines/corretto-17.0.16/Contents/Home"
./gradlew clean runIde
```

### Q2: 找不到 Node.js

**错误**: `无法找到 Node.js`

**解决**: 确保 Node.js 在 PATH 中，或在 `ClaudeSDKBridge` 中手动设置路径。

### Q3: JCEF 不可用

**错误**: `JCEF is not supported in this environment`

**解决**: 确保使用的 IDEA 版本支持 JCEF（2020.2+），且不是 no-jbr 版本。

### Q4: 前端显示空白

**检查步骤**:
1. 确认 `src/main/resources/html/claude-chat.html` 文件存在
2. 重新构建前端: `cd webview && npm run build`
3. 重启 IDEA 沙箱

### Q5: 消息发送无响应

**检查步骤**:
1. 确认 `claude-bridge/node_modules` 已安装
2. 检查 `~/.claude/settings.json` 中的 API 配置
3. 查看 IDEA 控制台输出的错误日志

## 八、项目结构速查

```
idea-claude-code-gui/
├── src/main/java/com/github/claudecodegui/
│   ├── ClaudeSDKToolWindow.java    # 工具窗口入口
│   ├── ClaudeSDKBridge.java        # Node.js 进程桥接
│   ├── ClaudeSession.java          # 会话状态管理
│   ├── ClaudeHistoryReader.java    # 历史记录读取
│   └── permission/                  # 权限管理模块
├── src/main/resources/
│   ├── META-INF/plugin.xml         # 插件配置
│   └── html/claude-chat.html       # 前端打包产物
├── webview/                         # React 前端源码
│   ├── src/App.tsx                 # 主组件
│   └── src/components/             # UI 组件
├── claude-bridge/                   # Node.js 桥接层
│   ├── simple-query.js             # 单次查询
│   └── channel-manager.js          # 多轮对话
└── build.gradle                     # Gradle 构建配置
```

## 九、调试日志

### 开启详细日志

在 IDEA 沙箱中：
1. 打开 **Help → Diagnostic Tools → Debug Log Settings**
2. 添加: `#com.github.claudecodegui`
3. 重启沙箱

日志文件位置: `~/Library/Logs/JetBrains/IntelliJIdea2024.x/idea.log`

### 控制台输出

插件的 `System.out.println()` 输出会显示在启动 Gradle 任务的终端中，方便调试。

---

## 快速参考卡片

```
# 首次运行
cd webview && npm install && npm run build
cd ../claude-bridge && pnpm install
cd .. && ./gradlew runIde

# 日常开发
./gradlew runIde                    # 运行插件
cd webview && npm run build         # 重建前端

# 打包发布
./gradlew buildPlugin               # 输出到 build/distributions/
```
