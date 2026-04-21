WITH duplicados AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, produto_id, platform 
    ORDER BY scheduled_at ASC, created_at ASC
  ) AS rn
  FROM social_posts_queue
  WHERE status = 'pendente'
    AND scheduled_at > NOW()
)
UPDATE social_posts_queue
SET status = 'cancelado',
    error_message = 'duplicate_autopilot_cleanup',
    updated_at = NOW()
WHERE id IN (SELECT id FROM duplicados WHERE rn > 1);