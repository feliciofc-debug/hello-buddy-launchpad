# Webmotors — produção (WEBMOTORS-2)

Integração revendedor SOAP liberada pela Webmotors (PTS-1463). Cada loja conecta **suas** credenciais do Cockpit; a plataforma publica apenas anúncios criados por ela (`managed_by_platform`).

## 1. Credenciais no Cockpit (lojista)

1. Acesse [https://www.cockpit.com.br/](https://www.cockpit.com.br/) com o login da revenda.
2. Menu **Integrações → Estoque terceiro**: [https://www.cockpit.com.br/integration/credential/thirdparty-inventory](https://www.cockpit.com.br/integration/credential/thirdparty-inventory)
3. Crie **usuário e senha** dedicados à integração (não use o login pessoal do vendedor).
4. No Jarvis: **Configurações → Integrações → Webmotors**, informe **CNPJ** (se exigido no login), **usuário** e **senha**, depois **Salvar** e **Testar conexão** (valida só o login SOAP).

Senhas são criptografadas no servidor (`WEBMOTORS_CRED_KEY`, mesma chave das demais integrações Webmotors).

## 2. Endpoints de produção

Definidos em `supabase/functions/_shared/webmotors-endpoints.ts`:

| Serviço | URL |
|--------|-----|
| Login | `https://integracao.webmotors.com.br/wsLoginSistemaRevendedor.asmx` |
| Estoque carros | `https://integracao.webmotors.com.br/wsEstoqueRevendedorWebMotors.asmx` |
| Estoque motos | `https://integracao.webmotors.com.br/Motos/wsEstoqueRevendedorMotos.asmx` |

Homologação usa `hportal.webmotors.com.br/IntegracaoRevendedor/...` (mesmos nomes de serviço).

## 3. Ambiente por loja (servidor)

| Variável | Uso |
|----------|-----|
| `WEBMOTORS_HML_TENANTS` | Lista de `user_id` (UUID) separados por vírgula/espaço/ponto-e-vírgula que continuam em **homologação** com credenciais de servidor |
| `WEBMOTORS_HML_CNPJ`, `WEBMOTORS_HML_USER`, `WEBMOTORS_HML_PASSWORD` | Credenciais Cockpit/HML só para esses tenants |
| `WEBMOTORS_CRED_KEY` | Criptografia das credenciais por loja em produção |

Todas as demais lojas usam **produção** e credenciais salvas no painel.

`WEBMOTORS_ENV` permanece apenas como normalizador legado; o roteamento por loja é `WEBMOTORS_HML_TENANTS`.

## 4. Publicação e estoque

- **Placa** obrigatória no payload (conferência Webmotors); veículo no banco deve ter placa cadastrada.
- Campos sensíveis (**chassi**, **renavam**) **não** entram no `WEBMOTORS_PUBLIC_VEHICLE_SELECT`.
- **Sim/Não** (`anuncio_sn`), **PrecoReal** / **PrecoVenda**, **TipoAnuncio "U"**, parser **CodigoRetorno** e estoque **ObterEstoqueAtual** (`<Anuncio>`) vêm da linha de homologação (WM-1 pós-correções).

## 5. Tirar do ar / voltar a anunciar

- **Tirar do ar**: exclui o anúncio na Webmotors (somente se criado pela plataforma), limpa vínculo local e registra histórico.
- **Voltar a anunciar**: novo `Incluir` + novo `anuncio_sn` (perguntas Sim/Não de novo).

Não há “pausar” na Webmotors nesta versão.

## 6. Leads

A Webmotors **não** expõe API de leads neste momento. Compradores entram em contato pelo **telefone/WhatsApp** configurado no Cockpit — cadastre o número do Jarvis lá.

## 7. Dúvidas / validação pendente

- Confirmar com a Webmotors se o endpoint de estoque de produção acima permanece o único oficial para todas as revendas (espelha homologação e o e-mail PTS-1463).
- Se a revenda usar URL alternativa, será necessário variável de ambiente por serviço (hoje **não** implementado; URLs fixas no código).
