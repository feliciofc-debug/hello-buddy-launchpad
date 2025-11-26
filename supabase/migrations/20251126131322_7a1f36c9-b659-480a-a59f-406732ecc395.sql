-- Add phone_numbers column to whatsapp_groups for storing contact numbers in groups
ALTER TABLE whatsapp_groups 
ADD COLUMN IF NOT EXISTS phone_numbers TEXT[];