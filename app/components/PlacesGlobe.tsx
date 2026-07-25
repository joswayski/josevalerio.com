import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { places, type PlacePhoto } from "../data/places";
import type {
  ExploreInput,
  SkyPhase,
} from "./PlacesScene";
import type { TraversalMode } from "../data/planetoid";

type ResolvedPlacePhoto = PlacePhoto & { src: string };

type ExpandedGallery = {
  placeId: string;
  photoIndex: number;
};

type CelestialState = {
  skyPhase: SkyPhase;
  solarDirection: [number, number, number];
};

type WaterAudioGraph = {
  context: AudioContext;
  oceanSource: AudioBufferSourceNode;
  foamSource: AudioBufferSourceNode;
  oceanFilter: BiquadFilterNode;
  foamFilter: BiquadFilterNode;
  oceanGain: GainNode;
  foamGain: GainNode;
  masterGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

const DAY_IN_MILLISECONDS = 86_400_000;
const DEFAULT_CELESTIAL_STATE: CelestialState = {
  skyPhase: "day",
  solarDirection: [-1, 0, 0],
};

function getCelestialState(now: Date): CelestialState {
  const localHour =
    now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const skyPhase: SkyPhase =
    localHour >= 7 && localHour < 17.5
      ? "day"
      : (localHour >= 5.25 && localHour < 7) ||
          (localHour >= 17.5 && localHour < 20)
        ? "twilight"
        : "night";
  // Approximate the current subsolar point from UTC so the planetoid can use a
  // real day/night direction without requesting the visitor's location.
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const currentDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dayOfYear = (currentDay - startOfYear) / DAY_IN_MILLISECONDS;
  const declination =
    (-23.44 *
      Math.cos((Math.PI * 2 * (dayOfYear + 10)) / 365.2422) *
      Math.PI) /
    180;
  const utcHour =
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600;
  const subsolarLongitude = ((180 - utcHour * 15) * Math.PI) / 180;
  const ringRadius = Math.cos(declination);

  return {
    skyPhase,
    solarDirection: [
      -ringRadius * Math.cos(subsolarLongitude),
      Math.sin(declination),
      ringRadius * Math.sin(subsolarLongitude),
    ],
  };
}

const LazyPlacesScene = lazy(() =>
  import("./PlacesScene").then(({ PlacesScene }) => ({ default: PlacesScene })),
);

type SceneErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type SceneErrorBoundaryState = {
  failed: boolean;
};

class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unable to render the places world.", error, errorInfo);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneFallback() {
  return (
    <div
      className="places-scene-fallback"
      role="img"
      aria-label="A tiny explorable planetoid inspired by places Jose has visited"
    >
      <div className="places-scene-fallback-planet" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function resolvePhotoSrc(
  photo: PlacePhoto,
  mediaBaseUrl: string | undefined,
) {
  if (photo.src) {
    return photo.src;
  }

  if (photo.objectKey && mediaBaseUrl) {
    return `${mediaBaseUrl}/${photo.objectKey.replace(/^\/+/, "")}`;
  }

  return null;
}

const movementKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Shift",
  "a",
  "d",
  "e",
  "j",
  "k",
  "q",
  "s",
  "w",
]);
const footstepKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Shift",
  "a",
  "d",
  "s",
  "w",
]);

export function PlacesGlobe() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [nearbyPlaceId, setNearbyPlaceId] = useState<string | null>(null);
  const [expandedGallery, setExpandedGallery] =
    useState<ExpandedGallery | null>(null);
  const [exploreMode, setExploreMode] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [celestialState, setCelestialState] = useState<CelestialState>(
    DEFAULT_CELESTIAL_STATE,
  );
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const projectionButtonRef = useRef<HTMLButtonElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const footstepBufferRef = useRef<AudioBuffer | null>(null);
  const waterNoiseBufferRef = useRef<AudioBuffer | null>(null);
  const waterAudioGraphRef = useRef<WaterAudioGraph | null>(null);
  const exploreInputRef = useRef<ExploreInput>({
    horizontal: 0,
    vertical: 0,
    cameraOrbit: 0,
    running: false,
    zoom: 0,
    jumpReady: true,
    jumpSequence: 0,
  });
  const pressedKeysRef = useRef(new Set<string>());
  // Keep an explicitly clicked place selected until the traveler leaves the
  // current cluster, so proximity updates cannot fight the user's choice.
  const manualSelectionLockRef = useRef(false);

  const nearbyPlace = useMemo(
    () => places.find((place) => place.id === nearbyPlaceId) ?? null,
    [nearbyPlaceId],
  );
  // Set this to the public custom-domain root for the curated R2 photo bucket.
  const mediaBaseUrl = (
    import.meta.env.VITE_PLACES_MEDIA_URL || "https://media.josevalerio.com"
  ).replace(/\/+$/, "");
  const photosByPlaceId = useMemo(
    () =>
      Object.fromEntries(
        places.map((place) => [
          place.id,
          place.photos.flatMap((photo) => {
            const src = resolvePhotoSrc(photo, mediaBaseUrl);
            return src ? [{ ...photo, src }] : [];
          }),
        ]),
      ) as Record<string, ResolvedPlacePhoto[]>,
    [mediaBaseUrl],
  );
  const selectedPhoto = photosByPlaceId[selectedPlaceId]?.[0] ?? null;
  const expandedPhotos = expandedGallery
    ? photosByPlaceId[expandedGallery.placeId] ?? []
    : [];
  const expandedPhoto = expandedGallery
    ? expandedPhotos[expandedGallery.photoIndex] ?? null
    : null;
  const expandedPlace = expandedGallery
    ? places.find((place) => place.id === expandedGallery.placeId) ?? null
    : null;

  useEffect(() => {
    setIsMounted(true);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReduceMotion(motionQuery.matches);
    const updateCelestialState = () =>
      setCelestialState(getCelestialState(new Date()));
    updateMotionPreference();
    updateCelestialState();
    motionQuery.addEventListener("change", updateMotionPreference);
    const celestialInterval = window.setInterval(
      updateCelestialState,
      60_000,
    );

    return () => {
      motionQuery.removeEventListener("change", updateMotionPreference);
      window.clearInterval(celestialInterval);
    };
  }, []);

  useEffect(
    () => () => {
      const waterGraph = waterAudioGraphRef.current;

      if (waterGraph) {
        waterGraph.oceanSource.stop();
        waterGraph.foamSource.stop();
        waterGraph.lfo.stop();
        waterGraph.oceanSource.disconnect();
        waterGraph.foamSource.disconnect();
        waterGraph.oceanFilter.disconnect();
        waterGraph.foamFilter.disconnect();
        waterGraph.oceanGain.disconnect();
        waterGraph.foamGain.disconnect();
        waterGraph.masterGain.disconnect();
        waterGraph.lfo.disconnect();
        waterGraph.lfoGain.disconnect();
      }

      footstepBufferRef.current = null;
      waterNoiseBufferRef.current = null;
      waterAudioGraphRef.current = null;
      void audioContextRef.current?.close();
    },
    [],
  );

  const ensureAudioContext = useCallback(() => {
    const currentContext = audioContextRef.current;

    if (currentContext && currentContext.state !== "closed") {
      void currentContext.resume();
      return currentContext;
    }

    const context = new AudioContext();
    audioContextRef.current = context;
    footstepBufferRef.current = null;
    waterNoiseBufferRef.current = null;
    waterAudioGraphRef.current = null;
    void context.resume();
    return context;
  }, []);

  const ensureWaterAudioGraph = useCallback(() => {
    const context = audioContextRef.current;

    if (!context || context.state === "closed") {
      return null;
    }

    const currentGraph = waterAudioGraphRef.current;

    if (currentGraph?.context === context) {
      return currentGraph;
    }

    const duration = 3;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let brown = 0;

    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.055) / 1.035;
      samples[index] = brown * 2.3 + white * 0.12;
    }

    const oceanSource = context.createBufferSource();
    const foamSource = context.createBufferSource();
    const oceanFilter = context.createBiquadFilter();
    const foamFilter = context.createBiquadFilter();
    const oceanGain = context.createGain();
    const foamGain = context.createGain();
    const masterGain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    oceanSource.buffer = buffer;
    oceanSource.loop = true;
    oceanSource.playbackRate.value = 0.72;
    foamSource.buffer = buffer;
    foamSource.loop = true;
    foamSource.playbackRate.value = 1.18;
    oceanFilter.type = "lowpass";
    oceanFilter.frequency.value = 520;
    oceanFilter.Q.value = 0.7;
    foamFilter.type = "bandpass";
    foamFilter.frequency.value = 1450;
    foamFilter.Q.value = 0.52;
    oceanGain.gain.value = 0.0001;
    foamGain.gain.value = 0.0001;
    masterGain.gain.value = 0.68;
    lfo.type = "sine";
    lfo.frequency.value = 0.16;
    lfoGain.gain.value = 0;

    oceanSource.connect(oceanFilter);
    oceanFilter.connect(oceanGain);
    foamSource.connect(foamFilter);
    foamFilter.connect(foamGain);
    oceanGain.connect(masterGain);
    foamGain.connect(masterGain);
    masterGain.connect(context.destination);
    lfo.connect(lfoGain);
    lfoGain.connect(oceanGain.gain);
    oceanSource.start();
    foamSource.start();
    lfo.start();

    const graph: WaterAudioGraph = {
      context,
      oceanSource,
      foamSource,
      oceanFilter,
      foamFilter,
      oceanGain,
      foamGain,
      masterGain,
      lfo,
      lfoGain,
    };
    waterAudioGraphRef.current = graph;
    return graph;
  }, []);

  const updateTraversalAudio = useCallback(
    (traversalMode: TraversalMode, movementBlend: number) => {
      const graph = ensureWaterAudioGraph();

      if (!graph) {
        return;
      }

      const now = graph.context.currentTime;
      const onWater = traversalMode !== "land";
      const oceanTarget = onWater
        ? traversalMode === "boat"
          ? 0.022
          : 0.029
        : 0.0001;
      const foamTarget = onWater
        ? 0.004 +
          movementBlend *
            (traversalMode === "boat" ? 0.05 : 0.034)
        : 0.0001;
      const filterTarget =
        traversalMode === "boat"
          ? 620 + movementBlend * 560
          : 480 + movementBlend * 330;

      graph.oceanGain.gain.setTargetAtTime(
        oceanTarget,
        now,
        onWater ? 0.3 : 0.55,
      );
      graph.foamGain.gain.setTargetAtTime(
        foamTarget,
        now,
        movementBlend > 0 ? 0.16 : 0.38,
      );
      graph.oceanFilter.frequency.setTargetAtTime(
        filterTarget,
        now,
        0.22,
      );
      graph.foamFilter.frequency.setTargetAtTime(
        1100 + movementBlend * 1050,
        now,
        0.18,
      );
      graph.lfoGain.gain.setTargetAtTime(
        onWater ? 0.0035 : 0,
        now,
        0.4,
      );
    },
    [ensureWaterAudioGraph],
  );

  useEffect(() => {
    const dialog = photoDialogRef.current;

    if (!dialog) {
      return;
    }

    if (expandedPhoto && !dialog.open) {
      dialog.showModal();
    } else if (!expandedPhoto && dialog.open) {
      dialog.close();
    }
  }, [expandedPhoto]);

  useEffect(() => {
    if (!exploreMode) {
      pressedKeysRef.current.clear();
      exploreInputRef.current = {
        horizontal: 0,
        vertical: 0,
        cameraOrbit: 0,
        running: false,
        zoom: 0,
        jumpReady: true,
        jumpSequence: exploreInputRef.current.jumpSequence,
      };
      return;
    }

    const updateInput = () => {
      const keys = pressedKeysRef.current;
      const left = keys.has("ArrowLeft") || keys.has("a");
      const right = keys.has("ArrowRight") || keys.has("d");
      const up = keys.has("ArrowUp") || keys.has("w");
      const down = keys.has("ArrowDown") || keys.has("s");
      const orbitLeft = keys.has("q");
      const orbitRight = keys.has("e");
      const zoomIn = keys.has("k");
      const zoomOut = keys.has("j");

      exploreInputRef.current = {
        horizontal: Number(right) - Number(left),
        vertical: Number(up) - Number(down),
        cameraOrbit: Number(orbitRight) - Number(orbitLeft),
        running: keys.has("Shift"),
        zoom: Number(zoomIn) - Number(zoomOut),
        jumpReady: exploreInputRef.current.jumpReady,
        jumpSequence: exploreInputRef.current.jumpSequence,
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const normalizedKey =
        event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (!movementKeys.has(normalizedKey)) {
        return;
      }

      if (photoDialogRef.current?.open) {
        return;
      }

      event.preventDefault();
      if (footstepKeys.has(normalizedKey)) {
        ensureAudioContext();
      }
      pressedKeysRef.current.add(normalizedKey);
      updateInput();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const normalizedKey =
        event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (!movementKeys.has(normalizedKey)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.delete(normalizedKey);
      updateInput();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      pressedKeysRef.current.clear();
      exploreInputRef.current = {
        horizontal: 0,
        vertical: 0,
        cameraOrbit: 0,
        running: false,
        zoom: 0,
        jumpReady: true,
        jumpSequence: exploreInputRef.current.jumpSequence,
      };
    };
  }, [ensureAudioContext, exploreMode]);

  const selectPlace = useCallback(
    (placeId: string) => {
      manualSelectionLockRef.current =
        exploreMode && placeId !== nearbyPlaceId;
      setSelectedPlaceId(placeId);
    },
    [exploreMode, nearbyPlaceId],
  );

  const handleNearbyChange = useCallback((placeId: string | null) => {
    setNearbyPlaceId(placeId);

    if (!placeId) {
      manualSelectionLockRef.current = false;
      return;
    }

    if (!manualSelectionLockRef.current) {
      setSelectedPlaceId(placeId);
    }
  }, []);

  const openPlaceGallery = useCallback(
    (placeId: string, photoIndex = 0) => {
      const photos = photosByPlaceId[placeId] ?? [];

      if (photos.length > 0) {
        setExpandedGallery({
          placeId,
          photoIndex: Math.max(0, Math.min(photoIndex, photos.length - 1)),
        });
      }
    },
    [photosByPlaceId],
  );

  const showRelativePhoto = useCallback(
    (offset: number) => {
      setExpandedGallery((current) => {
        if (!current) {
          return current;
        }

        const photos = photosByPlaceId[current.placeId] ?? [];

        if (photos.length === 0) {
          return null;
        }

        return {
          ...current,
          photoIndex:
            (current.photoIndex + offset + photos.length) % photos.length,
        };
      });
    },
    [photosByPlaceId],
  );

  const playJumpSound = useCallback(() => {
    const context = ensureAudioContext();
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(190, start);
    oscillator.frequency.exponentialRampToValueAtTime(380, start + 0.14);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    });
  }, [ensureAudioContext]);

  const playFootstepSound = useCallback(
    (movementBlend: number, runBlend: number, stepIndex: number) => {
      const context = ensureAudioContext();
      let buffer = footstepBufferRef.current;

      if (!buffer) {
        const duration = 0.07;
        buffer = context.createBuffer(
          1,
          Math.ceil(context.sampleRate * duration),
          context.sampleRate,
        );
        const samples = buffer.getChannelData(0);

        for (let index = 0; index < samples.length; index += 1) {
          const progress = index / samples.length;
          samples[index] =
            (Math.random() * 2 - 1) * Math.pow(1 - progress, 3.2);
        }

        footstepBufferRef.current = buffer;
      }

      const start = context.currentTime;
      const easedMovement =
        movementBlend * movementBlend * (3 - 2 * movementBlend);
      const volume = (0.02 + runBlend * 0.012) * easedMovement;
      const footOffset = stepIndex % 2 === 0 ? -0.09 : 0.09;
      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      const thump = context.createOscillator();
      const thumpGain = context.createGain();
      const panner = context.createStereoPanner();

      noise.buffer = buffer;
      noise.playbackRate.setValueAtTime(
        0.88 + runBlend * 0.38 + footOffset * 0.16,
        start,
      );
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(420 + runBlend * 240, start);
      noiseFilter.Q.setValueAtTime(0.72, start);
      noiseGain.gain.setValueAtTime(0.0001, start);
      noiseGain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);

      thump.type = "sine";
      thump.frequency.setValueAtTime(105 + runBlend * 32, start);
      thump.frequency.exponentialRampToValueAtTime(68, start + 0.055);
      thumpGain.gain.setValueAtTime(0.0001, start);
      thumpGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, volume * 0.42),
        start + 0.003,
      );
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
      panner.pan.setValueAtTime(footOffset, start);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(panner);
      thump.connect(thumpGain);
      thumpGain.connect(panner);
      panner.connect(context.destination);
      noise.start(start);
      thump.start(start);
      noise.stop(start + 0.075);
      thump.stop(start + 0.07);
      noise.addEventListener("ended", () => {
        noise.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
        thump.disconnect();
        thumpGain.disconnect();
        panner.disconnect();
      });
    },
    [ensureAudioContext],
  );

  const playWaterStrokeSound = useCallback(
    (
      traversalMode: Extract<TraversalMode, "boat" | "swim">,
      movementBlend: number,
      strokeIndex: number,
    ) => {
      const context = ensureAudioContext();
      let buffer = waterNoiseBufferRef.current;

      if (!buffer) {
        const duration = 0.18;
        buffer = context.createBuffer(
          1,
          Math.ceil(context.sampleRate * duration),
          context.sampleRate,
        );
        const samples = buffer.getChannelData(0);

        for (let index = 0; index < samples.length; index += 1) {
          const progress = index / samples.length;
          const envelope =
            Math.sin(Math.min(1, progress * 5.5) * Math.PI * 0.5) *
            Math.pow(1 - progress, 2.3);
          samples[index] =
            (Math.random() * 2 - 1) * envelope;
        }

        waterNoiseBufferRef.current = buffer;
      }

      const start = context.currentTime;
      const strength =
        Math.max(0.12, movementBlend) *
        (traversalMode === "boat" ? 1 : 0.72);
      const side = strokeIndex % 2 === 0 ? -0.28 : 0.28;
      const noise = context.createBufferSource();
      const bandpass = context.createBiquadFilter();
      const lowpass = context.createBiquadFilter();
      const gain = context.createGain();
      const bubble = context.createOscillator();
      const bubbleGain = context.createGain();
      const panner = context.createStereoPanner();

      noise.buffer = buffer;
      noise.playbackRate.setValueAtTime(
        traversalMode === "boat"
          ? 0.82 + movementBlend * 0.28
          : 1.05 + movementBlend * 0.35,
        start,
      );
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(
        traversalMode === "boat" ? 780 : 1050,
        start,
      );
      bandpass.frequency.exponentialRampToValueAtTime(
        traversalMode === "boat" ? 470 : 660,
        start + 0.15,
      );
      bandpass.Q.value = 0.62;
      lowpass.type = "lowpass";
      lowpass.frequency.value = 2600;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        0.032 * strength,
        start + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      bubble.type = "sine";
      bubble.frequency.setValueAtTime(
        traversalMode === "boat" ? 150 : 195,
        start,
      );
      bubble.frequency.exponentialRampToValueAtTime(82, start + 0.12);
      bubbleGain.gain.setValueAtTime(0.0001, start);
      bubbleGain.gain.exponentialRampToValueAtTime(
        0.012 * strength,
        start + 0.009,
      );
      bubbleGain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + 0.13,
      );
      panner.pan.setValueAtTime(side, start);

      noise.connect(bandpass);
      bandpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(panner);
      bubble.connect(bubbleGain);
      bubbleGain.connect(panner);
      panner.connect(context.destination);
      noise.start(start);
      bubble.start(start);
      noise.stop(start + 0.18);
      bubble.stop(start + 0.14);
      noise.addEventListener("ended", () => {
        noise.disconnect();
        bandpass.disconnect();
        lowpass.disconnect();
        gain.disconnect();
        bubble.disconnect();
        bubbleGain.disconnect();
        panner.disconnect();
      });
    },
    [ensureAudioContext],
  );

  const triggerJump = useCallback(() => {
    if (!exploreInputRef.current.jumpReady) {
      return;
    }

    exploreInputRef.current = {
      ...exploreInputRef.current,
      jumpReady: false,
      jumpSequence: exploreInputRef.current.jumpSequence + 1,
    };
    playJumpSound();
  }, [playJumpSound]);

  useEffect(() => {
    if (!exploreMode) {
      return;
    }

    const handleActionKey = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      const normalizedKey =
        event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (normalizedKey === "f" && photoDialogRef.current?.open) {
        event.preventDefault();
        setExpandedGallery(null);
        return;
      }

      if (photoDialogRef.current?.open) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        triggerJump();
        return;
      }

      if (normalizedKey === "f" && nearbyPlaceId) {
        event.preventDefault();
        openPlaceGallery(nearbyPlaceId);
      }
    };

    window.addEventListener("keydown", handleActionKey);
    return () => window.removeEventListener("keydown", handleActionKey);
  }, [exploreMode, nearbyPlaceId, openPlaceGallery, triggerJump]);

  const startTouchMovement =
    (horizontal: number, vertical: number) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (horizontal !== 0 || vertical !== 0) {
        ensureAudioContext();
      }
      exploreInputRef.current = {
        ...exploreInputRef.current,
        horizontal,
        vertical,
      };
    };

  const stopTouchMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    exploreInputRef.current = {
      ...exploreInputRef.current,
      horizontal: 0,
      vertical: 0,
    };

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleExploreMode = () => {
    manualSelectionLockRef.current = false;
    setExploreMode((current) => {
      if (current) {
        setNearbyPlaceId(null);
      }

      return !current;
    });
  };

  const sceneFallback = <SceneFallback />;

  return (
    <div
      className={`places-explorer${
        exploreMode ? " places-explorer--explore" : ""
      } places-explorer--sky-${celestialState.skyPhase}`}
    >
      <div className="globe-stage">
        <div className="places-scene-shell">
          {isMounted ? (
            <SceneErrorBoundary fallback={sceneFallback}>
              <Suspense fallback={sceneFallback}>
                <LazyPlacesScene
                  selectedPlaceId={selectedPlaceId}
                  exploreMode={exploreMode}
                  exploreInputRef={exploreInputRef}
                  reduceMotion={reduceMotion}
                  projectionRef={projectionButtonRef}
                  onSelect={selectPlace}
                  onNearbyChange={handleNearbyChange}
                  onFootstep={playFootstepSound}
                  onTraversalAudio={updateTraversalAudio}
                  onWaterStroke={playWaterStrokeSound}
                  skyPhase={celestialState.skyPhase}
                  solarDirection={celestialState.solarDirection}
                />
              </Suspense>
            </SceneErrorBoundary>
          ) : (
            sceneFallback
          )}
        </div>

        {selectedPhoto ? (
          <button
            ref={projectionButtonRef}
            type="button"
            className="place-photo-projection"
            aria-label={`Expand photo: ${selectedPhoto.alt}`}
            onClick={() => openPlaceGallery(selectedPlaceId)}
          >
            <img
              src={selectedPhoto.src}
              alt={selectedPhoto.alt}
              width={selectedPhoto.width}
              height={selectedPhoto.height}
            />
          </button>
        ) : null}

        <div className="globe-toolbar">
          <button
            type="button"
            className="explore-toggle"
            aria-pressed={exploreMode}
            onClick={toggleExploreMode}
          >
            <span aria-hidden="true">{exploreMode ? "×" : "◆"}</span>
            {exploreMode ? "Exit explore" : "Explore"}
          </button>
        </div>

        {exploreMode ? (
          <div
            className="explore-dpad"
            role="group"
            aria-label="Traveler movement controls"
          >
            <button
              type="button"
              className="explore-dpad-up"
              aria-label="Walk forward"
              onPointerDown={startTouchMovement(0, 1)}
              onPointerUp={stopTouchMovement}
              onPointerCancel={stopTouchMovement}
            >
              ↑
            </button>
            <button
              type="button"
              className="explore-dpad-left"
              aria-label="Move left"
              onPointerDown={startTouchMovement(-1, 0)}
              onPointerUp={stopTouchMovement}
              onPointerCancel={stopTouchMovement}
            >
              ←
            </button>
            <button
              type="button"
              className="explore-dpad-down"
              aria-label="Walk backward"
              onPointerDown={startTouchMovement(0, -1)}
              onPointerUp={stopTouchMovement}
              onPointerCancel={stopTouchMovement}
            >
              ↓
            </button>
            <button
              type="button"
              className="explore-dpad-right"
              aria-label="Move right"
              onPointerDown={startTouchMovement(1, 0)}
              onPointerUp={stopTouchMovement}
              onPointerCancel={stopTouchMovement}
            >
              →
            </button>
            <button
              type="button"
              className="explore-dpad-jump"
              aria-label="Jump"
              title="Jump"
              onClick={triggerJump}
            >
              ↟
            </button>
          </div>
        ) : null}

        {exploreMode && nearbyPlace ? (
          <div className="explore-place-hud" aria-live="polite">
            <span>Nearby</span>
            <strong>{nearbyPlace.name}</strong>
            <button
              type="button"
              onClick={() => openPlaceGallery(nearbyPlace.id)}
            >
              F · View photos ↗
            </button>
          </div>
        ) : null}

        <p className="globe-instructions">
          {exploreMode
            ? "Drag orbit · WASD move/paddle · Shift faster · Q/E orbit · Space jump · F interact · J out · K in"
            : "Drag to spin"}
        </p>
        <p className="sr-only">
          Walk, swim, or paddle toward a landmark to reveal its floating photo,
          then select the photo to expand it.
        </p>
      </div>

      <dialog
        ref={photoDialogRef}
        className="photo-lightbox"
        aria-label={
          expandedPlace ? `${expandedPlace.name} travel photos` : "Travel photos"
        }
        onClose={() => setExpandedGallery(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setExpandedGallery(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            showRelativePhoto(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showRelativePhoto(1);
          }
        }}
      >
        <button
          type="button"
          className="photo-lightbox-close"
          aria-label="Close photo gallery"
          onClick={() => setExpandedGallery(null)}
        >
          ×
        </button>
        {expandedPhotos.length > 1 ? (
          <button
            type="button"
            className="photo-lightbox-nav photo-lightbox-nav--previous"
            aria-label="Show previous photo"
            onClick={() => showRelativePhoto(-1)}
          >
            ←
          </button>
        ) : null}
        {expandedPhoto ? (
          <figure key={expandedPhoto.src} aria-live="polite">
            <img
              src={expandedPhoto.src}
              alt={expandedPhoto.alt}
              width={expandedPhoto.width}
              height={expandedPhoto.height}
            />
            <figcaption>
              <span>{expandedPhoto.alt}</span>
              {expandedGallery && expandedPhotos.length > 1 ? (
                <span className="photo-lightbox-count">
                  {expandedGallery.photoIndex + 1} / {expandedPhotos.length}
                </span>
              ) : null}
            </figcaption>
          </figure>
        ) : null}
        {expandedPhotos.length > 1 ? (
          <button
            type="button"
            className="photo-lightbox-nav photo-lightbox-nav--next"
            aria-label="Show next photo"
            onClick={() => showRelativePhoto(1)}
          >
            →
          </button>
        ) : null}
      </dialog>
    </div>
  );
}
