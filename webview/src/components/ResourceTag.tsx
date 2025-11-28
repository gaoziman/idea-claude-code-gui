import type { SelectedResource } from '../types';

interface ResourceTagProps {
  resources: SelectedResource[];
  onRemove: (id: string) => void;
}

const getIconClass = (icon: string, type: string): string => {
  switch (type) {
    case 'class':
      return 'codicon codicon-symbol-class';
    case 'interface':
      return 'codicon codicon-symbol-interface';
    case 'method':
      return 'codicon codicon-symbol-method';
    case 'folder':
      return 'codicon codicon-folder';
    case 'file':
    default:
      if (icon === 'file-code') return 'codicon codicon-file-code';
      if (icon === 'markdown') return 'codicon codicon-markdown';
      if (icon === 'file-media') return 'codicon codicon-file-media';
      return 'codicon codicon-file';
  }
};

const ResourceTag = ({ resources, onRemove }: ResourceTagProps) => {
  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="resource-tag-container">
      {resources.map((resource) => (
        <div key={resource.id} className="resource-tag">
          <span className={getIconClass(resource.icon, resource.type)} />
          <span className="resource-tag-name" title={resource.path}>
            {resource.name}
          </span>
          <button
            className="resource-tag-remove"
            onClick={() => onRemove(resource.id)}
            title="移除"
          >
            <span className="codicon codicon-close" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ResourceTag;
