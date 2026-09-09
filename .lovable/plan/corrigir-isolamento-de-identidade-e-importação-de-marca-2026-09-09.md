# Corrigir isolamento de identidade e importação de marca

## Objetivo
Impedir que logo ou dados de um prospect apareçam no vídeo seguinte e tornar a importação de sites mais segura para redes grandes.

## Implementação
1. **Destravar a tela imediatamente**
   - Adicionar “Remover logo” ao lado de “Trocar logo”.
   - Limpar a logo usada apenas no vídeo sem apagar a logo oficial cadastrada da conta.
   - Garantir que a próxima geração não reutilize caminho ou URL já removidos.

2. **Isolar cada identidade**
   - Ao escolher AMZ, Ademicon, Personalizada ou “Importar do site”, limpar primeiro logo, nome da marca, tom de voz, site, telefone e consultor do contexto anterior.
   - Depois aplicar somente os dados próprios do novo preset ou da nova importação.
   - Ao iniciar uma importação, descartar a logo anterior antes mesmo de receber o resultado.

3. **Corrigir a seleção de logo**
   - Manter a prioridade: logo do cabeçalho, `og:image`, maior ícone e `apple-touch-icon`.
   - Rejeitar imagens dentro de carrosséis, sliders, vitrines e áreas de parceiros/marcas.
   - Remover a busca genérica que hoje pode escolher arquivos como `brands-slider-01.png`.
   - Na leitura avançada, pontuar candidatos por posição, tamanho, visibilidade e proximidade do cabeçalho.

4. **Recuperar a cor da marca**
   - Extrair cores dominantes da logo aprovada pelo navegador, ignorando transparência, branco/cinza/preto predominantes quando houver cor de marca.
   - Somar essas cores à paleta renderizada com peso de marca, sem usar IA para inventar hexadecimal.
   - Manter aprovação humana obrigatória.

## Validação
- Trocar Revista MaisBonita → Venâncio e confirmar que nenhum dado anterior permanece.
- Remover uma logo e gerar roteiro sem `logo_path`/`logoUrl` residual.
- Importar `drogariavenancio.com.br` e confirmar que `brands-slider-01.png` é rejeitada.
- Conferir se o vermelho institucional aparece entre as cores detectadas quando estiver presente na logo correta.
