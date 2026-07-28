import { useEffect, useMemo, useState } from "react";
import {
  Mesh,
  type Group,
  type Material,
  type Object3D,
  type Vector3Tuple,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ASSET_LIBRARY_URL = "/places/models/places-world.glb";

export type PlacesAssetName =
  | "kayak"
  | "paddle"
  | "traveler_torso"
  | "traveler_head"
  | "traveler_arm"
  | "traveler_leg"
  | "traveler_shoe"
  | "traveler_backpack"
  | "cloud_cumulus"
  | "cloud_stratus"
  | "cloud_storm"
  | "tree_broadleaf"
  | "tree_blossom"
  | "tree_conifer"
  | "tree_pine"
  | "tree_cypress"
  | "tree_palm"
  | "bush_green"
  | "bush_blossom"
  | "bush_pine"
  | "bush_palm"
  | "rock"
  | "landmark_skyline"
  | "landmark_lighthouse"
  | "landmark_sailboat"
  | "landmark_barbecue"
  | "landmark_orange"
  | "landmark_palm"
  | "landmark_mosque"
  | "landmark_mountain"
  | "landmark_tower"
  | "landmark_torii"
  | "landmark_sushi"
  | "scenery_new-york"
  | "scenery_new-jersey"
  | "scenery_rhode-island"
  | "scenery_chicago"
  | "scenery_austin"
  | "scenery_central-florida"
  | "scenery_korean-dmz"
  | "scenery_malatya"
  | "scenery_osaka"
  | "ambient_barn"
  | "ambient_korean-pavilion";

type BlenderAssetProps = {
  name: PlacesAssetName;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: number | Vector3Tuple;
  receiveShadow?: boolean;
  castShadow?: boolean;
};

let cachedScene: Group | null = null;
let libraryPromise: Promise<Group> | null = null;

function loadLibrary() {
  if (cachedScene) {
    return Promise.resolve(cachedScene);
  }

  if (!libraryPromise) {
    libraryPromise = new Promise<Group>((resolve, reject) => {
      new GLTFLoader().load(
        ASSET_LIBRARY_URL,
        ({ scene }) => {
          cachedScene = scene;
          resolve(scene);
        },
        undefined,
        reject,
      );
    });
  }

  return libraryPromise;
}

function useAssetLibrary() {
  const [scene, setScene] = useState(cachedScene);

  useEffect(() => {
    let cancelled = false;

    loadLibrary()
      .then((nextScene) => {
        if (!cancelled) {
          setScene(nextScene);
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to load the Places Blender asset library", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return scene;
}

function configureClone(
  object: Object3D,
  castShadow: boolean,
  receiveShadow: boolean,
) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
    child.frustumCulled = true;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material: Material) => {
      material.needsUpdate = true;
    });
  });
}

export function BlenderAsset({
  name,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  castShadow = true,
  receiveShadow = true,
}: BlenderAssetProps) {
  const library = useAssetLibrary();
  const object = useMemo(() => {
    const source = library?.getObjectByName(name);

    if (!source) {
      return null;
    }

    const clone = source.clone(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.quaternion.identity();
    clone.scale.set(1, 1, 1);
    configureClone(clone, castShadow, receiveShadow);
    return clone;
  }, [castShadow, library, name, receiveShadow]);

  if (!object) {
    return null;
  }

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <primitive object={object} dispose={null} />
    </group>
  );
}

if (typeof window !== "undefined") {
  void loadLibrary();
}
