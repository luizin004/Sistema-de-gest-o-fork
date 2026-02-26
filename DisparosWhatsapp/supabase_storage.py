import os
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class SupabaseStorage:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")
        self.bucket_name = "disparos-files"
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL e SUPABASE_KEY devem estar definidos no .env")
    
    def upload_file(self, file_path: str, file_content: bytes, content_type: str = "application/octet-stream") -> Optional[str]:
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{file_path}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": content_type
        }
        
        response = requests.post(url, headers=headers, data=file_content)
        
        if response.status_code in [200, 201]:
            return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{file_path}"
        else:
            print(f"Erro ao fazer upload: {response.status_code} - {response.text}")
            return None
    
    def download_file(self, file_path: str) -> Optional[bytes]:
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{file_path}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}"
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return response.content
        else:
            print(f"Erro ao baixar arquivo: {response.status_code} - {response.text}")
            return None
    
    def delete_file(self, file_path: str) -> bool:
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{file_path}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}"
        }
        
        response = requests.delete(url, headers=headers)
        
        return response.status_code in [200, 204]
    
    def list_files(self, folder_path: str = "") -> list:
        url = f"{self.supabase_url}/storage/v1/object/list/{self.bucket_name}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}"
        }
        
        params = {"prefix": folder_path} if folder_path else {}
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Erro ao listar arquivos: {response.status_code} - {response.text}")
            return []
