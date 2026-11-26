import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  type Params,
  type WaveSolution,
  sampleWave,
} from './physics'

const X_MIN = -8
const X_MAX = 10
const N_POINTS = 220
const SURFACE_HALF_W = 1.35

export class TunnelScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls

  private densityMesh: THREE.Mesh
  private waveLine: THREE.Line
  private barrierMesh: THREE.Mesh
  private turningLeft: THREE.Mesh
  private turningRight: THREE.Mesh
  private tintIncident: THREE.Mesh
  private tintBarrier: THREE.Mesh
  private tintTransmit: THREE.Mesh
  private clock = new THREE.Clock()
  private params: Params
  private sol: WaveSolution
  private densMax = 1

  constructor(canvas: HTMLCanvasElement, params: Params, sol: WaveSolution) {
    this.params = params
    this.sol = sol

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x0c1520, 0.028)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120)
    this.camera.position.set(6.5, 7.2, 11.5)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.target.set(1.2, 1.2, 0)
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.minDistance = 4
    this.controls.maxDistance = 28

    this.addLights()
    this.scene.add(this.makeFloor())

    this.barrierMesh = this.makeBarrier()
    this.scene.add(this.barrierMesh)

    this.turningLeft = this.makeTurningMarker()
    this.turningRight = this.makeTurningMarker()
    this.scene.add(this.turningLeft, this.turningRight)

    const tints = this.makeRegionTints()
    this.tintIncident = tints.incident
    this.tintBarrier = tints.barrier
    this.tintTransmit = tints.transmit
    this.scene.add(this.tintIncident, this.tintBarrier, this.tintTransmit)
    this.addAxisGuides()

    this.densityMesh = this.makeDensitySurface()
    this.scene.add(this.densityMesh)

    this.waveLine = this.makeWaveRibbon()
    this.scene.add(this.waveLine)

    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private addLights() {
    const amb = new THREE.AmbientLight(0xb8c9d9, 0.55)
    const key = new THREE.DirectionalLight(0xffe2c4, 1.15)
    key.position.set(6, 12, 8)
    const fill = new THREE.DirectionalLight(0x7ec8e3, 0.45)
    fill.position.set(-8, 4, -4)
    const rim = new THREE.PointLight(0x3dd6c6, 1.2, 40)
    rim.position.set(2, 3, -6)
    this.scene.add(amb, key, fill, rim)
  }

  private makeFloor(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(40, 18, 1, 1)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x132032,
      metalness: 0.15,
      roughness: 0.92,
      transparent: true,
      opacity: 0.85,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -0.02
    return mesh
  }

  private addAxisGuides() {
    const mat = new THREE.LineBasicMaterial({
      color: 0x3a5168,
      transparent: true,
      opacity: 0.7,
    })
    const pts = [new THREE.Vector3(X_MIN, 0, 0), new THREE.Vector3(X_MAX, 0, 0)]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    this.scene.add(new THREE.Line(geo, mat))
  }

  private makeRegionTints() {
    const makeTint = (color: number) => {
      const g = new THREE.PlaneGeometry(1, 0.04)
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(g, m)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.01
      return mesh
    }
    return {
      incident: makeTint(0x2a6f9a),
      barrier: makeTint(0xc47a3a),
      transmit: makeTint(0x2f8f6b),
    }
  }

  private placeTint(mesh: THREE.Mesh, x0: number, x1: number) {
    const w = Math.max(x1 - x0, 0.01)
    mesh.scale.set(w, 1, 1)
    mesh.position.x = (x0 + x1) / 2
  }

  private makeBarrier(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xd9773a,
      metalness: 0.05,
      roughness: 0.35,
      transmission: 0.55,
      thickness: 1.2,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    return mesh
  }

  private makeTurningMarker(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 4.5, 12)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf0c674,
      transparent: true,
      opacity: 0.85,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = 2.25
    return mesh
  }

  private makeDensitySurface(): THREE.Mesh {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(N_POINTS * 2 * 3)
    const colors = new Float32Array(N_POINTS * 2 * 3)
    const indices: number[] = []

    for (let i = 0; i < N_POINTS - 1; i++) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, b, c, b, d, c)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setIndex(indices)

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.45,
      transparent: true,
      opacity: 0.92,
    })
    return new THREE.Mesh(geo, mat)
  }

  private makeWaveRibbon(): THREE.Line {
    const positions = new Float32Array(N_POINTS * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0xe8f4ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
    })
    return new THREE.Line(geo, mat)
  }

  updatePhysics(params: Params, sol: WaveSolution) {
    this.params = params
    this.sol = sol

    // Barrier geometry: width L, height ~ V0
    const h = 0.55 + params.V0 * 0.42
    this.barrierMesh.scale.set(params.L, h, 2.4)
    this.barrierMesh.position.set(params.L / 2, h / 2, 0)

    this.placeTint(this.tintIncident, X_MIN, 0)
    this.placeTint(this.tintBarrier, 0, params.L)
    this.placeTint(this.tintTransmit, params.L, X_MAX)

    // Classical turning points at barrier faces when E < V0
    const tunneling = sol.regime === 'tunneling' || sol.regime === 'resonant'
    this.turningLeft.visible = tunneling
    this.turningRight.visible = tunneling
    this.turningLeft.position.x = 0
    this.turningRight.position.x = params.L
    this.turningLeft.scale.y = h / 4.5 + 0.15
    this.turningRight.scale.y = h / 4.5 + 0.15
    this.turningLeft.position.y = h / 2
    this.turningRight.position.y = h / 2

    // Precompute dens max for normalization
    const samples = sampleWave(params, sol, X_MIN, X_MAX, N_POINTS, 0)
    this.densMax = Math.max(...samples.map((s) => s.dens), 0.05)
  }

  private regionColor(x: number, L: number): THREE.Color {
    if (x < 0) return new THREE.Color(0x4eb3e0)
    if (x <= L) return new THREE.Color(0xf0a05a)
    return new THREE.Color(0x4fd6a0)
  }

  private refreshGeometry(t: number) {
    const samples = sampleWave(this.params, this.sol, X_MIN, X_MAX, N_POINTS, t)
    const densPos = this.densityMesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const densCol = this.densityMesh.geometry.getAttribute('color') as THREE.BufferAttribute
    const wavePos = this.waveLine.geometry.getAttribute('position') as THREE.BufferAttribute

    const amp = 2.8 / this.densMax
    const waveAmp = 1.1

    for (let i = 0; i < N_POINTS; i++) {
      const s = samples[i]
      const y = Math.min(s.dens * amp, 5.5)
      const col = this.regionColor(s.x, this.params.L)

      // two vertices across z for a ribbon surface
      densPos.setXYZ(i * 2, s.x, y, -SURFACE_HALF_W)
      densPos.setXYZ(i * 2 + 1, s.x, y, SURFACE_HALF_W)
      densCol.setXYZ(i * 2, col.r, col.g, col.b)
      densCol.setXYZ(i * 2 + 1, col.r, col.g, col.b)

      wavePos.setXYZ(i, s.x, 0.15 + s.re * waveAmp + y * 0.15, 0)
    }

    densPos.needsUpdate = true
    densCol.needsUpdate = true
    this.densityMesh.geometry.computeVertexNormals()
    wavePos.needsUpdate = true
  }

  resize() {
    const parent = this.renderer.domElement.parentElement
    const w = parent?.clientWidth ?? window.innerWidth
    const h = parent?.clientHeight ?? window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  render() {
    const t = this.clock.getElapsedTime()
    this.refreshGeometry(t * 0.85)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}
