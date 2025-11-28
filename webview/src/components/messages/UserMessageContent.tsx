interface ResourceRef {
  type: 'file' | 'folder' | 'code' | 'workspace';
  path: string;
  name: string;
}

interface UserMessageContentProps {
  content: string;
}

// 解析消息中的资源引用
const parseResourceRefs = (content: string): { resources: ResourceRef[]; text: string } => {
  const resources: ResourceRef[] = [];

  // 匹配 [文件夹: path], [文件: path], [代码: path], [Workspace] 格式
  const patterns = [
    { regex: /\[文件夹:\s*([^\]]+)\]/g, type: 'folder' as const },
    { regex: /\[文件:\s*([^\]]+)\]/g, type: 'file' as const },
    { regex: /\[代码:\s*([^\]]+)\]/g, type: 'code' as const },
    { regex: /\[Workspace\]/gi, type: 'workspace' as const },
  ];

  let cleanText = content;

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (type === 'workspace') {
        resources.push({
          type: 'workspace',
          path: '',
          name: 'Workspace',
        });
      } else {
        const fullPath = match[1].trim();
        const name = fullPath.split('/').pop() || fullPath;
        resources.push({
          type,
          path: fullPath,
          name,
        });
      }
    }
    // 从文本中移除资源引用
    cleanText = cleanText.replace(regex, '');
  }

  // 清理多余的空行
  cleanText = cleanText.replace(/^\s*\n+/g, '').trim();

  return { resources, text: cleanText };
};

// 获取资源类型的图标类名
const getIconClass = (type: ResourceRef['type']): string => {
  switch (type) {
    case 'folder':
      return 'codicon codicon-folder';
    case 'code':
      return 'codicon codicon-symbol-class';
    case 'workspace':
      return 'codicon codicon-root-folder';
    case 'file':
    default:
      return 'codicon codicon-file';
  }
};

// 获取资源类型样式类名
const getTypeClass = (type: ResourceRef['type']): string => {
  switch (type) {
    case 'folder':
      return 'ref-folder';
    case 'code':
      return 'ref-code';
    case 'workspace':
      return 'ref-workspace';
    case 'file':
    default:
      return 'ref-file';
  }
};

const UserMessageContent = ({ content }: UserMessageContentProps) => {
  const { resources, text } = parseResourceRefs(content);

  // Trae 风格：标签和文字在同一行流式排列
  return (
    <span className="user-message-inline">
      {resources.map((resource, index) => (
        <span
          key={`${resource.type}-${index}`}
          className={`user-resource-tag ${getTypeClass(resource.type)}`}
          title={resource.path || resource.name}
        >
          <span className={`user-resource-icon ${getIconClass(resource.type)}`} />
          <span className="user-resource-name">{resource.name}</span>
        </span>
      ))}
      {text && <span className="user-message-text">{text}</span>}
    </span>
  );
};

export default UserMessageContent;
