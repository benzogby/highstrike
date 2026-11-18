import { UNIVERSE } from "@/lib/options/universe";

// The Scanner's groups for the heatmap (Ben, 2026-11-18: "an awesome Scanner tab… Heatmap, hot contracts, unusual
// flow"): every name in the options universe (src/lib/options/universe.ts) under one plain-English group. A name not
// listed here falls under "Other".

const GROUPS: Record<string, string> = {
  "Indexes & ETFs": "SPY QQQ IWM DIA GLD SLV TLT XLF XLE XLK SMH ARKK",
  Semiconductors: "NVDA AMD AVGO SMCI INTC MU TSM QCOM TXN AMAT LRCX KLAC MRVL ON ARM",
  "Big tech": "AAPL MSFT GOOGL AMZN META NFLX ORCL IBM CSCO DELL HPQ ANET",
  Software: "PLTR CRM ADBE SNOW NET CRWD PANW DDOG MDB ZM PATH AI SOUN BBAI U TTD TWLO OKTA DOCU ZS FTNT S CYBR ESTC TEAM WDAY NOW INTU ADSK HUBS VEEV APP DUOL",
  "Internet & social": "UBER SHOP PYPL XYZ SNAP PINS ROKU RBLX DASH ABNB LYFT EBAY ETSY CHWY SPOT TME Z OPEN RDFN COMP",
  "Crypto & fintech": "COIN MSTR HOOD SOFI UPST AFRM MARA RIOT CLSK IREN BITF HUT NU STNE",
  Financials: "JPM BAC WFC C GS MS V MA",
  "Autos & EV": "TSLA F GM RIVN LCID NIO XPEV LI CVNA QS CHPT BLNK",
  "Consumer & retail": "NKE SBUX MCD COST WMT TGT HD LOW GME AMC DG DLTR BBY KR ACI SFM CMG YUM DPZ QSR WING CAVA SHAK TXRH DRI BROS LULU ULTA DECK CROX ONON BIRK SKX UAA VFC GAP ANF AEO URBN KSS M JWN W PTON BYND EL",
  "Food, drink & staples": "KO PEP PG CL KMB CHD CELH MNST KDP STZ BUD TAP DEO SAM PM MO BTI KHC GIS K CPB HRL TSN SJM HSY MDLZ ADM BG",
  "Health & pharma": "LLY JNJ ABBV UNH CVS PFE MRK CAH MCK COR HCA ELV CI HUM CNC MOH ISRG DXCM ALGN ZBH SYK MDT BSX EW ABT TMO DHR A ILMN ZTS IDXX AZN NVO GSK SNY TEVA VTRS BMY",
  Biotech: "MRNA BNTX NVAX REGN VRTX GILD AMGN BIIB",
  Energy: "CVX XOM OXY PLUG FCEL ENPH SEDG FSLR RUN",
  "Metals & materials": "VALE RIO BHP FCX AA CLF NUE STLD SCCO NEM GOLD AEM KGC PAAS HL CDE AG MP ALB LAC SQM CF MOS NTR",
  "Industrials & defense": "BA DE CAT CMI PCAR URI ROK EMR HON GE GEV MMM RTX LMT NOC GD HII LHX TXT SPR AXON JOBY ACHR RKLB ASTS LUNR SPCE",
  "Travel & leisure": "DIS DKNG AAL DAL UAL LUV CCL RCL NCLH MGM WYNN LVS PENN CZR",
  "Telecom & media": "T VZ",
  "China & emerging": "BABA BIDU JD PDD SE MELI GRAB CPNG BILI IQ TAL EDU WB",
  "Real estate": "AMT CCI PLD O SPG VNO KIM EQIX DLR PSA EXR WELL VTR AVB EQR MAA INVH",
};

const SECTOR = new Map<string, string>();
for (const [group, names] of Object.entries(GROUPS)) for (const t of names.split(" ")) if (!SECTOR.has(t)) SECTOR.set(t, group);

export const sectorOf = (ticker: string) => SECTOR.get(ticker.toUpperCase()) ?? "Other";
export const SECTOR_ORDER = Object.keys(GROUPS);

/** Every scanner name with its tier and group. */
export const SCAN_UNIVERSE = UNIVERSE.map((u) => ({ ...u, sector: sectorOf(u.ticker) }));
