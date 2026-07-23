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
  "a",
  "d",
  "s",
  "w",
]);

export function PlacesGlobe() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [nearbyPlaceId, setNearbyPlaceId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] =
    useState<ResolvedPlacePhoto | null>(null);
  const [exploreMode, setExploreMode] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const projectionButtonRef = useRef<HTMLButtonElement>(null);
  const exploreInputRef = useRef<ExploreInput>({
    horizontal: 0,
    vertical: 0,
  });
  const pressedKeysRef = useRef(new Set<string>());

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

  useEffect(() => {
    setIsMounted(true);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReduceMotion(motionQuery.matches);
    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);

    return () =>
      motionQuery.removeEventListener("change", updateMotionPreference);
  }, []);

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
      exploreInputRef.current = { horizontal: 0, vertical: 0 };
      return;
    }

    const updateInput = () => {
      const keys = pressedKeysRef.current;
      const left = keys.has("ArrowLeft") || keys.has("a");
      const right = keys.has("ArrowRight") || keys.has("d");
      const up = keys.has("ArrowUp") || keys.has("w");
      const down = keys.has("ArrowDown") || keys.has("s");

      exploreInputRef.current = {
        horizontal: Number(right) - Number(left),
        vertical: Number(up) - Number(down),
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (!movementKeys.has(normalizedKey)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.add(normalizedKey);
      updateInput();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;

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
      exploreInputRef.current = { horizontal: 0, vertical: 0 };
    };
  }, [exploreMode]);

  const selectPlace = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
  }, []);

  const handleNearbyChange = useCallback((placeId: string | null) => {
    setNearbyPlaceId(placeId);
  }, []);

  const openPlacePhoto = useCallback(
    (placeId: string) => {
      const photo = photosByPlaceId[placeId]?.[0];

      if (photo) {
        setExpandedPhoto(photo);
      }
    },
    [photosByPlaceId],
  );

  const startTouchMovement =
    (horizontal: number, vertical: number) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      exploreInputRef.current = { horizontal, vertical };
    };

  const stopTouchMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    exploreInputRef.current = { horizontal: 0, vertical: 0 };

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleExploreMode = () => {
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
            onClick={() => openPlacePhoto(selectedPlaceId)}
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
          </div>
        ) : null}

        {exploreMode && nearbyPlace ? (
          <div className="explore-place-hud" aria-live="polite">
            <span>Nearby</span>
            <strong>{nearbyPlace.name}</strong>
            <button
              type="button"
              onClick={() => openPlacePhoto(nearbyPlace.id)}
            >
              Open photo ↗
            </button>
          </div>
        ) : null}

        <p className="globe-instructions">
          {exploreMode
            ? "W / S walk · A / D turn · arrows work too"
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
        aria-label="Expanded travel photo"
        onClose={() => setExpandedPhoto(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setExpandedPhoto(null);
          }
        }}
      >
        <button
          type="button"
          className="photo-lightbox-close"
          aria-label="Close expanded photo"
          onClick={() => setExpandedPhoto(null)}
        >
          ×
        </button>
        {expandedPhoto ? (
          <figure>
            <img
              src={expandedPhoto.src}
              alt={expandedPhoto.alt}
              width={expandedPhoto.width}
              height={expandedPhoto.height}
            />
            <figcaption>{expandedPhoto.alt}</figcaption>
          </figure>
        ) : null}
      </dialog>
    </div>
  );
}
