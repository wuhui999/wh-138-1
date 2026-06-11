from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from database import get_db
import models, schemas

router = APIRouter()


def _calc_project_progress(db: Session, project_id: int):
    procs = db.query(models.Process).filter(models.Process.project_id == project_id, models.Process.level == 1).all()
    if not procs:
        return 0.0, 0, 0, 0
    total = len(procs)
    completed = sum(1 for p in procs if p.status == "completed")
    progress = sum(p.progress for p in procs) / total
    today = date.today()
    delayed = 0
    for p in procs:
        if p.status != "completed" and p.planned_end_date and p.planned_end_date < today:
            delayed += 1
        if p.delay_reason and p.status != "completed":
            delayed += 1
    return round(progress, 1), total, completed, delayed


@router.get("", response_model=List[schemas.Project])
def list_projects(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Project)
    if status:
        query = query.filter(models.Project.status == status)
    projects = query.order_by(models.Project.id.desc()).all()
    result = []
    for p in projects:
        progress, total, completed, delayed = _calc_project_progress(db, p.id)
        p.progress = progress
        p.total_processes = total
        p.completed_processes = completed
        p.delayed_processes = delayed
        result.append(p)
    return result


@router.post("", response_model=schemas.Project)
def create_project(project_in: schemas.ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(**project_in.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=schemas.Project)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    progress, total, completed, delayed = _calc_project_progress(db, project_id)
    project.progress = progress
    project.total_processes = total
    project.completed_processes = completed
    project.delayed_processes = delayed
    return project


@router.put("/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, update_in: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    update_data = update_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(project, key, val)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/gantt")
def get_project_gantt(project_id: int, db: Session = Depends(get_db)):
    procs = db.query(models.Process).filter(models.Process.project_id == project_id).all()
    tasks = []
    for p in procs:
        tasks.append({
            "id": p.id, "parentId": p.parent_id, "name": p.name, "code": p.code,
            "status": p.status, "level": p.level,
            "planned_start": p.planned_start_date.isoformat() if p.planned_start_date else None,
            "planned_end": p.planned_end_date.isoformat() if p.planned_end_date else None,
            "actual_start": p.actual_start_date.isoformat() if p.actual_start_date else None,
            "actual_end": p.actual_end_date.isoformat() if p.actual_end_date else None,
            "progress": p.progress, "owner": p.owner_team, "is_critical": p.is_critical,
            "delay_reason": p.delay_reason
        })
    return {"tasks": tasks}
