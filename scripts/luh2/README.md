# LUH2 forest-area reconstruction (offline build asset)

One-time preprocessing that produces the per-domain historical forest-area series
(`shared/data/luh2/<domain>.json`, years **1800–2015**) used by the back-projection of
the forgone sink (ADR-026, business §7.2a). It is **not** part of the runtime app — the
committed JSONs are the only thing the server/BFF loads.

## What it computes

For each tropical domain (`amazon`, `congo`, `seasia`, `other_tropical`), for every year
1800–2015:

```
forestArea[km2] = Σ  (primf + secdf) × carea   over the domain's grid cells
```

- `primf` (forested primary land) + `secdf` (forested secondary land) — fractions of a
  0.25° grid cell — from **LUH2 v2h** `states.nc` (Hurtt et al. 2020, *GMD*; CC BY 4.0).
- `carea` — grid-cell area (km²) — from LUH2 `staticData_quarterdeg.nc`.

`states.nc` is **6.2 GB**; it is read **remotely via HTTP byte-range** (`#mode=bytes`),
so only the `primf`/`secdf` spatial slabs for the 216 requested years (~1.7 GB) are
transferred — the file is never fully downloaded.

## Domain mask (ADR-026 decision: Natural Earth 1:50m)

Each domain is the union of whole countries (`shared/config/domains.ts`). The mask is
built from **Natural Earth 1:50m `admin_0_map_subunits`**, filtered by **`ISO_A3_EH`**
(covers all 77 domain ISO3s, and — unlike `admin_0_countries` — keeps **GUF** French
Guiana as its own subunit instead of folding it into `FRA`), dissolved to one outer
polygon per domain, then **centroid-assigned** onto the LUH2 grid (`regionmask`).

## Runtime use (anchoring)

The reconstruction is spliced to the measured World Bank series at 1990: the service
offsets the LUH2 curve so its 1990 value matches WB `AG.LND.FRST.K2` at 1990, keeping the
reconstructed **shape** for 1800–1990 (dashed, `meta.reconstructedBefore = 1990`) and the
measured values from 1990 on. So the absolute LUH2 magnitude need not equal WB — only the
1800–1990 trajectory matters.

## Reproduce

Requires network to `luh.umd.edu` (states.nc byte-range) and `naciscdn.org` (Natural
Earth). In the Claude Code sandbox these hosts are not allowlisted — run with the sandbox
disabled.

```sh
python3 -m venv scripts/luh2/.venv
scripts/luh2/.venv/bin/pip install numpy xarray netCDF4 regionmask geopandas pooch requests

# input assets (not committed — see .gitignore):
curl -o scripts/luh2/staticData_quarterdeg.nc \
  https://luh.umd.edu/LUH2/LUH2_v2h/staticData_quarterdeg.nc
curl -o scripts/luh2/ne_50m_subunits.zip \
  https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_map_subunits.zip

scripts/luh2/.venv/bin/python scripts/luh2/extract.py   # writes shared/data/luh2/*.json
```

## Provenance / licence

- LUH2 v2h — Hurtt, G. C., et al. (2020). *Harmonization of global land-use change and
  management for the period 850–2100 (LUH2) for CMIP6.* Geoscientific Model Development,
  13, 5425–5464. CC BY 4.0.
- Natural Earth (public domain).
