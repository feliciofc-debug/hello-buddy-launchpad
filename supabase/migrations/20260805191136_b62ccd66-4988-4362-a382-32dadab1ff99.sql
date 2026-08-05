UPDATE public.pj_lista_membros
SET opt_in_status='convite_enviado', convite_enviado_em=now(),
    convite_template_id='bde7c3a0-ac39-4d89-8934-070c2dd009ec'
WHERE telefone='5521967520706' AND user_id='b7af0118-c506-4f87-8ac3-a0a11fd621fe';

select net.http_post(
  url:='https://graph.facebook.com/v25.0/'||c.phone_number_id||'/messages',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||c.access_token),
  body:=jsonb_build_object('messaging_product','whatsapp','to','5521967520706','type','template','template',jsonb_build_object('name','convite_ebook_v1','language',jsonb_build_object('code','pt_BR'),'components',jsonb_build_array(jsonb_build_object('type','body','parameters',jsonb_build_array(jsonb_build_object('type','text','text','Felicio'),jsonb_build_object('type','text','text','AMZ Ofertas'),jsonb_build_object('type','text','text','50 Receitas Fitness na Airfryer')))))),
  timeout_milliseconds:=15000)
from whatsapp_config c where c.user_id='b7af0118-c506-4f87-8ac3-a0a11fd621fe';