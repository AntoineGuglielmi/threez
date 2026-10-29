import * as THREE from 'three'

type BoardViewportOptions = {
  element: HTMLCanvasElement
  camera: THREE.OrthographicCamera
  cameraTarget: THREE.Vector3
  syncCameraPosition: () => void
  getZoom: () => number
  setZoom: (zoom: number) => void
  onCameraChange: () => void
}

export const setupBoardViewport = ({
  element,
  camera,
  cameraTarget,
  syncCameraPosition,
  getZoom,
  setZoom,
  onCameraChange,
}: BoardViewportOptions) => {
  let isDragging = false
  let hasDragged = false
  let pointerDownPosition = { x: 0, y: 0 }
  let previousPointer = { x: 0, y: 0 }

  element.addEventListener('pointerdown', (event) => {
    isDragging = true
    hasDragged = false
    pointerDownPosition = { x: event.clientX, y: event.clientY }
    previousPointer = { x: event.clientX, y: event.clientY }
    element.setPointerCapture(event.pointerId)
  })

  element.addEventListener('pointermove', (event) => {
    if (!isDragging) return
    const deltaX = event.clientX - previousPointer.x
    const deltaY = event.clientY - previousPointer.y
    if (Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y) > 5) {
      hasDragged = true
    }

    const worldPerPixel = (camera.top - camera.bottom) / camera.zoom / element.clientHeight
    camera.updateMatrixWorld()
    const screenRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    screenRight.y = 0
    screenRight.normalize()
    const screenUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    screenUp.y = 0
    screenUp.normalize()
    cameraTarget.addScaledVector(screenRight, -deltaX * worldPerPixel)
    cameraTarget.addScaledVector(screenUp, deltaY * worldPerPixel)
    syncCameraPosition()
    onCameraChange()
    previousPointer = { x: event.clientX, y: event.clientY }
  })

  element.addEventListener('pointerup', () => {
    isDragging = false
  })

  element.addEventListener('pointercancel', () => {
    isDragging = false
  })

  element.addEventListener('wheel', (event) => {
    event.preventDefault()
    setZoom(THREE.MathUtils.clamp(getZoom() + event.deltaY * -0.0015, 1, 3.2))
    onCameraChange()
  }, { passive: false })

  return { hasDragged: () => hasDragged }
}
