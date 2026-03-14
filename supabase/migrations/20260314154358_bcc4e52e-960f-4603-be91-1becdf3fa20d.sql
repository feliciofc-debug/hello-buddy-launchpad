-- Fix the one remaining anomaly: 5219982667658 (13 digits but starts with 52 not 55)
-- This looks like it was originally 21998266765 with extra 8 - likely a typo. 
-- Actually 5219982667658 = "52" + "19982667658" - probably should be 5521998266765
-- Let's check: the original was likely "219982667658" -> added "55" prefix would be wrong
-- Actually it's 13 chars starting with "52" - could be originally "21998266765" (11 digits) that got "52" instead of "55"
-- Safest: replace leading "52" with "55" since it's a Brazilian number
UPDATE pj_lista_membros SET telefone = '55' || substring(telefone from 3)
WHERE telefone = '5219982667658';