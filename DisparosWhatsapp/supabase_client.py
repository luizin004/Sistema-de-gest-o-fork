import os
from typing import Optional

from supabase import Client, create_client

_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Retorna um cliente Supabase singleton usando SUPABASE_URL e SUPABASE_KEY.
    Levanta erro se as variáveis não estiverem definidas.
    """
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY devem estar definidos no ambiente")

    _client = create_client(url, key)
    return _client
