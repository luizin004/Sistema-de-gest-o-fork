import { useOutletContext } from "react-router-dom";
import { KanbanBoardAcao } from "@/components/KanbanBoardAcao";

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
  refreshPosts: () => void;
}

const CRMKanbanAcao = () => {
  const { posts, refreshPosts } = useOutletContext<CRMContext>();

  return <KanbanBoardAcao posts={posts} onRefresh={refreshPosts} />;
};

export default CRMKanbanAcao;
