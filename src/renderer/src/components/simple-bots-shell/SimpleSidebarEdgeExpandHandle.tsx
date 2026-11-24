import { useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/class-names'

const EXPAND_DRAG_THRESHOLD_PX = 28

/** Thin drag handle along a collapsed sidebar edge so dragging inward or double-clicking reopens it. */
export function SimpleSidebarEdgeExpandHandle({
  side,
  label,
  onExpand
}: {
  side: 'left' | 'right'
  label: string
  onExpand: () => void
}): React.JSX.Element {
  const onExpandRef = useRef(onExpand)
  useLayoutEffect(() => {
    onExpandRef.current = onExpand
  })

  const dragStartXRef = useRef<number | null>(null)
  const direction = side === 'left' ? 1 : -1

  useEffect(() => {
    const cleanup = (): void => {
      if (dragStartXRef.current === null) {
        return
      }
      dragStartXRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    const onMouseMove = (event: MouseEvent): void => {
      const startX = dragStartXRef.current
      if (startX === null) {
        return
      }
      const delta = (event.clientX - startX) * direction
      if (delta >= EXPAND_DRAG_THRESHOLD_PX) {
        cleanup()
        onExpandRef.current()
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', cleanup)
    window.addEventListener('blur', cleanup)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', cleanup)
      window.removeEventListener('blur', cleanup)
      cleanup()
    }
  }, [direction])

  const handleMouseDown = (event: React.MouseEvent): void => {
    event.preventDefault()
    dragStartXRef.current = event.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onMouseDown={handleMouseDown}
      onDoubleClick={onExpand}
      className={cn(
        'absolute top-0 bottom-0 z-20 w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-ring/30 active:bg-ring/50',
        side === 'left' ? 'left-0' : 'right-0'
      )}
    />
  )
}
