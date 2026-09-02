-- Move legacy values from the duplicated packaging inputs into the stock that counts.

update public.products
set blister_stock = coalesce(blister_simple_units, 0),
    master_box_stock = coalesce(master_box_units, 0)
where blister_simple_units is not null or master_box_units is not null;

-- The trigger from 20260908000000_packaging_stock.sql recalculates physical_stock
-- as blister_stock + master_box_stock for every migrated row.
