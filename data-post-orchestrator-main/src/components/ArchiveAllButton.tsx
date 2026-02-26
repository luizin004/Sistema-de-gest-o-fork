import { useState } from "react";
import { AlertTriangle, Archive, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { archiveAllPosts, getPostsCount } from "@/lib/archiveAllPosts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ArchiveAllButtonProps {
  onArchiveComplete?: () => void;
}

export const ArchiveAllButton = ({ onArchiveComplete }: ArchiveAllButtonProps) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: initial, 2: confirmation, 3: timer, 4: progress
  const [confirmText, setConfirmText] = useState("");
  const [countText, setCountText] = useState("");
  const [postsCount, setPostsCount] = useState(0);
  const [timer, setTimer] = useState(10);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; count: number } | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Carregar usuário atual
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  // Carregar quantidade de posts ao abrir dialog
  const loadPostsCount = async () => {
    try {
      const count = await getPostsCount();
      setPostsCount(count);
    } catch (error) {
      console.error('Error loading posts count:', error);
    }
  };

  const handleOpenDialog = () => {
    setStep(1);
    setConfirmText("");
    setCountText("");
    setTimer(10);
    setProgress(0);
    setResult(null);
    setShowDialog(true);
    loadPostsCount();
  };

  const handleStep1Confirm = () => {
    if (confirmText.trim().toUpperCase() === "CONFIRMAR") {
      setStep(2);
      setConfirmText("");
    } else {
      toast.error("Digite exatamente 'CONFIRMAR' para continuar");
    }
  };

  const handleStep2Confirm = async () => {
    const currentCount = await getPostsCount();
    if (countText.trim() === currentCount.toString()) {
      setStep(3);
      startTimer();
    } else {
      toast.error(`Digite exatamente o número de posts: ${currentCount}`);
    }
  };

  const startTimer = () => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          executeArchive();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const executeArchive = async () => {
    const user = await getCurrentUser();
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setStep(4);
    setIsProcessing(true);
    setProgress(0);

    // Simular progresso
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const result = await archiveAllPosts(user.id);
      clearInterval(progressInterval);
      setProgress(100);
      setResult({
        success: result.success,
        message: result.message,
        count: result.archived_count
      });

      if (result.success) {
        toast.success(`✅ ${result.message}`);
        onArchiveComplete?.();
      } else {
        toast.error(`❌ ${result.message}`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setProgress(0);
      toast.error("Erro ao arquivar posts. Tente novamente.");
      console.error('Archive error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setShowDialog(false);
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleOpenDialog}
        className="gap-2 h-10 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 shadow-sm"
      >
        <Archive className="h-4 w-4 text-red-600" />
        Arquivar Todos
      </Button>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Arquivar Todos os Posts
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Aviso Inicial */}
          {step === 1 && (
            <div className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  <strong>ATENÇÃO:</strong> Esta ação irá mover TODOS os posts da tabela principal para a tabela de arquivados e limpar a tabela original.
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm text-gray-600">
                <p>• Todos os {postsCount} posts serão arquivados</p>
                <p>• A tabela posts será completamente limpa</p>
                <p>• Os dados serão preservados na tabela arquivados</p>
                <p>• Esta ação é irreversível (exceto por 5 minutos)</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Digite <span className="font-mono bg-gray-100 px-2 py-1 rounded">CONFIRMAR</span> para continuar:
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite CONFIRMAR"
                  className="uppercase"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleStep1Confirm}
                  disabled={confirmText.trim().toUpperCase() !== "CONFIRMAR"}
                  className="flex-1"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Confirmação com Número */}
          {step === 2 && (
            <div className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  <strong>CONFIRMAÇÃO FINAL:</strong> Para evitar acidentes, digite o número exato de posts que serão arquivados na tabela arquivados.
                </AlertDescription>
              </Alert>

              <div className="text-center">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {postsCount} posts
                </Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Digite o número exato de posts:
                </label>
                <Input
                  value={countText}
                  onChange={(e) => setCountText(e.target.value)}
                  placeholder={postsCount.toString()}
                  type="number"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleStep2Confirm}
                  disabled={countText.trim() !== postsCount.toString()}
                  className="flex-1"
                >
                  Confirmar Arquivamento
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Timer */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">{timer}</div>
                <p className="text-sm text-gray-600">Segundos para executar o arquivamento</p>
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>Prepare-se... o arquivamento começará em breve</p>
              </div>

              <Button variant="outline" onClick={handleClose} className="w-full">
                Cancelar (se ainda der tempo)
              </Button>
            </div>
          )}

          {/* Step 4: Progresso */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center">
                {isProcessing ? (
                  <div className="space-y-2">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-gray-600">Arquivando posts...</p>
                  </div>
                ) : result ? (
                  <div className="space-y-2">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                    <p className="text-sm font-medium text-green-700">
                      {result.success ? "Arquivamento Concluído" : "Erro no Arquivamento"}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>

              {result && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">{result.message}</p>
                  {result.success && (
                    <p className="text-lg font-semibold text-green-700 mt-2">
                      {result.count} posts arquivados
                    </p>
                  )}
                </div>
              )}

              {!isProcessing && (
                <Button onClick={handleClose} className="w-full">
                  Fechar
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
