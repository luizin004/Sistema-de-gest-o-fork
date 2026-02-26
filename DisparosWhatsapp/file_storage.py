import os
from pathlib import Path
from typing import Optional, BinaryIO
from dotenv import load_dotenv

load_dotenv()

class FileStorage:
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.use_supabase = self.environment == "production"
        
        if self.use_supabase:
            from supabase_storage import SupabaseStorage
            self.storage = SupabaseStorage()
        else:
            self.local_data_dir = Path(__file__).parent / "data"
            self.local_data_dir.mkdir(exist_ok=True)
    
    def save_file(self, filename: str, content: bytes, subfolder: str = "uploads") -> Optional[str]:
        if self.use_supabase:
            file_path = f"{subfolder}/{filename}"
            return self.storage.upload_file(file_path, content)
        else:
            folder = self.local_data_dir / subfolder
            folder.mkdir(exist_ok=True)
            file_path = folder / filename
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            return str(file_path)
    
    def read_file(self, filename: str, subfolder: str = "uploads") -> Optional[bytes]:
        if self.use_supabase:
            file_path = f"{subfolder}/{filename}"
            return self.storage.download_file(file_path)
        else:
            file_path = self.local_data_dir / subfolder / filename
            
            if file_path.exists():
                with open(file_path, "rb") as f:
                    return f.read()
            return None
    
    def delete_file(self, filename: str, subfolder: str = "uploads") -> bool:
        if self.use_supabase:
            file_path = f"{subfolder}/{filename}"
            return self.storage.delete_file(file_path)
        else:
            file_path = self.local_data_dir / subfolder / filename
            
            if file_path.exists():
                file_path.unlink()
                return True
            return False
    
    def list_files(self, subfolder: str = "uploads") -> list:
        if self.use_supabase:
            return self.storage.list_files(subfolder)
        else:
            folder = self.local_data_dir / subfolder
            
            if folder.exists():
                return [f.name for f in folder.iterdir() if f.is_file()]
            return []
    
    def get_file_path(self, filename: str, subfolder: str = "uploads") -> str:
        if self.use_supabase:
            return f"{subfolder}/{filename}"
        else:
            return str(self.local_data_dir / subfolder / filename)
