import React, { useState, useEffect } from 'react';
import { useCRMData } from '@/hooks/useCRMData';
import { UazapiInstance } from '@/hooks/useCRMData';

interface InstanceCardProps {
  instance: UazapiInstance;
  onRefresh: () => void;
}

const InstanceCard: React.FC<InstanceCardProps> = ({ instance, onRefresh }) => {
  const { refreshInstanceStatus, removeInstance } = useCRMData();
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Para uso geral, não passa tenant_id específico (usa o do usuário autenticado)
      await refreshInstanceStatus(instance.id);
      onRefresh();
    } catch (error) {
      console.error('Erro ao atualizar instância:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;
    
    setRemoving(true);
    try {
      // Para uso geral, não passa tenant_id específico (usa o do usuário autenticado)
      await removeInstance(instance.id);
      onRefresh();
    } catch (error) {
      console.error('Erro ao remover instância:', error);
    } finally {
      setRemoving(false);
    }
  };

  const getStatusColor = () => {
    if (instance.connected) return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusText = () => {
    if (instance.connected) return 'Conectado';
    return 'Desconectado';
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-semibold text-lg">{instance.name || instance.profile_name}</h4>
          <p className="text-sm text-gray-600">ID: {instance.instance_id}</p>
          <p className="text-sm text-gray-600">Telefone: {instance.owner_phone}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
        >
          {removing ? 'Removendo...' : 'Remover'}
        </button>
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p>Status: {instance.status}</p>
        <p>Plataforma: {instance.platform}</p>
        <p>Última verificação: {new Date(instance.last_status_check).toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
};

interface UazapiInstanceConfigProps {
  onInstanceConfigured?: (instance: UazapiInstance) => void;
}

export const UazapiInstanceConfig: React.FC<UazapiInstanceConfigProps> = ({ onInstanceConfigured }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { configureInstance, getInstances } = useCRMData();

  const loadInstances = async () => {
    try {
      // Para uso geral, não passa tenant_id específico (usa o do usuário autenticado)
      const instances = await getInstances();
      setInstances(instances);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const handleConfigure = async () => {
    if (!token.trim()) {
      setError('Por favor, insira um token válido');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Para uso geral, não passa tenant_id específico (usa o do usuário autenticado)
      const instance = await configureInstance(token);
      if (instance) {
        setToken('');
        await loadInstances();
        setSuccess('Instância configurada com sucesso!');
        onInstanceConfigured?.(instance);
      } else {
        setError('Falha ao configurar instância. Verifique o token.');
      }
    } catch (error) {
      console.error('Erro ao configurar instância:', error);
      setError('Erro ao configurar instância. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  return (
    <div className="space-y-6">
      {/* Formulário de configuração */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Configurar Instância UAZAPI</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            {success}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Token UAZAPI
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole seu token UAZAPI aqui..."
              className="w-full p-3 border rounded-lg resize-none h-24"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              O token será validado automaticamente com a API UAZAPI
            </p>
          </div>
          
          <button
            onClick={handleConfigure}
            disabled={loading || !token.trim()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Configurando...' : 'Configurar Instância'}
          </button>
        </div>
      </div>
      
      {/* Lista de instâncias */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">
          Instâncias Configuradas ({instances.length})
        </h3>
        
        {instances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhuma instância configurada ainda.</p>
            <p className="text-sm mt-2">Configure sua primeira instância acima.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onRefresh={loadInstances}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Informações de ajuda */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Como funciona:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Insira o token da sua instância UAZAPI</li>
          <li>O sistema validará o token automaticamente</li>
          <li>As informações da instância serão buscadas</li>
          <li>A instância ficará disponível para uso no sistema</li>
        </ol>
        <p className="text-xs text-blue-700 mt-3">
          Cada instância fica isolada por tenant, garantindo segurança e privacidade.
        </p>
      </div>
    </div>
  );
};
