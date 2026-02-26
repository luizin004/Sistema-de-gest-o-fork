import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirecionar diretamente para CRM sem verificação de autenticação
    navigate('/crm');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-xl text-muted-foreground">Redirecionando para CRM...</p>
      </div>
    </div>
  );
};

export default Index;
