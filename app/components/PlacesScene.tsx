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
  type RefObject,
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
  jumpSequence: number;
};

type PlacesSceneProps = {
  selectedPlaceId: string;
  exploreMode: boolean;
  exploreInputRef: MutableRefObject<ExploreInput>;
  reduceMotion: boolean;
  projectionRef: RefObject<HTMLButtonElement | null>;
  onSelect: (placeId: string) => void;
  onNearbyChange: (placeId: string | null) => void;
};

const PLANET_RADIUS = 6;
const WALK_SPEED = 0.32;
const TURN_SPEED = 2.1;
const START_DISTANCE = 0.24;
const NEARBY_DISTANCE = Math.cos(0.075);
const JUMP_DURATION = 0.52;
const BROWSE_CAMERA_POSITION = new Vector3(0, 0.45, 18.8);
const EXPLORE_CAMERA_HEIGHT = 18;
const EXPLORE_CAMERA_TRAIL = 14;
const EXPLORE_TARGET_HEIGHT = 4.8;
const EXPLORE_TARGET_LEAD = 0.8;
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
  const latitudeRadians = MathUtils.degToRad(latitude);
  const longitudeRadians = MathUtils.degToRad(longitude);
  const ringRadius = radius * Math.cos(latitudeRadians);

  return new Vector3(
    -ringRadius * Math.cos(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    ringRadius * Math.sin(longitudeRadians),
  );
}

const PLACE_DIRECTIONS = new Map(
  places.map((place) => [
    place.id,
    latLonToVector3(place.coordinates).normalize(),
  ]),
);

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

function PhotoProjection({
  projectionRef,
}: {
  projectionRef: RefObject<HTMLButtonElement | null>;
}) {
  const anchorRef = useRef<Group>(null);
  const projectedPositionRef = useRef(new Vector3());
  const { camera, gl } = useThree();

  useEffect(
    () => () => {
      const projection = projectionRef.current;

      if (projection) {
        projection.style.opacity = "0";
        projection.style.pointerEvents = "none";
      }
    },
    [projectionRef],
  );

  useFrame(({ clock }) => {
    const anchor = anchorRef.current;
    const projection = projectionRef.current;

    if (!anchor || !projection) {
      return;
    }

    anchor.position.y = 0.9 + Math.sin(clock.elapsedTime * 1.45) * 0.025;
    anchor.updateWorldMatrix(true, false);

    const projectedPosition = projectedPositionRef.current;
    anchor.getWorldPosition(projectedPosition);
    projectedPosition.project(camera);

    const visible =
      projectedPosition.z > -1 &&
      projectedPosition.z < 1 &&
      Math.abs(projectedPosition.x) < 1.2 &&
      Math.abs(projectedPosition.y) < 1.2;
    const x = (projectedPosition.x * 0.5 + 0.5) * gl.domElement.clientWidth;
    const y = (-projectedPosition.y * 0.5 + 0.5) * gl.domElement.clientHeight;

    projection.style.opacity = visible ? "1" : "0";
    projection.style.pointerEvents = visible ? "auto" : "none";
    projection.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  });

  return (
    <group scale={0.5}>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.008, 0.018, 0.66, 6]} />
        <meshBasicMaterial color="#d04842" transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.026, 8, 6]} />
        <meshBasicMaterial color="#d04842" />
      </mesh>
      <group ref={anchorRef} position={[0, 0.9, 0]} />
    </group>
  );
}

function DestinationWorld({
  place,
  selected,
  exploreMode,
  projectionRef,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  exploreMode: boolean;
  projectionRef: RefObject<HTMLButtonElement | null>;
  onSelect: (placeId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();
  const position = useMemo(
    () => latLonToVector3(place.coordinates, PLANET_RADIUS + 0.025),
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

    const targetScale = selected ? 1.9 : hovered ? 1.65 : 1.48;
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
        gl.domElement.style.cursor = exploreMode ? "default" : "grab";
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

      {selected ? <PhotoProjection projectionRef={projectionRef} /> : null}
    </group>
  );
}

function Traveler({
  inputRef,
  playerUpRef,
  playerForwardRef,
  reduceMotion,
}: {
  inputRef: MutableRefObject<ExploreInput>;
  playerUpRef: MutableRefObject<Vector3>;
  playerForwardRef: MutableRefObject<Vector3>;
  reduceMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);
  const jumpElapsedRef = useRef(JUMP_DURATION);
  const lastJumpSequenceRef = useRef(inputRef.current.jumpSequence);
  const positionRef = useRef(new Vector3());
  const lookTargetRef = useRef(new Vector3());

  useFrame((_, delta) => {
    const moving =
      Math.abs(inputRef.current.horizontal) +
        Math.abs(inputRef.current.vertical) >
      0;

    if (!groupRef.current) {
      return;
    }

    if (moving) {
      phaseRef.current += delta * 11;
    }

    if (inputRef.current.jumpSequence !== lastJumpSequenceRef.current) {
      lastJumpSequenceRef.current = inputRef.current.jumpSequence;
      jumpElapsedRef.current = 0;
    }

    jumpElapsedRef.current = Math.min(
      JUMP_DURATION,
      jumpElapsedRef.current + delta,
    );

    const jumpProgress = jumpElapsedRef.current / JUMP_DURATION;
    const jumping = jumpProgress < 1;
    const jumpCurve = jumping ? Math.sin(jumpProgress * Math.PI) : 0;
    const jumpLift = jumpCurve * (reduceMotion ? 0.08 : 0.38);

    const stride = moving ? Math.sin(phaseRef.current) : 0;
    const bob = moving ? Math.abs(Math.sin(phaseRef.current)) * 0.018 : 0;
    const playerUp = playerUpRef.current;
    const playerForward = playerForwardRef.current;
    const position = positionRef.current
      .copy(playerUp)
      .multiplyScalar(PLANET_RADIUS + 0.055 + bob + jumpLift);
    const lookTarget = lookTargetRef.current
      .copy(position)
      .add(playerForward);

    groupRef.current.position.copy(position);
    groupRef.current.up.copy(playerUp);
    groupRef.current.lookAt(lookTarget);

    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = jumping ? -0.34 : stride * 0.55;
      rightLegRef.current.rotation.x = jumping ? -0.34 : -stride * 0.55;
    }
  });

  return (
    <group ref={groupRef} scale={1.9}>
      <group>
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
  projectionRef,
  onSelect,
  onNearbyChange,
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
  const playerUpRef = useRef(new Vector3(0, 1, 0));
  const playerForwardRef = useRef(new Vector3(0, 0, 1));
  const wasExploreModeRef = useRef(false);
  const nearbyPlaceIdRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const onNearbyChangeRef = useRef(onNearbyChange);
  const movementAxisRef = useRef(new Vector3());
  const desiredCameraRef = useRef(new Vector3());
  const cameraTargetRef = useRef(new Vector3());
  const texture = useMemo(createGlobeTexture, []);
  const { camera, gl } = useThree();

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onNearbyChangeRef.current = onNearbyChange;
  }, [onNearbyChange]);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    const selectedPlace =
      places.find((place) => place.id === selectedPlaceId) ?? places[0];
    const selectedDirection = PLACE_DIRECTIONS.get(selectedPlace.id)?.clone();

    if (!selectedDirection) {
      return;
    }

    if (exploreMode && !wasExploreModeRef.current) {
      const east = new Vector3().crossVectors(Y_AXIS, selectedDirection);

      if (east.lengthSq() < 0.0001) {
        east.crossVectors(new Vector3(0, 0, 1), selectedDirection);
      }

      east.normalize();
      playerUpRef.current
        .copy(selectedDirection)
        .applyAxisAngle(east, START_DISTANCE)
        .normalize();
      playerForwardRef.current
        .copy(selectedDirection)
        .addScaledVector(
          playerUpRef.current,
          -selectedDirection.dot(playerUpRef.current),
        )
        .normalize();

      targetQuaternionRef.current.identity();
      globeRef.current?.quaternion.identity();
      nearbyPlaceIdRef.current = null;
      onNearbyChangeRef.current(null);

      const playerUp = playerUpRef.current;
      const playerForward = playerForwardRef.current;
      const cameraTarget = new Vector3()
        .copy(playerUp)
        .multiplyScalar(EXPLORE_TARGET_HEIGHT)
        .addScaledVector(playerForward, EXPLORE_TARGET_LEAD);

      camera.position
        .copy(playerUp)
        .multiplyScalar(EXPLORE_CAMERA_HEIGHT)
        .addScaledVector(playerForward, -EXPLORE_CAMERA_TRAIL);
      camera.up.copy(playerUp);
      camera.lookAt(cameraTarget);
    } else if (!exploreMode) {
      targetQuaternionRef.current.copy(
        new Quaternion().setFromUnitVectors(
          selectedDirection,
          FOCUS_DIRECTION,
        ),
      );
      globeRef.current?.quaternion.copy(targetQuaternionRef.current);
      idleUntilRef.current = performance.now() + 4200;

      if (nearbyPlaceIdRef.current !== null) {
        nearbyPlaceIdRef.current = null;
        onNearbyChangeRef.current(null);
      }
    }

    wasExploreModeRef.current = exploreMode;
  }, [camera, exploreMode, selectedPlaceId]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.cursor = exploreMode ? "default" : "grab";

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

    const frameDelta = Math.min(delta, 0.05);
    const input = exploreInputRef.current;

    if (exploreMode) {
      globe.quaternion.identity();

      const playerUp = playerUpRef.current;
      const playerForward = playerForwardRef.current;

      if (input.horizontal !== 0) {
        playerForward
          .applyAxisAngle(
            playerUp,
            -input.horizontal * TURN_SPEED * frameDelta,
          )
          .normalize();
      }

      if (input.vertical !== 0) {
        const movementAxis = movementAxisRef.current
          .crossVectors(playerForward, playerUp)
          .normalize();
        const movementAngle = -input.vertical * WALK_SPEED * frameDelta;

        playerUp.applyAxisAngle(movementAxis, movementAngle).normalize();
        playerForward
          .applyAxisAngle(movementAxis, movementAngle)
          .addScaledVector(playerUp, -playerForward.dot(playerUp))
          .normalize();
      }

      const cameraEase = 1 - Math.exp(-frameDelta * 7);
      const desiredCamera = desiredCameraRef.current
        .copy(playerUp)
        .multiplyScalar(EXPLORE_CAMERA_HEIGHT)
        .addScaledVector(playerForward, -EXPLORE_CAMERA_TRAIL);
      const cameraTarget = cameraTargetRef.current
        .copy(playerUp)
        .multiplyScalar(EXPLORE_TARGET_HEIGHT)
        .addScaledVector(playerForward, EXPLORE_TARGET_LEAD);

      camera.position.lerp(desiredCamera, cameraEase);
      camera.up.lerp(playerUp, cameraEase).normalize();
      camera.lookAt(cameraTarget);

      let nearestPlace: Place | null = null;
      let nearestDot = -1;

      for (const place of places) {
        const placeDirection = PLACE_DIRECTIONS.get(place.id);

        if (!placeDirection) {
          continue;
        }

        const dot = placeDirection.dot(playerUp);

        if (dot > nearestDot) {
          nearestDot = dot;
          nearestPlace = place;
        }
      }

      const nearbyPlace =
        nearestPlace && nearestDot > NEARBY_DISTANCE ? nearestPlace : null;
      const nearbyPlaceId = nearbyPlace?.id ?? null;

      if (nearbyPlaceIdRef.current !== nearbyPlaceId) {
        nearbyPlaceIdRef.current = nearbyPlaceId;
        onNearbyChangeRef.current(nearbyPlaceId);
      }

      if (
        nearbyPlace &&
        nearbyPlace.id !== selectedPlaceId &&
        performance.now() >= arrivalCooldownRef.current
      ) {
        arrivalCooldownRef.current = performance.now() + 900;
        onSelectRef.current(nearbyPlace.id);
      }

      return;
    }

    if (
      !reduceMotion &&
      !dragRef.current &&
      performance.now() >= idleUntilRef.current
    ) {
      const autoRotation = new Quaternion().setFromAxisAngle(
        Y_AXIS,
        frameDelta * 0.055,
      );
      targetQuaternionRef.current.premultiply(autoRotation).normalize();
    }

    globe.quaternion.slerp(
      targetQuaternionRef.current,
      1 - Math.exp(-frameDelta * 5),
    );

    const cameraEase = 1 - Math.exp(-frameDelta * 4);
    camera.position.lerp(BROWSE_CAMERA_POSITION, cameraEase);
    camera.up.lerp(Y_AXIS, cameraEase).normalize();
    camera.lookAt(0, -0.05, 0);
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
            exploreMode={exploreMode}
            projectionRef={projectionRef}
            onSelect={onSelect}
          />
        ))}
      </group>

      {exploreMode ? (
        <Traveler
          inputRef={exploreInputRef}
          playerUpRef={playerUpRef}
          playerForwardRef={playerForwardRef}
          reduceMotion={reduceMotion}
        />
      ) : null}

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
      camera={{ position: [0, 0.45, 18.8], fov: 40, near: 0.05, far: 80 }}
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
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-5, -2, 3]} intensity={0.65} color="#b9d5d0" />
      <PlanetExperience {...props} />
    </Canvas>
  );
}
