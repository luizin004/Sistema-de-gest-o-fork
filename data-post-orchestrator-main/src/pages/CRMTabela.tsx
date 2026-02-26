import { useOutletContext } from "react-router-dom";
import { InteractiveDataTable } from "@/components/InteractiveDataTable";

interface Post {
  id: string;
  nome: string;
  status: string;
  data: string | null;
  horario: string | null;
  tratamento: string | null;
  telefone: string | null;
  dentista: string | null;
  data_marcada: string | null;
  created_at: string;
  feedback: string | null;
  campanha_id?: number | null;
  campanha_nome?: string | null;
}

interface CRMContext {
  posts: Post[];
}

const CRMTabela = () => {
  const { posts } = useOutletContext<CRMContext>();

  return <InteractiveDataTable posts={posts} />;
};

export default CRMTabela;
