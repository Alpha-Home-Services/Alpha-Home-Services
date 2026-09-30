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
