import { useOutletContext } from "react-router-dom";
import { KanbanBoard } from "@/components/KanbanBoard";

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
}

interface CRMContext {
  posts: Post[];
}

const CRMKanban = () => {
  const { posts } = useOutletContext<CRMContext>();

  return <KanbanBoard posts={posts} />;
};

export default CRMKanban;
