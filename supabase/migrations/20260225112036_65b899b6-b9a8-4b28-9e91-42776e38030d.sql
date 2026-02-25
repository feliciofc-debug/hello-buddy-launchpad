UPDATE client_menu_config 
SET menus_permitidos = array_replace(menus_permitidos, 'whatsapp', 'conectar-whatsapp')
WHERE tipo_cliente IN ('parceiro', 'parceiro_peixotinho', 'barra_world');