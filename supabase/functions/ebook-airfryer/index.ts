import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// eBook "50 Receitas Airfryer" - Conteúdo completo para ENTREGA ao cliente
// ESTE É O EBOOK DE RECEITAS, NÃO A PÁGINA DE CAPTAÇÃO
const ebookHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>50 Receitas Airfryer - Do Básico ao Gourmet</title>
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Open Sans', sans-serif; line-height: 1.8; color: #333; background: #fff; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1, h2, h3 { font-family: 'Merriweather', serif; color: #2c3e50; margin: 30px 0 20px; }
        h1 { font-size: 2.5em; text-align: center; color: #e74c3c; }
        h2 { font-size: 1.8em; border-bottom: 3px solid #e74c3c; padding-bottom: 10px; }
        h3 { font-size: 1.3em; color: #34495e; }
        .cover { text-align: center; padding: 100px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; margin-bottom: 50px; }
        .cover h1 { color: white; font-size: 3em; margin-bottom: 20px; }
        .cover p { font-size: 1.2em; opacity: 0.9; margin: 15px 0; }
        .cover .emoji { font-size: 4em; margin: 20px 0; }
        .recipe { background: #f8f9fa; border-left: 5px solid #e74c3c; padding: 30px; margin: 40px 0; border-radius: 5px; }
        .recipe-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; font-size: 0.9em; }
        .recipe-meta { background: white; padding: 10px 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .nutrition { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .nutrition h4 { color: #2e7d32; margin-bottom: 10px; }
        .ingredients { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .ingredients h4 { color: #e74c3c; margin-bottom: 15px; }
        .ingredients ul { list-style: none; padding-left: 0; }
        .ingredients li { padding: 8px 0; border-bottom: 1px solid #ecf0f1; }
        .ingredients li:before { content: "✓ "; color: #27ae60; font-weight: bold; margin-right: 10px; }
        .steps { counter-reset: step; list-style: none; padding-left: 0; }
        .steps h4 { color: #e74c3c; margin-bottom: 15px; }
        .steps li { counter-increment: step; margin-bottom: 20px; padding-left: 50px; position: relative; }
        .steps li:before { content: counter(step); position: absolute; left: 0; top: 0; background: #e74c3c; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .tip-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .tip-box strong { color: #856404; display: block; margin-bottom: 5px; }
        .warning-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .warning-box strong { color: #721c24; display: block; margin-bottom: 5px; }
        .variations { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .variations strong { color: #0d47a1; display: block; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
        th, td { padding: 12px; text-align: left; border: 1px solid #dee2e6; }
        th { background: #e74c3c; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #f8f9fa; }
        .toc { background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 40px 0; }
        .toc h2 { text-align: center; margin-bottom: 30px; }
        .toc ul { list-style: none; padding-left: 20px; }
        .toc li { padding: 10px 0; border-bottom: 1px dotted #ccc; }
        .toc a { color: #2c3e50; text-decoration: none; display: flex; justify-content: space-between; }
        .toc a:hover { color: #e74c3c; }
        .chapter { margin-top: 40px; }
        .intro { background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 30px 0; line-height: 1.9; }
        .checklist { background: white; padding: 20px; border: 2px solid #e74c3c; border-radius: 10px; margin: 20px 0; }
        .checklist ul { list-style: none; padding-left: 0; }
        .checklist li { padding: 10px 0; border-bottom: 1px solid #ecf0f1; }
        .checklist li:before { content: "☐ "; font-size: 1.3em; margin-right: 10px; color: #e74c3c; }
        @media print { body { max-width: 100%; } .recipe { page-break-inside: avoid; } .chapter { page-break-before: always; } }
    </style>
</head>
<body>
    <div class="cover">
        <div class="emoji">🍳</div>
        <h1>50 RECEITAS AIRFRYER</h1>
        <p style="font-size: 1.5em; margin: 20px 0;">Do Básico ao Gourmet</p>
        <p style="font-size: 1.1em; margin-top: 30px;">Receitas testadas, aprovadas e deliciosas para você dominar sua Airfryer</p>
        <p style="font-size: 1em; margin-top: 50px; opacity: 0.8;">✨ Guia Completo e Gratuito ✨</p>
    </div>

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

    <div class="chapter" id="cap3">
        <h1>Capítulo 3: Café da Manhã</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">5 receitas deliciosas para começar o dia! ☕</p>
        
        <div class="recipe">
            <h3>🥐 1. PÃO DE QUEIJO CROCANTE</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
                <div class="recipe-meta">👥 15 unidades</div>
            </div>
            <div class="ingredients">
                <h4>🛒 INGREDIENTES:</h4>
                <ul>
                    <li>500g de polvilho azedo</li>
                    <li>250ml de leite integral</li>
                    <li>100ml de óleo de canola</li>
                    <li>2 ovos grandes</li>
                    <li>200g de queijo parmesão ralado</li>
                    <li>1 colher (chá) de sal</li>
                </ul>
            </div>
            <div class="steps">
                <h4>👨‍🍳 MODO DE PREPARO:</h4>
                <ol class="steps">
                    <li>Aqueça o leite e o óleo até ferver. Despeje sobre o polvilho e mexa bem.</li>
                    <li>Deixe esfriar 10 minutos. Adicione os ovos um de cada vez.</li>
                    <li>Incorpore o queijo e o sal. Modele bolinhas de 3cm.</li>
                    <li>Preaqueça a Airfryer a 180°C por 3 minutos.</li>
                    <li>Asse por 12 minutos até dourar. Sirva quente!</li>
                </ol>
            </div>
            <div class="tip-box">
                <strong>💡 DICA:</strong> Bolinhas cruas congelam bem - vão direto do freezer para Airfryer (adicione 3 min).
            </div>
        </div>

        <div class="recipe">
            <h3>🍳 2. OVOS NA AIRFRYER (4 Estilos)</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 6-15 min</div>
                <div class="recipe-meta">🌡️ 160°C</div>
            </div>
            <p><strong>OVO COZIDO:</strong> 160°C - Gema mole: 10min | Gema cremosa: 12min | Gema dura: 15min. Após, mergulhe em água gelada.</p>
            <p><strong>OVO FRITO:</strong> 160°C em forminha de silicone untada, 7min para gema mole.</p>
            <p><strong>OVOS MEXIDOS:</strong> Bata 4 ovos + 2 col leite em forminha, 160°C por 8min, mexa, mais 3min.</p>
        </div>

        <div class="recipe">
            <h3>🥞 3. PANQUECAS AMERICANAS</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 15 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
                <div class="recipe-meta">👥 8 panquecas</div>
            </div>
            <p>Misture 240g farinha + 2 col açúcar + 1 col fermento + sal. Adicione 300ml leite + 1 ovo + 3 col manteiga derretida. Use papel manteiga com furos, asse 7min, vire, mais 3min.</p>
        </div>

        <div class="recipe">
            <h3>🥓 4. BACON CROCANTE PERFEITO</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 10 min</div>
                <div class="recipe-meta">🌡️ 200°C</div>
            </div>
            <p>Coloque as fatias sem sobrepor. 200°C por 8-10min dependendo da grossura. Resultado: crocante e uniforme!</p>
        </div>

        <div class="recipe">
            <h3>🍞 5. TORRADA FRANCESA</h3>
            <div class="recipe-header">
                <div class="recipe-meta">⏰ 12 min</div>
                <div class="recipe-meta">🌡️ 180°C</div>
            </div>
            <p>Misture 2 ovos + 100ml leite + canela + baunilha. Mergulhe fatias de pão. 180°C por 6min cada lado. Sirva com mel!</p>
        </div>
    </div>

    <div class="chapter" id="cap4">
        <h1>Capítulo 4: Entradas e Petiscos</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">10 receitas para aperitivos irresistíveis! 🎉</p>
        
        <div class="recipe">
            <h3>🍗 1. COXINHA DE FRANGO</h3>
            <p>180°C, 15min. Borrife óleo para dourar. Congele antes de assar para melhor formato.</p>
        </div>
        <div class="recipe">
            <h3>🧀 2. BOLINHA DE QUEIJO</h3>
            <p>200°C, 10min. Dupla camada de empanado é essencial. 30min no freezer antes de assar.</p>
        </div>
        <div class="recipe">
            <h3>🥟 3. PASTEL DE FEIRA</h3>
            <p>200°C, 12min (vire na metade). Massa comprada ou caseira, borrife óleo.</p>
        </div>
        <div class="recipe">
            <h3>🌭 4. MINI HOT DOGS</h3>
            <p>180°C, 8min. Enrole salsichas em massa de pastel ou pão de forma.</p>
        </div>
        <div class="recipe">
            <h3>🍟 5. DADINHOS DE TAPIOCA</h3>
            <p>200°C, 15min. Congele a tapioca antes de cortar em cubos.</p>
        </div>
        <div class="recipe">
            <h3>🍗 6. COXAS DE FRANGO TEMPERADAS</h3>
            <p>200°C, 22min total (vire aos 12min). Seque bem a pele para crocância!</p>
        </div>
        <div class="recipe">
            <h3>🍟 7. BATATA FRITA CROCANTE</h3>
            <p>200°C, 25min (chacoalhe 2x). Segredo: deixe de molho 20min, ferva 5min, seque bem, congele 15min antes de assar.</p>
        </div>
        <div class="recipe">
            <h3>🧀 8. PALITOS DE MUSSARELA</h3>
            <p>200°C, 12min. Dupla camada de empanado + 30min freezer obrigatório!</p>
        </div>
        <div class="recipe">
            <h3>🍄 9. CHAMPIGNONS RECHEADOS</h3>
            <p>180°C, 18min. Recheie com cream cheese + bacon + parmesão.</p>
        </div>
        <div class="recipe">
            <h3>🍗 10. NUGGETS CASEIROS</h3>
            <p>200°C, 14min (vire aos 7min). Frango batido + temperos + empanado duplo.</p>
        </div>
    </div>

    <div class="chapter" id="cap5">
        <h1>Capítulo 5: Pratos Principais</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">15 receitas para refeições completas! 🍽️</p>
        
        <div class="recipe">
            <h3>🍗 1. PEITO DE FRANGO SUCULENTO</h3>
            <p>170°C, 18min. Marine 30min com azeite + ervas. Não passe de 75°C interno.</p>
        </div>
        <div class="recipe">
            <h3>🥩 2. PICANHA PERFEITA</h3>
            <p>200°C, 15min total. Gordura para baixo primeiro 5min, vire, mais 5-10min conforme ponto. Descanse 5min.</p>
        </div>
        <div class="recipe">
            <h3>🐟 3. SALMÃO GRELHADO</h3>
            <p>180°C, 12min. Pele para baixo, não vire. 52-55°C interno para ponto perfeito.</p>
        </div>
        <div class="recipe">
            <h3>🍖 4. COSTELA SUÍNA</h3>
            <p>160°C por 40min, depois 200°C por 10min para crocância. Cubra com alumínio no início.</p>
        </div>
        <div class="recipe">
            <h3>🍔 5. HAMBÚRGUER ARTESANAL</h3>
            <p>200°C, 10min (vire aos 5min). Queijo nos últimos 2min.</p>
        </div>
        <div class="recipe">
            <h3>🐟 6. TILÁPIA EMPANADA</h3>
            <p>200°C, 12min. Empane com farinha panko para extra crocância.</p>
        </div>
        <div class="recipe">
            <h3>🍗 7. COXA E SOBRECOXA</h3>
            <p>200°C, 25min (vire aos 15min). Pele seca = crocância garantida.</p>
        </div>
        <div class="recipe">
            <h3>🥩 8. BIFE ANCHO</h3>
            <p>200°C, 12min para mal passado. Tempere apenas com sal grosso.</p>
        </div>
        <div class="recipe">
            <h3>🌮 9. FRANGO DESFIADO</h3>
            <p>180°C, 20min. Desfie e tempere depois para tacos, wraps, etc.</p>
        </div>
        <div class="recipe">
            <h3>🐷 10. LOMBO RECHEADO</h3>
            <p>170°C, 35min. Recheie com bacon + cream cheese.</p>
        </div>
        <div class="recipe">
            <h3>🐟 11. CAMARÃO EMPANADO</h3>
            <p>200°C, 8min. Não cozinhe demais! Ficam borrachudos.</p>
        </div>
        <div class="recipe">
            <h3>🍗 12. FRANGO À PARMEGIANA</h3>
            <p>180°C, 15min para o frango empanado. Adicione molho + queijo, mais 3min.</p>
        </div>
        <div class="recipe">
            <h3>🥩 13. CARNE DE PANELA</h3>
            <p>160°C, 45min em forma com tampa. Adicione líquido para não ressecar.</p>
        </div>
        <div class="recipe">
            <h3>🐟 14. PEIXE INTEIRO</h3>
            <p>180°C, 25min. Faça cortes na pele, recheie com limão e ervas.</p>
        </div>
        <div class="recipe">
            <h3>🍗 15. ESPETINHOS</h3>
            <p>200°C, 15min (vire aos 7min). Alterne carne e vegetais.</p>
        </div>
    </div>

    <div class="chapter" id="cap6">
        <h1>Capítulo 6: Acompanhamentos</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">10 guarnições perfeitas! 🥗</p>
        
        <div class="recipe">
            <h3>🥦 1. BRÓCOLIS CROCANTE</h3>
            <p>200°C, 15min. Seque bem, regue com azeite + alho. Chacoalhe aos 8min.</p>
        </div>
        <div class="recipe">
            <h3>🥔 2. BATATA RÚSTICA</h3>
            <p>200°C, 25min. Com casca, em gomos, alecrim + sal grosso.</p>
        </div>
        <div class="recipe">
            <h3>🥕 3. CENOURA GLACEADA</h3>
            <p>180°C, 18min. Baby cenouras + mel + manteiga.</p>
        </div>
        <div class="recipe">
            <h3>🌽 4. MILHO ASSADO</h3>
            <p>200°C, 15min. Passe manteiga + parmesão.</p>
        </div>
        <div class="recipe">
            <h3>🍆 5. BERINJELA À PARMEGIANA</h3>
            <p>190°C, 20min. Fatias empanadas + molho + mussarela.</p>
        </div>
        <div class="recipe">
            <h3>🥒 6. ABOBRINHA RECHEADA</h3>
            <p>180°C, 22min. Recheie com carne moída + queijo.</p>
        </div>
        <div class="recipe">
            <h3>🥬 7. COUVE-FLOR GRATINADA</h3>
            <p>180°C, 18min. Com molho branco + queijo por cima.</p>
        </div>
        <div class="recipe">
            <h3>🥔 8. BATATA DOCE CHIPS</h3>
            <p>180°C, 20min. Fatias finas, borrife óleo, tempere com canela ou sal.</p>
        </div>
        <div class="recipe">
            <h3>🧅 9. CEBOLA ROXA ASSADA</h3>
            <p>180°C, 25min. Em gomos, com balsâmico + mel.</p>
        </div>
        <div class="recipe">
            <h3>🥔 10. BATATA HASSELBACK</h3>
            <p>190°C, 30min. Cortes finos sem separar, azeite entre as fatias.</p>
        </div>
    </div>

    <div class="chapter" id="cap7">
        <h1>Capítulo 7: Sobremesas</h1>
        <p style="text-align: center; font-size: 1.1em; color: #666; margin-bottom: 40px;">10 doces irresistíveis! 🍰</p>
        
        <div class="recipe">
            <h3>🍪 1. COOKIES DE CHOCOLATE</h3>
            <p>180°C, 10min. Centro levemente cru ao sair - endurece ao esfriar. Congele a massa 15min antes.</p>
        </div>
        <div class="recipe">
            <h3>🍫 2. BROWNIES ÚMIDOS</h3>
            <p>160°C, 20min. Use forminha adequada. Palito deve sair levemente sujo.</p>
        </div>
        <div class="recipe">
            <h3>🍌 3. BANANA CARAMELIZADA</h3>
            <p>180°C, 12min. Com canela + açúcar mascavo. Sirva com sorvete!</p>
        </div>
        <div class="recipe">
            <h3>🧁 4. BOLO DE CANECA</h3>
            <p>180°C, 8min. Receita individual em ramequin. Chocolate ou baunilha.</p>
        </div>
        <div class="recipe">
            <h3>🍩 5. CHURROS</h3>
            <p>190°C, 15min. Massa caseira, vire aos 7min. Passe em açúcar + canela.</p>
        </div>
        <div class="recipe">
            <h3>🍎 6. MAÇÃ ASSADA</h3>
            <p>180°C, 20min. Recheie com canela + açúcar + nozes. Regue com mel.</p>
        </div>
        <div class="recipe">
            <h3>🥧 7. MINI CHEESECAKES</h3>
            <p>160°C, 18min. Em forminhas individuais. Esfrie antes de desenformar.</p>
        </div>
        <div class="recipe">
            <h3>🍩 8. DONUTS ASSADOS</h3>
            <p>180°C, 10min. Massa de pão doce em formato de rosquinha. Glaceie depois.</p>
        </div>
        <div class="recipe">
            <h3>🍮 9. PUDIM</h3>
            <p>160°C, 25min em banho-maria. Forminha untada com caramelo.</p>
        </div>
        <div class="recipe">
            <h3>🥐 10. CROISSANT DE CHOCOLATE</h3>
            <p>180°C, 12min. Massa folhada + chocolate no centro. Pincele com ovo.</p>
        </div>
    </div>

    <div class="chapter" id="cap8">
        <h1>Capítulo 8: Tabela de Referência</h1>
        
        <h3>🍗 CARNES</h3>
        <table>
            <tr><th>Alimento</th><th>Temp</th><th>Tempo</th><th>Obs</th></tr>
            <tr><td>Frango (peito)</td><td>170°C</td><td>18-20 min</td><td>Não passe de 75°C interno</td></tr>
            <tr><td>Frango (coxa)</td><td>200°C</td><td>22-25 min</td><td>Vire na metade</td></tr>
            <tr><td>Picanha</td><td>200°C</td><td>12-15 min</td><td>Descanse 5 min</td></tr>
            <tr><td>Hambúrguer</td><td>200°C</td><td>10-12 min</td><td>Vire aos 5 min</td></tr>
            <tr><td>Linguiça</td><td>180°C</td><td>15-18 min</td><td>Fure antes</td></tr>
        </table>

        <h3 style="margin-top: 30px;">🐟 PEIXES</h3>
        <table>
            <tr><th>Alimento</th><th>Temp</th><th>Tempo</th><th>Obs</th></tr>
            <tr><td>Salmão</td><td>180°C</td><td>10-12 min</td><td>Pele para baixo</td></tr>
            <tr><td>Tilápia</td><td>180°C</td><td>12-15 min</td><td>Empane para crocância</td></tr>
            <tr><td>Camarão</td><td>200°C</td><td>6-8 min</td><td>Não passe do ponto!</td></tr>
        </table>

        <h3 style="margin-top: 30px;">🥔 VEGETAIS</h3>
        <table>
            <tr><th>Alimento</th><th>Temp</th><th>Tempo</th><th>Obs</th></tr>
            <tr><td>Batata frita</td><td>200°C</td><td>20-25 min</td><td>Chacoalhe 2x</td></tr>
            <tr><td>Brócolis</td><td>200°C</td><td>12-15 min</td><td>Seque bem</td></tr>
            <tr><td>Couve-flor</td><td>180°C</td><td>15-18 min</td><td>Floretes uniformes</td></tr>
            <tr><td>Abobrinha</td><td>180°C</td><td>12-15 min</td><td>Rodelas de 1cm</td></tr>
        </table>

        <h3 style="margin-top: 30px;">🍰 SOBREMESAS</h3>
        <table>
            <tr><th>Alimento</th><th>Temp</th><th>Tempo</th><th>Obs</th></tr>
            <tr><td>Cookies</td><td>180°C</td><td>8-10 min</td><td>Centro levemente cru</td></tr>
            <tr><td>Brownies</td><td>160°C</td><td>18-20 min</td><td>Use forminha</td></tr>
            <tr><td>Bolo</td><td>160°C</td><td>25-30 min</td><td>Teste palito</td></tr>
        </table>
    </div>

    <div class="chapter" id="cap9">
        <h1>Capítulo 9: Limpeza e Manutenção</h1>
        
        <div class="recipe">
            <h4>🧼 Limpeza Após Cada Uso:</h4>
            <ol style="line-height: 2; margin-left: 20px;">
                <li>Desconecte e deixe esfriar 15-20 minutos</li>
                <li>Lave cesta e bandeja com água morna + detergente</li>
                <li>Para gordura grudada: molho em água morna por 10min</li>
                <li>NUNCA use esponja de aço</li>
                <li>Seque completamente antes de guardar</li>
            </ol>
        </div>

        <div class="warning-box">
            <strong>⚠️ NUNCA FAÇA:</strong>
            <p>❌ Mergulhar unidade principal na água</p>
            <p>❌ Usar produtos abrasivos</p>
            <p>❌ Limpar com Airfryer quente</p>
            <p>❌ Guardar com partes úmidas</p>
        </div>

        <div class="tip-box">
            <strong>✨ DICAS:</strong>
            <p>• Use forros de silicone para facilitar limpeza</p>
            <p>• Limpe logo após usar (gordura quente sai fácil)</p>
            <p>• Bicarbonato remove gordura sem danificar</p>
            <p>• Vinagre branco elimina odores</p>
        </div>
    </div>

    <div class="chapter" id="cap10">
        <h1>Capítulo 10: Conclusão</h1>
        
        <div class="intro">
            <p>🎉 <strong>Parabéns!</strong> Você agora tem um guia completo com 50 receitas testadas e aprovadas!</p>
            <p style="margin-top: 20px;">Com as técnicas e segredos revelados aqui, você está pronto para criar refeições incríveis, saudáveis e deliciosas todos os dias.</p>
        </div>

        <div class="checklist">
            <h4>✅ CHECKLIST DO EXPERT:</h4>
            <ul>
                <li>Sempre preaquecer a Airfryer</li>
                <li>Secar bem os alimentos</li>
                <li>Não empilhar - dar espaço</li>
                <li>Chacoalhar/virar no tempo certo</li>
                <li>Usar termômetro para carnes</li>
                <li>Deixar carnes descansarem</li>
                <li>Limpar logo após usar</li>
            </ul>
        </div>

        <div class="recipe" style="margin-top: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 40px;">
            <h3 style="color: white;">❤️ Obrigado por baixar este eBook!</h3>
            <p style="margin-top: 20px; opacity: 0.9;">Material criado com carinho para você aproveitar ao máximo sua Airfryer.</p>
            <p style="margin-top: 20px; font-size: 1.2em;"><strong>Bom apetite e ótimas airfryadas! 🍳</strong></p>
            <p style="margin-top: 30px; font-size: 0.9em; opacity: 0.8;">AMZ Ofertas | Material gratuito para uso pessoal | 2025</p>
        </div>
    </div>
</body>
</html>`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    return new Response(ebookHTML, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Erro na Edge Function ebook-airfryer:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
