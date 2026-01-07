import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// eBook completo "50 Receitas Airfryer - Do Básico ao Gourmet"
const ebookHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>50 Receitas Airfryer - AMZ Ofertas</title>
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
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
        }
        
        h1, h2, h3 {
            font-family: 'Merriweather', serif;
            color: #2c3e50;
            margin: 30px 0 20px;
        }
        
        h1 {
            font-size: 2.5em;
            text-align: center;
            color: #e74c3c;
            page-break-before: always;
        }
        
        h2 {
            font-size: 1.8em;
            border-bottom: 3px solid #e74c3c;
            padding-bottom: 10px;
        }
        
        h3 {
            font-size: 1.3em;
            color: #34495e;
        }
        
        /* MARCA D'ÁGUA + FOOTER AMZ */
        .amz-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            text-align: center;
            font-size: 0.9em;
            z-index: 1000;
        }
        
        .amz-footer a {
            color: #ffd700;
            text-decoration: none;
            font-weight: 600;
        }
        
        .cover {
            text-align: center;
            padding: 100px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin-bottom: 50px;
            page-break-after: always;
        }
        
        .cover h1 {
            color: white;
            font-size: 3em;
            margin-bottom: 20px;
            page-break-before: avoid;
        }
        
        .cover p {
            font-size: 1.2em;
            opacity: 0.9;
            margin: 15px 0;
        }
        
        .cover .emoji {
            font-size: 4em;
            margin: 20px 0;
        }
        
        .recipe {
            background: #f8f9fa;
            border-left: 5px solid #e74c3c;
            padding: 30px;
            margin: 40px 0;
            border-radius: 5px;
            page-break-inside: avoid;
        }
        
        .recipe-header {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
            font-size: 0.9em;
        }
        
        .recipe-meta {
            background: white;
            padding: 10px 15px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .nutrition {
            background: #e8f5e9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        
        .nutrition h4 {
            color: #2e7d32;
            margin-bottom: 10px;
        }
        
        .ingredients {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        
        .ingredients h4 {
            color: #e74c3c;
            margin-bottom: 15px;
        }
        
        .ingredients ul {
            list-style: none;
            padding-left: 0;
        }
        
        .ingredients li {
            padding: 8px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .ingredients li:before {
            content: "✓ ";
            color: #27ae60;
            font-weight: bold;
            margin-right: 10px;
        }
        
        .steps {
            counter-reset: step;
            list-style: none;
            padding-left: 0;
        }
        
        .steps h4 {
            color: #e74c3c;
            margin-bottom: 15px;
        }
        
        .steps li {
            counter-increment: step;
            margin-bottom: 20px;
            padding-left: 50px;
            position: relative;
        }
        
        .steps li:before {
            content: counter(step);
            position: absolute;
            left: 0;
            top: 0;
            background: #e74c3c;
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .tip-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        
        .tip-box strong {
            color: #856404;
            display: block;
            margin-bottom: 5px;
        }
        
        .warning-box {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        
        .warning-box strong {
            color: #721c24;
            display: block;
            margin-bottom: 5px;
        }
        
        .variations {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        
        .variations strong {
            color: #0d47a1;
            display: block;
            margin-bottom: 5px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border: 1px solid #dee2e6;
        }
        
        th {
            background: #e74c3c;
            color: white;
            font-weight: 600;
        }
        
        tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .toc {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 10px;
            margin: 40px 0;
            page-break-after: always;
        }
        
        .toc h2 {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .toc ul {
            list-style: none;
            padding-left: 20px;
        }
        
        .toc li {
            padding: 10px 0;
            border-bottom: 1px dotted #ccc;
        }
        
        .toc a {
            color: #2c3e50;
            text-decoration: none;
            display: flex;
            justify-content: space-between;
        }
        
        .toc a:hover {
            color: #e74c3c;
        }
        
        .chapter {
            page-break-before: always;
            margin-top: 40px;
        }
        
        .intro {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 10px;
            margin: 30px 0;
            line-height: 1.9;
        }
        
        .checklist {
            background: white;
            padding: 20px;
            border: 2px solid #e74c3c;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        .checklist ul {
            list-style: none;
            padding-left: 0;
        }
        
        .checklist li {
            padding: 10px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .checklist li:before {
            content: "☐ ";
            font-size: 1.3em;
            margin-right: 10px;
            color: #e74c3c;
        }
        
        @media print {
            body {
                max-width: 100%;
            }
            
            .recipe {
                page-break-inside: avoid;
            }
            
            .chapter {
                page-break-before: always;
            }
            
            .amz-footer {
                display: none;
            }
        }
        
        @media (max-width: 600px) {
            .cover h1 {
                font-size: 2em;
            }
            
            .recipe-header {
                flex-direction: column;
            }
            
            body {
                padding: 20px 15px 100px 15px;
            }
        }
    </style>
</head>
<body>

    <!-- CAPA -->
    <div class="cover">
        <div class="emoji">🍳</div>
        <p style="font-size: 1.8em; font-weight: bold; margin-bottom: 10px;">AMZ OFERTAS</p>
        <p style="font-size: 1em; opacity: 0.9;">Seu guia de compras inteligentes</p>
        <h1 style="margin-top: 30px;">50 RECEITAS AIRFRYER</h1>
        <p style="font-size: 1.5em; margin: 20px 0;">Do Básico ao Gourmet</p>
        <p style="font-size: 1.1em; margin-top: 30px;">Receitas testadas, aprovadas e deliciosas para você dominar sua Airfryer</p>
        <p style="font-size: 1em; margin-top: 50px; opacity: 0.8;">✨ Guia Completo e Gratuito ✨</p>
    </div>

    <!-- SUMÁRIO -->
    <div class="toc">
        <h2>📚 SUMÁRIO</h2>
        <ul>
            <li><a href="#cap1"><span>Capítulo 1: Introdução à Airfryer</span></a></li>
            <li><a href="#cap2"><span>Capítulo 2: 10 Dicas Essenciais de Ouro</span></a></li>
            <li><a href="#cap3"><span>Capítulo 3: Café da Manhã (5 receitas)</span></a></li>
            <li><a href="#cap4"><span>Capítulo 4: Entradas e Petiscos (10 receitas)</span></a></li>
            <li><a href="#cap5"><span>Capítulo 5: Pratos Principais (15 receitas)</span></a></li>
            <li><a href="#cap6"><span>Capítulo 6: Acompanhamentos (10 receitas)</span></a></li>
            <li><a href="#cap7"><span>Capítulo 7: Sobremesas (10 receitas)</span></a></li>
            <li><a href="#cap8"><span>Capítulo 8: Tabela de Referência Completa</span></a></li>
            <li><a href="#cap9"><span>Capítulo 9: Limpeza e Manutenção</span></a></li>
            <li><a href="#cap10"><span>Capítulo 10: Conclusão</span></a></li>
        </ul>
    </div>

    <!-- CAPÍTULO 1 -->
    <div class="chapter" id="cap1">
        <h1>Capítulo 1: Introdução à Airfryer</h1>
        
        <div class="intro">
            <p>Bem-vindo ao universo mágico da Airfryer! Se você está aqui, provavelmente já ouviu falar dos benefícios deste eletrodoméstico revolucionário que conquistou cozinhas do mundo todo.</p>
            
            <p style="margin-top: 20px;">A Airfryer utiliza um sistema de circulação de ar quente em alta velocidade para cozinhar os alimentos. Isso significa que você pode obter aquela crocância irresistível de frituras tradicionais usando até <strong>80% menos gordura</strong>.</p>
            
            <h3 style="margin-top: 30px;">Como Funciona?</h3>
            
            <p>Um elemento de aquecimento na parte superior gera calor intenso (até 200°C), enquanto um ventilador potente distribui esse ar quente uniformemente ao redor dos alimentos. Este processo cria o efeito Maillard - a reação química responsável por dourar e criar crostas crocantes.</p>
            
            <h3 style="margin-top: 30px;">Benefícios Reais:</h3>
            
            <p><strong>1. Redução de Gordura:</strong> Batata frita tradicional tem 15-20g de gordura por porção. Na Airfryer: apenas 3-5g!</p>
            
            <p><strong>2. Economia de Tempo:</strong> Pré-aquece em 3-5 minutos (vs 10-15 min do forno) e cozinha mais rápido.</p>
            
            <p><strong>3. Versatilidade:</strong> Frite, asse, grille, refogue e até desidrate alimentos.</p>
            
            <p><strong>4. Limpeza Fácil:</strong> Nada de óleo espalhado. A maioria das cestas é antiaderente.</p>
            
            <p><strong>5. Economia de Energia:</strong> Consome até 50% menos energia que forno convencional.</p>
            
            <div class="warning-box" style="margin-top: 30px;">
                <strong>⚠️ O Que NÃO Fazer:</strong>
                <p>❌ Nunca encha a cesta até a borda - o ar precisa circular!</p>
                <p>❌ Não use spray de cozinha comum - danifica o antiaderente</p>
                <p>❌ Nunca cubra os furos de ventilação com papel alumínio</p>
                <p>❌ Não cozinhe alimentos com muito líquido solto</p>
            </div>
        </div>
    </div>

    <!-- CAPÍTULO 2 -->
    <div class="chapter" id="cap2">
        <h1>Capítulo 2: 10 Dicas Essenciais de Ouro</h1>

        <div class="recipe" style="background: #e8f5e9;">
            <h3>💡 DICA #1: Preaquecer É CRUCIAL</h3>
            <p>Ligue a Airfryer vazia por 3-5 minutos antes de adicionar os alimentos. Garante cozimento uniforme e crocância desde o primeiro segundo.</p>
        </div>

        <div class="recipe" style="background: #fff3cd;">
            <h3>💡 DICA #2: Chacoalhe na Metade</h3>
            <p>Alimentos pequenos (batatas, nuggets) precisam ser chacoalhados na metade do tempo para dourar uniformemente.</p>
        </div>

        <div class="recipe" style="background: #e3f2fd;">
            <h3>💡 DICA #3: Spray de Óleo É Seu Amigo</h3>
            <p>Um pouquinho de óleo ajuda no douramento. Use spray culinário ou borrifador com azeite. 2-3 borrifadas são suficientes.</p>
        </div>

        <div class="recipe" style="background: #f3e5f5;">
            <h3>💡 DICA #4: Espaço = Crocância</h3>
            <p>Deixe pelo menos 1cm entre cada pedaço. Se empilhar, bloqueia circulação de ar e fica empapado.</p>
        </div>

        <div class="recipe" style="background: #fce4ec;">
            <h3>💡 DICA #5: Temperatura Alta = Crocância</h3>
            <p>🔥 180-200°C: Crocância (batatas, frango empanado)<br>🌡️ 160-170°C: Suculência (peito de frango, peixe)<br>❄️ 120-140°C: Desidratar ou aquecer</p>
        </div>

        <div class="recipe" style="background: #e8eaf6;">
            <h3>💡 DICA #6: Seque Bem os Alimentos</h3>
            <p>Umidade é inimiga da crocância. Seque vegetais e carnes com papel toalha antes de temperar.</p>
        </div>

        <div class="recipe" style="background: #fff8e1;">
            <h3>💡 DICA #7: Use Papel Manteiga com Furos</h3>
            <p>Evita que alimentos grudem e facilita a limpeza. Importante: deixe furos para circulação de ar!</p>
        </div>

        <div class="recipe" style="background: #e0f7fa;">
            <h3>💡 DICA #8: Não Abra Demais</h3>
            <p>Cada vez que abre, perde calor e tempo. Programe timer e só abra quando necessário.</p>
        </div>

        <div class="recipe" style="background: #f1f8e9;">
            <h3>💡 DICA #9: Carnes - Descanse Antes de Cortar</h3>
            <p>Após assar, deixe a carne descansar 5 minutos antes de fatiar. Os sucos se redistribuem.</p>
        </div>

        <div class="recipe" style="background: #ede7f6;">
            <h3>💡 DICA #10: Limpe Logo Após Usar</h3>
            <p>Gordura quente sai muito mais fácil que fria e grudada. Limpe enquanto ainda morno!</p>
        </div>
    </div>

    <!-- CAPÍTULO 3: CAFÉ DA MANHÃ -->
    <div class="chapter" id="cap3">
        <h1>Capítulo 3: Café da Manhã</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">5 receitas deliciosas para começar o dia! ☕</p>

        <!-- RECEITA 1 -->
        <div class="recipe">
            <h3>🥐 1. PÃO DE QUEIJO CROCANTE</h3>
            
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 minutos</div>
                <div class="recipe-meta">🌡️ 180°C</div>
                <div class="recipe-meta">👥 15 unidades</div>
            </div>

            <div class="ingredients">
                <h4>🛒 INGREDIENTES:</h4>
                <ul>
                    <li>500g de polvilho azedo</li>
                    <li>250ml de leite integral</li>
                    <li>100ml de óleo</li>
                    <li>2 ovos grandes</li>
                    <li>200g de queijo parmesão ralado</li>
                    <li>1 colher (chá) de sal</li>
                </ul>
            </div>

            <div class="steps">
                <h4>👨‍🍳 MODO DE PREPARO:</h4>
                <ol class="steps">
                    <li>Aqueça leite e óleo até ferver. Despeje sobre o polvilho e mexa até formar massa homogênea.</li>
                    <li>Deixe esfriar 10 minutos. Adicione ovos um a um, misturando bem.</li>
                    <li>Incorpore queijo e sal. Modele bolinhas de 3cm.</li>
                    <li>Preaqueça Airfryer a 180°C. Asse por 12 minutos sem abrir.</li>
                </ol>
            </div>

            <div class="tip-box">
                <strong>💡 DICA:</strong>
                <p>Massa pode ser refrigerada por 2 dias ou congelada por 3 meses. Asse direto do freezer (+3 min).</p>
            </div>
        </div>

        <!-- RECEITA 2 -->
        <div class="recipe">
            <h3>🍳 2. OVOS PERFEITOS (4 Estilos)</h3>
            
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 6-15 min</div>
                <div class="recipe-meta">🌡️ 160°C</div>
            </div>

            <h4 style="color: #e74c3c; margin: 20px 0;">OVO COZIDO:</h4>
            <p>Coloque ovos direto na cesta. Gema mole: 9-10min | Cremosa: 11-12min | Dura: 15min. Transfira para água gelada.</p>

            <h4 style="color: #e74c3c; margin: 20px 0;">OVO FRITO:</h4>
            <p>Quebre ovo em forminha de silicone untada. 6-7min para clara firme e gema mole.</p>

            <h4 style="color: #e74c3c; margin: 20px 0;">OVOS MEXIDOS:</h4>
            <p>Bata 4 ovos + 2 col. leite. Despeje em forminha. 8min, mexa, mais 3-4min.</p>
        </div>

        <!-- RECEITA 3 -->
        <div class="recipe">
            <h3>🥓 3. BACON EXTRA CROCANTE</h3>
            
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 10 minutos</div>
                <div class="recipe-meta">🌡️ 200°C</div>
                <div class="recipe-meta">👥 8 fatias</div>
            </div>

            <div class="steps">
                <h4>👨‍🍳 MODO DE PREPARO:</h4>
                <ol class="steps">
                    <li>Preaqueça a 200°C. Arrume fatias em camada única.</li>
                    <li>Asse 5 minutos. Vire com pinça.</li>
                    <li>Asse mais 3-5 min dependendo da crocância.</li>
                    <li>Retire e coloque em papel toalha. Ficará ainda mais crocante ao esfriar!</li>
                </ol>
            </div>
        </div>

        <!-- RECEITA 4 -->
        <div class="recipe">
            <h3>🥞 4. PANQUECAS AMERICANAS</h3>
            
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 minutos</div>
                <div class="recipe-meta">🌡️ 180°C</div>
                <div class="recipe-meta">👥 8 panquecas</div>
            </div>

            <div class="ingredients">
                <h4>🛒 INGREDIENTES:</h4>
                <ul>
                    <li>240g farinha de trigo</li>
                    <li>2 col. (sopa) açúcar</li>
                    <li>1 col. (sopa) fermento em pó</li>
                    <li>300ml leite</li>
                    <li>1 ovo</li>
                    <li>3 col. (sopa) manteiga derretida</li>
                </ul>
            </div>

            <p><strong>Preparo:</strong> Misture secos. Misture líquidos. Combine SUAVEMENTE (deixe grumos). Despeje círculos em papel manteiga furado. 7min, vire, mais 3min.</p>
        </div>

        <!-- RECEITA 5 -->
        <div class="recipe">
            <h3>🍞 5. TORRADA FRANCESA</h3>
            
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 10 minutos</div>
                <div class="recipe-meta">🌡️ 180°C</div>
                <div class="recipe-meta">👥 4 fatias</div>
            </div>

            <p>Bata 2 ovos + 100ml leite + canela + baunilha. Mergulhe fatias de pão. Asse 5min de cada lado. Sirva com mel!</p>
        </div>
    </div>

    <!-- CAPÍTULO 4: ENTRADAS -->
    <div class="chapter" id="cap4">
        <h1>Capítulo 4: Entradas e Petiscos</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">10 receitas para impressionar! 🎉</p>

        <div class="recipe">
            <h3>🍟 6. BATATA FRITA PERFEITA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 25-30 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p><strong>Segredo:</strong> Corte em palitos uniformes. Deixe de molho em água fria 30min. Ferva 5min. Seque bem. Regue com azeite. Asse 10min, chacoalhe, mais 10min, chacoalhe, mais 5-8min.</p>
        </div>

        <div class="recipe">
            <h3>🧀 7. PALITOS DE MUSSARELA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min (+ 30 min freezer)</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Corte queijo em palitos. Passe farinha → ovo → farinha de rosca DUAS VEZES. Congele 30min. Borrife óleo. Asse 6min, vire, mais 6min.</p>
        </div>

        <div class="recipe">
            <h3>🍄 8. CHAMPIGNONS RECHEADOS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Limpe champignons (não lave!). Retire talos e pique. Refogue com bacon. Misture com cream cheese + parmesão. Recheie e asse 15min.</p>
        </div>

        <div class="recipe">
            <h3>🍗 9. NUGGETS CASEIROS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Processe 600g peito de frango + ovo + cream cheese + temperos. Modele, empane (farinha + ovo + farinha de rosca + corn flakes). Congele 15min. Borrife óleo. Asse 7min de cada lado.</p>
        </div>

        <div class="recipe">
            <h3>🦐 10. CAMARÃO EMPANADO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Marine camarões em limão + alho. Empane com panko. Borrife óleo generosamente. Asse 5min de cada lado.</p>
        </div>

        <div class="recipe">
            <h3>🥟 11. COXINHA DE FRANGO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Modele massa de batata com recheio de frango. Empane bem. Borrife óleo. Asse 18min virando na metade.</p>
        </div>

        <div class="recipe">
            <h3>🧆 12. BOLINHO DE BACALHAU</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 190°C</div>
            </div>
            <p>Misture bacalhau desfiado + batata + ovo + salsinha. Modele bolinhos. Borrife óleo. Asse 10min de cada lado.</p>
        </div>

        <div class="recipe">
            <h3>🌶️ 13. JALAPEÑO POPPERS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Corte jalapeños ao meio. Recheie com cream cheese + cheddar + bacon. Empane. Asse 15min.</p>
        </div>

        <div class="recipe">
            <h3>🥔 14. MINI BATATAS RECHEADAS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 35 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Asse batatas bolinha 25min. Corte ao meio, retire um pouco da polpa, recheie com queijo + bacon + cebolinha. Asse mais 10min.</p>
        </div>

        <div class="recipe">
            <h3>🧆 15. FALAFEL CROCANTE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18 min</div>
                <div class="recipe-meta">🌡️ 190°C</div>
            </div>
            <p>Processe grão-de-bico + alho + cebola + salsinha + cominho. Modele bolinhas, borrife óleo. Asse 18min chacoalhando na metade.</p>
        </div>
    </div>

    <!-- CAPÍTULO 5: PRATOS PRINCIPAIS -->
    <div class="chapter" id="cap5">
        <h1>Capítulo 5: Pratos Principais</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">15 receitas do básico ao gourmet! 🍽️</p>

        <div class="recipe">
            <h3>🍗 16. FRANGO CROCANTE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 25 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Tempere sobrecoxas com páprica, alho, sal. Marine 30min. Asse pele para cima 25min.</p>
        </div>

        <div class="recipe">
            <h3>🥩 17. PICANHA PERFEITA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12-15 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Tempere apenas com sal grosso. Gordura para cima. Mal passada: 12min. Ao ponto: 15min. Descanse 5min antes de fatiar.</p>
        </div>

        <div class="recipe">
            <h3>🐟 18. SALMÃO COM CROSTA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Pincele mostarda + mel no filé. Cubra com farinha de rosca + ervas. Asse pele para baixo, não vire.</p>
        </div>

        <div class="recipe">
            <h3>🍖 19. COSTELINHA BBQ</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 35 min</div>
                <div class="recipe-meta">🌡️ 160°C + 200°C</div>
            </div>
            <p>Tempere costela. Asse a 160°C por 30min. Pincele molho BBQ. Aumente para 200°C por 5min para caramelizar.</p>
        </div>

        <div class="recipe">
            <h3>🍔 20. HAMBÚRGUER ARTESANAL</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 14 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Modele hambúrgueres de 150g. Não aperte a carne! Asse 6min, vire, adicione queijo, mais 6min.</p>
        </div>

        <div class="recipe">
            <h3>🐔 21. PEITO DE FRANGO SUCULENTO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18-22 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Bata o peito para ficar uniforme. Marine em azeite + ervas. Asse virando na metade. Temp. interna: 75°C.</p>
        </div>

        <div class="recipe">
            <h3>🐟 22. TILÁPIA EMPANADA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Tempere com limão. Empane (farinha + ovo + farinha de rosca). Borrife óleo. Asse 6min de cada lado.</p>
        </div>

        <div class="recipe">
            <h3>🍖 23. LINGUIÇA CALABRESA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Fure com garfo. Adicione cebola em rodelas. Asse 18min virando na metade.</p>
        </div>

        <div class="recipe">
            <h3>🥩 24. FILÉ MIGNON</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Tempere com sal e pimenta. Sele em frigideira quente 1min cada lado. Transfira para Airfryer por 10min.</p>
        </div>

        <div class="recipe">
            <h3>🍗 25. ASA DE FRANGO BUFFALO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 25 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Tempere asas com sal e alho. Asse 25min chacoalhando 2x. Misture com molho buffalo ao final.</p>
        </div>

        <div class="recipe">
            <h3>🐟 26. BACALHAU À PORTUGUESA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Dessalgue bacalhau. Monte com batatas, cebola, pimentão, azeitonas. Regue com azeite. Asse 20min.</p>
        </div>

        <div class="recipe">
            <h3>🥩 27. BIFE À PARMEGIANA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Empane bifes (farinha + ovo + farinha de rosca). Asse 12min. Cubra com molho e queijo. Asse mais 8min.</p>
        </div>

        <div class="recipe">
            <h3>🍗 28. COXÃO DURO ASSADO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 45 min</div>
                <div class="recipe-meta">🌡️ 160°C</div>
            </div>
            <p>Tempere carne e asse lentamente a 160°C por 45min. Deixe descansar 10min antes de fatiar.</p>
        </div>

        <div class="recipe">
            <h3>🐟 29. PEIXE INTEIRO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 25 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Faça cortes no peixe. Recheie com limão e ervas. Pincele azeite. Asse 25min.</p>
        </div>

        <div class="recipe">
            <h3>🍖 30. ESPETINHO DE CARNE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Monte espetinhos com cubos de carne, pimentão, cebola. Tempere. Asse 15min virando na metade.</p>
        </div>
    </div>

    <!-- CAPÍTULO 6: ACOMPANHAMENTOS -->
    <div class="chapter" id="cap6">
        <h1>Capítulo 6: Acompanhamentos</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">10 guarnições perfeitas! 🥗</p>

        <div class="recipe">
            <h3>🥦 31. BRÓCOLIS CROCANTE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Corte em floretes, seque bem. Regue com azeite + alho. Asse 8min, chacoalhe, mais 7min. Finalize com limão e parmesão.</p>
        </div>

        <div class="recipe">
            <h3>🥕 32. LEGUMES ASSADOS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 190°C</div>
            </div>
            <p>Corte cenoura, abobrinha, pimentão em pedaços. Regue com azeite + mel + ervas. Asse 20min.</p>
        </div>

        <div class="recipe">
            <h3>🥔 33. BATATA RÚSTICA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 25 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Corte batatas em gomos com casca. Regue com azeite + alecrim. Asse 25min chacoalhando na metade.</p>
        </div>

        <div class="recipe">
            <h3>🍠 34. BATATA DOCE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 30 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Corte em cubos ou palitos. Regue com azeite + canela ou páprica. Asse 30min.</p>
        </div>

        <div class="recipe">
            <h3>🥬 35. COUVE-FLOR GRATINADA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Asse floretes 12min. Cubra com molho branco + queijo. Gratine mais 6min a 200°C.</p>
        </div>

        <div class="recipe">
            <h3>🍆 36. BERINJELA À PARMEGIANA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 190°C</div>
            </div>
            <p>Corte rodelas, pincele azeite. Asse 10min. Adicione molho + queijo. Asse mais 10min.</p>
        </div>

        <div class="recipe">
            <h3>🌽 37. ESPIGA DE MILHO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Pincele manteiga + ervas. Asse 15min virando na metade. Finalize com parmesão.</p>
        </div>

        <div class="recipe">
            <h3>🥒 38. ABOBRINHA CHIPS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Fatie bem fina. Seque com papel. Tempere com sal + ervas. Borrife óleo. Asse 15min.</p>
        </div>

        <div class="recipe">
            <h3>🥕 39. CENOURA GLACEADA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 18 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Use cenoura baby ou palitos. Regue com manteiga + mel. Asse 18min.</p>
        </div>

        <div class="recipe">
            <h3>🥦 40. COUVE CHIPS (LOW CARB)</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 8 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Rasgue folhas em pedaços. Seque MUITO BEM. Regue levemente com azeite + sal. Asse 8min.</p>
        </div>
    </div>

    <!-- CAPÍTULO 7: SOBREMESAS -->
    <div class="chapter" id="cap7">
        <h1>Capítulo 7: Sobremesas</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">10 doces irresistíveis! 🍰</p>

        <div class="recipe">
            <h3>🍪 41. COOKIES DE CHOCOLATE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 10 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>120g farinha + 100g manteiga + 80g açúcar mascavo + 40g açúcar + 1 ovo + 150g gotas chocolate. Bolinhas achatadas, 4 por vez. Centro ainda mole ao sair = perfeição!</p>
        </div>

        <div class="recipe">
            <h3>🍫 42. BROWNIES ÚMIDOS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 160°C</div>
            </div>
            <p>Derreta 150g chocolate + 100g manteiga. Misture 150g açúcar + 2 ovos + 50g farinha + 30g cacau. Asse em forminha pequena.</p>
        </div>

        <div class="recipe">
            <h3>🍌 43. BANANA CARAMELIZADA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Corte banana ao meio. Polvilhe açúcar mascavo + canela. Asse 12min. Sirva com sorvete!</p>
        </div>

        <div class="recipe">
            <h3>🍎 44. MAÇÃ ASSADA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 20 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Retire miolo da maçã. Recheie com aveia + mel + canela + nozes. Asse 20min até ficar macia.</p>
        </div>

        <div class="recipe">
            <h3>🥧 45. CHURROS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 190°C</div>
            </div>
            <p>Ferva 250ml água + 50g manteiga. Adicione 150g farinha de uma vez, mexa até soltar. Esfrie, adicione 2 ovos. Modele com saco de confeiteiro. Asse 15min. Passe em açúcar + canela.</p>
        </div>

        <div class="recipe">
            <h3>🍰 46. BOLO DE CANECA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 8 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>3 col. farinha + 2 col. açúcar + 1 col. cacau + 1 ovo + 2 col. leite + 1 col. óleo. Misture na caneca. Asse 8min.</p>
        </div>

        <div class="recipe">
            <h3>🍩 47. DONUTS ASSADOS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 10 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>200g farinha + 50g açúcar + 1 ovo + 100ml leite + fermento. Modele, asse 10min. Mergulhe em chocolate derretido.</p>
        </div>

        <div class="recipe">
            <h3>🥮 48. PETIT GATEAU</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 10 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Derreta 60g chocolate + 60g manteiga. Misture 50g açúcar + 1 ovo + 1 gema + 20g farinha. Asse em ramequin untado 8-10min. Centro deve estar cremoso!</p>
        </div>

        <div class="recipe">
            <h3>🍓 49. FRUTAS GRELHADAS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 8 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Corte pêssego, manga ou abacaxi em fatias. Pincele mel. Asse 8min. Sirva com iogurte grego.</p>
        </div>

        <div class="recipe">
            <h3>🥐 50. CROISSANT RECHEADO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 8 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Abra croissant pronto, recheie com Nutella + banana ou presunto + queijo. Feche e asse 8min.</p>
        </div>
    </div>

    <!-- CAPÍTULO 8: TABELA DE REFERÊNCIA -->
    <div class="chapter" id="cap8">
        <h1>Capítulo 8: Tabela de Referência</h1>

        <h3>🍖 CARNES</h3>
        <table>
            <tr><th>Alimento</th><th>Temperatura</th><th>Tempo</th></tr>
            <tr><td>Frango (peito)</td><td>180°C</td><td>18-22 min</td></tr>
            <tr><td>Frango (coxa)</td><td>200°C</td><td>25-30 min</td></tr>
            <tr><td>Picanha</td><td>200°C</td><td>12-15 min</td></tr>
            <tr><td>Filé Mignon</td><td>200°C</td><td>10-14 min</td></tr>
            <tr><td>Costelinha</td><td>160°C</td><td>35-40 min</td></tr>
            <tr><td>Hambúrguer</td><td>180°C</td><td>12-14 min</td></tr>
            <tr><td>Bacon</td><td>200°C</td><td>8-10 min</td></tr>
        </table>

        <h3>🐟 PEIXES</h3>
        <table>
            <tr><th>Alimento</th><th>Temperatura</th><th>Tempo</th></tr>
            <tr><td>Salmão</td><td>180°C</td><td>10-12 min</td></tr>
            <tr><td>Tilápia</td><td>180°C</td><td>10-12 min</td></tr>
            <tr><td>Peixe empanado</td><td>200°C</td><td>12-15 min</td></tr>
            <tr><td>Camarão</td><td>200°C</td><td>8-10 min</td></tr>
        </table>

        <h3>🥔 VEGETAIS</h3>
        <table>
            <tr><th>Alimento</th><th>Temperatura</th><th>Tempo</th></tr>
            <tr><td>Batata frita</td><td>200°C</td><td>25-30 min</td></tr>
            <tr><td>Batata rústica</td><td>200°C</td><td>20-25 min</td></tr>
            <tr><td>Brócolis</td><td>200°C</td><td>12-15 min</td></tr>
            <tr><td>Couve-flor</td><td>180°C</td><td>15-18 min</td></tr>
            <tr><td>Abobrinha</td><td>180°C</td><td>12-15 min</td></tr>
        </table>

        <h3>🍰 SOBREMESAS</h3>
        <table>
            <tr><th>Alimento</th><th>Temperatura</th><th>Tempo</th></tr>
            <tr><td>Cookies</td><td>180°C</td><td>8-10 min</td></tr>
            <tr><td>Brownies</td><td>160°C</td><td>18-20 min</td></tr>
            <tr><td>Bolo</td><td>160°C</td><td>25-30 min</td></tr>
        </table>
    </div>

    <!-- CAPÍTULO 9: LIMPEZA -->
    <div class="chapter" id="cap9">
        <h1>Capítulo 9: Limpeza e Manutenção</h1>

        <div class="recipe">
            <h4>🧼 LIMPEZA DIÁRIA:</h4>
            <ol style="line-height: 2;">
                <li>Desconecte e deixe esfriar 15-20 minutos</li>
                <li>Retire cesta e bandeja</li>
                <li>Lave com água morna e detergente neutro</li>
                <li>Use esponja MACIA (nunca aço!)</li>
                <li>Seque completamente antes de guardar</li>
            </ol>
        </div>

        <div class="warning-box">
            <strong>⚠️ NUNCA FAÇA:</strong>
            <p>❌ Mergulhar unidade principal em água</p>
            <p>❌ Usar esponja de aço ou produtos abrasivos</p>
            <p>❌ Limpar ainda quente</p>
            <p>❌ Guardar com partes úmidas</p>
        </div>

        <div class="tip-box">
            <strong>💡 DICAS:</strong>
            <p>• Use forros de silicone ou papel manteiga furado</p>
            <p>• Coloque 2-3 col. água no fundo para alimentos gordurosos</p>
            <p>• Bicarbonato + água remove gordura difícil</p>
            <p>• Vinagre branco elimina odores</p>
        </div>
    </div>

    <!-- CAPÍTULO 10: CONCLUSÃO -->
    <div class="chapter" id="cap10">
        <h1>Capítulo 10: Conclusão</h1>

        <div class="intro">
            <p>🎉 <strong>Parabéns!</strong> Você agora tem em mãos 50 receitas testadas e aprovadas para dominar sua Airfryer!</p>
            
            <p style="margin-top: 20px;">A Airfryer não é só um eletrodoméstico - é uma ferramenta que democratiza a boa comida. Com ela, qualquer pessoa pode criar refeições deliciosas, mais saudáveis e em menos tempo.</p>
            
            <p style="margin-top: 20px;"><strong>Próximos passos:</strong></p>
            <ul style="margin-left: 20px; line-height: 2;">
                <li>Experimente 1 receita nova por semana</li>
                <li>Adapte suas receitas favoritas (reduz temp 20°C e tempo 25%)</li>
                <li>Anote suas descobertas</li>
                <li>Seja criativo!</li>
            </ul>
        </div>

        <div class="recipe" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 40px; margin-top: 40px;">
            <h3 style="color: white;">💜 OBRIGADO POR FAZER PARTE DA AMZ OFERTAS!</h3>
            <p style="margin-top: 20px; opacity: 0.9;">
                Este eBook foi criado especialmente para você. Continue acompanhando nossas ofertas para mais conteúdos exclusivos!
            </p>
            <p style="margin-top: 30px; font-size: 1.2em;">
                <strong>Bom apetite e ótimas airfryadas! 🍳❤️</strong>
            </p>
        </div>
    </div>

    <!-- FOOTER AMZ -->
    <div class="amz-footer">
        📚 eBook exclusivo <strong>AMZ Ofertas</strong> | Garimpamos as melhores ofertas pra você!
    </div>

</body>
</html>`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  // Serve the eBook HTML
  return new Response(ebookHTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
