import PaymentFormDirect from '@/components/PaymentFormDirect';
import { useNavigate } from 'react-router-dom';

export default function TestPayment() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🧪 Teste de Pagamento PIX
          </h1>
          <p className="text-gray-300">
            Use esta página para testar a integração com Mercado Pago
          </p>
        </div>
        
        <PaymentFormDirect 
          planName="Teste - AMZ Ofertas"
          userId="test-user-123"
        />

        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/planos')}
            className="text-orange-300 hover:text-white transition"
          >
            ← Voltar para Planos
          </button>
        </div>

        <div className="max-w-2xl mx-auto mt-8 p-6 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-orange-500/30">
          <h3 className="text-lg font-bold text-white mb-3">📋 Dados para Teste:</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>✅ Email: qualquer email válido (ex: teste@teste.com)</li>
            <li>✅ CPF: 123.456.789-09 (ou qualquer CPF válido)</li>
            <li>✅ Valor: R$ 12,00</li>
          </ul>
          <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded">
            <p className="text-xs text-yellow-300">
              ⚠️ Este é um ambiente de TESTE. O PIX gerado é real e pode ser pago.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
