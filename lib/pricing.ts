// Flat-rate pricing, mirroring public.formula_price in the database so the editor can show a live preview.
// The database is the source of truth: it calculates and stores the price when a task or setting is saved.
export type PricingSettings={labor_rate:number;parts_markup:number;card_cover:number;tech_cost:number;target_margin:number};
export const DEFAULT_PRICING:PricingSettings={labor_rate:165,parts_markup:50,card_cover:3,tech_cost:40,target_margin:60};
const cents=(n:number)=>Math.round(n*100)/100;
export function priceBreakdown(hours:number,parts:number,s:PricingSettings){
 const labor=hours*s.labor_rate;const markedUp=parts*(1+s.parts_markup/100);
 const price=Math.round((labor+markedUp)/(1-s.card_cover/100));
 return {labor:cents(labor),markedUp:cents(markedUp),cardCover:cents(price-labor-markedUp),price};
}
// Margin = what's left after parts and tech labor cost, as a share of the price.
export function margin(price:number,hours:number,parts:number,s:PricingSettings){return price>0?(price-parts-hours*s.tech_cost)/price:0;}
export function marginLevel(m:number,s:PricingSettings):'good'|'close'|'low'{const t=s.target_margin/100;return m>=t?'good':m>=t-0.1?'close':'low';}
export const money=(n:number,digits=0)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
