UPDATE public.whatsapp_cloud_inbound_queue
SET status='pending', attempts=0, error=NULL, processing_started_at=NULL, processed_at=NULL
WHERE id IN ('02f649b5-eaee-42f3-8614-9d204f63332e','4b9452c9-6b6b-4c27-b849-78d5de84af49');