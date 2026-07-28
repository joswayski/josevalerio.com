"""Generate the authored asset library for the Places planetoid.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender \
    --background --python scripts/blender/generate_places_assets.py

The checked-in .blend file is the editable source of truth. The GLB is the
optimized runtime export consumed by Three.js.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = REPO_ROOT / "assets" / "blender" / "places-world.blend"
GLB_PATH = REPO_ROOT / "public" / "places" / "models" / "places-world.glb"

# Reset before creating any datablocks. Resetting after material construction
# invalidates their RNA handles in Blender.
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.72,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    value = bpy.data.materials.new(name)
    value.diffuse_color = color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic

    if emission is not None:
        shader.inputs["Emission Color"].default_value = emission
        shader.inputs["Emission Strength"].default_value = emission_strength

    return value


MATERIALS = {
    "orange": material("Kayak orange", (0.88, 0.29, 0.08, 1), roughness=0.38),
    "orange_light": material(
        "Kayak highlight", (1.0, 0.55, 0.16, 1), roughness=0.35
    ),
    "orange_dark": material("Kayak shadow", (0.45, 0.11, 0.035, 1)),
    "charcoal": material("Charcoal", (0.025, 0.035, 0.04, 1), roughness=0.62),
    "rubber": material("Rubber", (0.012, 0.016, 0.018, 1), roughness=0.9),
    "wood": material("Warm wood", (0.38, 0.17, 0.07, 1), roughness=0.8),
    "light_wood": material("Light wood", (0.72, 0.46, 0.22, 1), roughness=0.72),
    "skin": material("Skin", (0.76, 0.48, 0.29, 1), roughness=0.68),
    "shirt": material("Coral jacket", (0.78, 0.09, 0.055, 1), roughness=0.67),
    "shirt_light": material("Jacket highlight", (0.96, 0.25, 0.13, 1)),
    "denim": material("Deep denim", (0.035, 0.11, 0.16, 1), roughness=0.76),
    "cream": material("Warm cream", (0.9, 0.84, 0.7, 1), roughness=0.74),
    "white": material("Cloud white", (0.91, 0.95, 0.96, 1), roughness=0.95),
    "cloud_shadow": material(
        "Cloud blue shadow", (0.52, 0.64, 0.68, 1), roughness=0.98
    ),
    "storm": material("Storm cloud", (0.27, 0.36, 0.4, 1), roughness=0.98),
    "leaf": material("Leaf green", (0.12, 0.43, 0.2, 1), roughness=0.86),
    "leaf_light": material(
        "Leaf sun", (0.31, 0.65, 0.28, 1), roughness=0.84
    ),
    "leaf_dark": material(
        "Leaf shadow", (0.045, 0.24, 0.12, 1), roughness=0.9
    ),
    "pine": material("Pine", (0.055, 0.31, 0.2, 1), roughness=0.9),
    "blossom": material("Blossom", (0.94, 0.42, 0.53, 1), roughness=0.82),
    "stone": material("Warm stone", (0.42, 0.44, 0.4, 1), roughness=0.9),
    "stone_light": material(
        "Pale stone", (0.69, 0.69, 0.61, 1), roughness=0.86
    ),
    "concrete": material("Concrete", (0.55, 0.58, 0.56, 1), roughness=0.88),
    "red": material("Landmark red", (0.72, 0.055, 0.035, 1), roughness=0.58),
    "gold": material(
        "Warm metal", (0.76, 0.49, 0.08, 1), roughness=0.32, metallic=0.48
    ),
    "steel": material(
        "Steel", (0.37, 0.43, 0.44, 1), roughness=0.27, metallic=0.72
    ),
    "glass": material(
        "Blue glass", (0.16, 0.42, 0.52, 1), roughness=0.16, metallic=0.1
    ),
    "window": material(
        "Lit window",
        (0.58, 0.8, 0.84, 1),
        roughness=0.24,
        metallic=0.08,
        emission=(0.16, 0.34, 0.38, 1),
        emission_strength=0.32,
    ),
    "sand": material("Sand", (0.74, 0.57, 0.31, 1), roughness=0.92),
    "yellow": material("Taxi yellow", (0.95, 0.56, 0.02, 1), roughness=0.46),
    "blue": material("Ceramic blue", (0.08, 0.34, 0.48, 1), roughness=0.5),
    "snow": material("Snow", (0.92, 0.95, 0.93, 1), roughness=0.9),
    "salmon": material("Salmon", (0.94, 0.29, 0.2, 1), roughness=0.56),
    "nori": material("Nori", (0.018, 0.12, 0.075, 1), roughness=0.82),
}


def safe_name(name: str) -> str:
    # Blender treats a final ".<digits>" segment as a duplicate-number suffix.
    # Generated floating-point labels can overflow that parser in Blender 5.2.
    return name.replace(".", "_")


def create_root(name: str) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(root)
    return root


def attach(obj: bpy.types.Object, root: bpy.types.Object) -> bpy.types.Object:
    obj.parent = root
    return obj


def smooth(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> None:
    modifier = obj.modifiers.new(name="Soft edges", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def add_cube(
    root: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel_width:
        bevel(obj, bevel_width)
        smooth(obj)
    obj.data.materials.append(mat)
    return attach(obj, root)


def add_uv_sphere(
    root: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    segments: int = 24,
    rings: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=location
    )
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    smooth(obj)
    return attach(obj, root)


def add_ico(
    root: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    subdivisions: int = 2,
    smooth_faces: bool = True,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=1, location=location
    )
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if smooth_faces:
        smooth(obj)
    return attach(obj, root)


def add_cylinder(
    root: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 20,
    rotation: tuple[float, float, float] = (0, 0, 0),
    radius_top: float | None = None,
    bevel_width: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.data.materials.append(mat)
    if bevel_width:
        bevel(obj, bevel_width, 2)
        smooth(obj)
    return attach(obj, root)


def add_cylinder_between(
    root: bpy.types.Object,
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 16,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    obj = add_cylinder(
        root,
        name,
        tuple(midpoint),
        radius,
        delta.length,
        mat,
        vertices=vertices,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def add_torus(
    root: bpy.types.Object,
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    scale: tuple[float, float, float] = (1, 1, 1),
    major_segments: int = 36,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    smooth(obj)
    return attach(obj, root)


def add_curve(
    root: bpy.types.Object,
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    mat: bpy.types.Material,
    *,
    cyclic: bool = False,
) -> bpy.types.Object:
    clean_name = safe_name(name)
    curve = bpy.data.curves.new(clean_name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for control, point in zip(spline.bezier_points, points):
        control.co = point
        control.handle_left_type = "AUTO"
        control.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(clean_name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return attach(obj, root)


def add_mesh(
    root: bpy.types.Object,
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    mat: bpy.types.Material,
    *,
    smooth_faces: bool = False,
    bevel_width: float = 0.0,
) -> bpy.types.Object:
    clean_name = safe_name(name)
    mesh = bpy.data.meshes.new(clean_name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(clean_name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    attach(obj, root)
    if bevel_width:
        bevel(obj, bevel_width, 2)
    if smooth_faces:
        smooth(obj)
    return obj


def join_asset(root: bpy.types.Object) -> None:
    meshes = [child for child in root.children_recursive if child.type == "MESH"]
    curves = [child for child in root.children_recursive if child.type == "CURVE"]

    for curve in curves:
        bpy.context.view_layer.objects.active = curve
        curve.select_set(True)
        bpy.ops.object.convert(target="MESH")
        curve.select_set(False)

    meshes = [child for child in root.children_recursive if child.type == "MESH"]
    if not meshes:
        return

    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = f"{root.name}_mesh"
    joined.parent = root
    joined.select_set(False)


def build_kayak() -> None:
    root = create_root("kayak")
    stations = [
        (-0.43, 0.018, 0.035),
        (-0.34, 0.075, 0.055),
        (-0.19, 0.125, 0.072),
        (0.0, 0.145, 0.078),
        (0.19, 0.125, 0.072),
        (0.34, 0.075, 0.055),
        (0.43, 0.018, 0.035),
    ]
    vertices: list[tuple[float, float, float]] = []
    cross_segments = 14
    for y, half_width, half_height in stations:
        for segment in range(cross_segments):
            angle = segment / cross_segments * math.tau
            x = math.cos(angle) * half_width
            z = math.sin(angle) * half_height - 0.005
            vertices.append((x, y, z))
    faces: list[tuple[int, ...]] = []
    for station in range(len(stations) - 1):
        for segment in range(cross_segments):
            next_segment = (segment + 1) % cross_segments
            current = station * cross_segments + segment
            next_station = current + cross_segments
            faces.append(
                (
                    current,
                    station * cross_segments + next_segment,
                    next_station + next_segment,
                    next_station,
                )
            )
    faces.append(tuple(range(cross_segments - 1, -1, -1)))
    end_start = (len(stations) - 1) * cross_segments
    faces.append(tuple(end_start + i for i in range(cross_segments)))
    add_mesh(
        root,
        "Sculpted kayak hull",
        vertices,
        faces,
        MATERIALS["orange"],
        smooth_faces=True,
    )
    add_uv_sphere(
        root,
        "Recessed cockpit",
        (0, -0.035, 0.068),
        (0.095, 0.19, 0.018),
        MATERIALS["charcoal"],
        segments=28,
        rings=12,
    )
    rim_points = [
        (
            math.cos(i / 48 * math.tau) * 0.105,
            -0.035 + math.sin(i / 48 * math.tau) * 0.21,
            0.085,
        )
        for i in range(48)
    ]
    add_curve(
        root,
        "Cockpit rim",
        rim_points,
        0.009,
        MATERIALS["orange_light"],
        cyclic=True,
    )
    add_cube(
        root,
        "Padded seat",
        (0, -0.09, 0.078),
        (0.12, 0.105, 0.018),
        MATERIALS["cream"],
        bevel_width=0.012,
    )
    for y in (0.18, 0.23, 0.28):
        add_curve(
            root,
            f"Deck bungee {y}",
            [(-0.075, y, 0.073), (0.075, y, 0.073)],
            0.003,
            MATERIALS["charcoal"],
        )
    add_curve(
        root,
        "Deck center line",
        [(0, 0.19, 0.075), (0, 0.39, 0.045)],
        0.003,
        MATERIALS["orange_light"],
    )
    for y in (-0.39, 0.39):
        add_torus(
            root,
            f"Carry handle {y}",
            (0, y, 0.045),
            0.022,
            0.004,
            MATERIALS["charcoal"],
            rotation=(math.pi / 2, 0, 0),
            scale=(1.2, 0.55, 1),
            major_segments=20,
        )
    join_asset(root)

    paddle = create_root("paddle")
    add_cylinder(
        paddle,
        "Paddle shaft",
        (0, 0, 0),
        0.009,
        0.64,
        MATERIALS["light_wood"],
        vertices=20,
    )
    blade_vertices = [
        (-0.035, -0.31, 0),
        (-0.065, -0.43, 0),
        (-0.04, -0.5, 0),
        (0.04, -0.5, 0),
        (0.065, -0.43, 0),
        (0.035, -0.31, 0),
    ]
    blade_faces = [(0, 1, 2, 3, 4, 5)]
    lower = add_mesh(
        paddle,
        "Lower blade",
        blade_vertices,
        blade_faces,
        MATERIALS["orange_light"],
        bevel_width=0.006,
    )
    solidify = lower.modifiers.new("Blade thickness", "SOLIDIFY")
    solidify.thickness = 0.012
    bpy.context.view_layer.objects.active = lower
    lower.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    lower.select_set(False)
    upper_vertices = [(x, -y, z) for x, y, z in blade_vertices]
    upper = add_mesh(
        paddle,
        "Upper blade",
        upper_vertices,
        blade_faces,
        MATERIALS["orange_light"],
        bevel_width=0.006,
    )
    solidify = upper.modifiers.new("Blade thickness", "SOLIDIFY")
    solidify.thickness = 0.012
    bpy.context.view_layer.objects.active = upper
    upper.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    upper.select_set(False)
    join_asset(paddle)


def build_traveler() -> None:
    torso = create_root("traveler_torso")
    add_uv_sphere(
        torso,
        "Rounded torso",
        (0, 0, 0.16),
        (0.071, 0.052, 0.105),
        MATERIALS["shirt"],
        segments=24,
        rings=16,
    )
    add_cube(
        torso,
        "Jacket panel",
        (0, -0.05, 0.16),
        (0.075, 0.01, 0.13),
        MATERIALS["shirt_light"],
        bevel_width=0.006,
    )
    add_cylinder_between(
        torso,
        "Left jacket seam",
        (-0.026, -0.058, 0.105),
        (-0.026, -0.058, 0.215),
        0.003,
        MATERIALS["cream"],
    )
    add_cylinder_between(
        torso,
        "Right jacket seam",
        (0.026, -0.058, 0.105),
        (0.026, -0.058, 0.215),
        0.003,
        MATERIALS["cream"],
    )
    join_asset(torso)

    head = create_root("traveler_head")
    add_uv_sphere(
        head,
        "Head",
        (0, 0, 0),
        (0.078, 0.07, 0.082),
        MATERIALS["skin"],
        segments=28,
        rings=18,
    )
    add_uv_sphere(
        head,
        "Hair",
        (0, 0.01, 0.048),
        (0.081, 0.073, 0.045),
        MATERIALS["charcoal"],
        segments=24,
        rings=14,
    )
    for x in (-0.027, 0.027):
        add_uv_sphere(
            head,
            f"Eye {x}",
            (x, -0.067, 0.004),
            (0.006, 0.004, 0.008),
            MATERIALS["charcoal"],
            segments=12,
            rings=8,
        )
    join_asset(head)

    arm = create_root("traveler_arm")
    add_cylinder(
        arm,
        "Sleeve",
        (0, 0, 0.045),
        0.026,
        0.075,
        MATERIALS["shirt"],
        vertices=18,
        radius_top=0.022,
        bevel_width=0.004,
    )
    add_cylinder(
        arm,
        "Forearm",
        (0, 0, -0.025),
        0.021,
        0.085,
        MATERIALS["skin"],
        vertices=18,
        radius_top=0.018,
        bevel_width=0.004,
    )
    add_uv_sphere(
        arm,
        "Hand",
        (0, 0, -0.074),
        (0.022, 0.022, 0.025),
        MATERIALS["skin"],
        segments=16,
        rings=10,
    )
    join_asset(arm)

    leg = create_root("traveler_leg")
    add_cylinder(
        leg,
        "Tapered leg",
        (0, 0, 0),
        0.026,
        0.13,
        MATERIALS["denim"],
        vertices=18,
        radius_top=0.023,
        bevel_width=0.004,
    )
    join_asset(leg)

    shoe = create_root("traveler_shoe")
    add_cube(
        shoe,
        "Sneaker body",
        (0, -0.02, 0),
        (0.06, 0.105, 0.04),
        MATERIALS["charcoal"],
        bevel_width=0.013,
    )
    add_cube(
        shoe,
        "Gum sole",
        (0, -0.018, -0.025),
        (0.064, 0.115, 0.016),
        MATERIALS["light_wood"],
        bevel_width=0.006,
    )
    for y in (-0.035, -0.012, 0.011):
        add_cylinder_between(
            shoe,
            f"Lace {y}",
            (-0.023, y, 0.024),
            (0.023, y, 0.024),
            0.0025,
            MATERIALS["white"],
            vertices=8,
        )
    join_asset(shoe)

    backpack = create_root("traveler_backpack")
    add_cube(
        backpack,
        "Backpack",
        (0, 0, 0),
        (0.11, 0.055, 0.145),
        MATERIALS["gold"],
        bevel_width=0.018,
    )
    add_cube(
        backpack,
        "Backpack pocket",
        (0, -0.034, -0.025),
        (0.075, 0.025, 0.058),
        MATERIALS["orange_dark"],
        bevel_width=0.009,
    )
    add_curve(
        backpack,
        "Backpack handle",
        [(-0.028, 0, 0.075), (0, 0, 0.095), (0.028, 0, 0.075)],
        0.006,
        MATERIALS["cream"],
    )
    join_asset(backpack)


def build_clouds() -> None:
    definitions = {
        "cloud_cumulus": [
            (-0.42, 0.0, 0.0, 0.34),
            (-0.15, -0.04, 0.06, 0.42),
            (0.18, 0.0, 0.04, 0.36),
            (0.42, 0.02, -0.02, 0.27),
            (-0.22, 0.02, 0.31, 0.31),
            (0.06, 0.01, 0.38, 0.4),
            (0.31, 0.03, 0.27, 0.29),
        ],
        "cloud_stratus": [
            (-0.62, 0.0, 0.02, 0.28),
            (-0.34, 0.0, 0.04, 0.34),
            (0.0, 0.0, 0.02, 0.38),
            (0.35, 0.0, 0.05, 0.34),
            (0.63, 0.0, 0.0, 0.26),
            (-0.17, 0.0, 0.23, 0.29),
            (0.2, 0.0, 0.21, 0.26),
        ],
        "cloud_storm": [
            (-0.46, 0.0, 0.0, 0.34),
            (-0.17, 0.0, 0.02, 0.44),
            (0.18, 0.0, 0.02, 0.42),
            (0.46, 0.0, -0.02, 0.31),
            (-0.23, 0.0, 0.34, 0.34),
            (0.08, 0.0, 0.48, 0.43),
            (0.34, 0.0, 0.31, 0.31),
            (0.02, 0.0, 0.82, 0.29),
        ],
    }
    for asset_name, puffs in definitions.items():
        root = create_root(asset_name)
        storm = asset_name == "cloud_storm"
        for index, (x, y, z, radius) in enumerate(puffs):
            base_mat = (
                MATERIALS["storm"]
                if storm and z < 0.2
                else MATERIALS["cloud_shadow"]
                if index < 4
                else MATERIALS["white"]
            )
            add_uv_sphere(
                root,
                f"Cloud lobe {index}",
                (x, y, z),
                (
                    radius * (1.25 if asset_name == "cloud_stratus" else 1),
                    radius * 0.72,
                    radius,
                ),
                base_mat,
                segments=24,
                rings=16,
            )
        join_asset(root)


def build_tree_asset(
    name: str,
    *,
    kind: str,
    crown_material: bpy.types.Material,
) -> None:
    root = create_root(name)
    if kind == "palm":
        trunk_points = [
            (0, 0, 0),
            (0.025, 0, 0.18),
            (0.06, 0, 0.36),
            (0.045, 0, 0.53),
        ]
        add_curve(root, "Curved palm trunk", trunk_points, 0.025, MATERIALS["wood"])
        for index in range(8):
            angle = index / 8 * math.tau
            end = (
                math.cos(angle) * 0.27,
                math.sin(angle) * 0.27,
                0.47 + (0.035 if index % 2 else -0.01),
            )
            add_curve(
                root,
                f"Palm rib {index}",
                [(0.045, 0, 0.54), (end[0] * 0.55, end[1] * 0.55, 0.59), end],
                0.009,
                crown_material,
            )
            for leaf_index in range(3):
                t = 0.42 + leaf_index * 0.19
                leaf_center = (
                    end[0] * t,
                    end[1] * t,
                    0.57 - leaf_index * 0.025,
                )
                add_ico(
                    root,
                    f"Palm leaf {index}-{leaf_index}",
                    leaf_center,
                    (0.075, 0.025, 0.02),
                    MATERIALS["leaf_light"] if index % 2 else crown_material,
                    subdivisions=2,
                )
        for index in range(3):
            add_uv_sphere(
                root,
                f"Coconut {index}",
                ((index - 1) * 0.035, 0.02, 0.51 - abs(index - 1) * 0.012),
                (0.027, 0.027, 0.03),
                MATERIALS["wood"],
                segments=14,
                rings=9,
            )
    else:
        add_cylinder(
            root,
            "Tapered trunk",
            (0, 0, 0.21),
            0.035,
            0.42,
            MATERIALS["wood"],
            vertices=18,
            radius_top=0.022,
            bevel_width=0.004,
        )
        for side in (-1, 1):
            add_cylinder_between(
                root,
                f"Branch {side}",
                (0, 0, 0.28),
                (side * 0.11, 0.02, 0.42),
                0.015,
                MATERIALS["wood"],
            )
        if kind in {"pine", "conifer", "cypress"}:
            levels = (
                [(0.25, 0.2), (0.36, 0.18), (0.47, 0.145), (0.57, 0.1)]
                if kind != "cypress"
                else [(0.28, 0.115), (0.4, 0.1), (0.51, 0.075), (0.59, 0.04)]
            )
            for index, (z, radius) in enumerate(levels):
                bpy.ops.mesh.primitive_cone_add(
                    vertices=20,
                    radius1=radius,
                    radius2=0.015,
                    depth=0.24,
                    location=(0, 0, z),
                )
                obj = bpy.context.object
                obj.name = f"Needle canopy {index}"
                obj.data.materials.append(
                    MATERIALS["leaf_dark"] if index % 2 else crown_material
                )
                smooth(obj)
                attach(obj, root)
        else:
            crowns = [
                (-0.11, 0.01, 0.42, 0.16),
                (0.1, -0.015, 0.44, 0.17),
                (-0.015, 0.02, 0.55, 0.18),
                (0.12, 0.04, 0.56, 0.115),
                (-0.13, -0.03, 0.55, 0.105),
            ]
            for index, (x, y, z, radius) in enumerate(crowns):
                add_ico(
                    root,
                    f"Foliage cluster {index}",
                    (x, y, z),
                    (radius * 1.05, radius * 0.9, radius),
                    MATERIALS["leaf_light"] if index % 3 == 0 else crown_material,
                    subdivisions=3,
                )
    join_asset(root)


def build_vegetation() -> None:
    build_tree_asset(
        "tree_broadleaf", kind="broadleaf", crown_material=MATERIALS["leaf"]
    )
    build_tree_asset(
        "tree_blossom", kind="broadleaf", crown_material=MATERIALS["blossom"]
    )
    build_tree_asset("tree_conifer", kind="conifer", crown_material=MATERIALS["pine"])
    build_tree_asset("tree_pine", kind="pine", crown_material=MATERIALS["pine"])
    build_tree_asset(
        "tree_cypress", kind="cypress", crown_material=MATERIALS["leaf_dark"]
    )
    build_tree_asset("tree_palm", kind="palm", crown_material=MATERIALS["leaf"])

    for name, crown in (
        ("bush_green", MATERIALS["leaf"]),
        ("bush_blossom", MATERIALS["blossom"]),
        ("bush_pine", MATERIALS["pine"]),
        ("bush_palm", MATERIALS["leaf_light"]),
    ):
        root = create_root(name)
        clusters = [
            (-0.09, 0, 0.08, 0.105),
            (0.08, 0.01, 0.09, 0.115),
            (0, -0.015, 0.15, 0.12),
            (0.015, 0.08, 0.08, 0.09),
            (-0.035, -0.075, 0.08, 0.08),
        ]
        for index, (x, y, z, radius) in enumerate(clusters):
            add_ico(
                root,
                f"Bush cluster {index}",
                (x, y, z),
                (radius * 1.15, radius, radius * 0.9),
                MATERIALS["leaf_light"] if index == 2 else crown,
                subdivisions=3,
            )
        join_asset(root)

    rock = create_root("rock")
    add_ico(
        rock,
        "Weathered rock",
        (0, 0, 0.045),
        (0.095, 0.075, 0.06),
        MATERIALS["stone"],
        subdivisions=3,
        smooth_faces=True,
    )
    add_ico(
        rock,
        "Rock highlight",
        (-0.018, -0.045, 0.07),
        (0.045, 0.02, 0.018),
        MATERIALS["stone_light"],
        subdivisions=2,
    )
    join_asset(rock)


def add_windows(
    root: bpy.types.Object,
    *,
    center: tuple[float, float, float],
    width: float,
    height: float,
    rows: int,
    columns: int,
    front_y: float,
) -> None:
    for row in range(rows):
        for column in range(columns):
            x = center[0] + (column - (columns - 1) / 2) * width
            z = center[2] + (row - (rows - 1) / 2) * height
            add_cube(
                root,
                f"Window {x}-{z}",
                (x, front_y, z),
                (width * 0.48, 0.006, height * 0.42),
                MATERIALS["window"],
                bevel_width=0.0015,
            )


def build_landmarks() -> None:
    print("  landmark skyline", flush=True)
    skyline = create_root("landmark_skyline")
    buildings = [
        (-0.12, 0.0, 0.14, 0.09, 0.11, 0.28),
        (-0.04, 0.025, 0.19, 0.08, 0.1, 0.38),
        (0.055, 0.0, 0.235, 0.095, 0.12, 0.47),
        (0.15, 0.02, 0.155, 0.075, 0.1, 0.31),
    ]
    for index, (x, y, z, width, depth, height) in enumerate(buildings):
        add_cube(
            skyline,
            f"Tower {index}",
            (x, y, z),
            (width, depth, height),
            MATERIALS["concrete"] if index % 2 else MATERIALS["stone_light"],
            bevel_width=0.008,
        )
        add_windows(
            skyline,
            center=(x, y, z),
            width=width / 3,
            height=height / 5,
            rows=4,
            columns=2,
            front_y=y - depth / 2 - 0.004,
        )
    add_cylinder_between(
        skyline,
        "Spire",
        (0.055, 0, 0.47),
        (0.055, 0, 0.62),
        0.007,
        MATERIALS["steel"],
    )
    join_asset(skyline)

    print("  landmark lighthouse", flush=True)
    lighthouse = create_root("landmark_lighthouse")
    add_cylinder(
        lighthouse,
        "Tapered lighthouse",
        (0, 0, 0.19),
        0.07,
        0.38,
        MATERIALS["cream"],
        vertices=32,
        radius_top=0.045,
        bevel_width=0.004,
    )
    for z in (0.11, 0.24):
        add_cylinder(
            lighthouse,
            f"Red band {z}",
            (0, 0, z),
            0.062 - z * 0.04,
            0.045,
            MATERIALS["red"],
            vertices=32,
        )
    add_torus(
        lighthouse,
        "Balcony",
        (0, 0, 0.405),
        0.065,
        0.009,
        MATERIALS["steel"],
        rotation=(0, 0, 0),
    )
    add_cylinder(
        lighthouse,
        "Lamp room",
        (0, 0, 0.445),
        0.047,
        0.07,
        MATERIALS["glass"],
        vertices=24,
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=32,
        radius1=0.068,
        radius2=0,
        depth=0.075,
        location=(0, 0, 0.52),
    )
    attach(bpy.context.object, lighthouse).data.materials.append(MATERIALS["red"])
    for index in range(8):
        angle = index / 8 * math.tau
        x, y = math.cos(angle) * 0.065, math.sin(angle) * 0.065
        add_cylinder_between(
            lighthouse,
            f"Balcony rail {index}",
            (x, y, 0.398),
            (x, y, 0.44),
            0.003,
            MATERIALS["steel"],
            vertices=8,
        )
    join_asset(lighthouse)

    print("  landmark sailboat", flush=True)
    sailboat = create_root("landmark_sailboat")
    hull_vertices = [
        (-0.16, -0.12, 0.09),
        (0.16, -0.12, 0.09),
        (-0.11, 0.15, 0.09),
        (0.11, 0.15, 0.09),
        (-0.1, -0.1, 0),
        (0.1, -0.1, 0),
        (0, 0.19, 0.025),
    ]
    hull_faces = [
        (0, 1, 5, 4),
        (1, 3, 6, 5),
        (3, 2, 6),
        (2, 0, 4, 6),
        (4, 5, 6),
        (0, 2, 3, 1),
    ]
    add_mesh(
        sailboat,
        "Sailboat hull",
        hull_vertices,
        hull_faces,
        MATERIALS["orange_light"],
        bevel_width=0.008,
        smooth_faces=True,
    )
    add_cylinder_between(
        sailboat,
        "Mast",
        (0, 0.02, 0.08),
        (0, 0.02, 0.55),
        0.009,
        MATERIALS["wood"],
    )
    sails = [
        (
            [(-0.01, 0.02, 0.48), (-0.01, 0.02, 0.14), (-0.27, 0.02, 0.16)],
            MATERIALS["cream"],
        ),
        (
            [(0.012, 0.02, 0.45), (0.012, 0.02, 0.17), (0.2, 0.02, 0.19)],
            MATERIALS["red"],
        ),
    ]
    for index, (verts, mat) in enumerate(sails):
        sail = add_mesh(
            sailboat,
            f"Sail {index}",
            verts,
            [(0, 1, 2)],
            mat,
            bevel_width=0.003,
        )
        solidify = sail.modifiers.new("Sail cloth", "SOLIDIFY")
        solidify.thickness = 0.006
        bpy.context.view_layer.objects.active = sail
        sail.select_set(True)
        bpy.ops.object.modifier_apply(modifier=solidify.name)
        sail.select_set(False)
    add_curve(
        sailboat,
        "Rigging",
        [(-0.27, 0.02, 0.16), (0, 0.02, 0.55), (0.2, 0.02, 0.19)],
        0.0025,
        MATERIALS["charcoal"],
    )
    join_asset(sailboat)

    print("  landmark barbecue", flush=True)
    barbecue = create_root("landmark_barbecue")
    add_cylinder(
        barbecue,
        "Smoker barrel",
        (0, 0, 0.25),
        0.095,
        0.32,
        MATERIALS["charcoal"],
        vertices=32,
        rotation=(0, math.pi / 2, 0),
        bevel_width=0.006,
    )
    add_cylinder(
        barbecue,
        "Fire box",
        (-0.19, 0, 0.21),
        0.07,
        0.14,
        MATERIALS["charcoal"],
        vertices=28,
        rotation=(0, math.pi / 2, 0),
        bevel_width=0.005,
    )
    add_cylinder_between(
        barbecue,
        "Chimney",
        (0.13, 0, 0.31),
        (0.13, 0, 0.51),
        0.022,
        MATERIALS["charcoal"],
    )
    add_cylinder(
        barbecue,
        "Chimney cap",
        (0.13, 0, 0.515),
        0.04,
        0.012,
        MATERIALS["steel"],
        vertices=24,
    )
    for x in (-0.11, 0.11):
        add_cylinder_between(
            barbecue,
            f"Leg {x}",
            (x, -0.04, 0.17),
            (x, -0.04, 0.02),
            0.012,
            MATERIALS["steel"],
        )
        add_torus(
            barbecue,
            f"Wheel {x}",
            (x, -0.04, 0.035),
            0.035,
            0.009,
            MATERIALS["rubber"],
            rotation=(math.pi / 2, 0, 0),
            major_segments=20,
        )
    add_curve(
        barbecue,
        "Lid handle",
        [(-0.055, -0.1, 0.31), (0, -0.125, 0.34), (0.055, -0.1, 0.31)],
        0.008,
        MATERIALS["light_wood"],
    )
    join_asset(barbecue)

    print("  landmark orange", flush=True)
    orange = create_root("landmark_orange")
    add_cylinder(
        orange,
        "Orange tree trunk",
        (0, 0, 0.2),
        0.04,
        0.4,
        MATERIALS["wood"],
        vertices=18,
        radius_top=0.025,
        bevel_width=0.004,
    )
    for index, (x, y, z, radius) in enumerate(
        [
            (-0.11, 0, 0.41, 0.15),
            (0.1, 0.02, 0.42, 0.16),
            (0, -0.02, 0.52, 0.17),
        ]
    ):
        add_ico(
            orange,
            f"Orange foliage {index}",
            (x, y, z),
            (radius, radius * 0.9, radius),
            MATERIALS["leaf_light"] if index == 2 else MATERIALS["leaf"],
            subdivisions=3,
        )
    for index, (x, y, z) in enumerate(
        [
            (-0.13, -0.1, 0.4),
            (-0.04, -0.14, 0.51),
            (0.07, -0.13, 0.45),
            (0.14, -0.08, 0.53),
            (0.02, 0.1, 0.39),
        ]
    ):
        add_uv_sphere(
            orange,
            f"Orange fruit {index}",
            (x, y, z),
            (0.026, 0.026, 0.028),
            MATERIALS["orange_light"],
            segments=16,
            rings=10,
        )
    join_asset(orange)

    # The palm landmark reuses the authored palm tree at a larger destination scale.
    print("  landmark palm", flush=True)
    palm = create_root("landmark_palm")
    add_curve(
        palm,
        "Curved trunk",
        [(0, 0, 0), (0.025, 0, 0.22), (0.08, 0, 0.46)],
        0.035,
        MATERIALS["wood"],
    )
    for index in range(9):
        angle = index / 9 * math.tau
        end = (math.cos(angle) * 0.31, math.sin(angle) * 0.31, 0.43)
        add_curve(
            palm,
            f"Palm frond {index}",
            [(0.08, 0, 0.46), (end[0] * 0.52, end[1] * 0.52, 0.54), end],
            0.013,
            MATERIALS["leaf_light"] if index % 2 else MATERIALS["leaf"],
        )
    for index in range(3):
        add_uv_sphere(
            palm,
            f"Coconut {index}",
            (0.04 + index * 0.03, -0.025, 0.43 - index * 0.012),
            (0.029, 0.029, 0.031),
            MATERIALS["wood"],
            segments=14,
            rings=9,
        )
    join_asset(palm)

    print("  landmark mosque", flush=True)
    mosque = create_root("landmark_mosque")
    add_cube(
        mosque,
        "Mosque hall",
        (0, 0, 0.13),
        (0.3, 0.23, 0.24),
        MATERIALS["cream"],
        bevel_width=0.018,
    )
    add_uv_sphere(
        mosque,
        "Main dome",
        (0, 0, 0.28),
        (0.135, 0.115, 0.1),
        MATERIALS["blue"],
        segments=32,
        rings=18,
    )
    add_cylinder_between(
        mosque,
        "Dome finial",
        (0, 0, 0.35),
        (0, 0, 0.44),
        0.008,
        MATERIALS["gold"],
    )
    for x in (-0.19, 0.19):
        add_cylinder(
            mosque,
            f"Minaret {x}",
            (x, 0, 0.23),
            0.028,
            0.46,
            MATERIALS["cream"],
            vertices=28,
            radius_top=0.019,
            bevel_width=0.003,
        )
        add_torus(
            mosque,
            f"Minaret balcony {x}",
            (x, 0, 0.36),
            0.036,
            0.006,
            MATERIALS["gold"],
            major_segments=24,
        )
        bpy.ops.mesh.primitive_cone_add(
            vertices=24,
            radius1=0.031,
            radius2=0,
            depth=0.105,
            location=(x, 0, 0.515),
        )
        attach(bpy.context.object, mosque).data.materials.append(MATERIALS["blue"])
    for x in (-0.075, 0, 0.075):
        add_cube(
            mosque,
            f"Arch {x}",
            (x, -0.12, 0.135),
            (0.045, 0.012, 0.09),
            MATERIALS["charcoal"],
            bevel_width=0.018,
        )
    join_asset(mosque)

    print("  landmark mountain", flush=True)
    mountain = create_root("landmark_mountain")
    peaks = [(-0.08, 0.0, 0.19, 0.2), (0.1, 0.04, 0.15, 0.15)]
    for index, (x, y, z, radius) in enumerate(peaks):
        bpy.ops.mesh.primitive_cone_add(
            vertices=28,
            radius1=radius,
            radius2=0,
            depth=z * 2,
            location=(x, y, z),
        )
        attach(bpy.context.object, mountain).data.materials.append(
            MATERIALS["stone"] if index == 0 else MATERIALS["stone_light"]
        )
        bpy.ops.mesh.primitive_cone_add(
            vertices=28,
            radius1=radius * 0.43,
            radius2=0,
            depth=z * 0.72,
            location=(x, y, z * 1.64),
        )
        attach(bpy.context.object, mountain).data.materials.append(MATERIALS["snow"])
    for index, x in enumerate((-0.2, -0.14, 0.18, 0.23)):
        bpy.ops.mesh.primitive_cone_add(
            vertices=16,
            radius1=0.035,
            radius2=0,
            depth=0.12,
            location=(x, -0.05 + index * 0.015, 0.06),
        )
        attach(bpy.context.object, mountain).data.materials.append(MATERIALS["pine"])
    join_asset(mountain)

    print("  landmark tower", flush=True)
    tower = create_root("landmark_tower")
    add_cylinder(
        tower,
        "Tower shaft",
        (0, 0, 0.25),
        0.03,
        0.5,
        MATERIALS["concrete"],
        vertices=28,
        radius_top=0.018,
        bevel_width=0.003,
    )
    for x in (-0.055, 0.055):
        add_cylinder_between(
            tower,
            f"Tower brace {x}",
            (x, 0, 0.0),
            (0, 0, 0.28),
            0.012,
            MATERIALS["steel"],
        )
    add_cylinder(
        tower,
        "Observation deck",
        (0, 0, 0.38),
        0.085,
        0.075,
        MATERIALS["glass"],
        vertices=32,
        radius_top=0.068,
        bevel_width=0.006,
    )
    add_torus(
        tower,
        "Deck ring",
        (0, 0, 0.405),
        0.086,
        0.009,
        MATERIALS["red"],
    )
    add_cylinder_between(
        tower,
        "Antenna",
        (0, 0, 0.42),
        (0, 0, 0.67),
        0.009,
        MATERIALS["red"],
    )
    for z in (0.49, 0.56, 0.62):
        add_cylinder(
            tower,
            f"Antenna band {z}",
            (0, 0, z),
            0.014,
            0.025,
            MATERIALS["cream"],
            vertices=18,
        )
    join_asset(tower)

    print("  landmark torii", flush=True)
    torii = create_root("landmark_torii")
    for x in (-0.12, 0.12):
        add_cylinder(
            torii,
            f"Torii pillar {x}",
            (x, 0, 0.22),
            0.03,
            0.44,
            MATERIALS["red"],
            vertices=24,
            radius_top=0.025,
            bevel_width=0.005,
        )
        add_cylinder(
            torii,
            f"Pillar foot {x}",
            (x, 0, 0.025),
            0.05,
            0.05,
            MATERIALS["charcoal"],
            vertices=24,
        )
    add_curve(
        torii,
        "Curved upper lintel",
        [(-0.2, 0, 0.43), (0, 0, 0.46), (0.2, 0, 0.43)],
        0.035,
        MATERIALS["red"],
    )
    add_cube(
        torii,
        "Lower lintel",
        (0, 0, 0.37),
        (0.3, 0.055, 0.04),
        MATERIALS["red"],
        bevel_width=0.008,
    )
    add_cube(
        torii,
        "Torii plaque",
        (0, -0.035, 0.39),
        (0.07, 0.012, 0.09),
        MATERIALS["gold"],
        bevel_width=0.005,
    )
    add_curve(
        torii,
        "Shimenawa",
        [(-0.105, -0.03, 0.33), (0, -0.05, 0.3), (0.105, -0.03, 0.33)],
        0.008,
        MATERIALS["cream"],
    )
    join_asset(torii)

    print("  landmark sushi", flush=True)
    sushi = create_root("landmark_sushi")
    add_uv_sphere(
        sushi,
        "Serving plate",
        (0, 0, 0.03),
        (0.25, 0.18, 0.035),
        MATERIALS["blue"],
        segments=32,
        rings=12,
    )
    for index, x in enumerate((-0.11, 0, 0.11)):
        add_cube(
            sushi,
            f"Rice {index}",
            (x, 0, 0.09),
            (0.09, 0.115, 0.07),
            MATERIALS["cream"],
            bevel_width=0.022,
        )
        add_cube(
            sushi,
            f"Salmon {index}",
            (x, -0.005, 0.135),
            (0.105, 0.13, 0.028),
            MATERIALS["salmon"],
            bevel_width=0.012,
        )
        for stripe in (-0.025, 0, 0.025):
            add_cube(
                sushi,
                f"Salmon line {index}-{stripe}",
                (x + stripe, -0.071, 0.14),
                (0.009, 0.006, 0.026),
                MATERIALS["cream"],
                rotation=(0, 0, -0.22),
            )
    for index, y in enumerate((-0.09, 0.09)):
        add_cylinder(
            sushi,
            f"Maki {index}",
            (0.0, y, 0.13),
            0.052,
            0.085,
            MATERIALS["nori"],
            vertices=28,
        )
        add_cylinder(
            sushi,
            f"Maki rice {index}",
            (0.0, y, 0.177),
            0.039,
            0.012,
            MATERIALS["cream"],
            vertices=28,
        )
        add_cylinder(
            sushi,
            f"Maki center {index}",
            (0.0, y, 0.186),
            0.013,
            0.01,
            MATERIALS["salmon"],
            vertices=18,
        )
    join_asset(sushi)


def build_special_scenery() -> None:
    taxi = create_root("scenery_new-york")
    add_cube(
        taxi,
        "Taxi body",
        (0, 0, 0.105),
        (0.25, 0.4, 0.11),
        MATERIALS["yellow"],
        bevel_width=0.025,
    )
    add_cube(
        taxi,
        "Taxi cabin",
        (0, -0.015, 0.19),
        (0.2, 0.2, 0.11),
        MATERIALS["yellow"],
        bevel_width=0.022,
    )
    for side in (-1, 1):
        add_cube(
            taxi,
            f"Side windows {side}",
            (side * 0.102, -0.015, 0.205),
            (0.008, 0.14, 0.06),
            MATERIALS["glass"],
            bevel_width=0.004,
        )
        for y in (-0.13, 0.13):
            add_cylinder(
                taxi,
                f"Wheel {side}-{y}",
                (side * 0.135, y, 0.06),
                0.045,
                0.025,
                MATERIALS["rubber"],
                vertices=24,
                rotation=(0, math.pi / 2, 0),
            )
            add_cylinder(
                taxi,
                f"Hub {side}-{y}",
                (side * 0.15, y, 0.06),
                0.019,
                0.01,
                MATERIALS["steel"],
                vertices=20,
                rotation=(0, math.pi / 2, 0),
            )
    add_cube(
        taxi,
        "Taxi roof sign",
        (0, -0.01, 0.275),
        (0.09, 0.065, 0.035),
        MATERIALS["cream"],
        bevel_width=0.009,
    )
    for x in (-0.075, 0.075):
        add_uv_sphere(
            taxi,
            f"Headlight {x}",
            (x, -0.205, 0.105),
            (0.022, 0.008, 0.016),
            MATERIALS["window"],
            segments=14,
            rings=8,
        )
    join_asset(taxi)

    beach = create_root("scenery_new-jersey")
    for side in (-1, 1):
        add_cylinder_between(
            beach,
            f"Chair leg {side}",
            (side * 0.07, 0, 0),
            (side * 0.055, 0, 0.23),
            0.012,
            MATERIALS["light_wood"],
        )
    for z in (0.07, 0.13, 0.19):
        add_cube(
            beach,
            f"Chair slat {z}",
            (0, 0, z),
            (0.16, 0.025, 0.025),
            MATERIALS["cream"] if int(z * 100) % 2 else MATERIALS["red"],
            bevel_width=0.005,
        )
    add_cylinder_between(
        beach,
        "Umbrella pole",
        (-0.17, 0.04, 0),
        (-0.17, 0.04, 0.5),
        0.012,
        MATERIALS["light_wood"],
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=32,
        radius1=0.2,
        radius2=0.025,
        depth=0.08,
        location=(-0.17, 0.04, 0.5),
    )
    umbrella = attach(bpy.context.object, beach)
    umbrella.data.materials.append(MATERIALS["red"])
    join_asset(beach)

    buoy = create_root("scenery_rhode-island")
    add_cylinder(
        buoy,
        "Buoy body",
        (0, 0, 0.16),
        0.075,
        0.32,
        MATERIALS["red"],
        vertices=32,
        radius_top=0.05,
        bevel_width=0.006,
    )
    add_cylinder(
        buoy,
        "White band",
        (0, 0, 0.17),
        0.07,
        0.065,
        MATERIALS["cream"],
        vertices=32,
    )
    add_torus(
        buoy,
        "Rubber bumper",
        (0, 0, 0.055),
        0.09,
        0.014,
        MATERIALS["rubber"],
    )
    for side in (-1, 1):
        add_cylinder_between(
            buoy,
            f"Beacon support {side}",
            (side * 0.035, 0, 0.31),
            (side * 0.035, 0, 0.46),
            0.007,
            MATERIALS["steel"],
        )
    add_cylinder(
        buoy,
        "Beacon",
        (0, 0, 0.46),
        0.032,
        0.06,
        MATERIALS["window"],
        vertices=20,
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=20,
        radius1=0.05,
        radius2=0,
        depth=0.055,
        location=(0, 0, 0.515),
    )
    attach(bpy.context.object, buoy).data.materials.append(MATERIALS["charcoal"])
    join_asset(buoy)

    bean = create_root("scenery_chicago")
    add_uv_sphere(
        bean,
        "Cloud Gate",
        (0, 0, 0.13),
        (0.24, 0.16, 0.14),
        MATERIALS["steel"],
        segments=48,
        rings=28,
    )
    add_uv_sphere(
        bean,
        "Cloud Gate arch",
        (0, -0.145, 0.08),
        (0.13, 0.035, 0.065),
        MATERIALS["charcoal"],
        segments=32,
        rings=18,
    )
    add_cylinder(
        bean,
        "Plaza",
        (0, 0, 0.012),
        0.29,
        0.024,
        MATERIALS["stone_light"],
        vertices=48,
    )
    join_asset(bean)

    guitar = create_root("scenery_austin")
    add_uv_sphere(
        guitar,
        "Guitar lower body",
        (0, 0, 0.12),
        (0.11, 0.045, 0.13),
        MATERIALS["light_wood"],
        segments=28,
        rings=18,
    )
    add_uv_sphere(
        guitar,
        "Guitar upper body",
        (0, 0, 0.245),
        (0.085, 0.04, 0.09),
        MATERIALS["orange_dark"],
        segments=28,
        rings=18,
    )
    add_cube(
        guitar,
        "Guitar neck",
        (0, 0, 0.42),
        (0.045, 0.025, 0.28),
        MATERIALS["wood"],
        bevel_width=0.007,
    )
    add_cube(
        guitar,
        "Guitar headstock",
        (0, 0, 0.59),
        (0.075, 0.03, 0.085),
        MATERIALS["orange_dark"],
        bevel_width=0.009,
    )
    add_cylinder(
        guitar,
        "Sound hole",
        (0, -0.048, 0.16),
        0.03,
        0.008,
        MATERIALS["charcoal"],
        vertices=24,
        rotation=(math.pi / 2, 0, 0),
    )
    for index, x in enumerate((-0.012, -0.004, 0.004, 0.012)):
        add_cylinder_between(
            guitar,
            f"Guitar string {index}",
            (x, -0.051, 0.08),
            (x, -0.026, 0.61),
            0.0014,
            MATERIALS["steel"],
            vertices=6,
        )
    join_asset(guitar)

    rocket = create_root("scenery_central-florida")
    add_cylinder(
        rocket,
        "Rocket body",
        (0, 0, 0.28),
        0.055,
        0.48,
        MATERIALS["cream"],
        vertices=32,
        radius_top=0.047,
        bevel_width=0.004,
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=32,
        radius1=0.05,
        radius2=0,
        depth=0.17,
        location=(0, 0, 0.605),
    )
    attach(bpy.context.object, rocket).data.materials.append(MATERIALS["red"])
    for z in (0.15, 0.36):
        add_cylinder(
            rocket,
            f"Rocket band {z}",
            (0, 0, z),
            0.06,
            0.035,
            MATERIALS["charcoal"],
            vertices=28,
        )
    for index in range(4):
        angle = index / 4 * math.tau
        x, y = math.cos(angle) * 0.065, math.sin(angle) * 0.065
        vertices = [
            (x, y, 0.05),
            (x * 2.1, y * 2.1, 0.0),
            (x, y, 0.18),
        ]
        fin = add_mesh(
            rocket,
            f"Rocket fin {index}",
            vertices,
            [(0, 1, 2)],
            MATERIALS["red"],
        )
        solidify = fin.modifiers.new("Fin thickness", "SOLIDIFY")
        solidify.thickness = 0.018
        bpy.context.view_layer.objects.active = fin
        fin.select_set(True)
        bpy.ops.object.modifier_apply(modifier=solidify.name)
        fin.select_set(False)
    for side in (-1, 1):
        add_uv_sphere(
            rocket,
            f"Porthole {side}",
            (side * 0.047, -0.027, 0.42),
            (0.015, 0.01, 0.015),
            MATERIALS["window"],
            segments=16,
            rings=9,
        )
    join_asset(rocket)

    dmz = create_root("scenery_korean-dmz")
    add_cube(
        dmz,
        "Observation platform",
        (0, 0, 0.3),
        (0.3, 0.22, 0.12),
        MATERIALS["blue"],
        bevel_width=0.012,
    )
    for x in (-0.11, 0.11):
        for y in (-0.07, 0.07):
            add_cylinder_between(
                dmz,
                f"Observation leg {x}-{y}",
                (x, y, 0),
                (x, y, 0.25),
                0.014,
                MATERIALS["steel"],
            )
    add_cube(
        dmz,
        "Observation roof",
        (0, 0, 0.39),
        (0.36, 0.28, 0.045),
        MATERIALS["charcoal"],
        bevel_width=0.008,
    )
    for x in (-0.085, 0, 0.085):
        add_cube(
            dmz,
            f"Observation window {x}",
            (x, -0.113, 0.31),
            (0.065, 0.008, 0.055),
            MATERIALS["window"],
            bevel_width=0.003,
        )
    for x in (-0.24, -0.12, 0, 0.12, 0.24):
        add_cylinder_between(
            dmz,
            f"Fence post {x}",
            (x, 0.16, 0),
            (x, 0.16, 0.22),
            0.007,
            MATERIALS["steel"],
            vertices=10,
        )
    for z in (0.07, 0.14, 0.21):
        add_cylinder_between(
            dmz,
            f"Fence line {z}",
            (-0.25, 0.16, z),
            (0.25, 0.16, z),
            0.003,
            MATERIALS["steel"],
            vertices=8,
        )
    join_asset(dmz)

    apricot = create_root("scenery_malatya")
    add_cylinder(
        apricot,
        "Apricot trunk",
        (0, 0, 0.22),
        0.045,
        0.44,
        MATERIALS["wood"],
        vertices=20,
        radius_top=0.028,
        bevel_width=0.004,
    )
    for side in (-1, 1):
        add_cylinder_between(
            apricot,
            f"Apricot branch {side}",
            (0, 0, 0.28),
            (side * 0.13, 0, 0.46),
            0.018,
            MATERIALS["wood"],
        )
    for index, (x, y, z, radius) in enumerate(
        [
            (-0.13, 0.02, 0.48, 0.16),
            (0.12, 0, 0.49, 0.17),
            (0, -0.02, 0.59, 0.18),
            (0.16, 0.02, 0.61, 0.11),
        ]
    ):
        add_ico(
            apricot,
            f"Apricot foliage {index}",
            (x, y, z),
            (radius, radius * 0.88, radius),
            MATERIALS["leaf_light"] if index == 2 else MATERIALS["leaf"],
            subdivisions=3,
        )
    for index in range(9):
        angle = index / 9 * math.tau
        add_uv_sphere(
            apricot,
            f"Apricot {index}",
            (
                math.cos(angle) * (0.11 + (index % 3) * 0.03),
                -0.13,
                0.48 + math.sin(angle * 2) * 0.1,
            ),
            (0.025, 0.025, 0.028),
            MATERIALS["orange_light"],
            segments=14,
            rings=9,
        )
    add_cube(
        apricot,
        "Apricot crate",
        (0.2, 0.04, 0.065),
        (0.18, 0.14, 0.13),
        MATERIALS["light_wood"],
        bevel_width=0.008,
    )
    join_asset(apricot)

    castle = create_root("scenery_osaka")
    add_cube(
        castle,
        "Stone foundation",
        (0, 0, 0.055),
        (0.38, 0.32, 0.11),
        MATERIALS["stone"],
        bevel_width=0.016,
    )
    for tier in range(4):
        width = 0.31 - tier * 0.047
        depth = 0.25 - tier * 0.037
        base_z = 0.14 + tier * 0.115
        add_cube(
            castle,
            f"Castle floor {tier}",
            (0, 0, base_z),
            (width, depth, 0.09),
            MATERIALS["cream"],
            bevel_width=0.009,
        )
        roof_z = base_z + 0.067
        roof_vertices = [
            (-width * 0.62, -depth * 0.64, roof_z),
            (width * 0.62, -depth * 0.64, roof_z),
            (width * 0.62, depth * 0.64, roof_z),
            (-width * 0.62, depth * 0.64, roof_z),
            (-width * 0.48, -depth * 0.48, roof_z + 0.055),
            (width * 0.48, -depth * 0.48, roof_z + 0.055),
            (width * 0.48, depth * 0.48, roof_z + 0.055),
            (-width * 0.48, depth * 0.48, roof_z + 0.055),
        ]
        roof_faces = [
            (0, 1, 5, 4),
            (1, 2, 6, 5),
            (2, 3, 7, 6),
            (3, 0, 4, 7),
            (4, 5, 6, 7),
        ]
        add_mesh(
            castle,
            f"Sweeping roof {tier}",
            roof_vertices,
            roof_faces,
            MATERIALS["pine"],
            bevel_width=0.008,
            smooth_faces=True,
        )
        for column in (-1, 0, 1):
            add_cube(
                castle,
                f"Castle window {tier}-{column}",
                (column * width * 0.25, -depth / 2 - 0.006, base_z),
                (0.027, 0.008, 0.042),
                MATERIALS["charcoal"],
                bevel_width=0.002,
            )
        add_curve(
            castle,
            f"Gold roof trim {tier}",
            [
                (-width * 0.62, -depth * 0.65, roof_z + 0.004),
                (0, -depth * 0.7, roof_z + 0.02),
                (width * 0.62, -depth * 0.65, roof_z + 0.004),
            ],
            0.005,
            MATERIALS["gold"],
        )
    add_cylinder_between(
        castle,
        "Castle finial",
        (0, 0, 0.58),
        (0, 0, 0.68),
        0.008,
        MATERIALS["gold"],
    )
    for side in (-1, 1):
        add_curve(
            castle,
            f"Shachihoko {side}",
            [
                (side * 0.045, 0, 0.62),
                (side * 0.075, 0, 0.66),
                (side * 0.055, 0, 0.7),
            ],
            0.008,
            MATERIALS["gold"],
        )
    join_asset(castle)


def build_ambient_scenery() -> None:
    barn = create_root("ambient_barn")
    add_cube(
        barn,
        "Barn body",
        (0, 0, 0.16),
        (0.4, 0.31, 0.32),
        MATERIALS["red"],
        bevel_width=0.012,
    )
    roof_vertices = [
        (-0.24, -0.19, 0.3),
        (0.24, -0.19, 0.3),
        (-0.24, 0.19, 0.3),
        (0.24, 0.19, 0.3),
        (0, -0.19, 0.47),
        (0, 0.19, 0.47),
    ]
    roof_faces = [
        (0, 1, 4),
        (2, 5, 3),
        (0, 4, 5, 2),
        (1, 3, 5, 4),
    ]
    add_mesh(
        barn,
        "Barn roof",
        roof_vertices,
        roof_faces,
        MATERIALS["charcoal"],
        bevel_width=0.01,
    )
    add_cube(
        barn,
        "Barn doors",
        (0, -0.162, 0.14),
        (0.18, 0.012, 0.25),
        MATERIALS["cream"],
        bevel_width=0.006,
    )
    add_cube(
        barn,
        "Barn door inset",
        (0, -0.17, 0.14),
        (0.135, 0.008, 0.2),
        MATERIALS["red"],
        bevel_width=0.004,
    )
    add_cylinder_between(
        barn,
        "Door brace left",
        (-0.065, -0.176, 0.055),
        (0.065, -0.176, 0.225),
        0.007,
        MATERIALS["cream"],
    )
    add_cylinder_between(
        barn,
        "Door brace right",
        (0.065, -0.176, 0.055),
        (-0.065, -0.176, 0.225),
        0.007,
        MATERIALS["cream"],
    )
    add_uv_sphere(
        barn,
        "Loft window",
        (0, -0.183, 0.355),
        (0.055, 0.012, 0.055),
        MATERIALS["window"],
        segments=20,
        rings=10,
    )
    add_cylinder(
        barn,
        "Silo",
        (0.3, 0.03, 0.2),
        0.09,
        0.4,
        MATERIALS["steel"],
        vertices=32,
        bevel_width=0.004,
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=32,
        radius1=0.1,
        radius2=0,
        depth=0.12,
        location=(0.3, 0.03, 0.46),
    )
    attach(bpy.context.object, barn).data.materials.append(MATERIALS["steel"])
    for x in (-0.28, -0.14, 0.0, 0.14):
        add_cylinder_between(
            barn,
            f"Fence post {x}",
            (x, 0.28, 0),
            (x, 0.28, 0.16),
            0.012,
            MATERIALS["light_wood"],
        )
    for z in (0.06, 0.13):
        add_cylinder_between(
            barn,
            f"Fence rail {z}",
            (-0.29, 0.28, z),
            (0.15, 0.28, z),
            0.009,
            MATERIALS["light_wood"],
        )
    join_asset(barn)

    pavilion = create_root("ambient_korean-pavilion")
    add_cube(
        pavilion,
        "Stone terrace",
        (0, 0, 0.035),
        (0.48, 0.38, 0.07),
        MATERIALS["stone_light"],
        bevel_width=0.016,
    )
    for step in range(3):
        add_cube(
            pavilion,
            f"Front stair {step}",
            (0, -0.24 - step * 0.035, 0.018 + step * 0.016),
            (0.19 - step * 0.025, 0.07, 0.035),
            MATERIALS["stone_light"],
            bevel_width=0.006,
        )
    add_cube(
        pavilion,
        "Wooden floor",
        (0, 0, 0.095),
        (0.39, 0.3, 0.055),
        MATERIALS["wood"],
        bevel_width=0.008,
    )
    for x in (-0.15, 0.15):
        for y in (-0.105, 0.105):
            add_cylinder(
                pavilion,
                f"Pavilion pillar {x}-{y}",
                (x, y, 0.27),
                0.018,
                0.35,
                MATERIALS["red"],
                vertices=20,
                bevel_width=0.003,
            )
            add_cylinder(
                pavilion,
                f"Pillar stone {x}-{y}",
                (x, y, 0.105),
                0.026,
                0.04,
                MATERIALS["stone"],
                vertices=20,
            )
    for y in (-0.125, 0.125):
        add_cube(
            pavilion,
            f"Painted beam {y}",
            (0, y, 0.42),
            (0.4, 0.035, 0.045),
            MATERIALS["blue"],
            bevel_width=0.006,
        )
        add_cube(
            pavilion,
            f"Gold beam line {y}",
            (0, y - math.copysign(0.02, y), 0.42),
            (0.32, 0.009, 0.012),
            MATERIALS["gold"],
            bevel_width=0.003,
        )
    roof_z = 0.44
    roof_width = 0.56
    roof_depth = 0.46
    roof_vertices = [
        (-roof_width / 2, -roof_depth / 2, roof_z),
        (roof_width / 2, -roof_depth / 2, roof_z),
        (roof_width / 2, roof_depth / 2, roof_z),
        (-roof_width / 2, roof_depth / 2, roof_z),
        (-0.2, -0.15, roof_z + 0.14),
        (0.2, -0.15, roof_z + 0.14),
        (0.2, 0.15, roof_z + 0.14),
        (-0.2, 0.15, roof_z + 0.14),
    ]
    roof_faces = [
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
        (4, 5, 6, 7),
    ]
    add_mesh(
        pavilion,
        "Sweeping pavilion roof",
        roof_vertices,
        roof_faces,
        MATERIALS["pine"],
        bevel_width=0.012,
        smooth_faces=True,
    )
    for side_x in (-1, 1):
        for side_y in (-1, 1):
            corner = (
                side_x * roof_width / 2,
                side_y * roof_depth / 2,
                roof_z,
            )
            add_curve(
                pavilion,
                f"Upturned eave {side_x}-{side_y}",
                [
                    (
                        side_x * roof_width * 0.33,
                        side_y * roof_depth * 0.34,
                        roof_z + 0.09,
                    ),
                    corner,
                    (
                        side_x * (roof_width / 2 + 0.055),
                        side_y * (roof_depth / 2 + 0.045),
                        roof_z + 0.045,
                    ),
                ],
                0.012,
                MATERIALS["gold"],
            )
    add_cube(
        pavilion,
        "Pavilion sign",
        (0, -0.145, 0.365),
        (0.13, 0.018, 0.06),
        MATERIALS["charcoal"],
        bevel_width=0.006,
    )
    add_cylinder_between(
        pavilion,
        "Bell rope",
        (0, 0, 0.41),
        (0, 0, 0.24),
        0.004,
        MATERIALS["cream"],
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=24,
        radius1=0.035,
        radius2=0.018,
        depth=0.055,
        location=(0, 0, 0.23),
    )
    attach(bpy.context.object, pavilion).data.materials.append(MATERIALS["gold"])
    join_asset(pavilion)


def add_preview_camera_and_lighting() -> None:
    bpy.ops.object.light_add(type="AREA", location=(4, -6, 7))
    key = bpy.context.object
    key.name = "Preview key light"
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 5

    bpy.ops.object.light_add(type="AREA", location=(-5, -2, 3))
    fill = bpy.context.object
    fill.name = "Preview fill light"
    fill.data.energy = 500
    fill.data.size = 4

    bpy.ops.object.camera_add(location=(7.5, -10.5, 7.5))
    camera = bpy.context.object
    camera.name = "Preview camera"
    direction = Vector((0, 0, 0.8)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 54
    bpy.context.scene.camera = camera


def arrange_source_library() -> None:
    roots = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "EMPTY" and obj.parent is None
    ]
    columns = 8
    for index, root in enumerate(sorted(roots, key=lambda item: item.name)):
        root.location = (
            (index % columns - (columns - 1) / 2) * 1.3,
            (index // columns) * 1.5,
            0,
        )


def export() -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Keep the authored source arranged and readable in Blender.
    arrange_source_library()
    add_preview_camera_and_lighting()
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new("Places preview world")
    bpy.context.scene.world.color = (0.055, 0.075, 0.09)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    # Runtime nodes must all have local origin transforms. Their source layout
    # remains in the .blend file; the exported library is origin-normalized.
    roots = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "EMPTY" and obj.parent is None
    ]
    for root in roots:
        root.location = (0, 0, 0)

    bpy.ops.object.select_all(action="DESELECT")
    for root in roots:
        root.select_set(True)
        for child in root.children_recursive:
            child.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


def main() -> None:
    print("Building kayak", flush=True)
    build_kayak()
    print("Building traveler", flush=True)
    build_traveler()
    print("Building clouds", flush=True)
    build_clouds()
    print("Building vegetation", flush=True)
    build_vegetation()
    print("Building landmarks", flush=True)
    build_landmarks()
    print("Building special scenery", flush=True)
    build_special_scenery()
    print("Building ambient scenery", flush=True)
    build_ambient_scenery()
    print("Saving and exporting", flush=True)
    export()
    print(f"Saved Blender source: {BLEND_PATH}")
    print(f"Exported runtime GLB: {GLB_PATH}")


if __name__ == "__main__":
    main()
