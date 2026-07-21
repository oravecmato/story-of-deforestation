#!/usr/bin/env python3
"""
LUH2 per-domain forest-area reconstruction (offline build asset, ADR-026).

Sums forested land (primf + secdf, fraction of grid cell) * carea (km^2) over each
tropical domain's outer mask, per year 1800..2015, from LUH2 v2h states.nc.

Data source : LUH2 v2h (Hurtt et al. 2020, Geoscientific Model Development), CC BY 4.0.
              states.nc read remotely via HTTP byte-range (#mode=bytes) -- only the
              primf/secdf spatial slabs for the requested years are transferred.
Mask        : Natural Earth 1:50m admin_0_map_subunits, ISO_A3_EH, dissolved per
              domain, centroid assignment onto the LUH2 0.25deg grid. GUF (French
              Guiana) is a distinct subunit here (folded into FRA in admin_0_countries).

Output      : shared/data/luh2/<domain>.json  (year -> forest area in km^2).

Run (network host luh.umd.edu + naciscdn.org not in the sandbox allowlist):
    scripts/luh2/.venv/bin/python scripts/luh2/extract.py
"""
import json
import sys
import datetime as dt
from pathlib import Path

import numpy as np
import xarray as xr
import geopandas as gpd
import regionmask

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent.parent / "shared" / "data" / "luh2"
STATIC_NC = HERE / "staticData_quarterdeg.nc"
SUBUNITS_ZIP = HERE / "ne_50m_subunits.zip"
STATES_URL = "https://luh.umd.edu/LUH2/LUH2_v2h/states.nc#mode=bytes"

YEAR_START, YEAR_END = 1800, 2015  # LUH2 v2h ends 2015; ship the full overlap for anchoring
LUH2_EPOCH = 850  # time units: "years since 850-01-01"

# Domain ISO_A3 membership (mirrors shared/config/domains.ts).
DOMAINS = {
    "amazon": "BRA PER COL VEN ECU BOL GUY SUR GUF".split(),
    "congo": "COD COG GAB CMR CAF GNQ".split(),
    "seasia": "IDN MYS PNG MMR KHM LAO THA VNM PHL BRN".split(),
    "other_tropical": (
        "MEX GTM BLZ HND NIC CRI PAN CUB DOM HTI JAM TTO PRY NGA GHA CIV LBR SLE GIN "
        "GNB SEN TGO BEN BFA MLI GMB SDN SSD ETH SOM KEN UGA TZA RWA BDI AGO ZMB MWI "
        "MOZ ZWE MDG STP IND LKA BGD NPL BTN TLS FJI SLB VUT WSM"
    ).split(),
}
DOMAIN_IDS = list(DOMAINS.keys())
ISO_COL = "ISO_A3_EH"


def log(msg: str) -> None:
    print(msg, flush=True)


def build_domain_geoms(grid_lon, grid_lat):
    """Dissolve NE 50m subunits per domain and rasterize onto the LUH2 grid (centroid)."""
    gdf = gpd.read_file(f"zip://{SUBUNITS_ZIP}")
    geoms, names = [], []
    for did in DOMAIN_IDS:
        want = set(DOMAINS[did])
        sel = gdf[gdf[ISO_COL].isin(want)]
        found = set(sel[ISO_COL].astype(str))
        missing = want - found
        if missing:
            raise SystemExit(f"[FATAL] {did}: ISO codes missing from NE 50m: {sorted(missing)}")
        geoms.append(sel.union_all() if hasattr(sel, "union_all") else sel.unary_union)
        names.append(did)
        log(f"  mask {did}: {len(sel)} subunit polygons -> dissolved")
    regions = regionmask.Regions(geoms, numbers=list(range(len(geoms))), names=names)
    # mask2D: (lat, lon) with region index (0..3) or NaN outside all domains
    mask2d = regions.mask(grid_lon, grid_lat)
    return mask2d.values  # numpy (lat, lon)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    log("[1/4] Loading static grid (carea)...")
    static = xr.open_dataset(STATIC_NC)
    carea = static["carea"].values.astype(np.float64)  # (lat, lon), km^2
    carea = np.where(np.isfinite(carea) & (carea < 1e19), carea, 0.0)
    lon = static["lon"].values
    lat = static["lat"].values

    log("[2/4] Building domain masks (NE 50m subunits, centroid assignment)...")
    mask2d = build_domain_geoms(lon, lat)  # (lat, lon) domain index or NaN
    domain_cells = {}
    for i, did in enumerate(DOMAIN_IDS):
        sel = mask2d == i
        domain_cells[did] = sel
        log(f"  {did}: {int(sel.sum())} grid cells, {carea[sel].sum():,.0f} km^2 land-cell area")

    log("[3/4] Opening states.nc via HTTP byte-range...")
    ds = xr.open_dataset(STATES_URL, engine="netcdf4", decode_times=False)
    tvals = (LUH2_EPOCH + ds["time"].values.astype(int))
    idx_by_year = {int(y): int(np.where(tvals == y)[0][0]) for y in range(YEAR_START, YEAR_END + 1)}
    primf = ds["primf"]
    secdf = ds["secdf"]

    series = {did: {} for did in DOMAIN_IDS}

    log(f"[4/4] Summing forest area {YEAR_START}..{YEAR_END} ({len(idx_by_year)} years)...")
    for n, (year, idx) in enumerate(idx_by_year.items(), 1):
        pf = primf.isel(time=idx).values.astype(np.float64)
        sf = secdf.isel(time=idx).values.astype(np.float64)
        # clip fill values / non-finite to 0; fractions are in [0, 1]
        pf = np.where(np.isfinite(pf) & (pf <= 1.0), pf, 0.0)
        sf = np.where(np.isfinite(sf) & (sf <= 1.0), sf, 0.0)
        forest_km2 = (pf + sf) * carea  # (lat, lon)
        for did in DOMAIN_IDS:
            series[did][year] = float(forest_km2[domain_cells[did]].sum())
        if n % 20 == 0 or n == len(idx_by_year):
            sample = series["amazon"][year]
            log(f"  {n}/{len(idx_by_year)} year={year} amazon={sample:,.0f} km^2")

    generated = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for did in DOMAIN_IDS:
        payload = {
            "domain": did,
            "variable": "primf+secdf",
            "unit": "km2",
            "grid": "0.25deg",
            "source": "LUH2 v2h states.nc (Hurtt et al. 2020, GMD; CC BY 4.0)",
            "mask": (
                "Natural Earth 1:50m admin_0_map_subunits, ISO_A3_EH, dissolved per "
                "domain, centroid assignment on the LUH2 grid"
            ),
            "generated": generated,
            "points": [{"year": y, "areaKm2": round(series[did][y], 2)} for y in range(YEAR_START, YEAR_END + 1)],
        }
        out = OUT_DIR / f"{did}.json"
        out.write_text(json.dumps(payload, indent=2) + "\n")
        log(f"  wrote {out.relative_to(HERE.parent.parent)} ({len(payload['points'])} points, "
            f"{payload['points'][0]['areaKm2']:,.0f} -> {payload['points'][-1]['areaKm2']:,.0f} km^2)")

    log("DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
