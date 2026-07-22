import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { geoEquirectangular, geoPath, type GeoPermissibleObjects } from "d3-geo";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  BackSide,
  CanvasTexture,
  Color,
  MathUtils,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import { feature, mesh } from "topojson-client";
import type {
  GeometryCollection,
  GeometryObject,
  Topology,
} from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { places, type Place, type PlaceTerrain } from "../data/places";

export type ExploreInput = {
  horizontal: number;
  vertical: number;
};

type PlacesSceneProps = {
  selectedPlaceId: string;
  exploreMode: boolean;
  exploreInputRef: MutableRefObject<ExploreInput>;
  reduceMotion: boolean;
  onSelect: (placeId: string) => void;
};

const PLANET_RADIUS = 2.15;
const WORLD = worldAtlas as unknown as Topology<{
  countries: GeometryCollection;
  land: GeometryObject;
}>;
const LAND = feature(
  WORLD,
  WORLD.objects.land,
) as unknown as GeoPermissibleObjects;
const BORDERS = mesh(
  WORLD,
  WORLD.objects.countries,
  (countryA, countryB) => countryA !== countryB,
);
const SPHERE = { type: "Sphere" } as const;
const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const FOCUS_DIRECTION = new Vector3(0, -0.24, 0.97).normalize();

function latLonToVector3(
  [longitude, latitude]: [number, number],
  radius = 1,
) {
  const polar = MathUtils.degToRad(90 - latitude);
  const azimuth = MathUtils.degToRad(longitude + 180);

  return new Vector3(
    -radius * Math.sin(polar) * Math.cos(azimuth),
    radius * Math.cos(polar),
    radius * Math.sin(polar) * Math.sin(azimuth),
  );
}

function createGlobeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create the globe texture.");
  }

  const projection = geoEquirectangular().fitSize(
    [canvas.width, canvas.height],
    SPHERE,
  );
  const path = geoPath(projection, context);

  context.fillStyle = "#a9c7c0";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.beginPath();
  path(LAND);
  context.fillStyle = "#e7ded0";
  context.fill();

  context.beginPath();
  path(BORDERS);
  context.strokeStyle = "rgba(95, 100, 96, 0.3)";
  context.lineWidth = 0.75;
  context.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

function terrainColor(terrain: PlaceTerrain) {
  switch (terrain) {
    case "coast":
      return "#d9aa62";
    case "mountain":
      return "#87958b";
    default:
      return "#cf625b";
  }
}

function CityDiorama({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.052, 0.105, 0.01]} castShadow>
        <boxGeometry args={[0.065, 0.18, 0.06]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0.022, 0.14, -0.015]} castShadow>
        <boxGeometry args={[0.07, 0.25, 0.07]} />
        <meshStandardMaterial color="#f2c876" flatShading />
      </mesh>
      <mesh position={[0.083, 0.08, 0.027]} castShadow>
        <boxGeometry args={[0.052, 0.13, 0.052]} />
        <meshStandardMaterial color="#6f8f89" flatShading />
      </mesh>
    </group>
  );
}

function CoastDiorama({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.042, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.018, 0.2, 6]} />
        <meshStandardMaterial color="#725344" flatShading />
      </mesh>
      <mesh position={[-0.042, 0.22, 0]} rotation={[0, 0.35, 0]} castShadow>
        <coneGeometry args={[0.095, 0.12, 5]} />
        <meshStandardMaterial color="#62897a" flatShading />
      </mesh>
      <mesh position={[0.067, 0.075, 0.012]} rotation={[0, 0.4, 0]} castShadow>
        <tetrahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  );
}

function MountainDiorama({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.045, 0.105, 0]} rotation={[0, 0.35, 0]} castShadow>
        <coneGeometry args={[0.11, 0.22, 5]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0.075, 0.075, 0.025]} rotation={[0, -0.2, 0]} castShadow>
        <coneGeometry args={[0.08, 0.15, 5]} />
        <meshStandardMaterial color="#d7c7ae" flatShading />
      </mesh>
    </group>
  );
}

function DestinationWorld({
  place,
  selected,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  onSelect: (placeId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();
  const position = useMemo(
    () => latLonToVector3(place.coordinates, PLANET_RADIUS + 0.015),
    [place.coordinates],
  );
  const orientation = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        UP,
        position.clone().normalize(),
      ),
    [position],
  );
  const color = terrainColor(place.terrain);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetScale = selected ? 1.34 : hovered ? 1.16 : 1;
    const scale = MathUtils.damp(
      groupRef.current.scale.x,
      targetScale,
      9,
      delta,
    );
    groupRef.current.scale.setScalar(scale);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(place.id);
  };

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={orientation}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        gl.domElement.style.cursor = "grab";
      }}
    >
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.19, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group position={[0, selected ? 0.075 : 0.025, 0]}>
        <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial
            color={selected ? "#d04842" : "#d8c8aa"}
            emissive={selected ? "#4f0d0a" : "#000000"}
            emissiveIntensity={selected ? 0.22 : 0}
            flatShading
          />
        </mesh>

        {place.terrain === "coast" ? (
          <CoastDiorama color={color} />
        ) : place.terrain === "mountain" ? (
          <MountainDiorama color={color} />
        ) : (
          <CityDiorama color={color} />
        )}

        {selected ? (
          <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.013, 6, 28]} />
            <meshBasicMaterial color="#d04842" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

function Traveler({ inputRef }: { inputRef: MutableRefObject<ExploreInput> }) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);
  const basePosition = useMemo(
    () => FOCUS_DIRECTION.clone().multiplyScalar(PLANET_RADIUS + 0.055),
    [],
  );
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, FOCUS_DIRECTION),
    [],
  );

  useFrame((_, delta) => {
    const moving =
      Math.abs(inputRef.current.horizontal) +
        Math.abs(inputRef.current.vertical) >
      0;

    if (!groupRef.current || !bodyRef.current) {
      return;
    }

    if (moving) {
      phaseRef.current += delta * 11;
    }

    const stride = moving ? Math.sin(phaseRef.current) : 0;
    const bob = moving ? Math.abs(Math.sin(phaseRef.current)) * 0.018 : 0;
    groupRef.current.position
      .copy(basePosition)
      .addScaledVector(FOCUS_DIRECTION, bob);
    bodyRef.current.rotation.y = MathUtils.damp(
      bodyRef.current.rotation.y,
      Math.atan2(
        inputRef.current.horizontal,
        Math.max(0.001, -inputRef.current.vertical),
      ),
      8,
      delta,
    );

    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = stride * 0.55;
      rightLegRef.current.rotation.x = -stride * 0.55;
    }
  });

  return (
    <group ref={groupRef} position={basePosition} quaternion={orientation}>
      <group ref={bodyRef}>
        <mesh ref={leftLegRef} position={[-0.035, 0.055, 0]} castShadow>
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshStandardMaterial color="#2c3b40" flatShading />
        </mesh>
        <mesh ref={rightLegRef} position={[0.035, 0.055, 0]} castShadow>
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshStandardMaterial color="#2c3b40" flatShading />
        </mesh>
        <mesh position={[0, 0.17, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.13, 4, 8]} />
          <meshStandardMaterial color="#d04842" flatShading />
        </mesh>
        <mesh position={[0, 0.32, 0]} castShadow>
          <icosahedronGeometry args={[0.078, 1]} />
          <meshStandardMaterial color="#e9c5a4" flatShading />
        </mesh>
        <mesh position={[0, 0.2, -0.065]} castShadow>
          <boxGeometry args={[0.105, 0.13, 0.055]} />
          <meshStandardMaterial color="#d4a64c" flatShading />
        </mesh>
      </group>
    </group>
  );
}

function PlanetExperience({
  selectedPlaceId,
  exploreMode,
  exploreInputRef,
  reduceMotion,
  onSelect,
}: PlacesSceneProps) {
  const globeRef = useRef<Group>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const idleUntilRef = useRef(0);
  const arrivalCooldownRef = useRef(0);
  const targetQuaternionRef = useRef(new Quaternion());
  const onSelectRef = useRef(onSelect);
  const texture = useMemo(createGlobeTexture, []);
  const { camera, gl } = useThree();

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    const selectedPlace =
      places.find((place) => place.id === selectedPlaceId) ?? places[0];
    const selectedDirection = latLonToVector3(
      selectedPlace.coordinates,
    ).normalize();
    targetQuaternionRef.current.copy(
      new Quaternion().setFromUnitVectors(
        selectedDirection,
        FOCUS_DIRECTION,
      ),
    );
    idleUntilRef.current = performance.now() + (exploreMode ? 0 : 4200);
  }, [exploreMode, selectedPlaceId]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || exploreMode) {
        return;
      }

      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      idleUntilRef.current = Number.POSITIVE_INFINITY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;

      const yaw = new Quaternion().setFromAxisAngle(Y_AXIS, deltaX * 0.006);
      const pitch = new Quaternion().setFromAxisAngle(X_AXIS, deltaY * 0.006);
      targetQuaternionRef.current
        .premultiply(yaw)
        .premultiply(pitch)
        .normalize();
    };

    const finishDrag = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      canvas.style.cursor = "grab";
      idleUntilRef.current = performance.now() + 1800;

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishDrag);
    canvas.addEventListener("pointercancel", finishDrag);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishDrag);
      canvas.removeEventListener("pointercancel", finishDrag);
    };
  }, [exploreMode, gl]);

  useFrame((_, delta) => {
    const globe = globeRef.current;

    if (!globe) {
      return;
    }

    const input = exploreInputRef.current;
    const isWalking =
      exploreMode &&
      Math.abs(input.horizontal) + Math.abs(input.vertical) > 0;

    if (isWalking) {
      const yaw = new Quaternion().setFromAxisAngle(
        Y_AXIS,
        input.horizontal * delta * 0.78,
      );
      const pitch = new Quaternion().setFromAxisAngle(
        X_AXIS,
        input.vertical * delta * 0.78,
      );
      targetQuaternionRef.current
        .premultiply(yaw)
        .premultiply(pitch)
        .normalize();
    } else if (
      !exploreMode &&
      !reduceMotion &&
      !dragRef.current &&
      performance.now() >= idleUntilRef.current
    ) {
      const autoRotation = new Quaternion().setFromAxisAngle(
        Y_AXIS,
        delta * 0.055,
      );
      targetQuaternionRef.current.premultiply(autoRotation).normalize();
    }

    globe.quaternion.slerp(
      targetQuaternionRef.current,
      1 - Math.exp(-delta * (exploreMode ? 8 : 5)),
    );

    const targetCameraZ = exploreMode ? 6.3 : 6.95;
    camera.position.z = MathUtils.damp(
      camera.position.z,
      targetCameraZ,
      4,
      delta,
    );
    camera.lookAt(0, -0.05, 0);

    if (isWalking && performance.now() >= arrivalCooldownRef.current) {
      let nearestPlace: Place | null = null;
      let nearestDot = -1;

      for (const place of places) {
        const worldDirection = latLonToVector3(place.coordinates)
          .normalize()
          .applyQuaternion(globe.quaternion);
        const dot = worldDirection.dot(FOCUS_DIRECTION);

        if (dot > nearestDot) {
          nearestDot = dot;
          nearestPlace = place;
        }
      }

      if (
        nearestPlace &&
        nearestDot > 0.9975 &&
        nearestPlace.id !== selectedPlaceId
      ) {
        arrivalCooldownRef.current = performance.now() + 900;
        onSelectRef.current(nearestPlace.id);
      }
    }
  });

  return (
    <>
      <group ref={globeRef}>
        <mesh castShadow receiveShadow>
          <icosahedronGeometry args={[PLANET_RADIUS, 5]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.9}
            metalness={0}
            flatShading
          />
        </mesh>

        <mesh scale={1.003}>
          <icosahedronGeometry args={[PLANET_RADIUS, 4]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.12}
            wireframe
            depthWrite={false}
          />
        </mesh>

        {places.map((place) => (
          <DestinationWorld
            key={place.id}
            place={place}
            selected={place.id === selectedPlaceId}
            onSelect={onSelect}
          />
        ))}
      </group>

      {exploreMode ? <Traveler inputRef={exploreInputRef} /> : null}

      <mesh scale={1.075}>
        <icosahedronGeometry args={[PLANET_RADIUS, 4]} />
        <meshBasicMaterial
          color="#d04842"
          transparent
          opacity={0.055}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

export function PlacesScene(props: PlacesSceneProps) {
  return (
    <Canvas
      className="places-canvas"
      aria-hidden="true"
      camera={{ position: [0, 0.3, 6.95], fov: 40, near: 0.1, far: 50 }}
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      shadows
      onCreated={({ gl }) => {
        gl.setClearColor(new Color("#000000"), 0);
        gl.domElement.style.cursor = "grab";
        gl.domElement.style.touchAction = "none";
      }}
    >
      <ambientLight intensity={1.7} />
      <hemisphereLight args={["#fff7eb", "#55736d", 1.35]} />
      <directionalLight
        position={[4, 6, 7]}
        intensity={2.7}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, -2, 3]} intensity={0.65} color="#b9d5d0" />
      <PlanetExperience {...props} />
    </Canvas>
  );
}
