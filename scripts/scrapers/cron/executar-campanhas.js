import { supabase } from '../index.js';
import { buscarMedicosCFM } from '../cfm-scraper.js';

async function executarCampanhasAutomaticas() {
  console.log('🚀 Executando campanhas automáticas...');
  console.log('⏰', new Date().toLocaleString('pt-BR'));

  try {
    // Buscar campanhas ativas
    const { data: campanhas, error } = await supabase
      .from('campanhas_prospeccao')
      .select('*, icp_configs(*)')
      .eq('status', 'ativa')
      .eq('auto_executar', true);

    if (error) throw error;

    console.log(`📊 ${campanhas?.length || 0} campanhas ativas encontradas`);

    for (const campanha of campanhas || []) {
      console.log(`\n📋 Campanha: ${campanha.nome}`);
      
      const icp = campanha.icp_configs;

      // Se for campanha de médicos
      if (icp.tipo === 'b2c' && icp.profissoes?.includes('Médico')) {
        for (const estado of icp.estados || []) {
          const leads = await buscarMedicosCFM({
            especialidade: icp.especialidades?.[0] || 'Dermatologia',
            uf: estado,
            cidade: icp.cidades?.[0] || '',
            campanhaId: campanha.id
          });

          console.log(`  ✅ ${leads.length} leads em ${estado}`);
        }
      }
    }

    console.log('\n✅ Execução concluída!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executar a cada 6 horas
const SEIS_HORAS = 6 * 60 * 60 * 1000;
setInterval(executarCampanhasAutomaticas, SEIS_HORAS);

// Executar imediatamente ao iniciar
executarCampanhasAutomaticas();

console.log('⏰ Cron job iniciado - executando a cada 6 horas');
