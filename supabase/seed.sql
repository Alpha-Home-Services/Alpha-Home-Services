-- Fictional, disposable data only. Never seed a production database.
insert into public.customers(id,name,type,phone,email,service_address,terms)
values
 ('00000000-0000-4000-8000-000000000001','TEST — Desert Sample Property','Commercial','202-555-0101','property@example.test','100 Example Lane, Test City','net30'),
 ('00000000-0000-4000-8000-000000000002','TEST — Sample Household','Residential','202-555-0102','household@example.test','200 Example Lane, Test City','due');
insert into public.customers(id,name,type,email,parent_id,bill_to)
values ('00000000-0000-4000-8000-000000000003','TEST — Sample Tenant','Residential','tenant@example.test','00000000-0000-4000-8000-000000000001','parent');
insert into public.locations(id,customer_id,name,address)
values ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','TEST — Building A','100 Example Lane, Building A');
insert into public.equipment(customer_id,location_id,trade,type,brand,model,serial,size,extra)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','hvac','Heat pump','Test brand','DEMO-01','TEST-SERIAL-001','3 ton','{"refrigerant":"R-410A"}');
insert into public.site_details(customer_id,trade,details)
values ('00000000-0000-4000-8000-000000000002','septic','{"tankSize":"1000","tankMaterial":"Concrete","tankLocation":"TEST back yard","riser":"Yes"}');
