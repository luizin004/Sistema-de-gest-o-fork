import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCRMData } from '@/hooks/useCRMData';
import { UazapiInstance } from '@/hooks/useCRMData';
import { Plus, Trash2, RefreshCw, Wifi, WifiOff, Smartphone, CheckCircle, XCircle } from 'lucide-react';

interface UsuarioInstanceManagerProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const UsuarioInstanceManager: React.FC<UsuarioInstanceManagerProps> = ({
  tenantId,
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const { configureInstance, getInstances, refreshInstanceStatus, removeInstance } = useCRMData();
  
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [addingInstance, setAddingInstance] = useState(false);

  const loadInstances = async () => {
    if (!tenantId) return [];
    
    setLoading(true);
    try {
      // Passar o tenantId específico para buscar instâncias deste usuário
      const instancesData = await getInstances(tenantId);
      setInstances(instancesData);
      
      // Log informativo sobre o estado
      if (instancesData.length === 0) {
        console.log('[UsuarioInstanceManager] Nenhuma instância configurada para este tenant');
      } else {
        console.log(`[UsuarioInstanceManager] ${instancesData.length} instâncias carregadas para o tenant ${tenantId}`);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as instâncias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstance = async () => {
    if (!newToken.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira um token válido',
        variant: 'destructive'
      });
      return;
    }

    setAddingInstance(true);
    try {
      // Passar o tenantId do usuário selecionado para a configuração
      const instance = await configureInstance(newToken, tenantId);
      if (instance) {
        setNewToken('');
        setShowAddDialog(false);
        await loadInstances();
        toast({
          title: 'Sucesso',
          description: 'Instância configurada com sucesso'
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Falha ao configurar instância. Verifique o token.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao configurar instância:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível configurar a instância',
        variant: 'destructive'
      });
    } finally {
      setAddingInstance(false);
    }
  };

  const handleRefreshInstance = async (instanceId: string) => {
    try {
      await refreshInstanceStatus(instanceId, tenantId);
      await loadInstances();
      toast({
        title: 'Sucesso',
        description: 'Status atualizado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar instância:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveInstance = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;

    try {
      await removeInstance(instanceId, tenantId);
      await loadInstances();
      toast({
        title: 'Sucesso',
        description: 'Instância removida com sucesso'
      });
    } catch (error) {
      console.error('Erro ao remover instância:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a instância',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (isOpen && tenantId) {
      loadInstances();
    }
  }, [isOpen, tenantId]);

  const getStatusIcon = (connected: boolean) => {
    return connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;
  };

  const getStatusColor = (connected: boolean) => {
    return connected ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBadge = (connected: boolean) => {
    return connected ? 'default' : 'destructive';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Gerenciar Instâncias UAZAPI
            </DialogTitle>
            <DialogDescription>
              Configure e gerencie as instâncias do WhatsApp para este usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Botão para adicionar nova instância */}
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold">Instâncias Configuradas ({instances.length})</h4>
                <p className="text-sm text-gray-600">
                  Cada instância permite enviar mensagens pelo WhatsApp
                </p>
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Instância
              </Button>
            </div>

            {/* Lista de instâncias */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Carregando instâncias...</p>
              </div>
            ) : instances.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Nenhuma instância configurada</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure sua primeira instância para começar a enviar mensagens pelo WhatsApp
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  💡 Dica: Você precisará de um token UAZAPI válido para configurar uma instância
                </p>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Primeira Instância
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((instance) => (
                  <Card key={instance.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="font-semibold">{instance.name || instance.profile_name}</h5>
                            <Badge variant={getStatusBadge(instance.connected)}>
                              <span className={getStatusColor(instance.connected)}>
                                {getStatusIcon(instance.connected)}
                              </span>
                              <span className="ml-1">
                                {instance.connected ? 'Conectado' : 'Desconectado'}
                              </span>
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <p><span className="font-medium">ID:</span> {instance.instance_id}</p>
                            <p><span className="font-medium">Telefone:</span> {instance.owner_phone}</p>
                            <p><span className="font-medium">Status:</span> {instance.status}</p>
                            <p><span className="font-medium">Plataforma:</span> {instance.platform}</p>
                            <p><span className="font-medium">Última verificação:</span> {new Date(instance.last_status_check).toLocaleString('pt-BR')}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleRefreshInstance(instance.id)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Atualizar
                          </Button>
                          <Button
                            onClick={() => handleRemoveInstance(instance.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Informações de ajuda */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Como funciona
              </h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li><strong>Obtenha seu token UAZAPI:</strong> Acesse o painel UAZAPI → Instâncias → Copie o token</li>
                <li><strong>Clique em "Adicionar Instância":</strong> Cole o token no campo</li>
                <li><strong>Aguarde a validação:</strong> O sistema buscará automaticamente os dados</li>
                <li><strong>Pronto!</strong> A instância ficará disponível para uso</li>
              </ol>
              <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700">
                <strong>Importante:</strong> Cada instância fica isolada por tenant, garantindo segurança e privacidade.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar instância */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Instância UAZAPI</DialogTitle>
            <DialogDescription>
              Configure uma nova instância do WhatsApp para este usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token UAZAPI</Label>
              <textarea
                id="token"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="Cole seu token UAZAPI aqui..."
                className="w-full p-3 border rounded-lg resize-none h-24"
                disabled={addingInstance}
              />
              <p className="text-xs text-gray-500">
                O token será validado automaticamente com a API UAZAPI
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="font-semibold text-yellow-800 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Importante
              </h4>
              <p className="text-sm text-yellow-700">
                Certifique-se de que o token seja válido e pertença a uma instância ativa do UAZAPI.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddInstance}
              disabled={addingInstance || !newToken.trim()}
            >
              {addingInstance ? 'Configurando...' : 'Configurar Instância'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
