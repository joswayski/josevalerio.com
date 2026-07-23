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
import type { ExploreInput } from "./PlacesScene";

type ResolvedPlacePhoto = PlacePhoto & { src: string };

type ExpandedGallery = {
  placeId: string;
  photoIndex: number;
};

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
    console.error("Unable to render the places globe.", error, errorInfo);
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
      aria-label="A stylized globe showing places Jose has visited"
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

export function PlacesGlobe() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [nearbyPlaceId, setNearbyPlaceId] = useState<string | null>(null);
  const [expandedGallery, setExpandedGallery] =
    useState<ExpandedGallery | null>(null);
  const [exploreMode, setExploreMode] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const projectionButtonRef = useRef<HTMLButtonElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const exploreInputRef = useRef<ExploreInput>({
    horizontal: 0,
    vertical: 0,
    cameraOrbit: 0,
    running: false,
    zoom: 0,
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
  const projectionIsNearby =
    exploreMode && selectedPlaceId === nearbyPlaceId;
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
    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);

    return () =>
      motionQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
    },
    [],
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
        jumpSequence: exploreInputRef.current.jumpSequence,
      };
    };
  }, [exploreMode]);

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
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    void context.resume();

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
  }, []);

  const triggerJump = useCallback(() => {
    exploreInputRef.current = {
      ...exploreInputRef.current,
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
      }`}
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
            disabled={projectionIsNearby}
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
              aria-label="Turn left"
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
              aria-label="Turn right"
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
            ? "W/S walk · Shift run · A/D turn · Q/E orbit · Space jump · F interact · J out · K in"
            : "Drag to spin · select a tiny world"}
        </p>
        <p className="sr-only">
          Walk toward a landmark to reveal its floating photo, then select the
          photo to expand it.
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
