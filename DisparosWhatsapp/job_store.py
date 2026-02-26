import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class JobState:
    job_id: str
    input_csv_path: str
    report_csv_path: str
    log_path: str
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    status: str = "uploaded"
    stop_requested: bool = False
    total: int = 0
    processed: int = 0
    success: int = 0
    error: int = 0
    last_error: str = ""
    disparo_tipo: str = "manual"


class JobStore:
    def __init__(self, base_dir: str) -> None:
        self.base_dir = base_dir
        self.upload_dir = os.path.join(base_dir, "data", "uploads")
        self.result_dir = os.path.join(base_dir, "data", "results")
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.result_dir, exist_ok=True)

        self._lock = threading.Lock()
        self._jobs: Dict[str, JobState] = {}

    def criar_job(self, filename: str, disparo_tipo: str = "manual") -> JobState:
        job_id = uuid.uuid4().hex
        safe_name = os.path.basename(filename or "contatos.csv")
        input_csv_path = os.path.join(self.upload_dir, f"{job_id}__{safe_name}")
        report_csv_path = os.path.join(self.result_dir, f"{job_id}__relatorio_final.csv")
        log_path = os.path.join(self.result_dir, f"{job_id}__execucao.log")

        job = JobState(
            job_id=job_id,
            input_csv_path=input_csv_path,
            report_csv_path=report_csv_path,
            log_path=log_path,
            disparo_tipo=disparo_tipo or "manual",
        )

        with self._lock:
            self._jobs[job_id] = job

        return job

    def get(self, job_id: str) -> Optional[JobState]:
        with self._lock:
            return self._jobs.get(job_id)

    def listar(self) -> Dict[str, Any]:
        with self._lock:
            return {
                job_id: {
                    "job_id": j.job_id,
                    "status": j.status,
                    "stop_requested": bool(j.stop_requested),
                    "created_at": j.created_at,
                    "started_at": j.started_at,
                    "finished_at": j.finished_at,
                    "total": j.total,
                    "processed": j.processed,
                    "success": j.success,
                    "error": j.error,
                    "last_error": j.last_error,
                    "disparo_tipo": j.disparo_tipo,
                }
                for job_id, j in self._jobs.items()
            }

    def solicitar_parada(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            job.stop_requested = True
            return True

    def atualizar(self, job_id: str, **kwargs: Any) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for k, v in kwargs.items():
                if hasattr(job, k):
                    setattr(job, k, v)

    def incrementar(self, job_id: str, **kwargs: int) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for k, v in kwargs.items():
                if hasattr(job, k):
                    atual = int(getattr(job, k))
                    setattr(job, k, atual + int(v))
