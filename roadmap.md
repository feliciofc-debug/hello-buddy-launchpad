# Roadmap

## Em investigação
- [ ] Instagram "sacolinha" (product tags) na publicação via API
  - Requisitos externos: conta IG Business com Instagram Shopping aprovado, catálogo no Commerce Manager vinculado à conta IG, permissões `instagram_shopping_tag_products` + `catalog_management` (App Review).
  - Implementação (quando requisitos existirem): buscar produto por `GET /{ig-user-id}/catalog_product_search`, salvar `product_id` no nosso produto, e enviar `product_tags` no `POST /{ig-user-id}/media` em `meta-publish-instagram` (foto) e `meta-publish-carousel` (por slide).
