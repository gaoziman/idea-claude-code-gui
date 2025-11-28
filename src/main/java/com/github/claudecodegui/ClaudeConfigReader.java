package com.github.claudecodegui;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Claude Code 配置文件读取器
 * 用于读取 ~/.claude.json 中的 MCP 服务器配置
 */
public class ClaudeConfigReader {

    private static final String CLAUDE_CONFIG_FILE = ".claude.json";
    private static final String PROJECT_MCP_FILE = ".mcp.json";
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    /**
     * MCP 服务器配置
     */
    public static class MCPServer {
        public String name;
        public String type;           // stdio 或 http
        public String status;         // connected, failed, disabled
        public String scope;          // user, project, local

        // stdio 类型配置
        public String command;
        public List<String> args;
        public Map<String, String> env;

        // http 类型配置
        public String url;
        public Map<String, String> headers;

        // 元数据
        public String errorMessage;
        public List<String> tools;
    }

    /**
     * MCP 配置结果
     */
    public static class MCPConfigResult {
        public List<MCPServer> servers = new ArrayList<>();
        public String userConfigPath;
        public String projectConfigPath;
        public String localConfigPath;
        public int connectedCount = 0;
        public int failedCount = 0;
        public int disabledCount = 0;
    }

    /**
     * 获取所有 MCP 服务器配置
     * @param projectPath 当前项目路径
     * @return MCP 配置结果
     */
    public MCPConfigResult getMCPServers(String projectPath) {
        MCPConfigResult result = new MCPConfigResult();

        String userHome = System.getProperty("user.home");
        Path claudeConfigPath = Paths.get(userHome, CLAUDE_CONFIG_FILE);
        result.userConfigPath = claudeConfigPath.toString();

        try {
            if (Files.exists(claudeConfigPath)) {
                String content = Files.readString(claudeConfigPath);
                JsonObject config = JsonParser.parseString(content).getAsJsonObject();

                // 1. 读取用户级 MCP 服务器
                if (config.has("mcpServers")) {
                    JsonObject mcpServers = config.getAsJsonObject("mcpServers");
                    List<String> disabledServers = getDisabledServers(config, projectPath);

                    for (String serverName : mcpServers.keySet()) {
                        JsonObject serverConfig = mcpServers.getAsJsonObject(serverName);
                        MCPServer server = parseMCPServer(serverName, serverConfig, "user");

                        // 检查是否被禁用
                        if (disabledServers.contains(serverName)) {
                            server.status = "disabled";
                        } else {
                            server.status = "connected"; // 默认假设已连接
                        }

                        result.servers.add(server);
                    }
                }

                // 2. 读取项目级本地 MCP 服务器
                if (projectPath != null && config.has("projects")) {
                    JsonObject projects = config.getAsJsonObject("projects");
                    if (projects.has(projectPath)) {
                        JsonObject projectConfig = projects.getAsJsonObject(projectPath);
                        result.localConfigPath = claudeConfigPath + " [project: " + projectPath + "]";

                        if (projectConfig.has("mcpServers")) {
                            JsonObject localMcpServers = projectConfig.getAsJsonObject("mcpServers");
                            for (String serverName : localMcpServers.keySet()) {
                                // 检查是否已经存在（避免重复）
                                boolean exists = result.servers.stream()
                                    .anyMatch(s -> s.name.equals(serverName));
                                if (!exists) {
                                    JsonObject serverConfig = localMcpServers.getAsJsonObject(serverName);
                                    MCPServer server = parseMCPServer(serverName, serverConfig, "local");
                                    server.status = "connected";
                                    result.servers.add(server);
                                }
                            }
                        }
                    }
                }
            }

            // 3. 读取项目 .mcp.json 配置
            if (projectPath != null) {
                Path projectMcpPath = Paths.get(projectPath, PROJECT_MCP_FILE);
                if (Files.exists(projectMcpPath)) {
                    result.projectConfigPath = projectMcpPath.toString();
                    String projectContent = Files.readString(projectMcpPath);
                    JsonObject projectMcpConfig = JsonParser.parseString(projectContent).getAsJsonObject();

                    if (projectMcpConfig.has("mcpServers")) {
                        JsonObject projectMcpServers = projectMcpConfig.getAsJsonObject("mcpServers");
                        for (String serverName : projectMcpServers.keySet()) {
                            // 检查是否已经存在
                            boolean exists = result.servers.stream()
                                .anyMatch(s -> s.name.equals(serverName));
                            if (!exists) {
                                JsonObject serverConfig = projectMcpServers.getAsJsonObject(serverName);
                                MCPServer server = parseMCPServer(serverName, serverConfig, "project");
                                server.status = "connected";
                                result.servers.add(server);
                            }
                        }
                    }
                }
            }

            // 统计各状态数量
            for (MCPServer server : result.servers) {
                switch (server.status) {
                    case "connected" -> result.connectedCount++;
                    case "failed" -> result.failedCount++;
                    case "disabled" -> result.disabledCount++;
                }
            }

        } catch (IOException e) {
            System.err.println("[ClaudeConfigReader] Failed to read config: " + e.getMessage());
            e.printStackTrace();
        }

        return result;
    }

    /**
     * 解析单个 MCP 服务器配置
     */
    private MCPServer parseMCPServer(String name, JsonObject config, String scope) {
        MCPServer server = new MCPServer();
        server.name = name;
        server.scope = scope;

        // 判断类型
        if (config.has("type")) {
            String type = config.get("type").getAsString();
            if ("http".equals(type) || "sse".equals(type)) {
                server.type = "http";
                if (config.has("url")) {
                    server.url = config.get("url").getAsString();
                }
                if (config.has("headers")) {
                    server.headers = gson.fromJson(config.get("headers"), Map.class);
                }
            } else {
                server.type = "stdio";
            }
        } else if (config.has("url")) {
            // 有 url 但没有明确 type，默认为 http
            server.type = "http";
            server.url = config.get("url").getAsString();
            if (config.has("headers")) {
                server.headers = gson.fromJson(config.get("headers"), Map.class);
            }
        } else {
            // 默认为 stdio
            server.type = "stdio";
        }

        // 解析 stdio 配置
        if ("stdio".equals(server.type)) {
            if (config.has("command")) {
                server.command = config.get("command").getAsString();
            }
            if (config.has("args")) {
                JsonArray argsArray = config.getAsJsonArray("args");
                server.args = new ArrayList<>();
                for (JsonElement arg : argsArray) {
                    server.args.add(arg.getAsString());
                }
            }
            if (config.has("env")) {
                server.env = gson.fromJson(config.get("env"), Map.class);
            }
        }

        return server;
    }

    /**
     * 获取禁用的 MCP 服务器列表
     */
    private List<String> getDisabledServers(JsonObject config, String projectPath) {
        List<String> disabled = new ArrayList<>();

        if (projectPath != null && config.has("projects")) {
            JsonObject projects = config.getAsJsonObject("projects");
            if (projects.has(projectPath)) {
                JsonObject projectConfig = projects.getAsJsonObject(projectPath);
                if (projectConfig.has("disabledMcpServers")) {
                    JsonArray disabledArray = projectConfig.getAsJsonArray("disabledMcpServers");
                    for (JsonElement elem : disabledArray) {
                        disabled.add(elem.getAsString());
                    }
                }
            }
        }

        return disabled;
    }

    /**
     * 切换 MCP 服务器启用/禁用状态
     * @param serverName 服务器名称
     * @param projectPath 项目路径
     * @param enable true 为启用，false 为禁用
     * @return 是否成功
     */
    public boolean toggleMCPServer(String serverName, String projectPath, boolean enable) {
        String userHome = System.getProperty("user.home");
        Path claudeConfigPath = Paths.get(userHome, CLAUDE_CONFIG_FILE);

        try {
            if (!Files.exists(claudeConfigPath)) {
                return false;
            }

            String content = Files.readString(claudeConfigPath);
            JsonObject config = JsonParser.parseString(content).getAsJsonObject();

            // 确保 projects 对象存在
            if (!config.has("projects")) {
                config.add("projects", new JsonObject());
            }
            JsonObject projects = config.getAsJsonObject("projects");

            // 确保项目配置存在
            if (!projects.has(projectPath)) {
                projects.add(projectPath, new JsonObject());
            }
            JsonObject projectConfig = projects.getAsJsonObject(projectPath);

            // 确保 disabledMcpServers 数组存在
            if (!projectConfig.has("disabledMcpServers")) {
                projectConfig.add("disabledMcpServers", new JsonArray());
            }
            JsonArray disabledArray = projectConfig.getAsJsonArray("disabledMcpServers");

            // 更新禁用列表
            if (enable) {
                // 从禁用列表中移除
                JsonArray newArray = new JsonArray();
                for (JsonElement elem : disabledArray) {
                    if (!elem.getAsString().equals(serverName)) {
                        newArray.add(elem);
                    }
                }
                projectConfig.add("disabledMcpServers", newArray);
            } else {
                // 添加到禁用列表
                boolean alreadyDisabled = false;
                for (JsonElement elem : disabledArray) {
                    if (elem.getAsString().equals(serverName)) {
                        alreadyDisabled = true;
                        break;
                    }
                }
                if (!alreadyDisabled) {
                    disabledArray.add(serverName);
                }
            }

            // 写回文件
            Files.writeString(claudeConfigPath, gson.toJson(config));
            System.out.println("[ClaudeConfigReader] Successfully toggled MCP server: " + serverName + " -> " + (enable ? "enabled" : "disabled"));
            return true;

        } catch (IOException e) {
            System.err.println("[ClaudeConfigReader] Failed to toggle MCP server: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * 获取 MCP 服务器配置的 JSON 字符串（用于前端展示）
     */
    public String getMCPServersAsJson(String projectPath) {
        MCPConfigResult result = getMCPServers(projectPath);
        return gson.toJson(result);
    }
}
