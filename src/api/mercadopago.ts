const MP_ACCESS_TOKEN = 'APP_USR-5183241897014456-072215-168f59fcfe6f78fa3409bf63bbbf6735-1034562975';

export async function createPayment(userId: string, userEmail: string, planType: string) {
  try {
    // Pega dados do usuário
    const userDataStr = localStorage.getItem('tempUser');
    const userData = userDataStr ? JSON.parse(userDataStr) : {};
    
    // Limpa CPF (remove pontos e traços)
    const cpfLimpo = userData.cpf?.replace(/\D/g, '') || '';
    
    // Limpa telefone
    const telefoneLimpo = userData.whatsapp?.replace(/\D/g, '') || '';
    const ddd = telefoneLimpo.substring(0, 2) || '11';
    const numero = telefoneLimpo.substring(2) || '999999999';

    const preferenceData = {
      items: [
        {
          id: 'amz-ofertas-mensal',
          title: 'AMZ Ofertas - Plano Mensal',
          description: 'Acesso completo à plataforma',
          category_id: 'services',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 147.00
        }
      ],
      payer: {
        name: userData.nome || 'Cliente',
        surname: 'AMZ',
        email: userEmail,
        phone: {
          area_code: ddd,
          number: parseInt(numero)
        },
        identification: {
          type: 'CPF',
          number: cpfLimpo
        },
        address: {
          zip_code: '01310100',
          street_name: 'Av Paulista',
          street_number: 1000
        }
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12,
        default_installments: 1,
        default_payment_method_id: null
      },
      back_urls: {
        success: `${window.location.origin}/dashboard`,
        failure: `${window.location.origin}/planos`,
        pending: `${window.location.origin}/planos`
      },
      auto_return: 'approved',
      external_reference: userId,
      statement_descriptor: 'AMZ OFERTAS',
      expires: false,
      binary_mode: false
    };

    console.log('Enviando para MP:', preferenceData);

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    });

    const data = await response.json();
    
    console.log('Resposta MP:', data);
    
    if (data.init_point) {
      return { success: true, checkoutUrl: data.init_point };
    }
    
    throw new Error('Não foi possível criar a preferência de pagamento');
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    throw error;
  }
}
