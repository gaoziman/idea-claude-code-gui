import type { PendingImage } from '../types';

interface ImagePreviewProps {
  images: PendingImage[];
  onRemove: (id: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ImagePreview = ({ images, onRemove }: ImagePreviewProps) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="image-preview-container">
      {images.map((image) => (
        <div key={image.id} className="image-preview-item">
          <img
            src={`data:image/png;base64,${image.base64}`}
            alt={image.name}
            className="image-preview-thumbnail"
          />
          <div className="image-preview-info">
            <span className="image-preview-name" title={image.name}>
              {image.name}
            </span>
            <span className="image-preview-size">
              {formatFileSize(image.size)}
              {image.width && image.height && ` · ${image.width}×${image.height}`}
            </span>
          </div>
          <button
            className="image-preview-remove"
            onClick={() => onRemove(image.id)}
            title="移除图片"
          >
            <span className="codicon codicon-close" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ImagePreview;
