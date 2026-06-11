from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
import models, schemas

router = APIRouter()


def _build_tree(procs, parent_id=None):
    tree = []
    for p in procs:
        if p.parent_id == parent_id:
            children = _build_tree(procs, p.id)
            p.children = children
            tree.append(p)
    return sorted(tree, key=lambda x: x.sort_order)


def _check_can_start(db: Session, process_id: int):
    deps = db.query(models.ProcessDependency).filter(models.ProcessDependency.process_id == process_id).all()
    blocked_reasons = []
    for dep in deps:
        dep_proc = db.query(models.Process).filter(models.Process.id == dep.dependency_id).first()
        if dep_proc and dep_proc.status != "completed":
            blocked_reasons.append(f"前置工序[{dep_proc.name}]未完成")

    purchases = db.query(models.PurchaseRequest).filter(
        models.PurchaseRequest.process_id == process_id,
        models.PurchaseRequest.status.in_(["draft", "approved", "ordered", "partial_arrived"])
    ).all()
    for pr in purchases:
        if not pr.actual_arrival_date or pr.status != "arrived":
            for item in pr.items:
                if item.status != "arrived":
                    blocked_reasons.append(f"备件[{item.part.name if item.part else '未知'}]未到货")
            break

    can_start = len(blocked_reasons) == 0
    return can_start, "; ".join(blocked_reasons) if blocked_reasons else None


def _check_delayed(process: models.Process):
    today = date.today()
    if process.status == "completed":
        return False
    if process.planned_end_date and process.planned_end_date < today:
        return True
    if process.delay_reason:
        return True
    return False


@router.get("", response_model=List[schemas.Process])
def list_processes(project_id: Optional[int] = None, status: Optional[str] = None,
                   owner_team: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Process)
    if project_id:
        query = query.filter(models.Process.project_id == project_id)
    if status:
        query = query.filter(models.Process.status == status)
    if owner_team:
        query = query.filter(models.Process.owner_team == owner_team)
    procs = query.order_by(models.Process.project_id, models.Process.level, models.Process.sort_order).all()
    for p in procs:
        p.is_delayed = _check_delayed(p)
        p.can_start, p.blocked_reason = _check_can_start(db, p.id)
    return procs


@router.get("/tree", response_model=List[schemas.ProcessTree])
def get_process_tree(project_id: int, db: Session = Depends(get_db)):
    procs = db.query(models.Process).filter(models.Process.project_id == project_id).all()
    for p in procs:
        p.is_delayed = _check_delayed(p)
        p.can_start, p.blocked_reason = _check_can_start(db, p.id)
        p.children = []
    return _build_tree(procs)


@router.post("", response_model=schemas.Process)
def create_process(proc_in: schemas.ProcessCreate, db: Session = Depends(get_db)):
    dep_ids = proc_in.dependency_ids or []
    proc_data = proc_in.model_dump(exclude={"dependency_ids"})
    proc = models.Process(**proc_data)
    db.add(proc)
    db.flush()
    for dep_id in dep_ids:
        db.add(models.ProcessDependency(process_id=proc.id, dependency_id=dep_id))
    db.commit()
    db.refresh(proc)
    proc.is_delayed = _check_delayed(proc)
    proc.can_start, proc.blocked_reason = _check_can_start(db, proc.id)
    return proc


@router.get("/{proc_id}", response_model=schemas.Process)
def get_process(proc_id: int, db: Session = Depends(get_db)):
    proc = db.query(models.Process).filter(models.Process.id == proc_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="工序不存在")
    proc.is_delayed = _check_delayed(proc)
    proc.can_start, proc.blocked_reason = _check_can_start(db, proc.id)
    return proc


@router.put("/{proc_id}", response_model=schemas.Process)
def update_process(proc_id: int, update_in: schemas.ProcessUpdate, db: Session = Depends(get_db)):
    proc = db.query(models.Process).filter(models.Process.id == proc_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="工序不存在")

    new_status = update_in.status
    if new_status and new_status in ["in_progress", "completed"] and proc.status not in ["in_progress", "completed"]:
        can_start, reason = _check_can_start(db, proc_id)
        if not can_start:
            raise HTTPException(status_code=400, detail=f"无法开工：{reason}")

    update_data = update_in.model_dump(exclude_unset=True)

    if new_status == "completed" and not proc.actual_end_date:
        update_data["actual_end_date"] = date.today()
        update_data["progress"] = 100.0
    if new_status == "in_progress" and not proc.actual_start_date:
        update_data["actual_start_date"] = date.today()

    if "progress" in update_data:
        prog = update_data["progress"]
        if prog >= 100 and proc.status != "completed":
            update_data["status"] = "completed"
            if not proc.actual_end_date:
                update_data["actual_end_date"] = date.today()
        elif prog > 0 and prog < 100 and proc.status in ["pending", "blocked"]:
            can_start, reason = _check_can_start(db, proc_id)
            if can_start:
                update_data["status"] = "in_progress"
                if not proc.actual_start_date:
                    update_data["actual_start_date"] = date.today()

    for key, val in update_data.items():
        setattr(proc, key, val)

    db.commit()
    db.refresh(proc)
    proc.is_delayed = _check_delayed(proc)
    proc.can_start, proc.blocked_reason = _check_can_start(db, proc_id)
    return proc


@router.delete("/{proc_id}")
def delete_process(proc_id: int, db: Session = Depends(get_db)):
    proc = db.query(models.Process).filter(models.Process.id == proc_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="工序不存在")
    db.delete(proc)
    db.commit()
    return {"ok": True}


@router.post("/{proc_id}/dependencies", response_model=schemas.ProcessDependency)
def add_dependency(proc_id: int, dep_in: schemas.ProcessDependencyCreate, db: Session = Depends(get_db)):
    proc = db.query(models.Process).filter(models.Process.id == proc_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="工序不存在")
    dep_proc = db.query(models.Process).filter(models.Process.id == dep_in.dependency_id).first()
    if not dep_proc:
        raise HTTPException(status_code=404, detail="依赖工序不存在")
    if dep_in.dependency_id == proc_id:
        raise HTTPException(status_code=400, detail="不能依赖自己")
    existing = db.query(models.ProcessDependency).filter(
        models.ProcessDependency.process_id == proc_id,
        models.ProcessDependency.dependency_id == dep_in.dependency_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="依赖关系已存在")
    dep = models.ProcessDependency(**dep_in.model_dump())
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/{proc_id}/dependencies/{dep_id}")
def remove_dependency(proc_id: int, dep_id: int, db: Session = Depends(get_db)):
    dep = db.query(models.ProcessDependency).filter(
        models.ProcessDependency.process_id == proc_id,
        models.ProcessDependency.dependency_id == dep_id
    ).first()
    if not dep:
        raise HTTPException(status_code=404, detail="依赖关系不存在")
    db.delete(dep)
    db.commit()
    return {"ok": True}


@router.get("/delayed/list")
def list_delayed_processes(db: Session = Depends(get_db)):
    procs = db.query(models.Process).filter(models.Process.status != "completed").all()
    delayed = []
    for p in procs:
        if _check_delayed(p):
            today = date.today()
            delay_days = 0
            if p.planned_end_date and p.planned_end_date < today:
                delay_days = (today - p.planned_end_date).days
            delayed.append({
                "id": p.id, "name": p.name, "project_id": p.project_id,
                "status": p.status, "progress": p.progress,
                "planned_end_date": p.planned_end_date.isoformat() if p.planned_end_date else None,
                "actual_end_date": p.actual_end_date.isoformat() if p.actual_end_date else None,
                "delay_days": delay_days, "delay_reason": p.delay_reason or "未填写原因",
                "owner_team": p.owner_team
            })
    return delayed
