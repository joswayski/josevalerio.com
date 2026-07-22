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
  const [exploreMode, setExploreMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const exploreInputRef = useRef<ExploreInput>({
    horizontal: 0,
    vertical: 0,
  });
  const pressedKeysRef = useRef(new Set<string>());

  const selectedPlace = useMemo(
    () =>
      places.find((place) => place.id === selectedPlaceId) ?? places[0],
    [selectedPlaceId],
  );
  const selectedPlaceIndex = places.indexOf(selectedPlace);
  const nearbyPlace = useMemo(
    () => places.find((place) => place.id === nearbyPlaceId) ?? null,
    [nearbyPlaceId],
  );
  // Set this to the public custom-domain root for the curated R2 photo bucket.
  const mediaBaseUrl = (
    import.meta.env.VITE_PLACES_MEDIA_URL || "https://media.josevalerio.com"
  ).replace(/\/+$/, "");
  const selectedPhotos = selectedPlace.photos.flatMap((photo) => {
    const src = resolvePhotoSrc(photo, mediaBaseUrl);
    return src ? [{ ...photo, src }] : [];
  });
  const hasPublishedPhotos = selectedPhotos.some(
    (photo) => photo.src !== "/places/placeholder.svg",
  );

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

  const selectRelativePlace = (offset: number) => {
    const nextIndex =
      (selectedPlaceIndex + offset + places.length) % places.length;
    selectPlace(places[nextIndex].id);
  };

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

  const showNearbyPhotos = () => {
    document.getElementById("place-card")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
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
                  onSelect={selectPlace}
                  onNearbyChange={handleNearbyChange}
                />
              </Suspense>
            </SceneErrorBoundary>
          ) : (
            sceneFallback
          )}
        </div>

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
            <button type="button" onClick={showNearbyPhotos}>
              View photos ↓
            </button>
          </div>
        ) : null}

        <p className="globe-instructions">
          {exploreMode
            ? "W / S walk · A / D turn · arrows work too"
            : "Drag to spin · select a tiny world"}
        </p>
        <p className="sr-only">
          Use the previous and next buttons in the place card to browse every
          destination without using the 3D globe.
        </p>
      </div>

      <article id="place-card" className="place-card" aria-live="polite">
        <div className="place-card-copy">
          <p className="place-card-kicker">
            {String(selectedPlaceIndex + 1).padStart(2, "0")} / {places.length}
          </p>
          <div className="place-card-heading">
            <h3>{selectedPlace.name}</h3>
            <p className="place-card-region">{selectedPlace.region}</p>
          </div>

          {selectedPlace.note ? (
            <p className="place-card-note">{selectedPlace.note}</p>
          ) : (
            <p className="place-card-note place-card-note--empty">
              {hasPublishedPhotos
                ? "A short note coming soon."
                : "Photos and a short note coming soon."}
            </p>
          )}

          <div className="place-card-controls">
            <button
              type="button"
              aria-label="Show previous place"
              onClick={() => selectRelativePlace(-1)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Show next place"
              onClick={() => selectRelativePlace(1)}
            >
              →
            </button>
          </div>
        </div>

        {selectedPhotos.length > 0 ? (
          <div className="place-photos">
            {selectedPhotos.map((photo) => (
              <button
                key={photo.objectKey ?? photo.src}
                type="button"
                className="place-photo-button"
                aria-label={`Expand photo: ${photo.alt}`}
                onClick={() => setExpandedPhoto(photo)}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                />
                <span aria-hidden="true">Expand ↗</span>
              </button>
            ))}
          </div>
        ) : null}
      </article>

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
