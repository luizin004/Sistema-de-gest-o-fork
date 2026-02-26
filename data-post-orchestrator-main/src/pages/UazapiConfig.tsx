import React from 'react';
import { UazapiInstanceConfig } from '@/components/UazapiInstanceConfig';
import { UazapiInstance } from '@/hooks/useCRMData';

const UazapiConfigPage: React.FC = () => {
  const handleInstanceConfigured = (instance: UazapiInstance) => {
    console.log('Nova instância configurada:', instance);
    // Aqui você pode adicionar lógica adicional quando uma instância é configurada
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Configuração UAZAPI
          </h1>
          <p className="mt-2 text-gray-600">
            Gerencie suas instâncias do WhatsApp de forma simples e segura.
          </p>
        </div>

        <UazapiInstanceConfig 
          onInstanceConfigured={handleInstanceConfigured}
        />

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">
            ⚠️ Importante
          </h3>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>Cada instância configurada fica isolada por tenant</li>
            <li>Os tokens são validados automaticamente com a API UAZAPI</li>
            <li>Você pode configurar múltiplas instâncias por tenant</li>
            <li>O status das instâncias é atualizado em tempo real</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UazapiConfigPage;
