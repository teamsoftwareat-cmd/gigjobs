import { Modal } from './index'

export function ImageModal({ isOpen, onClose, imageUrl, title, alt }) {
  if (!isOpen || !imageUrl) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Image preview'} maxWidth="720px">
      <div className="image-modal-content">
        <img src={imageUrl} alt={alt || 'Preview image'} className="image-modal-preview" />
      </div>
    </Modal>
  )
}
