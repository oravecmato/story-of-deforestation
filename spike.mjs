#!/usr/bin/env node
// Dátový spike: hotspot -> lokálny klimatický signál
// Použitie:
//   node spike.mjs --selftest          # validácia štatistického jadra na syntetických dátach
//   node spike.mjs --country=MAR       # reálny beh: WDI výnosy vs. CCKP cdd/tas (vyžaduje sieť)

// ---------- Normalizovaný tvar série: { source, geo, year, value } ----------

// ---------- Adaptéry ----------

async function fetchWDI(iso3, indicator, dateRange = "1961:2024") {
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicator}?format=json&date=${dateRange}&per_page=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WDI ${indicator}: HTTP ${res.status}`);
  const body = await res.json();
  const rows = body[1] ?? [];
  return rows
    .filter(r => r.value != null)
    .map(r => ({ source: "wdi", geo: iso3, year: +r.date, value: r.value }))
    .sort((a, b) => a.year - b.year);
}

// CCKP: kolekcia era5-x0.25, produkt timeseries, ročná agregácia.
// POZN: presný tvar URL segmentov over cez "spatially aggregated data download"
// na climateknowledgeportal.worldbank.org/download-data a uprav šablónu nižšie.
// Geokód: pre krajiny ISO3; ak endpoint vráti 404, over kód v ich číselníku
// (Spatial Unit's Names and Codes JSON na tej istej stránke).
async function fetchCCKP(iso3, variable, { collection = "era5-x0.25", period = "1950-2022" } = {}) {
  const slug = `${collection}_timeseries_${variable}_timeseries_annual_${period}_mean_historical_era5_mean`;
  const url = `https://cckpapi.worldbank.org/cckp/v1/${slug}/${iso3}?_format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CCKP ${variable}: HTTP ${res.status} (${url})`);
  const body = await res.json();
  // Očakávaný tvar: { data: { [geokód]: { "1950-07": v, ... } } } alebo { [geokód]: {...} }
  const bag = body.data ?? body;
  const geoKey = bag[iso3] ? iso3 : Object.keys(bag)[0];
  if (!geoKey) throw new Error(`CCKP ${variable}: prázdna odpoveď, over geokód`);
  return Object.entries(bag[geoKey])
    .map(([k, v]) => ({ source: "cckp", geo: iso3, year: parseInt(k, 10), value: +v }))
    .filter(r => Number.isFinite(r.year) && Number.isFinite(r.value))
    .sort((a, b) => a.year - b.year);
}

// ---------- Štatistické jadro (čisté funkcie, séria dnu -> séria von) ----------

function movingAvg(series, window = 9) {
  const half = Math.floor(window / 2);
  return series.map((p, i) => {
    const nbrs = series.slice(Math.max(0, i - half), i + half + 1);
    const mean = nbrs.reduce((s, q) => s + q.value, 0) / nbrs.length;
    return { ...p, value: mean };
  });
}

// Detrend = odchýlka od centrovaného kĺzavého priemeru (izoluje medziročnú volatilitu)
function detrend(series, window = 9) {
  const trend = movingAvg(series, window);
  return series.map((p, i) => ({ ...p, value: p.value - trend[i].value }));
}

// Prvé diferencie: alternatívne odstránenie trendu, bez Slutzky-Yule artefaktov
function diff(series) {
  return series.slice(1).map((p, i) => ({ ...p, value: p.value - series[i].value }));
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

// Spoji dve série podľa roka, s posunom lagu: y[t] vs. x[t - lag]
function lagCorrelation(xSeries, ySeries, lag = 0) {
  const xByYear = new Map(xSeries.map(p => [p.year, p.value]));
  const pairs = ySeries
    .map(p => ({ x: xByYear.get(p.year - lag), y: p.value }))
    .filter(p => p.x != null);
  return { lag, n: pairs.length, r: pearson(pairs.map(p => p.x), pairs.map(p => p.y)) };
}

// ---------- Selftest: syntetické dáta so známym zabudovaným signálom ----------

function selftest() {
  // Deterministický PRNG (mulberry32), nech je test reprodukovateľný
  let seed = 42;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const years = Array.from({ length: 60 }, (_, i) => 1961 + i);

  // "cdd" (suché dni): šum + zreteľný rastúci trend (zdieľaný s trendom výnosov,
  // aby úrovňová korelácia demonštrovala pascu spoločného trendu)
  const cdd = years.map((year, i) => ({
    source: "syn", geo: "SYN", year,
    value: 40 + i * 0.8 + (rand() - 0.5) * 30,
  }));

  // "výnos": silný technologický trend + ZABUDOVANÝ signál: sucho v roku t
  // zráža výnos v roku t (koef -8) a slabšie aj v t+1 (koef -3) => čakáme
  // najsilnejšie r pri lagu 0, slabšie pri lagu 1, nič pri 2+.
  const yieldS = years.map((year, i) => {
    const droughtNow = cdd[i].value - (40 + i * 0.8);
    const droughtPrev = i > 0 ? cdd[i - 1].value - (40 + (i - 1) * 0.8) : 0;
    return {
      source: "syn", geo: "SYN", year,
      value: 800 + i * 25 + droughtNow * -8 + droughtPrev * -3 + (rand() - 0.5) * 80,
    };
  });

  console.log("=== SELFTEST: syntetika so signálom (lag0 silný, lag1 slabší) ===\n");

  const rawR = lagCorrelation(cdd, yieldS, 0).r;
  console.log(`Na úrovniach (bez detrendu):  r = ${rawR.toFixed(3)}  <- zavádzajúce, dominuje trend`);

  const dCdd = detrend(cdd), dYield = detrend(yieldS);
  console.log("\nMetóda A — odchýlky od kĺzavého priemeru:");
  console.log("lag  n   r");
  for (let lag = 0; lag <= 4; lag++) {
    const { n, r } = lagCorrelation(dCdd, dYield, lag);
    const bar = "#".repeat(Math.round(Math.abs(r) * 20));
    console.log(`${String(lag).padEnd(4)}${String(n).padEnd(4)}${r.toFixed(3).padStart(7)}  ${bar}`);
  }

  const fCdd = diff(cdd), fYield = diff(yieldS);
  console.log("\nMetóda B — prvé diferencie (krížová kontrola):");
  console.log("lag  n   r");
  for (let lag = 0; lag <= 4; lag++) {
    const { n, r } = lagCorrelation(fCdd, fYield, lag);
    const bar = "#".repeat(Math.round(Math.abs(r) * 20));
    console.log(`${String(lag).padEnd(4)}${String(n).padEnd(4)}${r.toFixed(3).padStart(7)}  ${bar}`);
  }
  console.log("\nOčakávanie: obe metódy |r| najvyššie pri lag 0; robustný je len signál, ktorý prežije obe.");
}

// ---------- Reálny beh ----------

async function realRun(iso3) {
  console.log(`=== SPIKE: ${iso3} — detrendovaný výnos obilnín vs. klimatický signál ===\n`);
  const [yieldS, cdd, tas] = await Promise.all([
    fetchWDI(iso3, "AG.YLD.CREL.KG"),
    fetchCCKP(iso3, "cdd"),
    fetchCCKP(iso3, "tas"),
  ]);
  console.log(`WDI výnosy: ${yieldS.length} rokov (${yieldS[0]?.year}–${yieldS.at(-1)?.year})`);
  console.log(`CCKP cdd:   ${cdd.length} rokov, CCKP tas: ${tas.length} rokov\n`);

  const dYield = detrend(yieldS);
  for (const [name, clim] of [["cdd (suché dni)", cdd], ["tas (teplota)", tas]]) {
    console.log(`--- ${name} -> výnos, detrendované ---`);
    console.log("lag  n   r");
    for (let lag = 0; lag <= 5; lag++) {
      const { n, r } = lagCorrelation(detrend(clim), dYield, lag);
      console.log(`${String(lag).padEnd(4)}${String(n).padEnd(4)}${(r ?? NaN).toFixed(3).padStart(7)}`);
    }
    console.log();
  }
  console.log("Interpretácia: hľadáme záporné r pri malých lagoch (sucho/teplo -> prepad výnosu).");
  console.log("Pri n ~ 50–60 ber |r| < 0.25 ako šum; toto je explorácia, nie dôkaz.");
}

// ---------- Vstupný bod ----------

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));

if (args.selftest) selftest();
else if (args.country) await realRun(String(args.country).toUpperCase());
else console.log("Použitie: node spike.mjs --selftest | node spike.mjs --country=MAR");
