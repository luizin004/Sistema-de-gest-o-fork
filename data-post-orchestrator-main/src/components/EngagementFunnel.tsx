import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FunnelData {
  respondeu: number;
  interagiu: number;
  engajou: number;
  impecilho: number;
  cadencia: number;
  total: number;
}

interface EngagementFunnelProps {
  data: FunnelData;
}

export const EngagementFunnel = ({ data }: EngagementFunnelProps) => {
  const stages = useMemo(() => {
    // Calcula porcentagem de conversão entre etapas
    // Cada etapa mostra quanto % ela representa da etapa anterior
    const respondeuPercentage = data.total > 0 ? (data.respondeu / data.total) * 100 : 0;
    const interagiuPercentage = data.respondeu > 0 ? (data.interagiu / data.respondeu) * 100 : 0;
    const engajouPercentage = data.interagiu > 0 ? (data.engajou / data.interagiu) * 100 : 0;
    const impecilhoPercentage = data.engajou > 0 ? (data.impecilho / data.engajou) * 100 : 0;
    
    return [
      {
        name: "RESPONDEU",
        count: data.respondeu,
        percentage: respondeuPercentage,
        color: "bg-blue-500",
        textColor: "text-blue-700",
        bgLight: "bg-blue-50",
      },
      {
        name: "INTERAGIU",
        count: data.interagiu,
        percentage: interagiuPercentage,
        color: "bg-purple-500",
        textColor: "text-purple-700",
        bgLight: "bg-purple-50",
      },
      {
        name: "ENGAJOU",
        count: data.engajou,
        percentage: engajouPercentage,
        color: "bg-green-500",
        textColor: "text-green-700",
        bgLight: "bg-green-50",
      },
      {
        name: "IMPECILHO",
        count: data.impecilho,
        percentage: impecilhoPercentage,
        color: "bg-red-500",
        textColor: "text-red-700",
        bgLight: "bg-red-50",
      },
    ];
  }, [data]);

  const cadenciaData = useMemo(() => ({
    name: "CADÊNCIA",
    count: data.cadencia,
    percentage: (data.cadencia / (data.total || 1)) * 100,
    color: "bg-amber-500",
    textColor: "text-amber-700",
    bgLight: "bg-amber-50",
  }), [data]);

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.total > 0 ? ((data.engajou / data.total) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Leads que engajaram</p>
          </CardContent>
        </Card>
      </div>

      {/* Funil Principal - Estilo Visual de Cone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Funil de Engajamento</span>
            <Badge variant="secondary" className="text-xs">
              {data.total} leads
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="relative flex flex-col items-center gap-1 max-w-2xl mx-auto">
            {stages.map((stage, index) => {
              const baseWidth = 100;
              const widthReduction = index * 15;
              const stageWidth = Math.max(baseWidth - widthReduction, 30);
              
              return (
                <div key={stage.name} className="w-full flex flex-col items-center">
                  <div 
                    className={`${stage.color} relative transition-all duration-500 ease-out shadow-md`}
                    style={{
                      width: `${stageWidth}%`,
                      height: '80px',
                      clipPath: index === stages.length - 1
                        ? 'polygon(10% 0, 90% 0, 80% 100%, 20% 100%)'
                        : 'polygon(0 0, 100% 0, 90% 100%, 10% 100%)',
                    }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <span className="font-bold text-2xl drop-shadow-lg">
                        {stage.count}
                      </span>
                      <span className="text-xs font-medium opacity-90 mt-1">
                        {stage.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2 mb-1">
                    <span className="text-sm text-muted-foreground">{stage.count} leads</span>
                    <Badge variant="secondary" className="text-xs">
                      {stage.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cadência (separada do funil) */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <span>{cadenciaData.name}</span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              Fora do funil
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Leads em cadência</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{cadenciaData.count} leads</span>
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                  {cadenciaData.percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <div className="relative h-16 flex items-center">
              <div 
                className={`${cadenciaData.color} h-full transition-all duration-500 ease-out relative rounded-md`}
                style={{ width: `${(cadenciaData.percentage / 100) * 100}%` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg drop-shadow-md">
                    {cadenciaData.count}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Leads que estão em processo de cadência e ainda não responderam
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">📊 Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p>
              <strong>{((data.respondeu / (data.total || 1)) * 100).toFixed(1)}%</strong> dos leads responderam à primeira mensagem
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-600 font-bold">↗</span>
            <p>
              <strong>{((data.interagiu / (data.respondeu || 1)) * 100).toFixed(1)}%</strong> dos que responderam continuaram interagindo
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">🎯</span>
            <p>
              <strong>{((data.engajou / (data.interagiu || 1)) * 100).toFixed(1)}%</strong> dos que interagiram chegaram ao engajamento
            </p>
          </div>
          {data.impecilho > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold">⚠</span>
              <p>
                <strong>{data.impecilho}</strong> leads encontraram algum impecilho no processo
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
