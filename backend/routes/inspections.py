from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from database import get_db
import models, schemas

router = APIRouter()


@router.get("", response_model=List[schemas.Inspection])
def list_inspections(process_id: Optional[int] = None, result: Optional[str] = None,
                     db: Session = Depends(get_db)):
    query = db.query(models.Inspection)
    if process_id:
        query = query.filter(models.Inspection.process_id == process_id)
    if result:
        query = query.filter(models.Inspection.result == result)
    return query.order_by(models.Inspection.id.desc()).all()


@router.post("", response_model=schemas.Inspection)
def create_inspection(ins_in: schemas.InspectionCreate, db: Session = Depends(get_db)):
    proc = db.query(models.Process).filter(models.Process.id == ins_in.process_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="关联工序不存在")
    existing = db.query(models.Inspection).filter(
        models.Inspection.process_id == ins_in.process_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"该工序已存在验收记录(编号#{existing.id})，请勿重复创建。如需修改请直接编辑原验收单。")
    ins = models.Inspection(**ins_in.model_dump())
    db.add(ins)
    db.commit()
    db.refresh(ins)
    return ins


@router.get("/{ins_id}", response_model=schemas.Inspection)
def get_inspection(ins_id: int, db: Session = Depends(get_db)):
    ins = db.query(models.Inspection).filter(models.Inspection.id == ins_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="验收记录不存在")
    return ins


@router.put("/{ins_id}", response_model=schemas.Inspection)
def update_inspection(ins_id: int, update_in: schemas.InspectionUpdate, db: Session = Depends(get_db)):
    ins = db.query(models.Inspection).filter(models.Inspection.id == ins_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="验收记录不存在")

    update_data = update_in.model_dump(exclude_unset=True)
    new_result = update_data.get("result")

    if new_result == "failed" and not update_data.get("rework_count"):
        update_data["rework_count"] = ins.rework_count + 1
        if not update_data.get("next_inspection_date"):
            update_data["next_inspection_date"] = date.today() + timedelta(days=2)

    if new_result == "rework" and not update_data.get("rework_count"):
        update_data["rework_count"] = ins.rework_count + 1
        proc = ins.process
        if proc:
            proc.status = "in_progress"
            proc.progress = max(proc.progress - 20, 0)
            proc.delay_reason = f"验收不通过需返工(第{update_data['rework_count']}次)"

    if new_result == "passed":
        proc = ins.process
        if proc:
            proc.status = "completed"
            proc.progress = 100.0
            if not proc.actual_end_date:
                proc.actual_end_date = date.today()

    for key, val in update_data.items():
        setattr(ins, key, val)

    db.commit()
    db.refresh(ins)
    return ins


@router.delete("/{ins_id}")
def delete_inspection(ins_id: int, db: Session = Depends(get_db)):
    ins = db.query(models.Inspection).filter(models.Inspection.id == ins_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="验收记录不存在")
    db.delete(ins)
    db.commit()
    return {"ok": True}


@router.get("/pending/list")
def list_pending_inspections(db: Session = Depends(get_db)):
    inspections = db.query(models.Inspection).filter(
        models.Inspection.result.in_(["pending", "rework"])
    ).order_by(models.Inspection.inspection_date.asc().nullslast()).all()
    result = []
    for ins in inspections:
        proc = ins.process
        project = proc.project if proc else None
        result.append({
            "id": ins.id, "process_id": ins.process_id,
            "process_name": proc.name if proc else "未知工序",
            "project_id": project.id if project else None,
            "project_name": project.ship_name if project else "未知项目",
            "inspection_date": ins.inspection_date.isoformat() if ins.inspection_date else None,
            "result": ins.result, "rework_count": ins.rework_count,
            "next_inspection_date": ins.next_inspection_date.isoformat() if ins.next_inspection_date else None,
            "inspector_id": ins.inspector_id, "remarks": ins.remarks
        })
    return result


@router.get("/failed/list")
def list_failed_inspections(db: Session = Depends(get_db)):
    inspections = db.query(models.Inspection).filter(
        models.Inspection.result.in_(["failed", "rework"])
    ).order_by(models.Inspection.rework_count.desc()).all()
    result = []
    for ins in inspections:
        proc = ins.process
        project = proc.project if proc else None
        result.append({
            "id": ins.id, "process_id": ins.process_id,
            "process_name": proc.name if proc else "未知工序",
            "project_id": project.id if project else None,
            "project_name": project.ship_name if project else "未知项目",
            "inspection_date": ins.inspection_date.isoformat() if ins.inspection_date else None,
            "result": ins.result, "rework_count": ins.rework_count,
            "defects": ins.defects, "rework_description": ins.rework_description,
            "next_inspection_date": ins.next_inspection_date.isoformat() if ins.next_inspection_date else None
        })
    return result
