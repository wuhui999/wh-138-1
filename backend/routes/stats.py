from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from database import get_db
import models
import schemas
from collections import Counter

router = APIRouter()


@router.get("/overview", response_model=schemas.StatsOverview)
def get_overview(db: Session = Depends(get_db)):
    today = date.today()
    total_projects = db.query(func.count(models.Project.id)).scalar() or 0
    active_projects = db.query(func.count(models.Project.id)).filter(
        models.Project.status == "active"
    ).scalar() or 0
    completed_projects = db.query(func.count(models.Project.id)).filter(
        models.Project.status == "completed"
    ).scalar() or 0

    delayed_projects = 0
    projects = db.query(models.Project).filter(models.Project.status == "active").all()
    for p in projects:
        if p.planned_dock_out_date and p.planned_dock_out_date < today:
            delayed_projects += 1

    total_processes = db.query(func.count(models.Process.id)).filter(models.Process.level == 1).scalar() or 0
    completed_processes = db.query(func.count(models.Process.id)).filter(
        models.Process.level == 1, models.Process.status == "completed"
    ).scalar() or 0
    in_progress_processes = db.query(func.count(models.Process.id)).filter(
        models.Process.level == 1, models.Process.status == "in_progress"
    ).scalar() or 0

    delayed_processes = 0
    procs = db.query(models.Process).filter(models.Process.level == 1, models.Process.status != "completed").all()
    for p in procs:
        if (p.planned_end_date and p.planned_end_date < today) or p.delay_reason:
            delayed_processes += 1

    pending_purchases = db.query(func.count(models.PurchaseRequest.id)).filter(
        models.PurchaseRequest.status.in_(["draft", "approved", "ordered", "partial_arrived"])
    ).scalar() or 0

    overdue_purchases = db.query(func.count(models.PurchaseRequest.id)).filter(
        models.PurchaseRequest.status.in_(["approved", "ordered", "partial_arrived"]),
        models.PurchaseRequest.expected_arrival_date < today
    ).scalar() or 0

    pending_inspections = db.query(func.count(models.Inspection.id)).filter(
        models.Inspection.result.in_(["pending", "rework"])
    ).scalar() or 0
    failed_inspections = db.query(func.count(models.Inspection.id)).filter(
        models.Inspection.result.in_(["failed", "rework"])
    ).scalar() or 0

    return schemas.StatsOverview(
        total_projects=total_projects,
        active_projects=active_projects,
        delayed_projects=delayed_projects,
        completed_projects=completed_projects,
        total_processes=total_processes,
        completed_processes=completed_processes,
        in_progress_processes=in_progress_processes,
        delayed_processes=delayed_processes,
        pending_purchases=pending_purchases,
        overdue_purchases=overdue_purchases,
        pending_inspections=pending_inspections,
        failed_inspections=failed_inspections,
    )


@router.get("/delay-reasons")
def get_delay_reasons(db: Session = Depends(get_db)):
    procs = db.query(models.Process).filter(
        models.Process.delay_reason.isnot(None),
        models.Process.delay_reason != ""
    ).all()

    reason_map = {
        "备件": "备件不足",
        "缺件": "备件不足",
        "库存不足": "备件不足",
        "到货": "备件未到货",
        "未到货": "备件未到货",
        "采购": "采购延误",
        "除锈": "前置工序滞后",
        "等待": "前置工序滞后",
        "返工": "质量返工",
        "验收": "质量返工",
        "人力": "人力不足",
        "进度滞后": "人力不足",
        "滞后": "人力不足",
    }

    raw_reasons = []
    for p in procs:
        reason = p.delay_reason
        categorized = "其他原因"
        for kw, cat in reason_map.items():
            if kw in reason:
                categorized = cat
                break
        raw_reasons.append(categorized)

    counter = Counter(raw_reasons)
    total = sum(counter.values()) or 1

    result = []
    for reason, count in counter.most_common():
        result.append({
            "reason": reason,
            "count": count,
            "percentage": round(count / total * 100, 1)
        })
    return result


@router.get("/shortage-rate")
def get_shortage_rate(db: Session = Depends(get_db)):
    parts = db.query(models.SparePart).all()
    total = len(parts)
    low_stock = sum(1 for p in parts if p.stock_quantity < p.safety_stock)
    out_of_stock = sum(1 for p in parts if p.stock_quantity == 0)

    parts_detail = []
    for p in parts:
        shortage = max(0, p.safety_stock - p.stock_quantity)
        parts_detail.append({
            "id": p.id, "name": p.name, "part_code": p.part_code,
            "stock": p.stock_quantity, "safety_stock": p.safety_stock,
            "unit": p.unit, "shortage": shortage,
            "is_low": p.stock_quantity < p.safety_stock,
            "is_out": p.stock_quantity == 0
        })

    return {
        "total_parts": total,
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "low_stock_rate": round(low_stock / total * 100, 1) if total > 0 else 0,
        "out_of_stock_rate": round(out_of_stock / total * 100, 1) if total > 0 else 0,
        "parts": parts_detail
    }


@router.get("/project-progress")
def get_project_progress(db: Session = Depends(get_db)):
    projects = db.query(models.Project).all()
    result = []
    for p in projects:
        procs = db.query(models.Process).filter(
            models.Process.project_id == p.id, models.Process.level == 1
        ).all()
        total = len(procs)
        if total == 0:
            progress = 0
        else:
            progress = round(sum(pr.progress for pr in procs) / total, 1)
        today = date.today()
        total_days = (p.planned_dock_out_date - p.dock_in_date).days if p.planned_dock_out_date and p.dock_in_date else 1
        elapsed = (today - p.dock_in_date).days if p.dock_in_date else 0
        schedule = round(min(elapsed / max(total_days, 1) * 100, 100), 1)
        deviation = round(progress - schedule, 1)

        completed = sum(1 for pr in procs if pr.status == "completed")
        in_progress = sum(1 for pr in procs if pr.status == "in_progress")
        pending = sum(1 for pr in procs if pr.status in ["pending", "blocked"])

        result.append({
            "id": p.id, "ship_name": p.ship_name, "dock_number": p.dock_number,
            "dock_in_date": p.dock_in_date.isoformat() if p.dock_in_date else None,
            "planned_dock_out_date": p.planned_dock_out_date.isoformat() if p.planned_dock_out_date else None,
            "progress": progress, "schedule": schedule, "deviation": deviation,
            "status": p.status,
            "total_processes": total, "completed": completed,
            "in_progress": in_progress, "pending": pending
        })
    return result


@router.get("/team-workload")
def get_team_workload(db: Session = Depends(get_db)):
    teams = db.query(models.Process.owner_team).filter(
        models.Process.owner_team.isnot(None)
    ).distinct().all()

    result = []
    for (team,) in teams:
        procs = db.query(models.Process).filter(models.Process.owner_team == team).all()
        total = len(procs)
        in_progress = sum(1 for p in procs if p.status == "in_progress")
        completed = sum(1 for p in procs if p.status == "completed")
        delayed = 0
        today = date.today()
        for p in procs:
            if p.status != "completed" and p.planned_end_date and p.planned_end_date < today:
                delayed += 1
        avg_progress = round(sum(p.progress for p in procs) / max(total, 1), 1)

        result.append({
            "team": team, "total": total, "completed": completed,
            "in_progress": in_progress, "delayed": delayed,
            "avg_progress": avg_progress,
            "utilization": round((completed * 100 + in_progress * 50) / max(total, 1), 1)
        })
    return sorted(result, key=lambda x: x["in_progress"], reverse=True)
