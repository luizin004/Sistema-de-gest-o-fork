import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ArchiveResult {
  success: boolean;
  message: string;
  archived_count: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restored_count: number;
}

export const archiveAllPosts = async (userId: string): Promise<ArchiveResult> => {
  try {
    const { data, error } = await (supabase.rpc as any)('archive_all_posts', {
      p_user_id: userId
    });

    if (error) throw error;

    const result = data as ArchiveResult[];
    return result[0] || { success: false, message: 'Sem resposta do servidor', archived_count: 0 };
  } catch (error) {
    console.error('Error archiving posts:', error);
    throw error;
  }
};

export const archiveSinglePost = async (postId: string, userId: string): Promise<ArchiveResult> => {
  try {
    const { data, error } = await (supabase.rpc as any)('archive_single_post', {
      p_post_id: postId,
      p_user_id: userId
    });

    if (error) throw error;

    const result = data as ArchiveResult[];
    return result[0] || { success: false, message: 'Sem resposta do servidor', archived_count: 0 };
  } catch (error) {
    console.error('Error archiving single post:', error);
    throw error;
  }
};

export const restoreArchivedPosts = async (archiveId: string): Promise<RestoreResult> => {
  try {
    const { data, error } = await (supabase.rpc as any)('restore_archived_posts', {
      p_archive_id: archiveId
    });

    if (error) throw error;

    const result = data as RestoreResult[];
    return result[0] || { success: false, message: 'Sem resposta do servidor', restored_count: 0 };
  } catch (error) {
    console.error('Error restoring posts:', error);
    throw error;
  }
};

export const getPostsCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting posts count:', error);
    return 0;
  }
};

export const getArchivedCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('arquivados' as any)
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting archived count:', error);
    return 0;
  }
};
