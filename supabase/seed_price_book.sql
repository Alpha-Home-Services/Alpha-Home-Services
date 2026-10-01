-- Sample price book from the prototype. TEST project only, run once after 202610030001_price_book.sql.
-- Names start with "TEST —" so samples are never mistaken for real prices. Real prices come from the
-- Housecall Pro price book in Phase 8. Prices are calculated by the formula from pricing_settings.
with sample(trade,name,parts,hours,includes) as (values
 ('hvac','Diagnostic service call',0,0.5,'Full system diagnosis'),
 ('hvac','Heating tune-up',6,1,'Burner or heat strip check, safety controls, filter'),
 ('hvac','Commercial unit tune-up and filter change',25,1.25,'Per unit: coils, belts, electrical, drains, new filter'),
 ('hvac','Replace run capacitor',18,0.5,'Dual run capacitor up to 60/5 MFD'),
 ('hvac','Replace contactor',24,0.75,'Single or double pole contactor'),
 ('hvac','AC tune-up',6,1,'Coil rinse, electrical check, drain flush'),
 ('hvac','Replace blower motor',265,2,'OEM-equivalent motor and capacitor'),
 ('hvac','Clear condensate drain',4,0.75,'Vacuum clear and drain tablets'),
 ('electrical','Diagnostic service call',0,0.5,'Troubleshoot and locate fault'),
 ('electrical','Replace GFCI outlet',22,0.5,'20A tamper-resistant GFCI'),
 ('electrical','Replace single-pole breaker',16,0.75,'Up to 30A, matched to panel brand'),
 ('electrical','Install ceiling fan on existing box',12,1.25,'Fan-rated box check and hardware'),
 ('electrical','Panel safety inspection',0,1,'Torque check, thermal scan, written report'),
 ('electrical','Whole-home surge protector',120,1,'Type 2 surge device and breaker'),
 ('plumbing','Diagnostic service call',0,0.5,'Locate leak or fault'),
 ('plumbing','Plumbing safety inspection',0,1,'Fixtures, supply lines, shutoffs, drains, written report'),
 ('plumbing','Toilet rebuild',35,1,'Fill valve, flapper, supply line'),
 ('plumbing','Clear kitchen drain',4,1,'Cable up to 50 ft'),
 ('plumbing','Water heater flush',5,1,'Flush, anode check, T&P test'),
 ('plumbing','Replace faucet cartridge',48,1,'Brand cartridge, O-rings, grease'),
 ('plumbing','Replace 50 gal gas water heater',960,4,'Heater, flex lines, venting, haul-away'),
 ('septic','Pump tank up to 1,000 gal',85,1.5,'Pump-out and disposal fees'),
 ('septic','Pump tank 1,001 to 1,500 gal',125,2,'Pump-out and disposal fees'),
 ('septic','Septic inspection',0,1.5,'Levels, baffles, drain field, written report'),
 ('septic','Clean effluent filter',0,0.5,'Remove, clean, reinstall'),
 ('septic','Install 24 in. riser and lid',180,3,'Riser, lid, sealant'),
 ('septic','Jet sewer line to tank',10,1.5,'Hydro-jet up to 100 ft')
),tasks as (
 insert into public.price_book(trade,name,includes,mode,price)
 select trade,'TEST — '||name,includes,'formula',public.formula_price(hours,parts) from sample
 returning id,trade,name
)
insert into public.price_book_costs(task_id,hours,parts)
select t.id,s.hours,s.parts from tasks t join sample s on t.trade=s.trade and t.name='TEST — '||s.name;
