const PRICING_KEY = 'yl_clean_pricing_v1';

const DEFAULT_PRICING = {
  acSplit: { unit: 1800, bulk3plus: 1500 },
  acDuct: { unit: 2800 },
  washerTop: { withAC: 1800, withoutAC: 2000 },
  waterTank: { unit: 1000 },
  pipesAmount: { passthrough: true },
  antiMold: { unit: 300, bulk5plus: 250 },
  ozone: { unit: 200 },
  transformerCount: { unit: 500 },
  longSplitCount: { unit: 300 },
  onePieceTray: { unit: 500 },
  outdoorUnitCleaning: { unit: 0 },
  // 舊版共用單價僅供既有訂單相容；新版由每筆其他項目自行儲存單價。
  customServiceItem: { unit: 0 },
  customServicePresets: [],
  thresholds: {
    // example: freeShippingOver: 5000
  }
};

function normalizePricingConfig(raw){
  const merge = (base, incoming) => {
    if (Array.isArray(base)) return Array.isArray(incoming) ? incoming.slice() : base.slice();
    if (!base || typeof base !== 'object') return incoming !== undefined ? incoming : base;
    const out = {};
    Object.keys(base).forEach(key => {
      const next = incoming && typeof incoming === 'object' ? incoming[key] : undefined;
      if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) out[key] = merge(base[key], next);
      else out[key] = next !== undefined ? next : base[key];
    });
    if (incoming && typeof incoming === 'object'){
      Object.keys(incoming).forEach(key => {
        if (!(key in out)) out[key] = incoming[key];
      });
    }
    return out;
  };
  return merge(DEFAULT_PRICING, raw || {});
}

let pricingConfig = normalizePricingConfig(load(PRICING_KEY, {}));

function calcTotal(f){
  const cfg = pricingConfig || DEFAULT_PRICING;

  const acSplit = +f.acSplit || 0;
  const acDuct = +f.acDuct || 0;
  const washerTop = +f.washerTop || 0;
  const waterTank = +f.waterTank || 0;
  const pipesAmount = +f.pipesAmount || 0;
  const antiMold = +f.antiMold || 0;
  const ozone = +f.ozone || 0;
  const transformerCount = +f.transformerCount || 0;
  const longSplitCount = +f.longSplitCount || 0;
  const onePieceTray = +f.onePieceTray || 0;
  const outdoorUnitCleaning = +f.outdoorUnitCleaning || 0;
  const legacyCustomServiceUnit = Number(cfg.customServiceItem?.unit || 0);
  const customServiceTotal = (Array.isArray(f.customServiceItems) ? f.customServiceItems : []).reduce((sum, item) => {
    const qty = Number(item && (item.quantity ?? item.qty ?? item.count));
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    const rawUnit = Number(item && (item.unitPrice ?? item.price ?? item.unit));
    const unitPrice = Number.isFinite(rawUnit) && rawUnit >= 0 ? rawUnit : legacyCustomServiceUnit;
    return sum + qty * unitPrice;
  }, 0);

  const splitUnit = acSplit >= 3 ? cfg.acSplit.bulk3plus : cfg.acSplit.unit;
  const splitTotal = acSplit * splitUnit;

  const ductTotal = acDuct * cfg.acDuct.unit;

  const washerUnit = (acSplit + acDuct) > 0 ? cfg.washerTop.withAC : cfg.washerTop.withoutAC;
  const washerTotal = washerTop * washerUnit;

  const tankTotal = waterTank * cfg.waterTank.unit;

  const pipesTotal = Math.max(0, pipesAmount);

  const antiMoldUnit = antiMold >= 5 ? cfg.antiMold.bulk5plus : cfg.antiMold.unit;
  const antiMoldTotal = antiMold * antiMoldUnit;

  const ozoneTotal = ozone * cfg.ozone.unit;
  const transformerTotal = transformerCount * cfg.transformerCount.unit;
  const longSplitTotal = longSplitCount * cfg.longSplitCount.unit;
  const onePieceTotal = onePieceTray * Number(cfg.onePieceTray?.unit || 0);
  const outdoorUnitTotal = outdoorUnitCleaning * Number(cfg.outdoorUnitCleaning?.unit || 0);
  const total = splitTotal + ductTotal + washerTotal + tankTotal + pipesTotal + antiMoldTotal + ozoneTotal + transformerTotal + longSplitTotal + onePieceTotal + outdoorUnitTotal + customServiceTotal;
  return Math.max(0, Math.round(total));
}

