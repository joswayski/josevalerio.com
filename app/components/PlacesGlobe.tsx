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
  TraversalMode,
} from "./PlacesScene";

type ResolvedPlacePhoto = PlacePhoto & { src: string };

type ExpandedGallery = {
  placeId: string;
  photoIndex: number;
};

const LazyPlacesScene = lazy(() =>
  import("./PlacesScene").then(({ PlacesScene }) => ({
    default: PlacesScene,
  })),
);

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unable to render the Places planetoid.", error, errorInfo);
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
      aria-label="Loading a tiny explorable planetoid inspired by places Jose has visited"
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
  mediaBaseUrl: string,
) {
  if (photo.src) {
    return photo.src;
  }

  if (photo.objectKey) {
    return `${mediaBaseUrl}/${photo.objectKey.replace(/^\/+/, "")}`;
  }

  return null;
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function PlacesGlobe() {
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [nearbyPlaceId, setNearbyPlaceId] = useState<string | null>(null);
  const [expandedGallery, setExpandedGallery] =
    useState<ExpandedGallery | null>(null);
  const [exploreMode, setExploreMode] = useState(false);
  const [traversalMode, setTraversalMode] =
    useState<TraversalMode>("land");
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const photoGalleryRef = useRef<HTMLDivElement>(null);
  const photoSwipeStartRef = useRef<number | null>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const exploreInputRef = useRef<ExploreInput>({
    forward: 0,
    strafe: 0,
    sprint: false,
    jumpSequence: 0,
  });

  const mediaBaseUrl = (
    import.meta.env.VITE_PLACES_MEDIA_URL ||
    "https://media.josevalerio.com"
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
  const activePlaceId = exploreMode
    ? nearbyPlaceId
    : selectedPlaceId || null;
  const activePlace = activePlaceId
    ? places.find((place) => place.id === activePlaceId) ?? null
    : null;
  const activePhotos = activePlaceId
    ? photosByPlaceId[activePlaceId] ?? []
    : [];
  const activePhoto = activePhotos[0] ?? null;
  const expandedPlace = expandedGallery
    ? places.find((place) => place.id === expandedGallery.placeId) ?? null
    : null;
  const expandedPhotos = expandedGallery
    ? photosByPlaceId[expandedGallery.placeId] ?? []
    : [];
  const expandedPhoto = expandedGallery
    ? expandedPhotos[expandedGallery.photoIndex] ?? null
    : null;

  useEffect(() => {
    setIsMounted(true);
    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updateMotionPreference = () =>
      setReduceMotion(motionQuery.matches);
    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);
    return () => {
      motionQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!expandedGallery) {
      return;
    }
    photoGalleryRef.current?.focus();
  }, [expandedGallery]);

  const updateMovement = useCallback(() => {
    const keys = pressedKeysRef.current;
    const forward =
      Number(keys.has("w") || keys.has("ArrowUp")) -
      Number(keys.has("s") || keys.has("ArrowDown"));
    const strafe =
      Number(keys.has("d") || keys.has("ArrowRight")) -
      Number(keys.has("a") || keys.has("ArrowLeft"));

    exploreInputRef.current = {
      ...exploreInputRef.current,
      forward,
      strafe,
      sprint: keys.has("Shift"),
    };
  }, []);

  const openGallery = useCallback(
    (placeId: string) => {
      const photos = photosByPlaceId[placeId] ?? [];
      if (photos.length === 0) {
        return;
      }
      setExpandedGallery({ placeId, photoIndex: 0 });
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
        if (photos.length < 2) {
          return current;
        }
        return {
          ...current,
          photoIndex:
            (current.photoIndex + offset + photos.length) %
            photos.length,
        };
      });
    },
    [photosByPlaceId],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const normalizedKey =
        event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (expandedGallery) {
        if (normalizedKey === "Escape" || normalizedKey === "f") {
          event.preventDefault();
          setExpandedGallery(null);
        } else if (normalizedKey === "ArrowLeft") {
          event.preventDefault();
          showRelativePhoto(-1);
        } else if (normalizedKey === "ArrowRight") {
          event.preventDefault();
          showRelativePhoto(1);
        }
        return;
      }

      if (normalizedKey === "Escape" && exploreMode) {
        event.preventDefault();
        setExploreMode(false);
        pressedKeysRef.current.clear();
        updateMovement();
        return;
      }

      if (normalizedKey === "f" && activePlaceId) {
        event.preventDefault();
        openGallery(activePlaceId);
        return;
      }

      if (!exploreMode || event.repeat) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        exploreInputRef.current = {
          ...exploreInputRef.current,
          jumpSequence: exploreInputRef.current.jumpSequence + 1,
        };
        return;
      }

      if (
        ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(
          normalizedKey,
        )
      ) {
        event.preventDefault();
        pressedKeysRef.current.add(normalizedKey);
        updateMovement();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const normalizedKey =
        event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (pressedKeysRef.current.delete(normalizedKey)) {
        event.preventDefault();
        updateMovement();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    activePlaceId,
    expandedGallery,
    exploreMode,
    openGallery,
    showRelativePhoto,
    updateMovement,
  ]);

  const startTouchMovement =
    (strafe: number, forward: number) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      exploreInputRef.current = {
        ...exploreInputRef.current,
        strafe,
        forward,
      };
    };

  const stopTouchMovement = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    exploreInputRef.current = {
      ...exploreInputRef.current,
      strafe: 0,
      forward: 0,
    };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleExploreMode = () => {
    setExploreMode((current) => {
      if (current) {
        setNearbyPlaceId(null);
        pressedKeysRef.current.clear();
        exploreInputRef.current = {
          ...exploreInputRef.current,
          forward: 0,
          strafe: 0,
          sprint: false,
        };
      } else {
        setSelectedPlaceId("");
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
                  exploreMode={exploreMode}
                  exploreInputRef={exploreInputRef}
                  reduceMotion={reduceMotion}
                  selectedPlaceId={selectedPlaceId}
                  onSelect={setSelectedPlaceId}
                  onNearbyChange={setNearbyPlaceId}
                  onTraversalChange={setTraversalMode}
                />
              </Suspense>
            </SceneErrorBoundary>
          ) : (
            sceneFallback
          )}
        </div>

        {activePlace && activePhoto && !expandedPhoto ? (
          <button
            type="button"
            className="place-photo-projection"
            aria-label={`View ${activePlace.name} photos`}
            onClick={() => openGallery(activePlace.id)}
          >
            <img
              src={activePhoto.src}
              alt={activePhoto.alt}
              width={activePhoto.width}
              height={activePhoto.height}
            />
            <span className="place-photo-projection-copy">
              <strong>{activePlace.name}</strong>
              <span>F · View photo</span>
            </span>
          </button>
        ) : null}

        {!expandedPhoto ? (
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
        ) : null}

        {exploreMode && !expandedPhoto ? (
          <div
            className="explore-dpad"
            role="group"
            aria-label="Traveler movement controls"
          >
            <button
              type="button"
              className="explore-dpad-up"
              aria-label="Move forward"
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
              aria-label="Move backward"
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
              onClick={() => {
                exploreInputRef.current = {
                  ...exploreInputRef.current,
                  jumpSequence:
                    exploreInputRef.current.jumpSequence + 1,
                };
              }}
            >
              ↟
            </button>
            <button
              type="button"
              className="explore-dpad-interact"
              aria-label="View nearby place photos"
              title="View nearby place photos"
              disabled={!activePlaceId}
              onClick={() => {
                if (activePlaceId) {
                  openGallery(activePlaceId);
                }
              }}
            >
              F
            </button>
          </div>
        ) : null}

        <p className="globe-instructions">
          {exploreMode
            ? `WASD move · drag camera · Shift ${
                traversalMode === "kayak" ? "paddle faster" : "run"
              } · Space jump · F photos`
            : "Drag to orbit · scroll to zoom · select a landmark"}
        </p>

        {expandedPhoto && expandedPlace ? (
          <div
            ref={photoGalleryRef}
            className="places-photo-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={`${expandedPlace.name} travel photos`}
            tabIndex={-1}
            onPointerDown={(event) => {
              photoSwipeStartRef.current = event.clientX;
            }}
            onPointerUp={(event) => {
              const start = photoSwipeStartRef.current;
              photoSwipeStartRef.current = null;
              if (start === null || expandedPhotos.length < 2) {
                return;
              }
              const distance = event.clientX - start;
              if (Math.abs(distance) > 48) {
                showRelativePhoto(distance < 0 ? 1 : -1);
              }
            }}
            onPointerCancel={() => {
              photoSwipeStartRef.current = null;
            }}
          >
            <div
              className="places-photo-viewer-vignette"
              aria-hidden="true"
            />
            <button
              type="button"
              className="places-photo-viewer-close"
              aria-label="Put photos away"
              onClick={() => setExpandedGallery(null)}
            >
              ×
            </button>
            {expandedPhotos.length > 1 ? (
              <button
                type="button"
                className="places-photo-viewer-nav places-photo-viewer-nav--previous"
                aria-label="Show previous photo"
                onClick={() => showRelativePhoto(-1)}
              >
                ←
              </button>
            ) : null}
            <div className="places-held-photo-wrap">
              <div
                className="places-photo-hand places-photo-hand--left"
                aria-hidden="true"
              />
              <figure key={expandedPhoto.src} aria-live="polite">
                <img
                  src={expandedPhoto.src}
                  alt={expandedPhoto.alt}
                  width={expandedPhoto.width}
                  height={expandedPhoto.height}
                />
                <figcaption>
                  <strong>{expandedPlace.name}</strong>
                  <span>{expandedPhoto.alt}</span>
                  {expandedPhotos.length > 1 ? (
                    <span className="places-photo-viewer-count">
                      {(expandedGallery?.photoIndex ?? 0) + 1} /{" "}
                      {expandedPhotos.length}
                    </span>
                  ) : null}
                </figcaption>
              </figure>
              <div
                className="places-photo-hand places-photo-hand--right"
                aria-hidden="true"
              />
            </div>
            {expandedPhotos.length > 1 ? (
              <button
                type="button"
                className="places-photo-viewer-nav places-photo-viewer-nav--next"
                aria-label="Show next photo"
                onClick={() => showRelativePhoto(1)}
              >
                →
              </button>
            ) : null}
            <p className="places-photo-viewer-help">
              {expandedPhotos.length > 1
                ? "Swipe or use ←/→ · F to put away"
                : "F to put away"}
            </p>
          </div>
        ) : null}

        <p className="sr-only">
          Explore a small spherical world, move between country islands by
          kayak, and approach a grounded landmark to open its travel gallery.
        </p>
      </div>
    </div>
  );
}
