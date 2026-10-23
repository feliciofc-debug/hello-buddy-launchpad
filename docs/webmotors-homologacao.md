# Webmotors — homologação da integração de estoque

Referências oficiais:

- Manual: <https://integracao.webmotors.com.br/manualintegracao/index.html>
- Collection: <https://cockpit.com.br/public/content/POSTMAN-WSIntegracao.postman_collection.json>

## Protocolo, autenticação e ambientes

A integração de revendedor documentada é SOAP 1.1/XML sobre serviços ASP.NET
`.asmx`. A autenticação recebe CNPJ, usuário de integração e senha e devolve
`HashAutenticacao`. O manual informa validade de 1000 minutos e códigos `401`
(hash inválido), `402` (sessão expirada), `403` (sem permissão) e `500`
(sucesso). A collection também envia um Bearer, mas não documenta como obtê-lo,
seu escopo ou sua expiração; por isso ele não foi inventado pela aplicação.

| Serviço | Homologação | Produção |
| --- | --- | --- |
| Login | `https://hportal.webmotors.com.br/IntegracaoRevendedor/wsLoginSistemaRevendedor.asmx` | `https://integracao.webmotors.com.br/wsLoginSistemaRevendedor.asmx` |
| Estoque carros | `https://hportal.webmotors.com.br/IntegracaoRevendedor/wsEstoqueRevendedorWebMotors.asmx` | `https://integracao.webmotors.com.br/wsEstoqueRevendedorWebMotors.asmx` |

Operações usadas: `autenticar`, `ObterMarca`, `ObterModelo`, `ObterVersao`,
`ObterNumeroPortas`, `ObterCombustivel`, `ObterCores`, `ObterOpcionais`,
`ObterCambio`, `ObterModalidade`, `IncluirCarro`, `AlterarCarro`,
`ExcluirCarro`, `ObterEstoqueAtual`, `IncluirFoto`, `ExcluirFoto` e
`ObterFotosCarro`.

## Mapeamento

| Estoque AMZ | Webmotors |
| --- | --- |
| `marca` | `CodigoMarca` |
| `modelo` | `CodigoModelo` |
| `versao` | `CodigoVersao` |
| `ano_modelo` | `AnoDoModelo` |
| `ano_fabricacao` | `AnoFabricacao` |
| `km` | `Km` |
| `cambio` | `CodigoCambio` |
| `portas` | `NrPortas` |
| `cor` | `CodigoCor` |
| `combustivel` | `CodigoCombustivel` |
| `blindado` | `Blindado` |
| `placa` (cadastro interno) | `Placa` (obrigatória na API; não aparece no anúncio) |
| `preco` | `PrecoVenda` |
| preço promocional “de” (se existir e for maior) | `PrecoReal` (senão `0`) |
| checkboxes na publicação | dez campos Sim/Não após `Blindado` |
| `descricao` | `Observacao` |
| `opcionais` | `Opcional/CodigoOpcional` |
| `fotos[]` | chamadas `IncluirFoto`, na ordem do estoque |

Marca, modelo, versão, cor, combustível, câmbio e opcionais só são associados
automaticamente por nome normalizado **exato**. Sem correspondência exata, a
publicação é bloqueada e o usuário escolhe o de/para. Portas e modalidade não
recebem valor arbitrário.

Em homologação (PTS-1463), a placa é **obrigatória** (`43|74`). A integração
envia a placa cadastrada no estoque (normalizada, sem hífen) somente para
conferência na Webmotors — ela não é exibida no anúncio público. Sem placa no
cadastro, a publicação é bloqueada com mensagem amigável.

Os dez campos Sim/Não (`43|46`…`43|54`) são sempre enviados. O sistema **não**
marca “Sim” automaticamente: na publicação, a loja marca o que for verdade;
itens desmarcados vão como “Não”.

`PrecoReal` deve ser `0` ou um preço “de” promocional **maior** que
`PrecoVenda`. Enviar os dois iguais gera `22|78`.

`Observacao` aceita no máximo 500 caracteres. Cada foto aceita no máximo 500
Kbytes. O manual retorna erro quando a quantidade de fotos é excedida, mas não
informa o número máximo nem lista de formatos; portanto a aplicação não fixa
um limite quantitativo próprio.

## Segurança e propriedade

- `WEBMOTORS_ENV=homologacao` (padrão): usa exclusivamente credenciais HML do
  ambiente do servidor. Elas não são persistidas nem retornadas ao navegador.
- `WEBMOTORS_ENV=producao`: cada loja informa suas próprias credenciais. A senha
  é cifrada com AES-GCM antes de ser armazenada.
- `managed_by_platform` é marcado somente pelo backend após `IncluirCarro`.
  Sincronização e exclusão recusam IDs sem essa prova. Trigger de banco impede
  que um cliente autenticado forje `external_id` ou a prova de propriedade.
- Senha, hash e credenciais não são escritos em logs.
- O cache de catálogo é isolado por loja, inclusive modalidades do contrato.
- Fotos aceitam apenas HTTPS público, com bloqueio de redes privadas,
  redirecionamentos limitados e leitura interrompida acima de 500 Kbytes.
- A integração lê o estoque de veículos e não altera o fluxo AMZ tradicional
  de produtos.

## Limitações confirmadas no material oficial

O manual e a collection fornecidos não expõem:

- pausa/reativação;
- status de moderação (`em análise`, `recusado`) ou motivo de recusa;
- leads ou mensagens;
- reordenação direta de fotos.

Assim, não há endpoints fictícios para essas funções. Para carros, uma mudança
de ordem é aplicada com `ExcluirFoto` + `IncluirFoto`. O cron permanece
desligado por padrão (nenhum agendamento é criado). Esses recursos dependem de
documentação/API adicional da Webmotors.

## Variáveis de ambiente

```text
WEBMOTORS_ENV=homologacao|producao
WEBMOTORS_HML_USER=
WEBMOTORS_HML_PASSWORD=
WEBMOTORS_HML_CNPJ=
WEBMOTORS_CRED_KEY=
```

Somente para o script manual:

```text
WEBMOTORS_HML_TEST_VEHICLE_JSON={"CodigoModalidade":7,"CodigoMarca":1,"CodigoModelo":2,"CodigoVersao":3,"AnoDoModelo":2024,"AnoFabricacao":2023,"Km":1000,"Placa":"ABC1D23","CodigoCambio":4,"NrPortas":4,"CodigoCor":5,"CodigoCombustivel":6,"Blindado":"N","UnicoDono":"N","PrecoReal":0,"PrecoVenda":100000,"Observacao":"Veiculo de teste","OpcionalCodigos":[]}
```

Os códigos acima são apenas um exemplo de formato. Devem ser substituídos pelos
códigos fornecidos para a conta de homologação; não se deve adivinhar códigos.

## Teste manual de homologação

O modo padrão autentica e valida a configuração, mas não cria anúncio:

```sh
DENO_NO_PACKAGE_JSON=1 deno run --allow-env --allow-net \
  scripts/webmotors-homologacao.ts
```

Após revisar o JSON de teste, o modo de execução inclui um veículo, aumenta o
preço em R$ 100, consulta o estoque e exclui o anúncio em bloco `finally`:

```sh
DENO_NO_PACKAGE_JSON=1 deno run --allow-env --allow-net \
  scripts/webmotors-homologacao.ts --execute
```

O script nunca imprime senha nem `HashAutenticacao`.
