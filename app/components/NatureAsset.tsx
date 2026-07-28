import { useEffect, useMemo, useState } from "react";
import {
  Mesh,
  MeshStandardMaterial,
  type Group,
  type Material,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type NatureAssetName =
  | "tree-broadleaf"
  | "tree-blossom"
  | "tree-pine"
  | "tree-palm"
  | "bush-green"
  | "bush-blossom"
  | "bush-tropical";

type NatureAssetDefinition = {
  url: string;
  objectName: string;
  scale: number;
  palette: "broadleaf" | "blossom" | "pine" | "palm" | "bush";
};

const DEFINITIONS: Record<NatureAssetName, NatureAssetDefinition> = {
  "tree-broadleaf": {
    url: "/places/models/nature/tree.glb",
    objectName: "CommonTree_2",
    scale: 0.075,
    palette: "broadleaf",
  },
  "tree-blossom": {
    url: "/places/models/nature/blossom-tree.glb",
    objectName: "TwistedTree_1",
    scale: 0.035,
    palette: "blossom",
  },
  "tree-pine": {
    url: "/places/models/nature/pine-trees.glb",
    objectName: "Resource_PineTree_Group",
    scale: 0.34,
    palette: "pine",
  },
  "tree-palm": {
    url: "/places/models/nature/palm-tree.glb",
    objectName: "Environment_PalmTree_1",
    scale: 0.165,
    palette: "palm",
  },
  "bush-green": {
    url: "/places/models/nature/flowering-bush.glb",
    objectName: "Bush_Common_Flowers",
    scale: 0.19,
    palette: "bush",
  },
  "bush-blossom": {
    url: "/places/models/nature/flowering-bush.glb",
    objectName: "Bush_Common_Flowers",
    scale: 0.19,
    palette: "blossom",
  },
  "bush-tropical": {
    url: "/places/models/nature/flowering-bush.glb",
    objectName: "Bush_Common_Flowers",
    scale: 0.17,
    palette: "palm",
  },
};

const sceneCache = new Map<string, Group>();
const loadingCache = new Map<string, Promise<Group>>();

function loadScene(url: string) {
  const cached = sceneCache.get(url);

  if (cached) {
    return Promise.resolve(cached);
  }

  const loading = loadingCache.get(url);

  if (loading) {
    return loading;
  }

  const promise = new Promise<Group>((resolve, reject) => {
    new GLTFLoader().load(
      url,
      ({ scene }) => {
        sceneCache.set(url, scene);
        resolve(scene);
      },
      undefined,
      reject,
    );
  });

  loadingCache.set(url, promise);
  return promise;
}

function tuneMaterial(
  material: Material,
  palette: NatureAssetDefinition["palette"],
) {
  if (!(material instanceof MeshStandardMaterial)) {
    return material;
  }

  const name = material.name.toLowerCase();
  const isLeaf = name.includes("leav") || name === "green";
  const isFlower = name.includes("flower");
  const isWood = name.includes("bark") || name.includes("wood");
  const tuned = material.clone();

  tuned.roughness = Math.max(0.68, tuned.roughness);
  tuned.metalness = 0;
  tuned.envMapIntensity = 0.52;

  if (palette === "blossom" && isLeaf) {
    tuned.map = null;
    tuned.color.set("#f1a4bc");
    tuned.emissive.set("#3b101f");
    tuned.emissiveIntensity = 0.16;
    tuned.roughness = 0.78;
  } else if (palette === "blossom" && isFlower) {
    tuned.color.set("#ffd2df");
    tuned.emissive.set("#3a111f");
    tuned.emissiveIntensity = 0.1;
  } else if (palette === "pine" && isLeaf) {
    tuned.color.set("#3a7650");
    tuned.roughness = 0.9;
  } else if (palette === "palm" && isLeaf) {
    tuned.color.multiplyScalar(1.16);
  } else if (palette === "broadleaf" && isLeaf) {
    tuned.color.multiplyScalar(1.12);
  }

  if (isWood) {
    tuned.roughness = 0.88;
  }

  tuned.needsUpdate = true;
  return tuned;
}

function configureObject(
  object: Object3D,
  palette: NatureAssetDefinition["palette"],
) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => tuneMaterial(material, palette))
      : tuneMaterial(child.material, palette);
  });
}

export function NatureAsset({ name }: { name: NatureAssetName }) {
  const definition = DEFINITIONS[name];
  const [scene, setScene] = useState(
    () => sceneCache.get(definition.url) ?? null,
  );

  useEffect(() => {
    let cancelled = false;

    loadScene(definition.url)
      .then((nextScene) => {
        if (!cancelled) {
          setScene(nextScene);
        }
      })
      .catch((error: unknown) => {
        console.error(`Unable to load Places nature asset "${name}"`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [definition.url, name]);

  const object = useMemo(() => {
    const source = scene?.getObjectByName(definition.objectName);

    if (!source) {
      return null;
    }

    const clone = source.clone(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.quaternion.identity();
    clone.scale.setScalar(definition.scale);
    configureObject(clone, definition.palette);
    return clone;
  }, [definition, scene]);

  if (!object) {
    return null;
  }

  return <primitive object={object} dispose={null} />;
}

if (typeof window !== "undefined") {
  Object.values(DEFINITIONS).forEach(({ url }) => {
    void loadScene(url);
  });
}
