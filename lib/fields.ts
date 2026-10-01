export type Field={k:string;l:string;t?:string;o?:string[]};
export const SITE:Record<string,Field[]>={
 hvac:[{k:'system',l:'System type',o:['Split AC','Heat pump','Package unit','Gas furnace','Mini-split']},{k:'brand',l:'Brand'},{k:'age',l:'Approx. age (years)',t:'number'},{k:'tonnage',l:'Tonnage',o:['1.5','2','2.5','3','3.5','4','5']},{k:'filter',l:'Filter size'},{k:'thermostat',l:'Thermostat'}],
 electrical:[{k:'panelBrand',l:'Panel brand'},{k:'panelAmps',l:'Panel amps',o:['100','125','150','200','400']},{k:'issueLocation',l:'Where is the issue?'},{k:'permit',l:'Permit likely?',o:['No','Yes','Not sure']},{k:'gensolar',l:'Generator or solar?',o:['None','Generator','Solar','Both']}],
 plumbing:[{k:'whType',l:'Water heater type',o:['Gas tank','Electric tank','Tankless gas','Tankless electric']},{k:'whAge',l:'Water heater age (years)',t:'number'},{k:'shutoff',l:'Main shutoff location'},{k:'pipe',l:'Pipe material',o:['Copper','PEX','CPVC','Galvanized','Unknown']},{k:'fixture',l:'Fixture involved'}],
 septic:[{k:'tankSize',l:'Tank size (gallons)',o:['750','1000','1250','1500','2000']},{k:'tankMaterial',l:'Tank material',o:['Concrete','Poly','Fiberglass','Steel']},{k:'tankLocation',l:'Tank location'},{k:'lidDepth',l:'Lid depth (inches)',t:'number'},{k:'riser',l:'Riser installed?',o:['No','Yes']},{k:'lastPumped',l:'Last pumped',t:'date'},{k:'drainField',l:'Drain field notes'}]
};
export type EquipmentDefinition={types:string[];size:string;sizePh:string;extra:{k:string;l:string;o:string[]}};
export const EQ:Record<string,EquipmentDefinition>={
 hvac:{types:['AC/heat unit','Condenser','Heat pump','Furnace','Air handler','Package unit','Mini-split','Wall unit','Window AC','Evaporative cooler','Exhaust fan','Gas unit heater','Evaporator coil','Thermostat'],size:'Size (tons or BTU)',sizePh:'3 ton, 80,000 BTU',extra:{k:'refrigerant',l:'Refrigerant',o:['R-410A','R-454B','R-32','R-22','Other']}},
 electrical:{types:['Main panel','Subpanel','Meter base','Generator','Transfer switch','Solar inverter','EV charger','Surge protector'],size:'Amps or kW',sizePh:'200A, 40 spaces',extra:{k:'breakers',l:'Breaker type',o:['Plug-on','Bolt-on','Mixed','Unknown']}},
 plumbing:{types:['Water heater','Tankless water heater','Water softener','Filtration system','Pressure regulator','Sump pump','Well pump','Recirculation pump'],size:'Capacity',sizePh:'50 gal, 199k BTU',extra:{k:'fuel',l:'Fuel or power',o:['Natural gas','Propane','Electric','N/A']}},
 septic:{types:['Septic tank','Pump or lift station','Effluent filter','Alarm panel','Aerobic unit','Distribution box','Drain field'],size:'Capacity or size',sizePh:'1,250 gal',extra:{k:'material',l:'Material',o:['Concrete','Poly','Fiberglass','Steel','N/A']}}
};
export const TRADE_NAMES:Record<string,string>={hvac:'HVAC',electrical:'Electrical',plumbing:'Plumbing',septic:'Septic'};
export const PHOTO_BUCKET='equipment-photos';
// Trade checklists from the prototype. The number of items per trade must match public.checklist_size() in the database.
export const CHECK:Record<string,string[]>={
 hvac:['Check thermostat operation','Inspect filter and replace if dirty','Test capacitor and contactor','Check refrigerant pressures','Rinse condenser coil','Flush condensate drain','Record supply and return temperatures'],
 electrical:['Shut off and lock out circuit before work','Test outlets and GFCI protection','Check panel for heat, corrosion, or loose lugs','Verify breaker and wire sizing match','Label any circuits changed','Test circuit after repair with customer'],
 plumbing:['Locate main shutoff before work','Inspect for active leaks','Test water pressure','Check water heater T&P valve','Run fixtures after repair and check for leaks','Clean up work area'],
 septic:['Locate and expose tank lids','Record sludge and scum levels','Inspect inlet and outlet baffles','Check effluent filter','Walk drain field for pooling or odor','Record gallons pumped','Secure lids and replace cover soil']
};
