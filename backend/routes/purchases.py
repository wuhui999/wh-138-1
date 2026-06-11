from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
import models, schemas

router = APIRouter()


# ==================== 备件管理 ====================
@router.get("/parts", response_model=List[schemas.SparePart])
def list_parts(keyword: Optional[str] = None, low_stock_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.SparePart)
    if keyword:
        query = query.filter(
            (models.SparePart.name.contains(keyword)) |
            (models.SparePart.part_code.contains(keyword))
        )
    parts = query.order_by(models.SparePart.id).all()
    for p in parts:
        p.is_low_stock = p.stock_quantity < p.safety_stock
    if low_stock_only:
        parts = [p for p in parts if p.is_low_stock]
    return parts


@router.post("/parts", response_model=schemas.SparePart)
def create_part(part_in: schemas.SparePartCreate, db: Session = Depends(get_db)):
    existing = db.query(models.SparePart).filter(models.SparePart.part_code == part_in.part_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="备件编码已存在")
    part = models.SparePart(**part_in.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


@router.get("/parts/{part_id}", response_model=schemas.SparePart)
def get_part(part_id: int, db: Session = Depends(get_db)):
    part = db.query(models.SparePart).filter(models.SparePart.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="备件不存在")
    part.is_low_stock = part.stock_quantity < part.safety_stock
    return part


@router.put("/parts/{part_id}", response_model=schemas.SparePart)
def update_part(part_id: int, update_in: schemas.SparePartUpdate, db: Session = Depends(get_db)):
    part = db.query(models.SparePart).filter(models.SparePart.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="备件不存在")
    for key, val in update_in.model_dump(exclude_unset=True).items():
        setattr(part, key, val)
    db.commit()
    db.refresh(part)
    return part


# ==================== 请购单管理 ====================
@router.get("", response_model=List[schemas.PurchaseRequest])
def list_purchases(project_id: Optional[int] = None, status: Optional[str] = None,
                   urgency: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.PurchaseRequest)
    if project_id:
        query = query.filter(models.PurchaseRequest.project_id == project_id)
    if status:
        query = query.filter(models.PurchaseRequest.status == status)
    if urgency:
        query = query.filter(models.PurchaseRequest.urgency == urgency)
    prs = query.order_by(models.PurchaseRequest.id.desc()).all()
    today = date.today()
    for pr in prs:
        is_blocking = False
        if pr.process_id and pr.status in ["draft", "approved", "ordered", "partial_arrived"]:
            proc = db.query(models.Process).filter(models.Process.id == pr.process_id).first()
            if proc and (proc.is_critical or proc.status in ["pending", "blocked"]):
                if pr.expected_arrival_date and pr.expected_arrival_date < today:
                    is_blocking = True
                elif pr.urgency in ["urgent", "emergency"]:
                    is_blocking = True
        pr.is_blocking = is_blocking
    return prs


@router.post("", response_model=schemas.PurchaseRequest)
def create_purchase(pr_in: schemas.PurchaseRequestCreate, db: Session = Depends(get_db)):
    items_data = pr_in.items or []
    pr_data = pr_in.model_dump(exclude={"items"})
    pr = models.PurchaseRequest(**pr_data)
    db.add(pr)
    db.flush()
    for item_data in items_data:
        item = models.PurchaseItem(request_id=pr.id, **item_data.model_dump())
        db.add(item)
    db.commit()
    db.refresh(pr)
    return pr


@router.get("/{pr_id}", response_model=schemas.PurchaseRequest)
def get_purchase(pr_id: int, db: Session = Depends(get_db)):
    pr = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="请购单不存在")
    return pr


@router.put("/{pr_id}", response_model=schemas.PurchaseRequest)
def update_purchase(pr_id: int, update_in: schemas.PurchaseRequestUpdate, db: Session = Depends(get_db)):
    pr = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="请购单不存在")
    update_data = update_in.model_dump(exclude_unset=True)
    new_items = update_data.pop("items", None)
    for key, val in update_data.items():
        setattr(pr, key, val)

    if new_items is not None:
        for existing in pr.items:
            db.delete(existing)
        for item_data in new_items:
            db.add(models.PurchaseItem(request_id=pr.id, **item_data))

    if update_in.status == "arrived" and not pr.actual_arrival_date:
        pr.actual_arrival_date = date.today()
        for item in pr.items:
            item.arrived_quantity = item.quantity
            item.status = "arrived"
            if item.part:
                item.part.stock_quantity += item.quantity

    db.commit()
    db.refresh(pr)
    return pr


@router.delete("/{pr_id}")
def delete_purchase(pr_id: int, db: Session = Depends(get_db)):
    pr = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="请购单不存在")
    db.delete(pr)
    db.commit()
    return {"ok": True}


@router.put("/items/{item_id}/arrive", response_model=schemas.PurchaseItem)
def mark_item_arrived(item_id: int, arrived_quantity: Optional[float] = None, db: Session = Depends(get_db)):
    item = db.query(models.PurchaseItem).filter(models.PurchaseItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="采购项不存在")
    qty = arrived_quantity if arrived_quantity is not None else item.quantity
    item.arrived_quantity = min(item.arrived_quantity + qty, item.quantity)
    if item.arrived_quantity >= item.quantity:
        item.status = "arrived"
    else:
        item.status = "partial_arrived"
    if item.part:
        item.part.stock_quantity += qty

    pr = item.request
    all_arrived = all(i.status == "arrived" for i in pr.items)
    partial = any(i.status == "partial_arrived" for i in pr.items)
    if all_arrived:
        pr.status = "arrived"
        if not pr.actual_arrival_date:
            pr.actual_arrival_date = date.today()
    elif partial:
        pr.status = "partial_arrived"

    db.commit()
    db.refresh(item)
    return item


@router.get("/overdue/list")
def list_overdue_purchases(db: Session = Depends(get_db)):
    today = date.today()
    prs = db.query(models.PurchaseRequest).filter(
        models.PurchaseRequest.status.in_(["approved", "ordered", "partial_arrived"])
    ).all()
    overdue = []
    for pr in prs:
        if pr.expected_arrival_date and pr.expected_arrival_date < today:
            overdue_days = (today - pr.expected_arrival_date).days
            overdue.append({
                "id": pr.id, "request_no": pr.request_no, "title": pr.title,
                "project_id": pr.project_id, "process_id": pr.process_id,
                "status": pr.status, "urgency": pr.urgency,
                "expected_arrival_date": pr.expected_arrival_date.isoformat(),
                "actual_arrival_date": pr.actual_arrival_date.isoformat() if pr.actual_arrival_date else None,
                "overdue_days": overdue_days,
                "items": [{"part": it.part.name if it.part else "未知", "qty": it.quantity,
                           "arrived": it.arrived_quantity} for it in pr.items]
            })
    return sorted(overdue, key=lambda x: x["overdue_days"], reverse=True)
