"""Generate the cohesive Blender asset library for the Places planetoid.

Everything in this file is authored from primitives so the runtime has one
consistent silhouette language, material response, scale, and polygon density.
No downloaded models or textures are used.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "assets" / "blender" / "places-world.blend"
GLB_PATH = ROOT / "public" / "places" / "models" / "places-world.glb"


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for value in list(collection):
            collection.remove(value)


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.82,
    metallic: float = 0.0,
) -> bpy.types.Material:
    value = bpy.data.materials.new(name)
    value.diffuse_color = color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return value


MATERIALS = {
    "coral": material("Coral jacket", (0.84, 0.13, 0.09, 1)),
    "coral_light": material("Coral highlight", (1.0, 0.31, 0.16, 1)),
    "skin": material("Warm skin", (0.74, 0.43, 0.25, 1), roughness=0.72),
    "hair": material("Soft black", (0.018, 0.024, 0.026, 1), roughness=0.9),
    "denim": material("Deep denim", (0.025, 0.12, 0.18, 1)),
    "cream": material("Warm cream", (0.94, 0.88, 0.73, 1)),
    "white": material("Warm white", (0.96, 0.94, 0.88, 1)),
    "charcoal": material("Charcoal", (0.035, 0.045, 0.05, 1), roughness=0.75),
    "orange": material("Kayak orange", (0.95, 0.28, 0.045, 1), roughness=0.58),
    "orange_light": material(
        "Kayak rim", (1.0, 0.52, 0.12, 1), roughness=0.48
    ),
    "wood": material("Warm wood", (0.37, 0.16, 0.06, 1), roughness=0.9),
    "wood_light": material("Paddle wood", (0.73, 0.42, 0.16, 1), roughness=0.78),
    "bark": material("Tree bark", (0.31, 0.13, 0.055, 1), roughness=0.94),
    "leaf": material("Leaf green", (0.12, 0.48, 0.22, 1), roughness=0.9),
    "leaf_light": material("Leaf sunlight", (0.32, 0.68, 0.27, 1)),
    "leaf_dark": material("Leaf shadow", (0.055, 0.29, 0.16, 1)),
    "cherry": material("Sakura blossom", (0.98, 0.47, 0.62, 1), roughness=0.84),
    "cherry_light": material(
        "Sakura highlight", (1.0, 0.72, 0.8, 1), roughness=0.8
    ),
    "pine": material("Pine green", (0.055, 0.34, 0.22, 1)),
    "palm": material("Palm leaf", (0.2, 0.58, 0.24, 1)),
    "stone": material("Warm stone", (0.49, 0.48, 0.41, 1), roughness=0.94),
    "stone_light": material("Pale stone", (0.72, 0.7, 0.59, 1)),
    "concrete": material("Concrete", (0.48, 0.53, 0.52, 1)),
    "glass": material("Window blue", (0.12, 0.36, 0.47, 1), roughness=0.32),
    "red": material("Landmark red", (0.82, 0.055, 0.035, 1), roughness=0.62),
    "gold": material(
        "Warm gold", (0.93, 0.58, 0.08, 1), roughness=0.42, metallic=0.22
    ),
    "blue": material("Ceramic blue", (0.055, 0.31, 0.52, 1)),
    "yellow": material("Citrus orange", (1.0, 0.42, 0.035, 1)),
    "pink": material("Salmon", (0.94, 0.28, 0.25, 1)),
    "nori": material("Nori", (0.018, 0.16, 0.09, 1)),
}


def root(name: str) -> bpy.types.Object:
    value = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(value)
    return value


def attach(value: bpy.types.Object, parent: bpy.types.Object) -> bpy.types.Object:
    value.parent = parent
    return value


def add_cube(
    parent: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    bevel: float = 0.0,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    value = attach(bpy.context.object, parent)
    value.name = name
    value.scale = tuple(component / 2 for component in scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    value.data.materials.append(mat)
    if bevel > 0:
        modifier = value.modifiers.new("Soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.context.view_layer.objects.active = value
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return value


def add_cylinder(
    parent: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 12,
    radius_top: float | None = None,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    if radius_top is None or abs(radius_top - radius) < 0.00001:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=vertices,
            radius=radius,
            depth=depth,
            location=location,
            rotation=rotation,
        )
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=vertices,
            radius1=radius,
            radius2=radius_top,
            depth=depth,
            location=location,
            rotation=rotation,
        )
    value = attach(bpy.context.object, parent)
    value.name = name
    value.data.materials.append(mat)
    return value


def add_cylinder_between(
    parent: bpy.types.Object,
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 10,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    delta = end_vector - start_vector
    value = add_cylinder(
        parent,
        name,
        tuple((start_vector + end_vector) / 2),
        radius,
        delta.length,
        mat,
        vertices=vertices,
    )
    value.rotation_mode = "QUATERNION"
    value.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    return value


def add_ico(
    parent: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    subdivisions: int = 1,
    rotation: tuple[float, float, float] = (0, 0, 0),
    smooth: bool = False,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1,
        location=location,
        rotation=rotation,
    )
    value = attach(bpy.context.object, parent)
    value.name = name
    value.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    value.data.materials.append(mat)
    for polygon in value.data.polygons:
        polygon.use_smooth = smooth
    return value


def add_torus(
    parent: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    scale: tuple[float, float, float] = (1, 1, 1),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    value = attach(bpy.context.object, parent)
    value.name = name
    value.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    value.data.materials.append(mat)
    return value


def add_leaf(
    parent: bpy.types.Object,
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    width: float,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    side = Vector((-direction.y, direction.x, 0))
    if side.length < 0.001:
        side = Vector((1, 0, 0))
    side.normalize()
    midpoint = start_vector.lerp(end_vector, 0.55)
    vertices = [
        tuple(start_vector),
        tuple(midpoint + side * width),
        tuple(end_vector),
        tuple(midpoint - side * width),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.materials.append(mat)
    value = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(value)
    value.parent = parent
    return value


def add_mesh(
    parent: bpy.types.Object,
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    mat: bpy.types.Material,
    *,
    smooth: bool = False,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    value = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(value)
    value.parent = parent
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    return value


def join_asset(asset_root: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [child for child in asset_root.children_recursive if child.type == "MESH"]
    if not meshes:
        return
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = f"{asset_root.name}_mesh"
    joined.parent = asset_root
    joined.select_set(False)


def build_avatar() -> None:
    torso = root("avatar_torso")
    add_cube(
        torso,
        "Rounded jacket",
        (0, 0, 0.15),
        (0.2, 0.12, 0.3),
        MATERIALS["coral"],
        bevel=0.035,
    )
    add_cube(
        torso,
        "Jacket panel",
        (0, -0.064, 0.15),
        (0.12, 0.012, 0.19),
        MATERIALS["coral_light"],
        bevel=0.008,
    )
    join_asset(torso)

    head = root("avatar_head")
    add_ico(
        head,
        "Head",
        (0, 0, 0),
        (0.13, 0.12, 0.135),
        MATERIALS["skin"],
        subdivisions=3,
        smooth=True,
    )
    add_ico(
        head,
        "Hair",
        (0, 0.008, 0.085),
        (0.136, 0.125, 0.075),
        MATERIALS["hair"],
        subdivisions=2,
    )
    join_asset(head)

    arm = root("avatar_arm")
    add_cylinder_between(
        arm,
        "Sleeve",
        (0, 0, 0),
        (0, 0, -0.13),
        0.045,
        MATERIALS["coral"],
        vertices=12,
    )
    add_cylinder_between(
        arm,
        "Forearm",
        (0, 0, -0.13),
        (0, 0, -0.24),
        0.034,
        MATERIALS["skin"],
        vertices=12,
    )
    join_asset(arm)

    leg = root("avatar_leg")
    add_cylinder_between(
        leg,
        "Trouser leg",
        (0, 0, 0),
        (0, 0, -0.22),
        0.045,
        MATERIALS["denim"],
        vertices=12,
    )
    join_asset(leg)

    shoe = root("avatar_shoe")
    add_cube(
        shoe,
        "Shoe",
        (0, -0.035, 0),
        (0.09, 0.16, 0.065),
        MATERIALS["charcoal"],
        bevel=0.025,
    )
    add_cube(
        shoe,
        "Sole",
        (0, -0.04, -0.035),
        (0.094, 0.165, 0.018),
        MATERIALS["cream"],
        bevel=0.006,
    )
    join_asset(shoe)

    backpack = root("avatar_backpack")
    add_cube(
        backpack,
        "Backpack",
        (0, 0, 0),
        (0.16, 0.075, 0.23),
        MATERIALS["gold"],
        bevel=0.03,
    )
    add_cube(
        backpack,
        "Pocket",
        (0, 0.04, -0.035),
        (0.115, 0.025, 0.085),
        MATERIALS["orange"],
        bevel=0.012,
    )
    join_asset(backpack)


def build_kayak() -> None:
    kayak = root("kayak")
    station_count = 33
    cross_segments = 24
    vertices: list[tuple[float, float, float]] = []
    for station in range(station_count):
        progress = station / (station_count - 1)
        taper = math.sin(progress * math.pi)
        y = 0.62 - progress * 1.24
        half_width = 0.01 + 0.105 * taper**0.62
        half_height = 0.012 + 0.048 * taper**0.72
        bow_lift = 0.03 * (1 - taper)
        for segment in range(cross_segments):
            angle = segment / cross_segments * math.tau
            vertices.append(
                (
                    math.cos(angle) * half_width,
                    y,
                    math.sin(angle) * half_height + bow_lift,
                )
            )
    faces: list[tuple[int, ...]] = []
    for station in range(station_count - 1):
        for segment in range(cross_segments):
            following = (segment + 1) % cross_segments
            current = station * cross_segments + segment
            next_station = current + cross_segments
            faces.append(
                (
                    current,
                    station * cross_segments + following,
                    next_station + following,
                    next_station,
                )
            )
    faces.append(tuple(range(cross_segments - 1, -1, -1)))
    last = (station_count - 1) * cross_segments
    faces.append(tuple(last + index for index in range(cross_segments)))
    add_mesh(
        kayak,
        "Smooth recreational kayak hull",
        vertices,
        faces,
        MATERIALS["orange"],
        smooth=True,
    )
    add_ico(
        kayak,
        "Cockpit recess",
        (0, 0.02, 0.058),
        (0.085, 0.19, 0.022),
        MATERIALS["charcoal"],
        subdivisions=3,
        smooth=True,
    )
    add_torus(
        kayak,
        "Cockpit rim",
        (0, 0.02, 0.071),
        0.1,
        0.008,
        MATERIALS["orange_light"],
        scale=(1, 1.85, 1),
    )
    add_cube(
        kayak,
        "Seat",
        (0, 0.08, 0.065),
        (0.11, 0.13, 0.025),
        MATERIALS["cream"],
        bevel=0.012,
    )
    join_asset(kayak)

    paddle = root("paddle")
    add_cylinder_between(
        paddle,
        "Paddle shaft",
        (-0.48, 0, 0),
        (0.48, 0, 0),
        0.009,
        MATERIALS["wood_light"],
        vertices=12,
    )
    blade_vertices = [
        (-0.48, -0.035, 0),
        (-0.61, -0.075, 0),
        (-0.72, -0.055, 0),
        (-0.72, 0.055, 0),
        (-0.61, 0.075, 0),
        (-0.48, 0.035, 0),
    ]
    add_mesh(
        paddle,
        "Left paddle blade",
        blade_vertices,
        [(0, 1, 2, 3, 4, 5)],
        MATERIALS["orange_light"],
    )
    add_mesh(
        paddle,
        "Right paddle blade",
        [(-x, y, z) for x, y, z in blade_vertices],
        [(5, 4, 3, 2, 1, 0)],
        MATERIALS["orange_light"],
    )
    join_asset(paddle)


def build_deciduous(name: str, blossom: bool = False) -> None:
    tree = root(name)
    add_cylinder(
        tree,
        "Tapered trunk",
        (0, 0, 0.24),
        0.045,
        0.48,
        MATERIALS["bark"],
        vertices=10,
        radius_top=0.026,
    )
    branches = [
        ((0, 0, 0.28), (-0.18, 0.02, 0.5)),
        ((0, 0, 0.32), (0.2, -0.025, 0.53)),
        ((0, 0, 0.38), (-0.06, 0.12, 0.64)),
        ((0, 0, 0.41), (0.08, -0.12, 0.65)),
    ]
    for index, (start, end) in enumerate(branches):
        add_cylinder_between(
            tree,
            f"Branch {index}",
            start,
            end,
            0.018,
            MATERIALS["bark"],
            vertices=8,
        )
    canopy_materials = (
        (MATERIALS["cherry"], MATERIALS["cherry_light"])
        if blossom
        else (MATERIALS["leaf"], MATERIALS["leaf_light"])
    )
    clusters = [
        (-0.2, 0.02, 0.55, 0.17, 0.12),
        (0.19, -0.02, 0.57, 0.18, 0.13),
        (-0.05, 0.11, 0.68, 0.18, 0.12),
        (0.08, -0.11, 0.69, 0.17, 0.11),
        (0, 0, 0.76, 0.2, 0.13),
    ]
    for index, (x, y, z, width, height) in enumerate(clusters):
        add_ico(
            tree,
            f"Leaf fan {index}",
            (x, y, z),
            (width, width * 0.74, height),
            canopy_materials[index % 2],
            subdivisions=2,
            rotation=(0.12 * index, 0.21 * index, 0.34 * index),
        )
    join_asset(tree)


def build_pine() -> None:
    tree = root("tree_pine")
    add_cylinder(
        tree,
        "Pine trunk",
        (0, 0, 0.27),
        0.035,
        0.54,
        MATERIALS["bark"],
        vertices=9,
        radius_top=0.022,
    )
    for index, (z, radius) in enumerate(((0.32, 0.24), (0.49, 0.2), (0.64, 0.15))):
        bpy.ops.mesh.primitive_cone_add(
            vertices=12,
            radius1=radius,
            radius2=0.02,
            depth=0.3,
            location=(0, 0, z),
        )
        value = attach(bpy.context.object, tree)
        value.name = f"Pine tier {index}"
        value.data.materials.append(
            MATERIALS["pine"] if index != 1 else MATERIALS["leaf_dark"]
        )
    join_asset(tree)


def build_palm() -> None:
    tree = root("tree_palm")
    trunk_points = [
        (0, 0, 0),
        (0.018, 0, 0.22),
        (0.045, 0, 0.45),
        (0.07, 0, 0.66),
    ]
    for index in range(len(trunk_points) - 1):
        add_cylinder_between(
            tree,
            f"Palm trunk {index}",
            trunk_points[index],
            trunk_points[index + 1],
            0.034 - index * 0.006,
            MATERIALS["bark"],
            vertices=10,
        )
    crown = Vector(trunk_points[-1])
    for index in range(10):
        angle = index / 10 * math.tau
        length = 0.28 + 0.045 * (index % 3)
        start = tuple(crown)
        end = (
            crown.x + math.cos(angle) * length,
            crown.y + math.sin(angle) * length,
            crown.z - 0.06 + 0.035 * (index % 2),
        )
        add_leaf(
            tree,
            f"Palm frond {index}",
            start,
            end,
            0.055,
            MATERIALS["palm"] if index % 2 else MATERIALS["leaf_light"],
        )
    join_asset(tree)


def build_small_nature() -> None:
    bush = root("bush")
    for index, (x, y, z, scale) in enumerate(
        (
            (-0.08, 0, 0.1, (0.12, 0.09, 0.09)),
            (0.075, 0.01, 0.11, (0.13, 0.1, 0.1)),
            (0, -0.04, 0.17, (0.14, 0.1, 0.11)),
        )
    ):
        add_ico(
            bush,
            f"Bush fan {index}",
            (x, y, z),
            scale,
            MATERIALS["leaf"] if index != 2 else MATERIALS["leaf_light"],
            subdivisions=1,
            rotation=(0.2 * index, 0.1, 0.4 * index),
        )
    join_asset(bush)

    rock = root("rock")
    add_ico(
        rock,
        "Weathered rock",
        (0, 0, 0.07),
        (0.13, 0.1, 0.08),
        MATERIALS["stone"],
        subdivisions=1,
        rotation=(0.2, 0.1, 0.3),
    )
    join_asset(rock)


def add_windows(
    parent: bpy.types.Object,
    *,
    center_x: float,
    front_y: float,
    bottom: float,
    rows: int,
    columns: int,
    width: float,
    height: float,
) -> None:
    for row in range(rows):
        for column in range(columns):
            x = center_x + (column - (columns - 1) / 2) * width
            z = bottom + row * height
            add_cube(
                parent,
                f"Window {row}-{column}",
                (x, front_y, z),
                (width * 0.52, 0.009, height * 0.48),
                MATERIALS["glass"],
                bevel=0.002,
            )


def build_landmarks() -> None:
    skyline = root("landmark_skyline")
    for index, (x, y, width, depth, height) in enumerate(
        (
            (-0.17, 0, 0.13, 0.12, 0.38),
            (0, 0.02, 0.16, 0.14, 0.58),
            (0.18, -0.01, 0.12, 0.11, 0.44),
        )
    ):
        add_cube(
            skyline,
            f"Rounded tower {index}",
            (x, y, height / 2),
            (width, depth, height),
            MATERIALS["concrete"] if index != 1 else MATERIALS["stone_light"],
            bevel=0.018,
        )
        add_windows(
            skyline,
            center_x=x,
            front_y=y - depth / 2 - 0.006,
            bottom=0.1,
            rows=4,
            columns=2,
            width=width * 0.42,
            height=height * 0.16,
        )
    join_asset(skyline)

    lighthouse = root("landmark_lighthouse")
    add_cylinder(
        lighthouse,
        "Lighthouse",
        (0, 0, 0.27),
        0.09,
        0.54,
        MATERIALS["white"],
        vertices=18,
        radius_top=0.06,
    )
    for z in (0.16, 0.34):
        add_cylinder(
            lighthouse,
            f"Red band {z}",
            (0, 0, z),
            0.082 - z * 0.04,
            0.055,
            MATERIALS["red"],
            vertices=18,
        )
    add_torus(
        lighthouse,
        "Balcony",
        (0, 0, 0.55),
        0.085,
        0.009,
        MATERIALS["charcoal"],
    )
    add_cylinder(
        lighthouse,
        "Lamp",
        (0, 0, 0.59),
        0.055,
        0.08,
        MATERIALS["glass"],
        vertices=16,
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=18,
        radius1=0.075,
        radius2=0,
        depth=0.08,
        location=(0, 0, 0.68),
    )
    attach(bpy.context.object, lighthouse).data.materials.append(MATERIALS["red"])
    join_asset(lighthouse)

    sailboat = root("landmark_sailboat")
    add_ico(
        sailboat,
        "Sailboat hull",
        (0, 0, 0.1),
        (0.25, 0.11, 0.09),
        MATERIALS["wood_light"],
        subdivisions=2,
        smooth=True,
    )
    add_cylinder_between(
        sailboat,
        "Mast",
        (0, 0, 0.12),
        (0, 0, 0.62),
        0.012,
        MATERIALS["wood"],
        vertices=10,
    )
    add_mesh(
        sailboat,
        "Main sail",
        [(0.015, 0, 0.58), (0.015, 0, 0.18), (0.28, 0, 0.2)],
        [(0, 1, 2)],
        MATERIALS["white"],
    )
    add_mesh(
        sailboat,
        "Coral sail",
        [(-0.015, 0, 0.53), (-0.015, 0, 0.23), (-0.2, 0, 0.26)],
        [(0, 1, 2)],
        MATERIALS["coral"],
    )
    join_asset(sailboat)

    barbecue = root("landmark_barbecue")
    add_ico(
        barbecue,
        "Round grill",
        (0, 0, 0.36),
        (0.2, 0.14, 0.12),
        MATERIALS["charcoal"],
        subdivisions=2,
        smooth=True,
    )
    add_cube(
        barbecue,
        "Grill rim",
        (0, -0.02, 0.4),
        (0.34, 0.22, 0.025),
        MATERIALS["red"],
        bevel=0.012,
    )
    for x in (-0.1, 0.1):
        add_cylinder_between(
            barbecue,
            f"Leg {x}",
            (x, 0, 0.3),
            (x * 1.35, 0, 0),
            0.015,
            MATERIALS["charcoal"],
            vertices=8,
        )
    join_asset(barbecue)

    citrus = root("landmark_orange")
    add_cylinder(
        citrus,
        "Pedestal",
        (0, 0, 0.08),
        0.17,
        0.16,
        MATERIALS["stone_light"],
        vertices=18,
        radius_top=0.14,
    )
    add_ico(
        citrus,
        "Giant citrus",
        (0, 0, 0.36),
        (0.2, 0.2, 0.19),
        MATERIALS["yellow"],
        subdivisions=3,
        smooth=True,
    )
    add_leaf(
        citrus,
        "Citrus leaf",
        (0, 0, 0.54),
        (0.16, 0.02, 0.62),
        0.055,
        MATERIALS["leaf"],
    )
    join_asset(citrus)

    palm_landmark = root("landmark_palm")
    for side in (-1, 1):
        x = side * 0.11
        add_cylinder_between(
            palm_landmark,
            f"Palm trunk {side}",
            (x, 0, 0),
            (x + side * 0.05, 0, 0.5 + (side + 1) * 0.04),
            0.035,
            MATERIALS["bark"],
            vertices=10,
        )
        crown = (x + side * 0.05, 0, 0.5 + (side + 1) * 0.04)
        for index in range(7):
            angle = index / 7 * math.tau
            add_leaf(
                palm_landmark,
                f"Landmark frond {side}-{index}",
                crown,
                (
                    crown[0] + math.cos(angle) * 0.24,
                    crown[1] + math.sin(angle) * 0.24,
                    crown[2] - 0.06,
                ),
                0.045,
                MATERIALS["palm"],
            )
    join_asset(palm_landmark)

    mosque = root("landmark_mosque")
    add_cube(
        mosque,
        "Mosque body",
        (0, 0, 0.16),
        (0.38, 0.28, 0.32),
        MATERIALS["stone_light"],
        bevel=0.025,
    )
    add_ico(
        mosque,
        "Central dome",
        (0, 0, 0.36),
        (0.2, 0.17, 0.13),
        MATERIALS["blue"],
        subdivisions=3,
        smooth=True,
    )
    for x in (-0.24, 0.24):
        add_cylinder(
            mosque,
            f"Minaret {x}",
            (x, 0, 0.28),
            0.03,
            0.56,
            MATERIALS["stone_light"],
            vertices=12,
            radius_top=0.018,
        )
        bpy.ops.mesh.primitive_cone_add(
            vertices=12,
            radius1=0.045,
            radius2=0,
            depth=0.12,
            location=(x, 0, 0.62),
        )
        attach(bpy.context.object, mosque).data.materials.append(MATERIALS["gold"])
    join_asset(mosque)

    mountain = root("landmark_mountain")
    for index, (x, y, height, radius) in enumerate(
        ((-0.17, 0, 0.55, 0.23), (0.1, 0.02, 0.72, 0.28), (0.28, 0.04, 0.42, 0.18))
    ):
        bpy.ops.mesh.primitive_cone_add(
            vertices=9,
            radius1=radius,
            radius2=0,
            depth=height,
            location=(x, y, height / 2),
        )
        peak = attach(bpy.context.object, mountain)
        peak.name = f"Mountain {index}"
        peak.data.materials.append(MATERIALS["stone"])
        if index == 1:
            bpy.ops.mesh.primitive_cone_add(
                vertices=9,
                radius1=radius * 0.38,
                radius2=0,
                depth=height * 0.22,
                location=(x, y, height * 0.89),
            )
            attach(bpy.context.object, mountain).data.materials.append(MATERIALS["white"])
    join_asset(mountain)

    tower = root("landmark_tower")
    add_cylinder(
        tower,
        "Tower base",
        (0, 0, 0.28),
        0.07,
        0.56,
        MATERIALS["concrete"],
        vertices=14,
        radius_top=0.035,
    )
    add_ico(
        tower,
        "Observation deck",
        (0, 0, 0.58),
        (0.17, 0.14, 0.09),
        MATERIALS["glass"],
        subdivisions=2,
        smooth=True,
    )
    add_cylinder_between(
        tower,
        "Antenna",
        (0, 0, 0.64),
        (0, 0, 0.9),
        0.012,
        MATERIALS["red"],
        vertices=8,
    )
    join_asset(tower)

    torii = root("landmark_torii")
    for x in (-0.19, 0.19):
        add_cylinder(
            torii,
            f"Torii post {x}",
            (x, 0, 0.28),
            0.035,
            0.56,
            MATERIALS["red"],
            vertices=12,
            radius_top=0.028,
        )
    add_cube(
        torii,
        "Upper lintel",
        (0, 0, 0.58),
        (0.52, 0.075, 0.065),
        MATERIALS["red"],
        bevel=0.018,
    )
    add_cube(
        torii,
        "Lower lintel",
        (0, 0, 0.49),
        (0.4, 0.055, 0.045),
        MATERIALS["red"],
        bevel=0.012,
    )
    join_asset(torii)

    sushi = root("landmark_sushi")
    add_ico(
        sushi,
        "Sushi plate",
        (0, 0, 0.06),
        (0.31, 0.22, 0.055),
        MATERIALS["blue"],
        subdivisions=3,
        smooth=True,
    )
    for index, x in enumerate((-0.13, 0, 0.13)):
        add_cube(
            sushi,
            f"Rice {index}",
            (x, 0, 0.15),
            (0.12, 0.12, 0.1),
            MATERIALS["white"],
            bevel=0.025,
        )
        add_cube(
            sushi,
            f"Topping {index}",
            (x, -0.005, 0.215),
            (0.13, 0.125, 0.045),
            MATERIALS["pink"] if index != 1 else MATERIALS["nori"],
            bevel=0.018,
        )
    join_asset(sushi)


def setup_preview() -> None:
    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        0.06,
        0.1,
        0.14,
        1,
    )
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    bpy.ops.object.light_add(type="AREA", location=(4, -5, 7))
    key = bpy.context.object
    key.name = "Preview key"
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 5
    key.rotation_euler = (math.radians(28), 0, math.radians(38))
    bpy.ops.object.light_add(type="AREA", location=(-4, -2, 3))
    fill = bpy.context.object
    fill.name = "Preview fill"
    fill.data.energy = 450
    fill.data.size = 4
    bpy.ops.object.camera_add(location=(4.8, -7.2, 4.5))
    camera = bpy.context.object
    camera.name = "Preview camera"
    direction = Vector((0, 0, 0.3)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 58
    bpy.context.scene.camera = camera


def main() -> None:
    reset_scene()
    print("Building custom Places asset library", flush=True)
    build_avatar()
    build_kayak()
    build_deciduous("tree_deciduous")
    build_deciduous("tree_cherry", blossom=True)
    build_pine()
    build_palm()
    build_small_nature()
    build_landmarks()
    setup_preview()

    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f"Saved Blender source: {BLEND_PATH}", flush=True)
    print(f"Exported runtime GLB: {GLB_PATH}", flush=True)


if __name__ == "__main__":
    main()
