import { useRef, useEffect } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import {
  OrbitControls,
  ContactShadows,
  Grid,
  Environment,
  Sparkles,
} from "@react-three/drei"
import * as THREE from "three"
import { gsap } from "gsap"
import { Warehouse } from "./elements/Warehouse"
import { Rack } from "./elements/Rack"
import { ConveyorBelt } from "./elements/ConveyorBelt"
import { Truck } from "./elements/Truck"
import { AGV } from "./elements/AGV"
import { RoboticArm } from "./elements/RoboticArm"
import { DistributionCenter } from "./elements/DistributionCenter"
import { SupplyRoute } from "./elements/SupplyRoute"
import { FloatingCard3D } from "./elements/FloatingCard3D"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { hasWebGL } from "@/lib/webgl"
import { Building2, Package, Truck as TruckIcon, Factory, Network } from "lucide-react"

export type CameraPreset =
  | "overview"
  | "warehouse"
  | "robotics"
  | "fleet"
  | "suppliers"
  | "hubs"
  | "dc-west"
  | "dc-east"

export interface PanCommand {
  dx: number
  dy: number
  timestamp: number
}

export interface OrbitCommand {
  angle: number
  timestamp: number
}

// DYNAMIC 3/4 ISOMETRIC PERSPECTIVE CAMERA ANGLES ACCURATELY FRAMING EACH FACILITY
export const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; lookAt: [number, number, number]; label: string }
> = {
  overview: { pos: [62, 54, 76], lookAt: [0, 4, 4], label: "Global Campus (Isometric)" },
  warehouse: { pos: [28, 24, 42], lookAt: [0, 7, 4], label: "Smart Warehouse" },
  robotics: { pos: [-20, 16, 38], lookAt: [-18, 3, 14], label: "Robotic Sortation" },
  fleet: { pos: [18, 18, 54], lookAt: [0, 3, 23], label: "Fleet & Docks" },
  suppliers: { pos: [-10, 26, 86], lookAt: [-38, 6, 50], label: "Supplier Hub" },
  hubs: { pos: [-34, 26, -8], lookAt: [-60, 6, -36], label: "Regional Hubs" },
  "dc-west": { pos: [-34, 26, -8], lookAt: [-60, 6, -36], label: "Regional DC West" },
  "dc-east": { pos: [38, 26, 0], lookAt: [64, 6, -30], label: "Regional DC East" },
}

interface SceneContentProps {
  activeZone: string | null
  setActiveZone: (id: string | null) => void
  cameraPreset: CameraPreset
  zoomTrigger: number
  panTrigger?: PanCommand | null
  orbitTrigger?: OrbitCommand | null
  dragMode?: "orbit" | "pan"
  metrics: {
    totalSalesRevenue: number
    totalSalesCount: number
    totalInventoryUnits: number
    inventorySkuCount: number
    activePos: number
    pendingPos: number
    totalSuppliers: number
    totalDatasets: number
  }
}

function SceneContent({
  activeZone,
  setActiveZone,
  cameraPreset,
  zoomTrigger,
  panTrigger,
  orbitTrigger,
  dragMode = "orbit",
  metrics,
}: SceneContentProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const prevZoomTrigger = useRef(zoomTrigger)

  // Direct programmatic side movement (Pan Left / Right / Up / Down)
  const panCamera = (deltaX: number, deltaY: number) => {
    if (!controlsRef.current) return
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize()
    const up = camera.up.clone().normalize()

    const offset = new THREE.Vector3()
      .addScaledVector(right, deltaX)
      .addScaledVector(up, deltaY)

    gsap.to(camera.position, {
      x: camera.position.x + offset.x,
      y: camera.position.y + offset.y,
      z: camera.position.z + offset.z,
      duration: 0.35,
      ease: "power2.out",
      onUpdate: () => controlsRef.current?.update(),
    })

    gsap.to(controlsRef.current.target, {
      x: controlsRef.current.target.x + offset.x,
      y: controlsRef.current.target.y + offset.y,
      z: controlsRef.current.target.z + offset.z,
      duration: 0.35,
      ease: "power2.out",
      onUpdate: () => controlsRef.current?.update(),
    })
  }

  // Direct programmatic orbit rotation (Left / Right)
  const orbitCamera = (angleDelta: number) => {
    if (!controlsRef.current) return
    const target = controlsRef.current.target
    const offset = new THREE.Vector3().subVectors(camera.position, target)
    const radius = offset.length()
    const theta = Math.atan2(offset.x, offset.z) + angleDelta
    const phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)))

    const newX = target.x + radius * Math.sin(phi) * Math.sin(theta)
    const newY = target.y + radius * Math.cos(phi)
    const newZ = target.z + radius * Math.sin(phi) * Math.cos(theta)

    gsap.to(camera.position, {
      x: newX,
      y: newY,
      z: newZ,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => controlsRef.current?.update(),
    })
  }

  // Keyboard navigation listener (Arrow keys / WASD to pan sideways, Q/E to orbit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return
      }

      const panStep = 3.5
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        panCamera(-panStep, 0)
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        panCamera(panStep, 0)
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        panCamera(0, panStep)
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        panCamera(0, -panStep)
      } else if (e.key === "q" || e.key === "Q") {
        orbitCamera(-0.15)
      } else if (e.key === "e" || e.key === "E") {
        orbitCamera(0.15)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [camera])

  // Precision Zoom (+ / -)
  useEffect(() => {
    if (!controlsRef.current || zoomTrigger === 0) return
    const delta = zoomTrigger - prevZoomTrigger.current
    prevZoomTrigger.current = zoomTrigger

    if (delta !== 0) {
      const target = controlsRef.current.target
      const dir = new THREE.Vector3().subVectors(camera.position, target)
      const currentDist = dir.length()
      const factor = delta > 0 ? 0.75 : 1.35
      const newDist = Math.max(3.5, Math.min(140, currentDist * factor))
      dir.normalize().multiplyScalar(newDist)

      gsap.to(camera.position, {
        duration: 0.5,
        x: target.x + dir.x,
        y: target.y + dir.y,
        z: target.z + dir.z,
        ease: "power2.out",
        onUpdate: () => controlsRef.current?.update(),
      })
    }
  }, [zoomTrigger, camera])

  // External programmatic Pan Trigger
  useEffect(() => {
    if (!panTrigger) return
    panCamera(panTrigger.dx, panTrigger.dy)
  }, [panTrigger])

  // External programmatic Orbit Trigger
  useEffect(() => {
    if (!orbitTrigger) return
    orbitCamera(orbitTrigger.angle)
  }, [orbitTrigger])

  // Smooth cinematic camera transition with accurate targeting for each facility
  useEffect(() => {
    if (!controlsRef.current) return

    let targetConfig = CAMERA_PRESETS[cameraPreset] || CAMERA_PRESETS.overview

    if (activeZone === "warehouse") {
      targetConfig = CAMERA_PRESETS.warehouse
    } else if (activeZone === "conveyor" || activeZone === "robotics") {
      targetConfig = CAMERA_PRESETS.robotics
    } else if (activeZone === "fleet" || activeZone === "dock") {
      targetConfig = CAMERA_PRESETS.fleet
    } else if (activeZone === "suppliers") {
      // ACCURATELY TARGET THE SUPPLIER HUB AT [-38, 0, 50]
      targetConfig = CAMERA_PRESETS.suppliers
    } else if (activeZone === "dc-west" || activeZone === "hubs") {
      // ACCURATELY TARGET REGIONAL DC WEST AT [-60, 0, -36]
      targetConfig = CAMERA_PRESETS["dc-west"]
    } else if (activeZone === "dc-east") {
      // ACCURATELY TARGET REGIONAL DC EAST AT [64, 0, -30]
      targetConfig = CAMERA_PRESETS["dc-east"]
    }

    gsap.killTweensOf(camera.position)
    gsap.killTweensOf(controlsRef.current.target)

    // Disable OrbitControls damping during flight to eliminate stutter
    controlsRef.current.enabled = false

    const timeline = gsap.timeline({
      onUpdate: () => {
        controlsRef.current?.update()
      },
      onComplete: () => {
        if (controlsRef.current) {
          controlsRef.current.enabled = true
        }
      },
    })

    timeline.to(
      camera.position,
      {
        duration: 1.3,
        x: targetConfig.pos[0],
        y: targetConfig.pos[1],
        z: targetConfig.pos[2],
        ease: "power2.inOut",
      },
      0
    )

    timeline.to(
      controlsRef.current.target,
      {
        duration: 1.3,
        x: targetConfig.lookAt[0],
        y: targetConfig.lookAt[1],
        z: targetConfig.lookAt[2],
        ease: "power2.inOut",
      },
      0
    )
  }, [cameraPreset, activeZone, camera])

  useFrame(() => {
    if (controlsRef.current && controlsRef.current.enabled) {
      controlsRef.current.update()
    }
  })

  return (
    <>
      {/* PBR Realistic Environment Map */}
      <Environment preset="city" environmentIntensity={0.8} />

      {/* Radiant High-Tech Architectural Lighting Setup */}
      <ambientLight intensity={1.05} color="#e2e8f0" />
      <hemisphereLight intensity={1.15} color="#38bdf8" groundColor="#0f172a" />

      {/* Key Sun Light with Soft Directional Shadows */}
      <directionalLight
        position={[65, 110, 65]}
        intensity={3.2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-80}
        shadow-bias={-0.00005}
      />

      {/* Volumetric Cyan, Violet & Emerald Cyber Spotlights */}
      <spotLight
        position={[0, 75, 25]}
        intensity={4.2}
        color="#06b6d4"
        penumbra={0.6}
        decay={1.2}
        distance={220}
        angle={0.75}
      />
      <pointLight position={[-75, 35, -35]} intensity={3.5} color="#06b6d4" distance={160} />
      <pointLight position={[75, 35, -30]} intensity={3.5} color="#a855f7" distance={160} />
      <pointLight position={[-40, 32, 55]} intensity={3.2} color="#10b981" distance={140} />
      <pointLight position={[0, 30, 55]} intensity={3.0} color="#38bdf8" distance={140} />

      {/* Distant Atmospheric Fog (Does NOT obscure the campus buildings) */}
      <fog attach="fog" args={["#050b18", 120, 500]} />

      {/* Accurate High-Precision Orbit Controls with Cursor Zoom & Screen-Space Panning */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={true}
        screenSpacePanning={true}
        enableZoom={true}
        enableRotate={true}
        zoomToCursor={true}
        zoomSpeed={1.2}
        rotateSpeed={0.8}
        panSpeed={1.4}
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={180}
        maxPolarAngle={Math.PI / 2 - 0.04}
        mouseButtons={
          dragMode === "pan"
            ? {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE,
              }
            : {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
              }
        }
      />

      {/* Floor Contact Shadows */}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.8}
        scale={200}
        blur={2.0}
        far={20}
      />

      {/* Glossy High-Tech Platform Floor */}
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial
          color="#080f1e"
          roughness={0.45}
          metalness={0.65}
        />
      </mesh>

      {/* Smooth Fading High-Tech Grid Floor */}
      <Grid
        position={[0, 0.01, 0]}
        args={[400, 400]}
        cellSize={2}
        cellThickness={0.9}
        cellColor="#1e3a5f"
        sectionSize={10}
        sectionThickness={1.8}
        sectionColor="#06b6d4"
        fadeDistance={180}
        fadeStrength={1.5}
      />

      {/* Atmospheric Floating Cyber Sparkles */}
      <Sparkles
        count={180}
        scale={[170, 45, 170]}
        size={2.5}
        speed={0.4}
        color="#06b6d4"
        opacity={0.65}
      />

      {/* ============================================================ */}
      {/* 1. CENTRAL AUTOMATED HIGH-BAY WAREHOUSE */}
      {/* ============================================================ */}
      <group position={[0, 0, 0]}>
        <Warehouse
          position={[0, 0, 0]}
          onClick={() => setActiveZone(activeZone === "warehouse" ? null : "warehouse")}
        />

        {/* High-Bay Automated Pallet Racking Rows */}
        {[-16, -8, 8, 16].map((x, i) => (
          <Rack
            key={`rack-front-${i}`}
            position={[x, 0, 8]}
            levels={4}
            onClick={() => setActiveZone("warehouse")}
          />
        ))}
        {[-16, -8, 8, 16].map((x, i) => (
          <Rack
            key={`rack-back-${i}`}
            position={[x, 0, -8]}
            rotation={[0, Math.PI, 0]}
            levels={4}
            onClick={() => setActiveZone("warehouse")}
          />
        ))}

        {/* Floating 3D Badge */}
        <FloatingCard3D
          position={[0, 24, 12]}
          title="Fulfillment Center"
          metric={
            metrics.totalInventoryUnits > 0
              ? `${metrics.totalInventoryUnits.toLocaleString()} Units`
              : "1,250 Units"
          }
          subtext={`${metrics.inventorySkuCount || 3} SKUs Online`}
          icon={Building2}
          status="optimal"
          isSelected={activeZone === "warehouse"}
          onClick={() => setActiveZone("warehouse")}
        />
      </group>

      {/* ============================================================ */}
      {/* 2. ROBOTIC WAREHOUSE EQUIPMENT */}
      {/* ============================================================ */}
      <RoboticArm
        position={[-14, 0, 16]}
        rotation={[0, 0.3, 0]}
        scale={1.15}
        speedMultiplier={1.0}
        onClick={() => setActiveZone("robotics")}
      />
      <RoboticArm
        position={[14, 0, 16]}
        rotation={[0, -0.3, 0]}
        scale={1.15}
        speedMultiplier={0.9}
        onClick={() => setActiveZone("robotics")}
      />

      {/* AGV 01 (Central storage aisle) */}
      <AGV
        waypoints={[
          [-16, 14],
          [-2, 14],
          [12, 14],
          [12, -2],
          [-2, -2],
          [-16, -2],
        ]}
        speed={4.5}
        label="AGV-01"
        onClick={() => setActiveZone("robotics")}
      />
      {/* AGV 02 (Loading dock apron) */}
      <AGV
        waypoints={[
          [-20, 27],
          [0, 27],
          [20, 27],
          [14, 33],
          [-14, 33],
        ]}
        speed={3.8}
        label="AGV-02"
        onClick={() => setActiveZone("fleet")}
      />

      {/* ============================================================ */}
      {/* 3. CONVEYOR BELT SYSTEMS */}
      {/* ============================================================ */}
      <ConveyorBelt
        position={[-26, 0.6, 14]}
        rotation={[0, 0, 0]}
        length={34}
        width={3.4}
        speed={4.2}
        packageCount={14}
        onClick={() => setActiveZone("conveyor")}
      />
      <ConveyorBelt
        position={[26, 0.6, 14]}
        rotation={[0, 0, 0]}
        length={32}
        width={3.4}
        speed={4.0}
        packageCount={12}
        onClick={() => setActiveZone("conveyor")}
      />

      {/* Floating 3D Badge over Conveyor */}
      <FloatingCard3D
        position={[-26, 6, 14]}
        title="Sortation Belt"
        metric={
          metrics.totalSalesRevenue > 0
            ? `$${Math.round(metrics.totalSalesRevenue).toLocaleString()}`
            : "$2,590 Outbound"
        }
        subtext="Throughput Active"
        icon={Package}
        status="active"
        isSelected={activeZone === "conveyor" || activeZone === "robotics"}
        onClick={() => setActiveZone("conveyor")}
      />

      {/* ============================================================ */}
      {/* 4. FLEET LOGISTICS DOCKS & ANIMATED DELIVERY TRUCKS */}
      {/* ============================================================ */}
      <Truck
        start={[-58, 1.4, -32]}
        end={[-18, 1.4, 23]}
        duration={20}
        offset={0}
        onClick={() => setActiveZone("fleet")}
      />
      <Truck
        start={[62, 1.4, -26]}
        end={[6, 1.4, 23]}
        duration={24}
        offset={8}
        onClick={() => setActiveZone("fleet")}
      />
      <Truck
        start={[-36, 1.4, 46]}
        end={[18, 1.4, 23]}
        duration={22}
        offset={15}
        onClick={() => setActiveZone("fleet")}
      />

      {/* Floating 3D Badge over Docks */}
      <FloatingCard3D
        position={[0, 11, 26]}
        title="Fleet Docks"
        metric={
          metrics.activePos > 0
            ? `${metrics.activePos} Active POs`
            : "3 Trucks In Queue"
        }
        subtext="All Bays Connected"
        icon={TruckIcon}
        status="optimal"
        isSelected={activeZone === "fleet"}
        onClick={() => setActiveZone("fleet")}
      />

      {/* ============================================================ */}
      {/* 5. REGIONAL DISTRIBUTION CENTERS & CONNECTING SUPPLY ROUTES */}
      {/* ============================================================ */}
      <DistributionCenter
        position={[-60, 0, -36]}
        scale={1.05}
        accentColor="cyan"
        onClick={() => setActiveZone("dc-west")}
      />
      <FloatingCard3D
        position={[-60, 20, -36]}
        title="Regional DC West"
        metric="99.8% On-Time"
        subtext="Transit Hub"
        icon={Factory}
        status="optimal"
        isSelected={activeZone === "dc-west"}
        onClick={() => setActiveZone("dc-west")}
      />

      <DistributionCenter
        position={[64, 0, -30]}
        scale={1.1}
        accentColor="violet"
        onClick={() => setActiveZone("dc-east")}
      />
      <FloatingCard3D
        position={[64, 20, -30]}
        title="Regional DC East"
        metric="Priority Node"
        subtext="Live Route Active"
        icon={Network}
        status="active"
        isSelected={activeZone === "dc-east"}
        onClick={() => setActiveZone("dc-east")}
      />

      <DistributionCenter
        position={[-38, 0, 50]}
        scale={0.95}
        accentColor="cyan"
        onClick={() => setActiveZone("suppliers")}
      />
      <FloatingCard3D
        position={[-38, 16.5, 50]}
        title="Supplier Hub"
        metric={
          metrics.totalSuppliers > 0
            ? `${metrics.totalSuppliers} Partners`
            : "Tier-1 Suppliers"
        }
        subtext="Acme & Global Co"
        icon={Factory}
        status="optimal"
        isSelected={activeZone === "suppliers"}
        onClick={() => setActiveZone("suppliers")}
      />

      {/* Luminous 3D Supply Routes with Energy Pulses */}
      <SupplyRoute
        start={[-58, 1.2, -32]}
        end={[-18, 1.2, 21]}
        color={0x06b6d4}
        speed={0.55}
        arcHeight={12}
      />
      <SupplyRoute
        start={[6, 1.2, 21]}
        end={[64, 1.2, -26]}
        color={0x8b5cf6}
        speed={0.48}
        arcHeight={14}
      />
      <SupplyRoute
        start={[-38, 1.2, 46]}
        end={[18, 1.2, 21]}
        color={0x10b981}
        speed={0.5}
        arcHeight={10}
      />
    </>
  )
}

interface SupplyChainSceneProps {
  activeZone: string | null
  setActiveZone: (id: string | null) => void
  cameraPreset?: CameraPreset
  zoomTrigger?: number
  panTrigger?: PanCommand | null
  orbitTrigger?: OrbitCommand | null
  dragMode?: "orbit" | "pan"
  metrics: {
    totalSalesRevenue: number
    totalSalesCount: number
    totalInventoryUnits: number
    inventorySkuCount: number
    activePos: number
    pendingPos: number
    totalSuppliers: number
    totalDatasets: number
  }
}

export function SupplyChainScene({
  activeZone,
  setActiveZone,
  cameraPreset = "overview",
  zoomTrigger = 0,
  panTrigger = null,
  orbitTrigger = null,
  dragMode = "orbit",
  metrics,
}: SupplyChainSceneProps) {
  const isAvailable = hasWebGL()

  if (!isAvailable) {
    return (
      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">3D Acceleration Offline</h3>
        <p className="text-sm text-slate-400 max-w-md">
          WebGL is not enabled in your current browser configuration.
        </p>
      </div>
    )
  }

  return (
    <ErrorBoundary
      fallback={() => (
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
          <p className="text-sm text-slate-400 font-mono">3D Canvas encountered a rendering error</p>
        </div>
      )}
    >
      <div className="absolute inset-0 w-full h-full">
        <Canvas
          shadows
          camera={{
            position: CAMERA_PRESETS.overview.pos,
            fov: 40, // CRISP 3/4 ARCHITECTURAL ISOMETRIC FIELD OF VIEW
            near: 0.1,
            far: 800,
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping, // ACES FILMIC TONE MAPPING FOR VIBRANT NEON & SPECULAR SHINE
            toneMappingExposure: 1.4,
          }}
          className="w-full h-full"
        >
          <SceneContent
            activeZone={activeZone}
            setActiveZone={setActiveZone}
            cameraPreset={cameraPreset}
            zoomTrigger={zoomTrigger}
            panTrigger={panTrigger}
            orbitTrigger={orbitTrigger}
            dragMode={dragMode}
            metrics={metrics}
          />
        </Canvas>
      </div>
    </ErrorBoundary>
  )
}
