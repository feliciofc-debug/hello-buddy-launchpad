import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ebookHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>50 Receitas Airfryer - AMZ Ofertas</title>
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Open Sans', sans-serif;
            line-height: 1.8;
            color: #333;
            background: #fff;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px 120px 20px;
            position: relative;
        }
        
        /* MARCA D'ÁGUA */
        body::before {
            content: "AMZ OFERTAS";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 800;
            color: rgba(0, 0, 0, 0.02);
            z-index: -1;
            pointer-events: none;
        }
        
        /* RODAPÉ FIXO */
        .footer-fixed {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            text-align: center;
            font-size: 0.85em;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        
        .footer-fixed a {
            color: #ffd700;
            text-decoration: none;
            font-weight: 600;
            margin: 0 8px;
            transition: all 0.3s;
        }
        
        .footer-fixed a:hover {
            color: white;
            transform: scale(1.05);
        }
        
        /* EMOJIS NOS LINKS */
        .footer-fixed .emoji {
            font-size: 1.2em;
            margin-right: 3px;
        }
        
        /* CAPA */
        .cover {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin-bottom: 50px;
            page-break-after: always;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        
        .cover .brand {
            font-size: 3.5em;
            font-weight: 800;
            margin-bottom: 10px;
            text-shadow: 2px 2px 10px rgba(0,0,0,0.3);
            letter-spacing: 2px;
        }
        
        .cover .brand-subtitle {
            font-size: 1.2em;
            opacity: 0.95;
            margin-bottom: 40px;
            font-weight: 300;
        }
        
        .cover h1 {
            font-family: 'Merriweather', serif;
            font-size: 2.8em;
            margin-bottom: 15px;
            font-weight: 700;
        }
        
        .cover .subtitle {
            font-size: 1.4em;
            opacity: 0.95;
            margin-bottom: 30px;
        }
        
        .cover .badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 10px 25px;
            border-radius: 30px;
            font-weight: 600;
            border: 2px solid rgba(255,255,255,0.3);
        }
        
        /* SEÇÕES */
        .section {
            margin-bottom: 50px;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-family: 'Merriweather', serif;
            font-size: 1.8em;
            color: #667eea;
            margin-bottom: 25px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        
        /* RECEITAS */
        .recipe {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 25px;
            border-left: 4px solid #667eea;
            page-break-inside: avoid;
        }
        
        .recipe-title {
            font-size: 1.4em;
            color: #333;
            margin-bottom: 15px;
            font-weight: 700;
        }
        
        .recipe-meta {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        
        .recipe-meta span {
            background: #667eea;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
        }
        
        .recipe h4 {
            color: #764ba2;
            margin: 15px 0 10px 0;
            font-size: 1.1em;
        }
        
        .recipe ul, .recipe ol {
            margin-left: 25px;
            margin-bottom: 10px;
        }
        
        .recipe li {
            margin-bottom: 5px;
        }
        
        .recipe .tip {
            background: linear-gradient(135deg, #667eea22, #764ba222);
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-style: italic;
        }
        
        .recipe .tip::before {
            content: "💡 Dica: ";
            font-weight: 700;
            font-style: normal;
        }
        
        /* INTRO */
        .intro {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 40px;
        }
        
        .intro h2 {
            color: #667eea;
            margin-bottom: 15px;
        }
        
        .intro ul {
            margin-left: 25px;
        }
        
        .intro li {
            margin-bottom: 8px;
        }
        
        /* CTA */
        .cta-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin: 40px 0;
        }
        
        .cta-box h3 {
            font-size: 1.5em;
            margin-bottom: 15px;
        }
        
        .cta-box a {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 12px 30px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: 700;
            margin-top: 15px;
            transition: all 0.3s;
        }
        
        .cta-box a:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        }
        
        /* ÍNDICE */
        .toc {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 40px;
        }
        
        .toc h2 {
            color: #667eea;
            margin-bottom: 15px;
        }
        
        .toc ol {
            margin-left: 25px;
        }
        
        .toc li {
            margin-bottom: 5px;
        }
        
        /* RESPONSIVO */
        @media (max-width: 600px) {
            .cover .brand {
                font-size: 2.5em;
            }
            
            .cover h1 {
                font-size: 2em;
            }
            
            .recipe-meta {
                flex-direction: column;
                gap: 10px;
            }
            
            body {
                padding: 20px 15px 100px 15px;
            }
        }
        
        /* PRINT */
        @media print {
            .footer-fixed {
                display: none;
            }
            
            body {
                padding-bottom: 20px;
            }
            
            .recipe {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <!-- CAPA -->
    <div class="cover">
        <div class="brand">🍳 AMZ OFERTAS</div>
        <div class="brand-subtitle">Seu guia de compras inteligentes</div>
        <h1>50 Receitas na Airfryer</h1>
        <p class="subtitle">Deliciosas, Práticas e Saudáveis</p>
        <div class="badge">📚 eBook Exclusivo</div>
    </div>

    <!-- INTRODUÇÃO -->
    <div class="intro">
        <h2>👋 Bem-vindo ao seu eBook!</h2>
        <p>Você acaba de receber um presente exclusivo da <strong>AMZ Ofertas</strong>! Este eBook foi criado especialmente para você que ama praticidade na cozinha.</p>
        <br>
        <p><strong>O que você vai encontrar:</strong></p>
        <ul>
            <li>🍗 Receitas de carnes suculentas</li>
            <li>🐟 Peixes e frutos do mar deliciosos</li>
            <li>🥔 Legumes e acompanhamentos perfeitos</li>
            <li>🍰 Sobremesas incríveis</li>
            <li>🍟 Petiscos irresistíveis</li>
        </ul>
        <br>
        <p>💡 <strong>Dica:</strong> Salve este link nos favoritos do seu celular para acessar sempre que precisar!</p>
    </div>

    <!-- ÍNDICE -->
    <div class="toc">
        <h2>📑 Índice</h2>
        <ol>
            <li>Carnes (Receitas 1-15)</li>
            <li>Peixes e Frutos do Mar (Receitas 16-25)</li>
            <li>Legumes e Vegetais (Receitas 26-35)</li>
            <li>Sobremesas (Receitas 36-42)</li>
            <li>Petiscos (Receitas 43-50)</li>
        </ol>
    </div>

    <!-- SEÇÃO 1: CARNES -->
    <div class="section">
        <h2 class="section-title">🍗 CARNES</h2>
        
        <div class="recipe">
            <h3 class="recipe-title">1. Frango Crocante</h3>
            <div class="recipe-meta">
                <span>⏱️ 25 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de sobrecoxa de frango</li>
                <li>2 colheres de azeite</li>
                <li>Sal, pimenta e páprica a gosto</li>
                <li>1 dente de alho picado</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Tempere o frango com todos os ingredientes</li>
                <li>Deixe marinar por 30 minutos</li>
                <li>Pré-aqueça a airfryer a 200°C</li>
                <li>Asse por 25 minutos, virando na metade</li>
            </ol>
            <div class="tip">Fure a pele com um garfo para ficar ainda mais crocante!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">2. Costela Suína</h3>
            <div class="recipe-meta">
                <span>⏱️ 35 min</span>
                <span>🔥 180°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1kg de costela suína</li>
                <li>3 colheres de molho shoyu</li>
                <li>2 colheres de mel</li>
                <li>Alho e gengibre a gosto</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture o shoyu, mel, alho e gengibre</li>
                <li>Pincele a costela com a mistura</li>
                <li>Asse a 180°C por 35 minutos</li>
                <li>Pincele novamente na metade do tempo</li>
            </ol>
            <div class="tip">Deixe marinar overnight para um sabor mais intenso!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">3. Hambúrguer Artesanal</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 190°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>400g de carne moída</li>
                <li>1 cebola ralada</li>
                <li>Sal e pimenta</li>
                <li>Queijo para gratinar</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture a carne com cebola e temperos</li>
                <li>Forme hambúrgueres de 100g cada</li>
                <li>Asse a 190°C por 10 minutos</li>
                <li>Adicione queijo e asse mais 2 minutos</li>
            </ol>
            <div class="tip">Não aperte a carne ao moldar para manter suculenta!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">4. Linguiça Calabresa</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de linguiça calabresa</li>
                <li>1 cebola em rodelas</li>
                <li>Azeite para pincelar</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Fure a linguiça com um garfo</li>
                <li>Pincele com azeite</li>
                <li>Coloque a cebola por cima</li>
                <li>Asse a 180°C por 18 minutos</li>
            </ol>
            <div class="tip">Sirva com farofa e vinagrete!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">5. Bife à Parmegiana</h3>
            <div class="recipe-meta">
                <span>⏱️ 20 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 bifes de alcatra finos</li>
                <li>Farinha de rosca</li>
                <li>2 ovos batidos</li>
                <li>Molho de tomate e queijo</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Empane os bifes no ovo e farinha</li>
                <li>Asse a 200°C por 15 minutos</li>
                <li>Cubra com molho e queijo</li>
                <li>Asse mais 5 minutos para gratinar</li>
            </ol>
            <div class="tip">Use spray de óleo para dourar melhor!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">6. Espetinho de Carne</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 200°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de alcatra em cubos</li>
                <li>Pimentão colorido</li>
                <li>Cebola em pedaços</li>
                <li>Tempero para churrasco</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Monte os espetinhos alternando ingredientes</li>
                <li>Tempere bem</li>
                <li>Asse a 200°C por 15 minutos</li>
                <li>Vire na metade do tempo</li>
            </ol>
            <div class="tip">Deixe de molho em cerveja para amaciar!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">7. Coxa de Frango ao Limão</h3>
            <div class="recipe-meta">
                <span>⏱️ 30 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>8 coxas de frango</li>
                <li>Suco de 2 limões</li>
                <li>Alho, sal e ervas finas</li>
                <li>Azeite</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Marine o frango no limão por 1 hora</li>
                <li>Adicione alho e ervas</li>
                <li>Asse a 180°C por 30 minutos</li>
                <li>Pincele com azeite durante</li>
            </ol>
            <div class="tip">O limão ajuda a deixar a pele super crocante!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">8. Lombo Recheado</h3>
            <div class="recipe-meta">
                <span>⏱️ 40 min</span>
                <span>🔥 180°C</span>
                <span>👥 8 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1kg de lombo</li>
                <li>Bacon em fatias</li>
                <li>Queijo muçarela</li>
                <li>Tempero verde</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Abra o lombo em borboleta</li>
                <li>Recheie com bacon e queijo</li>
                <li>Enrole e amarre</li>
                <li>Asse a 180°C por 40 minutos</li>
            </ol>
            <div class="tip">Deixe descansar 10 min antes de fatiar!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">9. Asinha Buffalo</h3>
            <div class="recipe-meta">
                <span>⏱️ 25 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1kg de asinhas de frango</li>
                <li>4 colheres de manteiga</li>
                <li>Molho de pimenta</li>
                <li>Alho em pó</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Tempere as asinhas com alho</li>
                <li>Asse a 200°C por 25 minutos</li>
                <li>Misture manteiga com molho de pimenta</li>
                <li>Pincele nas asinhas e sirva</li>
            </ol>
            <div class="tip">Sirva com molho ranch para equilibrar!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">10. Kafta</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 190°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de carne moída</li>
                <li>Salsinha e hortelã</li>
                <li>Cebola ralada</li>
                <li>Cominho e pimenta síria</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture todos os ingredientes</li>
                <li>Modele em formato de charuto</li>
                <li>Asse a 190°C por 18 minutos</li>
                <li>Sirva com coalhada seca</li>
            </ol>
            <div class="tip">Molhe as mãos para modelar mais fácil!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">11. Picanha</h3>
            <div class="recipe-meta">
                <span>⏱️ 25 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de picanha em bifes</li>
                <li>Sal grosso</li>
                <li>Alho picado (opcional)</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Retire a carne da geladeira 30 min antes</li>
                <li>Tempere com sal grosso</li>
                <li>Asse a 200°C por 20-25 min (ao ponto)</li>
                <li>Deixe descansar 5 min antes de servir</li>
            </ol>
            <div class="tip">Coloque a gordura para cima nos primeiros 15 min!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">12. Nuggets Caseiros</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 200°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de peito de frango</li>
                <li>Farinha de rosca</li>
                <li>Queijo parmesão ralado</li>
                <li>Ovos</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Processe o frango até virar pasta</li>
                <li>Modele os nuggets</li>
                <li>Empane no ovo e farinha com parmesão</li>
                <li>Asse a 200°C por 15 minutos</li>
            </ol>
            <div class="tip">Congele cru para ter sempre à mão!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">13. Carne de Porco Desfiada</h3>
            <div class="recipe-meta">
                <span>⏱️ 45 min</span>
                <span>🔥 160°C</span>
                <span>👥 8 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1kg de paleta suína</li>
                <li>Molho barbecue</li>
                <li>Cebola caramelizada</li>
                <li>Temperos defumados</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Tempere a carne e envolva em papel alumínio</li>
                <li>Asse a 160°C por 45 minutos</li>
                <li>Desfie e misture com molho</li>
                <li>Sirva em pães brioche</li>
            </ol>
            <div class="tip">O papel alumínio mantém úmida!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">14. Almôndegas</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 180°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de carne moída</li>
                <li>1/2 xícara de aveia</li>
                <li>1 ovo</li>
                <li>Temperos a gosto</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture todos os ingredientes</li>
                <li>Modele bolinhas</li>
                <li>Asse a 180°C por 18 minutos</li>
                <li>Sirva com molho de tomate</li>
            </ol>
            <div class="tip">A aveia deixa super macia e saudável!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">15. Filé Mignon com Bacon</h3>
            <div class="recipe-meta">
                <span>⏱️ 20 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 medalhões de filé mignon</li>
                <li>Bacon em fatias</li>
                <li>Cream cheese</li>
                <li>Sal e pimenta</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Envolva cada medalhão com bacon</li>
                <li>Prenda com palito</li>
                <li>Asse a 200°C por 18-20 min</li>
                <li>Sirva com cream cheese derretido</li>
            </ol>
            <div class="tip">Bacon crocante = perfeição!</div>
        </div>
    </div>

    <!-- SEÇÃO 2: PEIXES -->
    <div class="section">
        <h2 class="section-title">🐟 PEIXES E FRUTOS DO MAR</h2>
        
        <div class="recipe">
            <h3 class="recipe-title">16. Salmão ao Limão</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 180°C</span>
                <span>👥 2 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>2 postas de salmão</li>
                <li>Limão siciliano fatiado</li>
                <li>Azeite, sal e dill</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Tempere o salmão com sal e azeite</li>
                <li>Coloque fatias de limão por cima</li>
                <li>Asse a 180°C por 12-15 minutos</li>
                <li>Finalize com dill fresco</li>
            </ol>
            <div class="tip">Não deixe passar do ponto para manter suculento!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">17. Tilápia Empanada</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 filés de tilápia</li>
                <li>Farinha panko</li>
                <li>Ovos batidos</li>
                <li>Limão e sal</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Tempere os filés com limão e sal</li>
                <li>Passe no ovo e depois no panko</li>
                <li>Asse a 200°C por 15 minutos</li>
                <li>Sirva com maionese temperada</li>
            </ol>
            <div class="tip">Panko fica muito mais crocante que farinha comum!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">18. Camarão ao Alho</h3>
            <div class="recipe-meta">
                <span>⏱️ 10 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de camarão limpo</li>
                <li>6 dentes de alho picados</li>
                <li>Azeite e manteiga</li>
                <li>Salsinha</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture camarão com alho, azeite e manteiga</li>
                <li>Asse a 200°C por 8-10 minutos</li>
                <li>Finalize com salsinha</li>
                <li>Sirva imediatamente</li>
            </ol>
            <div class="tip">Camarão grande fica mais suculento!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">19. Peixe com Crosta de Ervas</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 filés de peixe branco</li>
                <li>Pão ralado com ervas</li>
                <li>Mostarda dijon</li>
                <li>Azeite</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Pincele os filés com mostarda</li>
                <li>Cubra com a mistura de ervas</li>
                <li>Asse a 180°C por 15-18 minutos</li>
            </ol>
            <div class="tip">Use manjericão, tomilho e alecrim!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">20. Atum Selado</h3>
            <div class="recipe-meta">
                <span>⏱️ 8 min</span>
                <span>🔥 220°C</span>
                <span>👥 2 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>2 postas de atum fresco</li>
                <li>Gergelim preto e branco</li>
                <li>Molho shoyu</li>
                <li>Gengibre ralado</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Passe o atum no gergelim</li>
                <li>Pré-aqueça bem a 220°C</li>
                <li>Asse por apenas 3-4 min de cada lado</li>
                <li>Sirva com shoyu e gengibre</li>
            </ol>
            <div class="tip">O centro deve ficar rosado!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">21. Bolinho de Bacalhau</h3>
            <div class="recipe-meta">
                <span>⏱️ 20 min</span>
                <span>🔥 200°C</span>
                <span>👥 8 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de bacalhau dessalgado</li>
                <li>500g de batata cozida</li>
                <li>Cebola, alho e salsinha</li>
                <li>2 ovos</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Desfie o bacalhau e amasse as batatas</li>
                <li>Misture tudo e modele bolinhos</li>
                <li>Pincele com gema</li>
                <li>Asse a 200°C por 20 minutos</li>
            </ol>
            <div class="tip">Sem fritura, mais saudável e tão gostoso!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">22. Lula à Dorê</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de anéis de lula</li>
                <li>Farinha de trigo temperada</li>
                <li>Ovos batidos</li>
                <li>Limão</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Seque bem a lula</li>
                <li>Passe na farinha e depois no ovo</li>
                <li>Asse a 200°C por 10-12 minutos</li>
                <li>Sirva com limão</li>
            </ol>
            <div class="tip">Não cozinhe demais ou fica borrachuda!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">23. Sardinha Crocante</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>8 sardinhas limpas</li>
                <li>Fubá temperado</li>
                <li>Limão</li>
                <li>Azeite</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Tempere as sardinhas com limão</li>
                <li>Passe no fubá</li>
                <li>Pincele com azeite</li>
                <li>Asse a 200°C por 18 minutos</li>
            </ol>
            <div class="tip">Rica em ômega 3!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">24. Mexilhões ao Vinagrete</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1kg de mexilhões limpos</li>
                <li>Vinho branco</li>
                <li>Alho e salsinha</li>
                <li>Vinagrete para servir</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Coloque mexilhões com vinho na airfryer</li>
                <li>Asse a 200°C por 10-12 minutos</li>
                <li>Descarte os que não abriram</li>
                <li>Sirva com vinagrete</li>
            </ol>
            <div class="tip">Acompanha bem com pão italiano!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">25. Fish and Chips</h3>
            <div class="recipe-meta">
                <span>⏱️ 22 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 filés de peixe branco</li>
                <li>Batatas em palito</li>
                <li>Massa de cerveja</li>
                <li>Farinha de rosca</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Empane o peixe na massa e farinha</li>
                <li>Corte as batatas em palito</li>
                <li>Asse tudo a 200°C por 22 minutos</li>
                <li>Sirva com maionese e limão</li>
            </ol>
            <div class="tip">Clássico britânico, versão saudável!</div>
        </div>
    </div>

    <!-- SEÇÃO 3: LEGUMES -->
    <div class="section">
        <h2 class="section-title">🥔 LEGUMES E VEGETAIS</h2>
        
        <div class="recipe">
            <h3 class="recipe-title">26. Batata Rústica</h3>
            <div class="recipe-meta">
                <span>⏱️ 25 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 batatas médias</li>
                <li>Azeite e sal grosso</li>
                <li>Alecrim e páprica</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte as batatas em gomos</li>
                <li>Tempere com azeite e especiarias</li>
                <li>Asse a 200°C por 25 minutos</li>
                <li>Agite a cesta na metade</li>
            </ol>
            <div class="tip">Não empilhe demais para dourar uniforme!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">27. Abobrinha Grelhada</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>2 abobrinhas</li>
                <li>Azeite e sal</li>
                <li>Queijo parmesão ralado</li>
                <li>Ervas finas</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em rodelas de 1cm</li>
                <li>Tempere com azeite e sal</li>
                <li>Asse a 180°C por 10 minutos</li>
                <li>Finalize com parmesão e ervas</li>
            </ol>
            <div class="tip">Ótimo acompanhamento low carb!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">28. Berinjela à Parmegiana</h3>
            <div class="recipe-meta">
                <span>⏱️ 20 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1 berinjela grande</li>
                <li>Molho de tomate</li>
                <li>Queijo muçarela</li>
                <li>Parmesão ralado</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em fatias e salgue por 30 min</li>
                <li>Lave e seque bem</li>
                <li>Monte camadas com molho e queijo</li>
                <li>Asse a 180°C por 20 minutos</li>
            </ol>
            <div class="tip">O sal remove o amargor!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">29. Couve-flor ao Curry</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 190°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1 couve-flor</li>
                <li>Curry em pó</li>
                <li>Azeite e sal</li>
                <li>Iogurte natural para servir</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em floretes</li>
                <li>Tempere com azeite e curry</li>
                <li>Asse a 190°C por 18 minutos</li>
                <li>Sirva com iogurte</li>
            </ol>
            <div class="tip">Fica incrível douradinha!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">30. Cenoura Glaceada</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 cenouras</li>
                <li>1 colher de mel</li>
                <li>Manteiga</li>
                <li>Salsinha</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em rodelas</li>
                <li>Misture com mel e manteiga</li>
                <li>Asse a 180°C por 15 minutos</li>
                <li>Finalize com salsinha</li>
            </ol>
            <div class="tip">O mel carameliza perfeitamente!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">31. Batata Doce Chips</h3>
            <div class="recipe-meta">
                <span>⏱️ 20 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>2 batatas doces</li>
                <li>Azeite</li>
                <li>Sal e canela</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Fatie bem fino com mandolina</li>
                <li>Misture com azeite</li>
                <li>Asse a 180°C por 18-20 minutos</li>
                <li>Tempere com sal ou canela</li>
            </ol>
            <div class="tip">Quanto mais fino, mais crocante!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">32. Brócolis Crocante</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 190°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1 brócolis</li>
                <li>Alho picado</li>
                <li>Azeite e parmesão</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em floretes</li>
                <li>Tempere com alho e azeite</li>
                <li>Asse a 190°C por 12 minutos</li>
                <li>Finalize com parmesão</li>
            </ol>
            <div class="tip">As pontas ficam crocantes!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">33. Legumes Mediterrâneos</h3>
            <div class="recipe-meta">
                <span>⏱️ 22 min</span>
                <span>🔥 180°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>Abobrinha, berinjela, pimentão</li>
                <li>Cebola roxa e tomate</li>
                <li>Azeite e ervas de Provence</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte tudo em cubos</li>
                <li>Tempere com azeite e ervas</li>
                <li>Asse a 180°C por 22 minutos</li>
                <li>Misture na metade do tempo</li>
            </ol>
            <div class="tip">Perfeito com arroz integral!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">34. Cogumelos Recheados</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>8 cogumelos grandes</li>
                <li>Cream cheese</li>
                <li>Bacon picado</li>
                <li>Cebolinha</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Retire os talos dos cogumelos</li>
                <li>Misture cream cheese com bacon</li>
                <li>Recheie e asse a 180°C por 15 min</li>
                <li>Finalize com cebolinha</li>
            </ol>
            <div class="tip">Entrada elegante e fácil!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">35. Abóbora com Canela</h3>
            <div class="recipe-meta">
                <span>⏱️ 25 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de abóbora cabotiá</li>
                <li>Canela e mel</li>
                <li>Manteiga</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em cubos grandes</li>
                <li>Tempere com canela e mel</li>
                <li>Adicione pedacinhos de manteiga</li>
                <li>Asse a 180°C por 25 minutos</li>
            </ol>
            <div class="tip">Pode ser doce ou salgada!</div>
        </div>
    </div>

    <!-- SEÇÃO 4: SOBREMESAS -->
    <div class="section">
        <h2 class="section-title">🍰 SOBREMESAS</h2>
        
        <div class="recipe">
            <h3 class="recipe-title">36. Banana Caramelizada</h3>
            <div class="recipe-meta">
                <span>⏱️ 10 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 bananas maduras</li>
                <li>Açúcar mascavo</li>
                <li>Canela</li>
                <li>Sorvete para acompanhar</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte as bananas ao meio</li>
                <li>Polvilhe açúcar e canela</li>
                <li>Asse a 180°C por 10 minutos</li>
                <li>Sirva com sorvete</li>
            </ol>
            <div class="tip">Use bananas bem maduras!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">37. Brownie de Caneca</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 160°C</span>
                <span>👥 2 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>3 colheres de farinha</li>
                <li>3 colheres de chocolate em pó</li>
                <li>2 colheres de açúcar</li>
                <li>1 ovo e 2 colheres de óleo</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture tudo em ramequins</li>
                <li>Asse a 160°C por 10-12 minutos</li>
                <li>O centro deve ficar cremoso</li>
                <li>Sirva quente</li>
            </ol>
            <div class="tip">Não passe do ponto!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">38. Maçã Assada</h3>
            <div class="recipe-meta">
                <span>⏱️ 20 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>4 maçãs</li>
                <li>Canela e açúcar</li>
                <li>Manteiga</li>
                <li>Nozes picadas</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Retire o miolo das maçãs</li>
                <li>Recheie com canela, açúcar e nozes</li>
                <li>Coloque manteiga por cima</li>
                <li>Asse a 180°C por 20 minutos</li>
            </ol>
            <div class="tip">Maçã Fuji fica perfeita!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">39. Churros</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 180°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1 xícara de água</li>
                <li>1/2 xícara de manteiga</li>
                <li>1 xícara de farinha</li>
                <li>3 ovos e açúcar com canela</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Ferva água com manteiga, adicione farinha</li>
                <li>Deixe esfriar e misture os ovos</li>
                <li>Molde com saco de confeiteiro</li>
                <li>Asse a 180°C por 15 minutos</li>
            </ol>
            <div class="tip">Passe no açúcar com canela ainda quente!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">40. Petit Gâteau</h3>
            <div class="recipe-meta">
                <span>⏱️ 12 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>100g de chocolate meio amargo</li>
                <li>100g de manteiga</li>
                <li>2 ovos e 2 gemas</li>
                <li>4 colheres de farinha</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Derreta chocolate com manteiga</li>
                <li>Bata ovos com açúcar, misture tudo</li>
                <li>Adicione farinha</li>
                <li>Asse a 180°C por 10-12 min</li>
            </ol>
            <div class="tip">O centro deve escorrer!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">41. Cookie Gigante</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 160°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1/2 xícara de manteiga</li>
                <li>1 xícara de açúcar mascavo</li>
                <li>1 ovo e farinha</li>
                <li>Gotas de chocolate</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Misture manteiga com açúcar</li>
                <li>Adicione ovo e farinha</li>
                <li>Misture as gotas de chocolate</li>
                <li>Asse a 160°C por 15 minutos</li>
            </ol>
            <div class="tip">Deixe dourar nas bordas!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">42. Torta de Limão</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 160°C</span>
                <span>👥 8 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1 pacote de biscoito maizena</li>
                <li>Manteiga</li>
                <li>Leite condensado</li>
                <li>Suco de 3 limões</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Triture biscoito com manteiga derretida</li>
                <li>Forre forma e asse 8 min a 160°C</li>
                <li>Misture condensado com limão</li>
                <li>Recheie e leve à geladeira</li>
            </ol>
            <div class="tip">A base fica super crocante!</div>
        </div>
    </div>

    <!-- SEÇÃO 5: PETISCOS -->
    <div class="section">
        <h2 class="section-title">🍟 PETISCOS</h2>
        
        <div class="recipe">
            <h3 class="recipe-title">43. Bolinho de Queijo</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 180°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>200g de queijo coalho</li>
                <li>Orégano</li>
                <li>Spray de óleo</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte o queijo em cubos</li>
                <li>Polvilhe orégano</li>
                <li>Asse a 180°C por 15 minutos</li>
                <li>Sirva com melado (opcional)</li>
            </ol>
            <div class="tip">Queijo coalho fica perfeito!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">44. Coxinha de Frango</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 200°C</span>
                <span>👥 8 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>Massa de coxinha pronta</li>
                <li>Frango desfiado temperado</li>
                <li>Farinha de rosca</li>
                <li>Ovos</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Modele as coxinhas</li>
                <li>Passe no ovo e na farinha</li>
                <li>Pincele com óleo</li>
                <li>Asse a 200°C por 18 minutos</li>
            </ol>
            <div class="tip">Congele cruas para ter sempre!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">45. Polenta Frita</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 200°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>1 pacote de polenta pronta</li>
                <li>Azeite</li>
                <li>Sal e ervas</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte a polenta em palitos</li>
                <li>Pincele com azeite</li>
                <li>Tempere com sal e ervas</li>
                <li>Asse a 200°C por 15 minutos</li>
            </ol>
            <div class="tip">Crocante por fora, macia por dentro!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">46. Pastel de Forno</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 200°C</span>
                <span>👥 8 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>Massa de pastel</li>
                <li>Recheio a gosto</li>
                <li>Gema para pincelar</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Recheie e feche com garfo</li>
                <li>Pincele com gema</li>
                <li>Asse a 200°C por 15 minutos</li>
                <li>Vire na metade</li>
            </ol>
            <div class="tip">Sem óleo, muito mais leve!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">47. Empanada</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 180°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>Massa de empanada</li>
                <li>Carne moída temperada</li>
                <li>Ovo cozido e azeitona</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Recheie a massa</li>
                <li>Feche pressionando as bordas</li>
                <li>Pincele com ovo</li>
                <li>Asse a 180°C por 18 minutos</li>
            </ol>
            <div class="tip">Clássico argentino!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">48. Cebola Empanada</h3>
            <div class="recipe-meta">
                <span>⏱️ 15 min</span>
                <span>🔥 200°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>2 cebolas grandes</li>
                <li>Farinha, ovo e farinha de rosca</li>
                <li>Temperos a gosto</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte as cebolas em anéis</li>
                <li>Empane: farinha, ovo, rosca</li>
                <li>Asse a 200°C por 15 minutos</li>
                <li>Sirva com molho especial</li>
            </ol>
            <div class="tip">Onion rings perfeitos!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">49. Torresmo</h3>
            <div class="recipe-meta">
                <span>⏱️ 35 min</span>
                <span>🔥 200°C</span>
                <span>👥 6 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>500g de barriga de porco</li>
                <li>Sal grosso</li>
                <li>Água fervente</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte em cubos e seque bem</li>
                <li>Tempere com sal grosso</li>
                <li>Asse a 200°C por 35 minutos</li>
                <li>Agite a cesta várias vezes</li>
            </ol>
            <div class="tip">Secar bem é o segredo da crocância!</div>
        </div>

        <div class="recipe">
            <h3 class="recipe-title">50. Calabresa Acebolada</h3>
            <div class="recipe-meta">
                <span>⏱️ 18 min</span>
                <span>🔥 180°C</span>
                <span>👥 4 porções</span>
            </div>
            <h4>Ingredientes:</h4>
            <ul>
                <li>300g de calabresa</li>
                <li>2 cebolas em rodelas</li>
                <li>Azeite</li>
            </ul>
            <h4>Modo de Preparo:</h4>
            <ol>
                <li>Corte a calabresa em rodelas</li>
                <li>Misture com cebola e azeite</li>
                <li>Asse a 180°C por 18 minutos</li>
                <li>Misture na metade do tempo</li>
            </ol>
            <div class="tip">Clássico de boteco, versão saudável!</div>
        </div>
    </div>

    <!-- CTA FINAL -->
    <div class="cta-box">
        <h3>🎉 Parabéns! Você concluiu o eBook!</h3>
        <p>Esperamos que tenha gostado das receitas. Lembre-se: a cada compra nos marketplaces, envie o comprovante para ganhar 2% de cashback!</p>
        <a href="https://wa.me/5521967520706">💬 Falar com AMZ Ofertas</a>
    </div>

    <!-- FOOTER FIXO -->
    <div class="footer-fixed">
        <span class="emoji">🍳</span> <strong>AMZ OFERTAS</strong> - Seu guia de compras inteligentes |
        <a href="https://wa.me/5521967520706"><span class="emoji">💬</span>WhatsApp</a> |
        <a href="https://www.instagram.com/amzofertas"><span class="emoji">📸</span>Instagram</a>
    </div>
</body>
</html>`

serve(async (req) => {
  // Retorna o HTML diretamente
  return new Response(ebookHTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
