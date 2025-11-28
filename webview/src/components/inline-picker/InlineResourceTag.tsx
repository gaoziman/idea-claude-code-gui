import type { SelectedResource, ResourceType } from '../../types';

interface InlineResourceTagProps {
  resource: SelectedResource;
  onRemove: (id: string) => void;
  onOpen?: (resource: SelectedResource) => void;
}

const getIconClass = (type: ResourceType): string => {
  switch (type) {
    case 'folder':
      return 'codicon codicon-folder';
    case 'class':
      return 'codicon codicon-symbol-class';
    case 'interface':
      return 'codicon codicon-symbol-interface';
    case 'method':
      return 'codicon codicon-symbol-method';
    case 'doc':
      return 'codicon codicon-notebook';
    case 'workspace':
      return 'codicon codicon-root-folder';
    case 'file':
    default:
      return 'codicon codicon-file';
  }
};

const getTagTypeClass = (type: ResourceType): string => {
  switch (type) {
    case 'folder':
      return 'tag-folder';
    case 'class':
    case 'interface':
    case 'method':
      return 'tag-code';
    case 'doc':
      return 'tag-doc';
    case 'workspace':
      return 'tag-workspace';
    case 'file':
    default:
      return 'tag-file';
  }
};

const InlineResourceTag = ({ resource, onRemove, onOpen }: InlineResourceTagProps) => {
  const isClickable = resource.type === 'file' || resource.type === 'doc';

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('inline-tag-close')) {
      return;
    }
    if (isClickable && onOpen) {
      onOpen(resource);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(resource.id);
  };

  return (
    <span
      className={`inline-resource-tag ${getTagTypeClass(resource.type)} ${isClickable ? 'clickable' : ''}`}
      onClick={handleClick}
      title={resource.relativePath || resource.name}
    >
      <span className={`inline-tag-icon ${getIconClass(resource.type)}`} />
      <span className="inline-tag-name">{resource.name}</span>
      <span
        className="inline-tag-close codicon codicon-close"
        onClick={handleRemove}
        title="移除"
      />
    </span>
  );
};

export default InlineResourceTag;
