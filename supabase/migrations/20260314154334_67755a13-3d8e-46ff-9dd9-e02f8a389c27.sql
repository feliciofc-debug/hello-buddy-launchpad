-- Normalize phones: split "/" keeping first, strip non-digits, remove leading 0, add 55+DDD prefix

-- Step 1: Split "/" phones
UPDATE pj_lista_membros SET telefone = split_part(telefone, '/', 1)
WHERE telefone LIKE '%/%' AND lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');

-- Step 2: Strip non-digits
UPDATE pj_lista_membros SET telefone = regexp_replace(telefone, '[^0-9]', '', 'g')
WHERE lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');

-- Step 3: Remove leading 0
UPDATE pj_lista_membros SET telefone = substring(telefone from 2)
WHERE telefone LIKE '0%' AND lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');

-- Step 4: 9 digits (celular sem DDD) -> 5521
UPDATE pj_lista_membros SET telefone = '5521' || telefone
WHERE length(telefone) = 9 AND lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');

-- Step 5: 8 digits (fixo sem DDD) -> 5521
UPDATE pj_lista_membros SET telefone = '5521' || telefone
WHERE length(telefone) = 8 AND lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');

-- Step 6: 10 digits (DDD+8) -> 55
UPDATE pj_lista_membros SET telefone = '55' || telefone
WHERE length(telefone) = 10 AND lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');

-- Step 7: 11 digits (DDD+9) -> 55
UPDATE pj_lista_membros SET telefone = '55' || telefone
WHERE length(telefone) = 11 AND lista_id IN ('6793f43d-4763-4fa6-baa9-3bee84a35762','5335eb9e-6b87-40ba-8221-915b1c1908b0','1328415f-a1de-4c23-9cb6-efecc6253ba6','a993b5c3-c342-4075-924d-7ac0e9f707e6');