import geopandas as gpd
import pandas as pd
import re
import os
import json

# --- PATHS (Adjust these if needed) ---
base_downloads = r'C:\Users\Samuel Alalade\Downloads'
statewide_folder = os.path.join(base_downloads, 'TxDOT Statewide')

district_shapefile_path = os.path.join(statewide_folder, 'TxDOT_Districts', 'TxDOT_Districts.shp')
markers_gdb = os.path.join(statewide_folder, 'TxDOT_Reference_Markers_-3319492179985110783', '3f843393-22ab-44c8-a9a2-7e85b5dfe25a.gdb')

output_json_path = os.path.join(os.path.dirname(__file__), 'public', 'txdot_spatial_data.json')

def normalize_hwy(hwy):
    """Standardizes highway names: IH 0010 R -> IH10"""
    if pd.isna(hwy): return ""
    s = str(hwy).upper().strip().replace(" ", "").replace("-", "")
    s = re.sub(r'[RLKAX]$', '', s)
    match = re.match(r"([A-Z]+)0*(\d+)", s)
    return f"{match.group(1)}{match.group(2)}" if match else s

def extract_spatial_data():
    print("1/3: Loading District Boundaries...")
    district_map = gpd.read_file(district_shapefile_path)
    
    # Reproject to WGS84 (Lat/Lon) so Plotly/Leaflet can render it natively
    if district_map.crs != "EPSG:4326":
        district_map = district_map.to_crs("EPSG:4326")
        
    district_map['DIST_CLEAN'] = district_map['DIST_NM'].astype(str).str.upper().str.replace(" ", "")
    
    # Convert districts to raw GeoJSON format
    districts_geojson = json.loads(district_map.to_json())

    print("2/3: Loading Reference Markers (This may take a minute depending on engine)...")
    # Try pyogrio first for speed, fallback to fiona
    try:
        markers = gpd.read_file(markers_gdb, engine="pyogrio")
    except Exception:
        markers = gpd.read_file(markers_gdb, engine="fiona")

    if markers.crs != "EPSG:4326":
        markers = markers.to_crs("EPSG:4326")

    print("3/3: Building web-friendly marker lookup table...")
    markers['DIST_CLEAN'] = markers['DIST_NM'].astype(str).str.upper().str.replace(" ", "")
    markers['hwy_key'] = markers['RTE_NM'].apply(normalize_hwy)
    m_col = 'MRKR_NBR' if 'MRKR_NBR' in markers.columns else 'M_NBR'
    
    # Ensure marker number is an integer
    markers['TRM_NUM'] = pd.to_numeric(markers[m_col], errors='coerce').fillna(0).astype(int)
    
    # We only need the coordinates and the key
    # Create a lookup dictionary: "DIST_HWY_TRM" -> [longitude, latitude]
    marker_lookup = {}
    
    # Convert geometry to lon/lat efficiently
    lons = markers.geometry.x.values
    lats = markers.geometry.y.values
    dists = markers['DIST_CLEAN'].values
    hwys = markers['hwy_key'].values
    trms = markers['TRM_NUM'].values
    
    for i in range(len(markers)):
        # Skip if missing essential data
        if pd.isna(dists[i]) or pd.isna(hwys[i]):
            continue
            
        key = f"{dists[i]}_{hwys[i]}_{trms[i]}"
        # If there are duplicates, we'll just keep the first one encountered
        if key not in marker_lookup:
            marker_lookup[key] = [round(float(lons[i]), 5), round(float(lats[i]), 5)]
            
    print(f"Built lookup dictionary for {len(marker_lookup)} unique markers.")

    # Save to JSON
    print(f"Saving compiled spatial data to {output_json_path}...")
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    
    with open(output_json_path, 'w') as f:
        json.dump({
            "districts_geojson": districts_geojson,
            "marker_lookup": marker_lookup
        }, f)
        
    print("Success! The web application is now equipped with the spatial data.")

if __name__ == "__main__":
    extract_spatial_data()
