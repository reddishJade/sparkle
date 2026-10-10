import { Modal } from '@heroui/react'
import type { ReactNode } from 'react'
export default function PageViewSettings({
  title,
  children,
  onClose
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog className="w-96">
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
            <Modal.CloseTrigger />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
