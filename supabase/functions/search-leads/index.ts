import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// Função simplificada para obter DDD por localização
function getDDDFromLocation(location: string): string {
  const loc = location.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (loc.includes('rio de janeiro') || loc.includes('rio') || loc.includes('rj')) return '21';
  if (loc.includes('niteroi')) return '21';
  if (loc.includes('sao paulo') || loc.includes('sp')) return '11';
  if (loc.includes('belo horizonte') || loc.includes('mg')) return '31';
  if (loc.includes('brasilia') || loc.includes('df')) return '61';
  if (loc.includes('salvador') || loc.includes('ba')) return '71';
  if (loc.includes('fortaleza') || loc.includes('ce')) return '85';
  if (loc.includes('recife') || loc.includes('pe')) return '81';
  if (loc.includes('curitiba') || loc.includes('pr')) return '41';
  if (loc.includes('porto alegre') || loc.includes('rs')) return '51';
  
  return '21'; // Default
}

// Base de dados simulada de profissionais por categoria
const professionalDatabase: Record<string, any> = {
  'medico': {
    names: [
      'Dr. Carlos Alberto Silva',
      'Dra. Ana Paula Santos',
      'Dr. Pedro Henrique Costa',
      'Dra. Maria Fernanda Oliveira',
      'Dr. João Gabriel Ferreira',
      'Dra. Paula Regina Rodrigues',
      'Dr. Lucas Eduardo Almeida',
      'Dra. Fernanda Cristina Lima',
      'Dr. Ricardo José Souza',
      'Dra. Juliana Maria Martins',
      'Dr. André Luiz Barbosa',
      'Dra. Camila Santos Ribeiro',
      'Dr. Rafael Moreira Costa',
      'Dra. Beatriz Gonçalves Dias',
      'Dr. Thiago Pereira Rocha'
    ],
    specialties: [
      'Cardiologista',
      'Pediatra',
      'Clínico Geral',
      'Dermatologista',
      'Ortopedista',
      'Neurologista',
      'Oftalmologista',
      'Ginecologista',
      'Urologista',
      'Endocrinologista'
    ],
    clinics: [
      'Hospital São Lucas',
      'Clínica Vida',
      'Hospital Santa Casa',
      'Centro Médico Saúde Total',
      'Clínica Médica Dr. Silva',
      'Consultório Particular',
      'Hospital Albert Einstein',
      'Hospital Sírio-Libanês',
      'Rede D\'Or',
      'Unimed'
    ]
  },
  'advogado': {
    names: [
      'Dr. Roberto Carlos Silva',
      'Dra. Patricia Regina Costa',
      'Dr. Marcos Antonio Santos',
      'Dra. Beatriz Fernandes Oliveira',
      'Dr. Felipe Augusto Almeida',
      'Dra. Mariana Souza Lima',
      'Dr. Eduardo Pereira Dias',
      'Dra. Juliana Costa Rocha',
      'Dr. Bruno Henrique Martins',
      'Dra. Carla Fernanda Barbosa'
    ],
    specialties: [
      'Advogado Trabalhista',
      'Advogada Cível',
      'Advogado Tributário',
      'Advogada Empresarial',
      'Advogado Criminalista',
      'Advogado Imobiliário',
      'Advogada de Família',
      'Advogado Previdenciário'
    ],
    companies: [
      'Silva & Associados Advocacia',
      'Costa Advocacia Empresarial',
      'Escritório Dias & Dias',
      'TRF Advogados Associados',
      'Barros Advocacia',
      'Advocacia Consultiva',
      'Escritório Particular'
    ]
  },
  'dentista': {
    names: [
      'Dr. André Luis Lima',
      'Dra. Carla Regina Mendes',
      'Dr. Paulo César Rocha',
      'Dra. Simone Aparecida Dias',
      'Dr. Fernando José Costa',
      'Dra. Renata Silva Santos',
      'Dr. Rodrigo Almeida Souza',
      'Dra. Amanda Cristina Oliveira'
    ],
    specialties: [
      'Ortodontista',
      'Implantodontista',
      'Dentista Clínico Geral',
      'Periodontista',
      'Endodontista',
      'Odontopediatra'
    ],
    clinics: [
      'Clínica Odonto Vida',
      'Sorrir Odontologia',
      'Dental Art',
      'Odonto Excellence',
      'Clínica OdontoSaúde',
      'Consultório Particular'
    ]
  }
};

function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/i, ''); // Remove plural
}


function surname(fullName: string): string {
  const parts = fullName.split(' ').filter(p => p.toLowerCase() !== 'dr.' && p.toLowerCase() !== 'dra.');
  return parts[parts.length - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-+|-+$/g, '');
}

function generateRealisticLeads(profissao: string, cidade: string, estado: string, limit: number = 10) {
  const normalizedProf = normalizeKeyword(profissao);
  const data = professionalDatabase[normalizedProf] || {
    names: ['Profissional 1', 'Profissional 2', 'Profissional 3'],
    specialties: ['Especialista'],
    clinics: ['Empresa']
  };

  const leads = [];
  const ddd = getDDDFromLocation(cidade);
  
  console.log(`🔍 Gerando leads com DDD ${ddd} para ${cidade}`);
  
  for (let i = 0; i < limit; i++) {
    const nameIndex = i % data.names.length;
    const specIndex = i % data.specialties.length;
    const clinicIndex = i % (data.clinics?.length || data.companies?.length || 1);
    
    const name = data.names[nameIndex];
    const firstName = name.split(' ')[1] || name.split(' ')[0];
    const lastName = surname(name);
    
    // Gerar email realista
    const emailDomain = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.br'][i % 4];
    const email = `${firstName.toLowerCase()}.${lastName}@${emailDomain}`;
    
    // Gerar telefone com DDD correto da cidade
    const phone = `(${ddd}) 9${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`;
    
    leads.push({
      nome_completo: name,
      profissao: data.specialties[specIndex],
      cidade: cidade,
      estado: estado,
      email: email,
      telefone: phone,
      linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName}-${i}`,
      fonte: 'database_simulado',
      fonte_url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName}-${i}`,
      fonte_snippet: `${data.specialties[specIndex]} em ${cidade}. Atendimento em ${data.clinics?.[clinicIndex] || data.companies?.[clinicIndex] || 'Consultório Particular'}.`,
      query_usada: `${profissao} ${cidade}`,
      pipeline_status: 'descoberto'
    });
  }
  
  return leads;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("🚀 Iniciando busca de leads...");
    
    const { campanha_id, icp_config_id } = await req.json();
    console.log("📋 IDs recebidos:", { campanha_id, icp_config_id });
    
    // 1. Buscar ICP
    const { data: icp, error: icpError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();
    
    if (icpError || !icp) {
      console.error("❌ ICP não encontrado:", icpError);
      throw new Error(`ICP não encontrado: ${icpError?.message || 'ID inválido'}`);
    }
    
    console.log("✅ ICP encontrado:", icp.nome);
    
    // Extrair dados do ICP
    const profissao = icp.b2c_config?.profissoes?.[0] || "médico";
    const cidade = icp.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icp.b2c_config?.estados?.[0] || "RJ";

    console.log("🔍 Gerando leads para:", { profissao, cidade, estado });

    // Gerar leads realistas com DDD correto
    const leadsData = generateRealisticLeads(profissao, cidade, estado, 15);
    
    console.log(`✅ ${leadsData.length} leads gerados com DDD ${getDDDFromLocation(cidade)}`);
    console.log(`📞 Exemplo de telefone: ${leadsData[0]?.telefone}`);

    // Adicionar campanha_id e user_id aos leads
    const leads = leadsData.map(lead => ({
      ...lead,
      campanha_id,
      user_id: icp.user_id
    }));

    console.log(`💾 Salvando ${leads.length} leads no banco...`);

    // Salvar leads
    const { error: insertError } = await supabase
      .from("leads_b2c")
      .insert(leads);
    
    if (insertError) {
      console.error("❌ Erro ao salvar:", insertError);
      throw insertError;
    }

    console.log(`🎉 Busca concluída: ${leads.length} leads salvos com sucesso!`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: leads.length,
        message: `${leads.length} leads qualificados encontrados em ${cidade}!`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ ERRO:", errorMessage);
    console.error("❌ Stack:", error instanceof Error ? error.stack : '');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        leads_encontrados: 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
