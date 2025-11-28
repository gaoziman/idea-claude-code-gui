package com.github.claudecodegui;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.intellij.openapi.application.ReadAction;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.LocalFileSystem;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.psi.search.FilenameIndex;
import com.intellij.psi.search.GlobalSearchScope;

import java.util.*;

/**
 * 项目搜索服务 - 提供文件、文件夹、代码搜索能力
 */
public class ProjectSearchService {

    private final Project project;
    private static final int MAX_RESULTS = 50;

    // 源代码文件扩展名
    private static final Set<String> CODE_EXTENSIONS = Set.of(
        "java", "kt", "kts", "groovy", "scala",  // JVM
        "js", "ts", "jsx", "tsx", "vue",         // JavaScript/TypeScript
        "py", "rb", "php",                        // 脚本语言
        "go", "rs", "c", "cpp", "h", "hpp",      // 系统语言
        "swift", "m", "mm"                        // Apple
    );

    // 文档文件扩展名
    private static final Set<String> DOC_EXTENSIONS = Set.of(
        "md", "markdown",                         // Markdown
        "txt", "text",                            // 纯文本
        "rst",                                    // reStructuredText
        "adoc", "asciidoc",                       // AsciiDoc
        "org",                                    // Org Mode
        "wiki",                                   // Wiki
        "rtf"                                     // Rich Text
    );

    // 需要排除的目录（搜索时忽略这些目录下的文件）
    private static final Set<String> EXCLUDED_DIRECTORIES = Set.of(
        "node_modules",
        ".git",
        ".idea",
        ".vscode",
        "target",
        "build",
        "dist",
        "out",
        ".next",
        ".nuxt",
        "__pycache__",
        ".gradle",
        "vendor",
        "coverage",
        ".cache"
    );

    public ProjectSearchService(Project project) {
        this.project = project;
    }

    /**
     * 检查文件路径是否在排除目录中
     */
    private boolean isInExcludedDirectory(String path) {
        for (String excluded : EXCLUDED_DIRECTORIES) {
            // 检查路径中是否包含排除的目录
            if (path.contains("/" + excluded + "/") || path.contains("\\" + excluded + "\\")) {
                return true;
            }
        }
        return false;
    }

    /**
     * 搜索入口
     */
    public String search(String type, String query) {
        return search(type, query, null);
    }

    /**
     * 搜索入口（带上下文目录）
     * @param contextDir 上下文目录路径（当前编辑器文件所在目录），用于folder搜索的默认结果
     */
    public String search(String type, String query, String contextDir) {
        String trimmedQuery = (query == null) ? "" : query.trim().toLowerCase();

        return switch (type) {
            case "file" -> searchFiles(trimmedQuery);
            case "folder" -> searchFolders(trimmedQuery, contextDir);
            case "code" -> searchCode(trimmedQuery);
            case "doc" -> searchDocs(trimmedQuery);
            default -> emptyResult();
        };
    }

    /**
     * 搜索文件
     */
    private String searchFiles(String query) {
        List<SearchResult> results = new ArrayList<>();

        try {
            // 空查询时返回根目录下的文件
            if (query.isEmpty()) {
                VirtualFile baseDir = project.getBaseDir();
                if (baseDir != null) {
                    VirtualFile[] children = baseDir.getChildren();
                    if (children != null) {
                        for (VirtualFile file : children) {
                            if (results.size() >= MAX_RESULTS) break;
                            if (file.isDirectory()) continue;
                            if (file.getName().startsWith(".")) continue; // 跳过隐藏文件

                            String relativePath = getRelativePath(file);
                            results.add(new SearchResult(
                                file.getPath(),
                                file.getName(),
                                file.getPath(),
                                relativePath,
                                "file",
                                getFileIcon(file)
                            ));
                        }
                    }
                }
                return toJson(results);
            }

            ReadAction.run(() -> {
                GlobalSearchScope scope = GlobalSearchScope.projectScope(project);

                // 获取所有文件名
                String[] allNames = FilenameIndex.getAllFilenames(project);

                for (String fileName : allNames) {
                    if (results.size() >= MAX_RESULTS) break;

                    // 模糊匹配文件名
                    if (fileName.toLowerCase().contains(query)) {
                        Collection<VirtualFile> files = FilenameIndex.getVirtualFilesByName(fileName, scope);

                        for (VirtualFile file : files) {
                            if (results.size() >= MAX_RESULTS) break;
                            if (file.isDirectory()) continue;

                            // 排除指定目录下的文件
                            String filePath = file.getPath();
                            if (isInExcludedDirectory(filePath)) continue;

                            String relativePath = getRelativePath(file);
                            results.add(new SearchResult(
                                file.getPath(),
                                file.getName(),
                                file.getPath(),
                                relativePath,
                                "file",
                                getFileIcon(file)
                            ));
                        }
                    }
                }
            });
        } catch (Exception e) {
            System.err.println("[ProjectSearchService] 搜索文件失败: " + e.getMessage());
            e.printStackTrace();
        }

        // 按匹配度排序（空查询时跳过）
        if (!query.isEmpty()) {
            final String finalQuery = query;
            results.sort((a, b) -> {
                // 精确匹配优先
                boolean aExact = a.name.toLowerCase().equals(finalQuery);
                boolean bExact = b.name.toLowerCase().equals(finalQuery);
                if (aExact != bExact) return aExact ? -1 : 1;

                // 前缀匹配次之
                boolean aPrefix = a.name.toLowerCase().startsWith(finalQuery);
                boolean bPrefix = b.name.toLowerCase().startsWith(finalQuery);
                if (aPrefix != bPrefix) return aPrefix ? -1 : 1;

                // 按文件名长度排序
                return a.name.length() - b.name.length();
            });
        }

        return toJson(results);
    }

    /**
     * 搜索文件夹（无上下文目录）
     */
    private String searchFolders(String query) {
        return searchFolders(query, null);
    }

    /**
     * 搜索文件夹（带上下文目录）
     * @param contextDir 上下文目录路径，用于空查询时显示该目录下的子文件夹
     */
    private String searchFolders(String query, String contextDir) {
        List<SearchResult> results = new ArrayList<>();

        try {
            VirtualFile baseDir = project.getBaseDir();
            if (baseDir != null) {
                // 空查询时返回上下文目录（或根目录）下的子文件夹
                if (query.isEmpty()) {
                    // 确定要显示的目录：优先使用上下文目录
                    VirtualFile targetDir = baseDir;
                    if (contextDir != null && !contextDir.isEmpty()) {
                        VirtualFile contextVirtualDir = LocalFileSystem.getInstance().findFileByPath(contextDir);
                        if (contextVirtualDir != null && contextVirtualDir.isDirectory()) {
                            targetDir = contextVirtualDir;
                            System.out.println("[ProjectSearchService] 使用上下文目录: " + contextDir);
                        } else {
                            System.out.println("[ProjectSearchService] 上下文目录无效，回退到根目录: " + contextDir);
                        }
                    }

                    VirtualFile[] children = targetDir.getChildren();
                    if (children != null) {
                        for (VirtualFile child : children) {
                            if (results.size() >= MAX_RESULTS) break;
                            if (!child.isDirectory()) continue;

                            String name = child.getName();
                            // 跳过隐藏目录和排除的目录
                            if (name.startsWith(".") || EXCLUDED_DIRECTORIES.contains(name)) {
                                continue;
                            }

                            String relativePath = getRelativePath(child);
                            results.add(new SearchResult(
                                child.getPath(),
                                name,
                                child.getPath(),
                                relativePath,
                                "folder",
                                "folder"
                            ));
                        }
                    }
                } else {
                    searchFoldersRecursive(baseDir, query, results);
                }
            }
        } catch (Exception e) {
            System.err.println("[ProjectSearchService] 搜索文件夹失败: " + e.getMessage());
            e.printStackTrace();
        }

        // 按匹配度排序（空查询时跳过）
        if (!query.isEmpty()) {
            final String finalQuery = query;
            results.sort((a, b) -> {
                boolean aExact = a.name.toLowerCase().equals(finalQuery);
                boolean bExact = b.name.toLowerCase().equals(finalQuery);
                if (aExact != bExact) return aExact ? -1 : 1;

                boolean aPrefix = a.name.toLowerCase().startsWith(finalQuery);
                boolean bPrefix = b.name.toLowerCase().startsWith(finalQuery);
                if (aPrefix != bPrefix) return aPrefix ? -1 : 1;

                return a.relativePath.length() - b.relativePath.length();
            });
        }

        return toJson(results);
    }

    /**
     * 递归搜索文件夹
     */
    private void searchFoldersRecursive(VirtualFile dir, String query, List<SearchResult> results) {
        if (results.size() >= MAX_RESULTS) return;
        if (dir == null || !dir.isDirectory()) return;

        // 跳过隐藏目录和排除的目录
        String name = dir.getName();
        if (name.startsWith(".") || EXCLUDED_DIRECTORIES.contains(name)) {
            return;
        }

        // 匹配当前目录
        if (name.toLowerCase().contains(query)) {
            String relativePath = getRelativePath(dir);
            results.add(new SearchResult(
                dir.getPath(),
                name,
                dir.getPath(),
                relativePath,
                "folder",
                "folder"
            ));
        }

        // 递归子目录
        VirtualFile[] children = dir.getChildren();
        if (children != null) {
            for (VirtualFile child : children) {
                if (results.size() >= MAX_RESULTS) break;
                if (child.isDirectory()) {
                    searchFoldersRecursive(child, query, results);
                }
            }
        }
    }

    /**
     * 搜索代码（基于源代码文件名）
     * 由于不依赖 Java 插件，我们通过搜索源代码文件来模拟类/代码搜索
     */
    private String searchCode(String query) {
        List<SearchResult> results = new ArrayList<>();

        try {
            ReadAction.run(() -> {
                GlobalSearchScope scope = GlobalSearchScope.projectScope(project);

                // 获取所有文件名
                String[] allNames = FilenameIndex.getAllFilenames(project);

                for (String fileName : allNames) {
                    if (results.size() >= MAX_RESULTS) break;

                    // 获取文件扩展名
                    String extension = getExtension(fileName);
                    if (!CODE_EXTENSIONS.contains(extension.toLowerCase())) {
                        continue;
                    }

                    // 获取不带扩展名的文件名（作为类名/模块名）
                    String baseName = getBaseName(fileName);

                    // 模糊匹配
                    if (baseName.toLowerCase().contains(query)) {
                        Collection<VirtualFile> files = FilenameIndex.getVirtualFilesByName(fileName, scope);

                        for (VirtualFile file : files) {
                            if (results.size() >= MAX_RESULTS) break;
                            if (file.isDirectory()) continue;

                            // 跳过测试文件、生成的文件和排除目录
                            String path = file.getPath();
                            if (path.contains("/test/") || path.contains("/generated/")) {
                                continue;
                            }
                            if (isInExcludedDirectory(path)) continue;

                            String relativePath = getRelativePath(file);
                            String type = inferCodeType(file, baseName);
                            String icon = inferCodeIcon(type);

                            results.add(new SearchResult(
                                file.getPath(),
                                baseName,
                                file.getPath(),
                                relativePath,
                                type,
                                icon
                            ));
                        }
                    }
                }
            });
        } catch (Exception e) {
            System.err.println("[ProjectSearchService] 搜索代码失败: " + e.getMessage());
            e.printStackTrace();
        }

        // 按匹配度排序
        results.sort((a, b) -> {
            // 精确匹配优先
            boolean aExact = a.name.toLowerCase().equals(query);
            boolean bExact = b.name.toLowerCase().equals(query);
            if (aExact != bExact) return aExact ? -1 : 1;

            // 前缀匹配次之
            boolean aPrefix = a.name.toLowerCase().startsWith(query);
            boolean bPrefix = b.name.toLowerCase().startsWith(query);
            if (aPrefix != bPrefix) return aPrefix ? -1 : 1;

            // 按名称长度排序
            return a.name.length() - b.name.length();
        });

        return toJson(results);
    }

    /**
     * 搜索文档文件
     */
    private String searchDocs(String query) {
        List<SearchResult> results = new ArrayList<>();

        try {
            ReadAction.run(() -> {
                GlobalSearchScope scope = GlobalSearchScope.projectScope(project);

                // 获取所有文件名
                String[] allNames = FilenameIndex.getAllFilenames(project);

                for (String fileName : allNames) {
                    if (results.size() >= MAX_RESULTS) break;

                    // 获取文件扩展名
                    String extension = getExtension(fileName);
                    if (!DOC_EXTENSIONS.contains(extension.toLowerCase())) {
                        continue;
                    }

                    // 模糊匹配文件名（不带扩展名）
                    String baseName = getBaseName(fileName);
                    if (baseName.toLowerCase().contains(query) || fileName.toLowerCase().contains(query)) {
                        Collection<VirtualFile> files = FilenameIndex.getVirtualFilesByName(fileName, scope);

                        for (VirtualFile file : files) {
                            if (results.size() >= MAX_RESULTS) break;
                            if (file.isDirectory()) continue;

                            // 跳过排除目录
                            String path = file.getPath();
                            if (isInExcludedDirectory(path)) continue;

                            String relativePath = getRelativePath(file);
                            String icon = getDocIcon(file);

                            results.add(new SearchResult(
                                file.getPath(),
                                file.getName(),
                                file.getPath(),
                                relativePath,
                                "doc",
                                icon
                            ));
                        }
                    }
                }
            });
        } catch (Exception e) {
            System.err.println("[ProjectSearchService] 搜索文档失败: " + e.getMessage());
            e.printStackTrace();
        }

        // 按匹配度排序
        results.sort((a, b) -> {
            // 精确匹配优先
            boolean aExact = a.name.toLowerCase().equals(query);
            boolean bExact = b.name.toLowerCase().equals(query);
            if (aExact != bExact) return aExact ? -1 : 1;

            // 前缀匹配次之
            boolean aPrefix = a.name.toLowerCase().startsWith(query);
            boolean bPrefix = b.name.toLowerCase().startsWith(query);
            if (aPrefix != bPrefix) return aPrefix ? -1 : 1;

            // 按名称长度排序
            return a.name.length() - b.name.length();
        });

        return toJson(results);
    }

    /**
     * 获取文档图标
     */
    private String getDocIcon(VirtualFile file) {
        String extension = file.getExtension();
        if (extension == null) return "notebook";

        return switch (extension.toLowerCase()) {
            case "md", "markdown" -> "markdown";
            case "txt", "text" -> "file-text";
            default -> "notebook";
        };
    }

    /**
     * 推断代码类型
     */
    private String inferCodeType(VirtualFile file, String baseName) {
        String extension = getExtension(file.getName());

        // Java/Kotlin 文件根据命名约定推断
        if ("java".equals(extension) || "kt".equals(extension)) {
            if (baseName.startsWith("I") && baseName.length() > 1 && Character.isUpperCase(baseName.charAt(1))) {
                return "interface";  // 以 I 开头的可能是接口
            }
            return "class";
        }

        // 其他语言统一返回 class
        return "class";
    }

    /**
     * 推断代码图标
     */
    private String inferCodeIcon(String type) {
        return switch (type) {
            case "interface" -> "symbol-interface";
            case "method" -> "symbol-method";
            default -> "symbol-class";
        };
    }

    /**
     * 获取文件扩展名
     */
    private String getExtension(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0 && lastDot < fileName.length() - 1) {
            return fileName.substring(lastDot + 1);
        }
        return "";
    }

    /**
     * 获取不带扩展名的文件名
     */
    private String getBaseName(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0) {
            return fileName.substring(0, lastDot);
        }
        return fileName;
    }

    /**
     * 获取相对于项目的路径
     */
    private String getRelativePath(VirtualFile file) {
        String basePath = project.getBasePath();
        if (basePath != null && file.getPath().startsWith(basePath)) {
            String relative = file.getPath().substring(basePath.length());
            if (relative.startsWith("/")) {
                relative = relative.substring(1);
            }
            return relative;
        }
        return file.getPath();
    }

    /**
     * 根据文件类型返回图标类型
     */
    private String getFileIcon(VirtualFile file) {
        String extension = file.getExtension();
        if (extension == null) return "file";

        return switch (extension.toLowerCase()) {
            case "java" -> "file-code";
            case "kt", "kts" -> "file-code";
            case "xml" -> "file-code";
            case "json" -> "file-code";
            case "yaml", "yml" -> "file-code";
            case "properties" -> "settings-gear";
            case "md" -> "markdown";
            case "txt" -> "file-text";
            case "html", "htm" -> "file-code";
            case "css", "scss", "less" -> "file-code";
            case "js", "ts", "jsx", "tsx" -> "file-code";
            case "py" -> "file-code";
            case "go" -> "file-code";
            case "rs" -> "file-code";
            case "sql" -> "database";
            case "sh", "bash" -> "terminal";
            case "gradle" -> "file-code";
            case "png", "jpg", "jpeg", "gif", "svg", "ico" -> "file-media";
            default -> "file";
        };
    }

    /**
     * 转换为 JSON
     */
    private String toJson(List<SearchResult> results) {
        Gson gson = new Gson();
        JsonObject response = new JsonObject();
        JsonArray resultsArray = new JsonArray();

        for (SearchResult result : results) {
            JsonObject obj = new JsonObject();
            obj.addProperty("id", result.id);
            obj.addProperty("name", result.name);
            obj.addProperty("path", result.path);
            obj.addProperty("relativePath", result.relativePath);
            obj.addProperty("type", result.type);
            obj.addProperty("icon", result.icon);
            resultsArray.add(obj);
        }

        response.add("results", resultsArray);
        return gson.toJson(response);
    }

    /**
     * 返回空结果
     */
    private String emptyResult() {
        return "{\"results\":[]}";
    }

    /**
     * 搜索结果类
     */
    private static class SearchResult {
        final String id;
        final String name;
        final String path;
        final String relativePath;
        final String type;
        final String icon;

        SearchResult(String id, String name, String path, String relativePath, String type, String icon) {
            this.id = id;
            this.name = name;
            this.path = path;
            this.relativePath = relativePath;
            this.type = type;
            this.icon = icon;
        }
    }
}
