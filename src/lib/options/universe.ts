// The swipe deck's stocks (Ben, 2026-11-02: "Many, many names. As many as possible, with the more common names having
// more cards"): the most actively traded US options names, in three tiers. Tier 1 gets four cards each refresh, tier 2
// two, tier 3 one. Grow the list freely: the refresh job paces itself to the free quote service's rate limit.

export const TIERS: Record<1 | 2 | 3, string[]> = {
  1: "SPY QQQ IWM NVDA TSLA AAPL AMD AMZN META MSFT GOOGL PLTR NFLX AVGO COIN MSTR SMCI SOFI HOOD BABA".split(" "),
  2: "DIA GLD SLV TLT XLF XLE XLK SMH ARKK UBER INTC MU ORCL CRM ADBE PYPL SHOP XYZ DIS BA JPM BAC WFC C GS MS V MA NKE SBUX MCD COST WMT TGT HD LOW CVX XOM OXY PFE MRK LLY JNJ ABBV UNH CVS T VZ KO PEP F GM RIVN LCID NIO XPEV LI DKNG RBLX SNAP PINS ROKU ZM SNOW NET CRWD PANW DDOG MDB ARM TSM QCOM TXN AMAT LRCX KLAC MRVL ON DELL HPQ IBM CSCO ANET UPST AFRM MARA RIOT CLSK IREN BITF HUT CVNA GME AMC CHWY ETSY EBAY ABNB DASH LYFT".split(" "),
  3: "AAL DAL UAL LUV CCL RCL NCLH MGM WYNN LVS PENN CZR BYND PTON W PLUG FCEL ENPH SEDG FSLR RUN CHPT QS BLNK SPCE JOBY ACHR RKLB ASTS LUNR PATH AI SOUN BBAI U TTD TWLO OKTA DOCU ZS FTNT S CYBR ESTC TEAM WDAY NOW INTU ADSK HUBS VEEV SPOT TME BIDU JD PDD SE MELI NU STNE GRAB CPNG BILI IQ TAL EDU WB VALE RIO BHP FCX AA CLF NUE STLD SCCO NEM GOLD AEM KGC PAAS HL CDE AG MP ALB LAC SQM CF MOS NTR ADM BG DE CAT CMI PCAR URI ROK EMR HON GE GEV MMM RTX LMT NOC GD HII LHX TXT BA SPR AXON CAH MCK COR HCA ELV CI HUM CNC MOH ISRG DXCM ALGN ZBH SYK MDT BSX EW ABT TMO DHR A ILMN MRNA BNTX NVAX REGN VRTX GILD AMGN BIIB BMY AZN NVO GSK SNY TEVA VTRS ZTS IDXX CHD CL PG KMB EL ULTA LULU DECK CROX ONON BIRK SKX UAA VFC GAP ANF AEO URBN KSS M JWN DG DLTR BBY KR ACI SFM CMG YUM DPZ QSR WING CAVA SHAK TXRH DRI BROS DUOL APP CELH MNST KDP STZ BUD TAP DEO SAM PM MO BTI KHC GIS K CPB HRL TSN SJM HSY MDLZ AMT CCI PLD O SPG VNO KIM EQIX DLR PSA EXR WELL VTR AVB EQR MAA INVH Z OPEN RDFN COMP".split(" "),
};

/** Every name once, with its tier (the first tier that lists it wins). */
export const UNIVERSE: { ticker: string; tier: 1 | 2 | 3 }[] = (() => {
  const seen = new Set<string>();
  const out: { ticker: string; tier: 1 | 2 | 3 }[] = [];
  for (const tier of [1, 2, 3] as const)
    for (const t of TIERS[tier]) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push({ ticker: t, tier });
    }
  return out;
})();

export const CARDS_PER_TIER: Record<1 | 2 | 3, number> = { 1: 4, 2: 2, 3: 1 };
