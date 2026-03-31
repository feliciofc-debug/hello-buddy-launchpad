
UPDATE client_menu_config 
SET menus_permitidos = ARRAY['dashboard', 'produtos', 'ia-marketing', 'redes-sociais', 'whatsapp', 'configuracoes']
WHERE tipo_cliente IN ('empresa', 'afiliado', 'b2b', 'parceiro', 'parceiro_peixotinho', 'barra_world');
