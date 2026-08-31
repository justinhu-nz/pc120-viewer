from pathlib import Path
import sys

import geopandas as gpd


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "PC120.gdb"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data"
OUTPUT.mkdir(parents=True, exist_ok=True)


LAYERS = {
    "pc120-zoning": ("PC120_Zoning", "ZONE_resolved"),
    "operative-zoning": ("UnitaryPlan_OperativeZoning", "ZONE_resolved"),
    "pc120-height": ("PC120_HeightVariationControl", "TYPE_resolved"),
    "operative-height": ("UnitaryPlan_OperativeHeightVariationControl", "TYPE_resolved"),
    "walkable-catchments": ("PC120_WalkableCatchment", None),
    "frequent-transport": ("PC120_FTN", None),
    "policy-3d": ("PC120_Policy3DArea", "TYPE_resolved"),
    "withdrawal-area": ("PC120_WithdrawalArea", None),
}


requested = set(sys.argv[1:])

for output_name, (source_name, category_field) in LAYERS.items():
    if requested and output_name not in requested:
        continue
    columns = [category_field] if category_field else []
    frame = gpd.read_file(SOURCE, layer=source_name, columns=columns)
    frame = frame.set_crs(2193, allow_override=True)
    tolerance = 7.5 if output_name == "operative-zoning" else 3.0 if output_name == "withdrawal-area" else 0.75
    frame.geometry = frame.geometry.make_valid().simplify(tolerance, preserve_topology=True)

    if category_field:
        frame[category_field] = frame[category_field].fillna("Other").astype(str)
        frame = frame.dissolve(by=category_field, as_index=False)
        frame = frame.rename(columns={category_field: "category"})
    else:
        frame["category"] = output_name.replace("-", " ").title()
        frame = frame.dissolve(by="category", as_index=False)

    frame = frame.to_crs(4326)
    destination = OUTPUT / f"{output_name}.geojson"
    frame.to_file(destination, driver="GeoJSON", engine="pyogrio", layer_options={"RFC7946": "YES"})
    size_mb = destination.stat().st_size / 1024 / 1024
    print(f"{output_name}: {len(frame)} features, {size_mb:.2f} MB")
