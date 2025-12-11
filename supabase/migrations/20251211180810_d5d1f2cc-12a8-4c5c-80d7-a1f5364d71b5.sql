-- Criar trigger para sincronizar opt_ins → cadastros automaticamente
DROP TRIGGER IF EXISTS trigger_sync_optin ON opt_ins;
CREATE TRIGGER trigger_sync_optin
AFTER INSERT ON opt_ins
FOR EACH ROW
EXECUTE FUNCTION sync_optin_to_cadastro();