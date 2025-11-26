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
  thresholds: {
    // example: freeShippingOver: 5000
  }
};

let pricingConfig = load(PRICING_KEY, JSON.parse(JSON.stringify(DEFAULT_PRICING)));

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
  const onePieceTotal = onePieceTray * cfg.onePieceTray.unit;

  const total = splitTotal + ductTotal + washerTotal + tankTotal + pipesTotal + antiMoldTotal + ozoneTotal + transformerTotal + longSplitTotal + onePieceTotal;
  return Math.max(0, Math.round(total));
}

