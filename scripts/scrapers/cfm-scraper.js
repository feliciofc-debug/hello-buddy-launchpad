import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase } from './index.js';

export async function buscarMedicosCFM({ especialidade, uf, cidade, campanhaId }) {
  console.log(`🔍 Buscando médicos: ${especialidade} em ${cidade}-${uf}`);

  try {
    // URL do portal CFM (exemplo - ajustar conforme API real)
    const url = 'https://portal.cfm.org.br/busca-medicos/';
    
    // Mock de dados (substituir por scraping real)
    const medicos = [];
    const nomes = [
      'João Silva Santos', 
      'Maria Oliveira Costa', 
      'Pedro Mendes Rocha',
      'Ana Paula Ferreira',
      'Carlos Eduardo Lima'
    ];

    for (let i = 0; i < 5; i++) {
      medicos.push({
        nome_completo: `Dr(a). ${nomes[i]}`,
        crm: `${uf}-${(12345 + i).toString()}`,
        especialidade: especialidade,
        uf: uf,
        cidade: cidade,
        profissao: 'médico',
        fonte: 'CFM',
        pipeline_status: 'descoberto',
        score: 20,
        campanha_id: campanhaId,
      });
    }

    // Salvar no Supabase
    const { data, error } = await supabase
      .from('leads_b2c')
      .insert(medicos)
      .select();

    if (error) throw error;

    console.log(`✅ ${medicos.length} médicos salvos!`);
    return medicos;

  } catch (error) {
    console.error('❌ Erro ao buscar médicos:', error.message);
    throw error;
  }
}
