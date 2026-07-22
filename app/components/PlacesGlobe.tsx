import {
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { feature, mesh } from "topojson-client";
import type {
  GeometryCollection,
  GeometryObject,
  Topology,
} from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { places, type Place } from "../data/places";

const GLOBE_SIZE = 420;
const SPHERE = { type: "Sphere" } as const;
const GRATICULE = geoGraticule10();
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

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startRotation: [number, number, number];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PlacesGlobe() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const projectionRef = useRef(
    geoOrthographic()
      .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
      .scale(GLOBE_SIZE * 0.44)
      .clipAngle(90)
      .precision(0.5)
      .rotate([74, -28, 0]),
  );
  const pathRef = useRef(geoPath(projectionRef.current));
  const sphereRef = useRef<SVGPathElement>(null);
  const graticuleRef = useRef<SVGPathElement>(null);
  const landRef = useRef<SVGPathElement>(null);
  const bordersRef = useRef<SVGPathElement>(null);
  const markerRefs = useRef(new Map<string, HTMLAnchorElement>());
  const markerGroupRefs = useRef(new Map<string, SVGGElement>());
  const dragRef = useRef<DragState | null>(null);
  const resumeRotationAtRef = useRef(0);

  const selectedPlace = useMemo(
    () =>
      places.find((place) => place.id === selectedPlaceId) ?? places[0],
    [selectedPlaceId],
  );
  const selectedPlaceIndex = places.indexOf(selectedPlace);
  // Set this to the public custom-domain path for the curated R2 photo folder.
  const mediaBaseUrl = import.meta.env.VITE_PLACES_MEDIA_URL?.replace(/\/+$/, "");

  const drawGlobe = useCallback(() => {
    const projection = projectionRef.current;
    const path = pathRef.current;

    sphereRef.current?.setAttribute("d", path(SPHERE) ?? "");
    graticuleRef.current?.setAttribute("d", path(GRATICULE) ?? "");
    landRef.current?.setAttribute("d", path(LAND) ?? "");
    bordersRef.current?.setAttribute("d", path(BORDERS) ?? "");

    const rotation = projection.rotate();
    const globeCenter: [number, number] = [-rotation[0], -rotation[1]];

    for (const place of places) {
      const marker = markerRefs.current.get(place.id);
      const markerGroup = markerGroupRefs.current.get(place.id);
      const point = projection(place.coordinates);
      const isVisible = geoDistance(place.coordinates, globeCenter) < Math.PI / 2;

      if (!marker || !markerGroup || !point) {
        continue;
      }

      markerGroup.setAttribute(
        "transform",
        `translate(${point[0].toFixed(2)} ${point[1].toFixed(2)})`,
      );
      marker.style.opacity = isVisible ? "1" : "0";
      marker.style.pointerEvents = isVisible ? "auto" : "none";
      marker.style.visibility = isVisible ? "visible" : "hidden";
    }
  }, []);

  useEffect(() => {
    drawGlobe();

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      return;
    }

    let animationFrame = 0;
    let previousTime = performance.now();
    let previousDrawTime = previousTime;

    const spin = (time: number) => {
      const elapsed = Math.min(time - previousTime, 50);

      if (
        !dragRef.current &&
        time >= resumeRotationAtRef.current &&
        time - previousDrawTime >= 32
      ) {
        const [longitude, latitude] = projectionRef.current.rotate();
        projectionRef.current.rotate([
          longitude + elapsed * 0.004,
          latitude,
          0,
        ]);
        drawGlobe();
        previousDrawTime = time;
        previousTime = time;
      }

      animationFrame = requestAnimationFrame(spin);
    };

    animationFrame = requestAnimationFrame(spin);

    return () => cancelAnimationFrame(animationFrame);
  }, [drawGlobe]);

  const selectPlace = useCallback(
    (place: Place) => {
      setSelectedPlaceId(place.id);
      projectionRef.current.rotate([
        -place.coordinates[0],
        -place.coordinates[1],
        0,
      ]);
      resumeRotationAtRef.current = performance.now() + 4000;
      drawGlobe();
    },
    [drawGlobe],
  );

  const selectRelativePlace = (offset: number) => {
    const nextIndex =
      (selectedPlaceIndex + offset + places.length) % places.length;
    selectPlace(places[nextIndex]);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }

    const rotation = projectionRef.current.rotate();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotation: [rotation[0], rotation[1], rotation[2]],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const longitude =
      drag.startRotation[0] + (event.clientX - drag.startX) * 0.28;
    const latitude = clamp(
      drag.startRotation[1] - (event.clientY - drag.startY) * 0.24,
      -72,
      72,
    );

    projectionRef.current.rotate([longitude, latitude, 0]);
    drawGlobe();
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    resumeRotationAtRef.current = performance.now() + 1800;
    event.currentTarget.dataset.dragging = "false";

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="places-explorer">
      <div className="globe-stage">
        <svg
          className="places-globe"
          viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
          role="group"
          aria-label="Interactive globe showing broad places Jose has visited"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerEnter={() => {
            resumeRotationAtRef.current = Number.POSITIVE_INFINITY;
          }}
          onPointerLeave={() => {
            if (!dragRef.current) {
              resumeRotationAtRef.current = performance.now() + 1000;
            }
          }}
        >
          <path
            ref={sphereRef}
            className="globe-sphere"
            d={pathRef.current(SPHERE) ?? undefined}
          />
          <path
            ref={graticuleRef}
            className="globe-graticule"
            d={pathRef.current(GRATICULE) ?? undefined}
          />
          <path
            ref={landRef}
            className="globe-land"
            d={pathRef.current(LAND) ?? undefined}
          />
          <path
            ref={bordersRef}
            className="globe-borders"
            d={pathRef.current(BORDERS) ?? undefined}
          />

          {places.map((place) => {
            const point = projectionRef.current(place.coordinates) ?? [0, 0];
            const rotation = projectionRef.current.rotate();
            const isVisible =
              geoDistance(place.coordinates, [-rotation[0], -rotation[1]]) <
              Math.PI / 2;

            return (
              <a
                key={place.id}
                ref={(marker) => {
                  if (marker) {
                    markerRefs.current.set(place.id, marker);
                  } else {
                    markerRefs.current.delete(place.id);
                  }
                }}
                href="#place-card"
                className={`globe-marker${
                  place.id === selectedPlaceId ? " globe-marker--selected" : ""
                }`}
                aria-label={`Show ${place.name}`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  pointerEvents: isVisible ? "auto" : "none",
                  visibility: isVisible ? "visible" : "hidden",
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onFocus={() => {
                  resumeRotationAtRef.current = Number.POSITIVE_INFINITY;
                }}
                onBlur={() => {
                  resumeRotationAtRef.current = performance.now() + 1200;
                }}
                onClick={(event) => {
                  event.preventDefault();
                  selectPlace(place);
                }}
              >
                <g
                  ref={(markerGroup) => {
                    if (markerGroup) {
                      markerGroupRefs.current.set(place.id, markerGroup);
                    } else {
                      markerGroupRefs.current.delete(place.id);
                    }
                  }}
                  transform={`translate(${point[0]} ${point[1]})`}
                >
                  <title>{place.name}</title>
                  <circle className="globe-marker-ring" r="10" />
                  <circle className="globe-marker-dot" r="4.5" />
                  <text className="globe-marker-label" x="12" y="4">
                    {place.name}
                  </text>
                </g>
              </a>
            );
          })}
        </svg>

        <p className="globe-instructions">Drag to spin · select a dot</p>
      </div>

      <article id="place-card" className="place-card" aria-live="polite">
        <p className="place-card-kicker">
          {String(selectedPlaceIndex + 1).padStart(2, "0")} / {places.length}
        </p>
        <div>
          <h3>{selectedPlace.name}</h3>
          <p className="place-card-region">{selectedPlace.region}</p>
        </div>

        {selectedPlace.note ? (
          <p className="place-card-note">{selectedPlace.note}</p>
        ) : (
          <p className="place-card-note place-card-note--empty">
            Photos and a short note coming soon.
          </p>
        )}

        {mediaBaseUrl && selectedPlace.photos.length > 0 ? (
          <div className="place-photos">
            {selectedPlace.photos.map((photo) => (
              <img
                key={photo.objectKey}
                src={`${mediaBaseUrl}/${photo.objectKey.replace(/^\/+/, "")}`}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="lazy"
              />
            ))}
          </div>
        ) : null}

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
      </article>
    </div>
  );
}
