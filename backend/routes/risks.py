from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from database import get_db
import models
from collections import defaultdict

router = APIRouter()


@router.get("")
def get_all_risks(db: Session = Depends(get_db)):
    today = date.today()
    risks = []

    # 1. 延期工序风险
    procs = db.query(models.Process).filter(models.Process.status != "completed").all()
    for p in procs:
        is_delayed = False
        delay_days = 0
        if p.planned_end_date and p.planned_end_date < today:
            is_delayed = True
            delay_days = (today - p.planned_end_date).days
        elif p.delay_reason and p.status == "blocked":
            is_delayed = True

        if is_delayed:
            project = p.project
            severity = "low"
            if delay_days > 7 or (p.is_critical and delay_days > 2):
                severity = "critical"
            elif delay_days > 3 or p.is_critical:
                severity = "high"
            elif delay_days > 0:
                severity = "medium"

            risks.append({
                "type": "delay", "severity": severity,
                "title": f"[{project.ship_name if project else '未知项目'}] {p.name} 延期",
                "description": p.delay_reason or f"计划完成日期已过{delay_days}天，当前进度{p.progress}%",
                "related_id": p.id, "related_type": "process",
                "project_id": project.id if project else None,
                "ship_name": project.ship_name if project else "未知",
                "extra": {
                    "delay_days": delay_days, "progress": p.progress,
                    "owner_team": p.owner_team, "status": p.status,
                    "planned_end_date": p.planned_end_date.isoformat() if p.planned_end_date else None
                }
            })

    # 2. 备件短缺风险
    parts = db.query(models.SparePart).all()
    for part in parts:
        if part.stock_quantity < part.safety_stock:
            shortage = part.safety_stock - part.stock_quantity
            severity = "low"
            if shortage > part.safety_stock * 2:
                severity = "critical"
            elif shortage > part.safety_stock:
                severity = "high"
            elif shortage > 0:
                severity = "medium"

            risks.append({
                "type": "shortage", "severity": severity,
                "title": f"备件短缺: {part.name}",
                "description": f"库存 {part.stock_quantity}{part.unit}，安全库存 {part.safety_stock}{part.unit}，缺 {shortage}{part.unit}",
                "related_id": part.id, "related_type": "part",
                "extra": {
                    "part_code": part.part_code, "stock": part.stock_quantity,
                    "safety_stock": part.safety_stock, "shortage": shortage
                }
            })

    # 3. 采购逾期风险
    prs = db.query(models.PurchaseRequest).filter(
        models.PurchaseRequest.status.in_(["approved", "ordered", "partial_arrived"])
    ).all()
    for pr in prs:
        if pr.expected_arrival_date and pr.expected_arrival_date < today:
            overdue_days = (today - pr.expected_arrival_date).days
            proc = pr.process
            project = pr.project
            severity = "low"
            if pr.urgency == "emergency" or (proc and proc.is_critical and overdue_days > 2):
                severity = "critical"
            elif pr.urgency == "urgent" or overdue_days > 5:
                severity = "high"
            elif overdue_days > 2:
                severity = "medium"

            risks.append({
                "type": "purchase", "severity": severity,
                "title": f"采购逾期: {pr.request_no} {pr.title}",
                "description": f"预计到货 {pr.expected_arrival_date}，已逾期{overdue_days}天" +
                               (f"，关联关键工序: {proc.name}" if proc and proc.is_critical else ""),
                "related_id": pr.id, "related_type": "purchase",
                "project_id": project.id if project else None,
                "ship_name": project.ship_name if project else "未知",
                "extra": {
                    "request_no": pr.request_no, "overdue_days": overdue_days,
                    "status": pr.status, "urgency": pr.urgency,
                    "process_id": pr.process_id,
                    "process_name": proc.name if proc else None
                }
            })

    # 4. 人力冲突风险 (同一班组同时承担多个进行中工序)
    team_workload = defaultdict(list)
    for p in procs:
        if p.status == "in_progress" and p.owner_team:
            team_workload[p.owner_team].append(p)

    for team, work_procs in team_workload.items():
        if len(work_procs) >= 3:
            severity = "low"
            if len(work_procs) >= 5:
                severity = "high"
            elif len(work_procs) >= 4:
                severity = "medium"

            proc_names = [f"{p.name}({p.progress}%)" for p in work_procs]
            risks.append({
                "type": "manpower", "severity": severity,
                "title": f"人力冲突: {team}",
                "description": f"同时进行 {len(work_procs)} 个工序: {', '.join(proc_names)}",
                "related_id": None, "related_type": "team",
                "extra": {
                    "team": team, "process_count": len(work_procs),
                    "processes": [{"id": p.id, "name": p.name, "progress": p.progress} for p in work_procs]
                }
            })

    # 5. 验收失败/返工风险
    inspections = db.query(models.Inspection).filter(
        models.Inspection.result.in_(["failed", "rework"])
    ).all()
    for ins in inspections:
        proc = ins.process
        project = proc.project if proc else None
        severity = "low"
        if ins.rework_count >= 3:
            severity = "critical"
        elif ins.rework_count >= 2:
            severity = "high"
        elif ins.rework_count >= 1:
            severity = "medium"

        risks.append({
            "type": "quality", "severity": severity,
            "title": f"质量问题: {proc.name if proc else '未知工序'}",
            "description": f"返工次数 {ins.rework_count}，缺陷: {ins.defects or '未记录'}",
            "related_id": ins.id, "related_type": "inspection",
            "project_id": project.id if project else None,
            "ship_name": project.ship_name if project else "未知",
            "extra": {
                "rework_count": ins.rework_count, "defects": ins.defects,
                "result": ins.result, "process_id": proc.id if proc else None
            }
        })

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    risks.sort(key=lambda x: severity_order.get(x["severity"], 99))

    summary = {
        "total": len(risks),
        "critical": sum(1 for r in risks if r["severity"] == "critical"),
        "high": sum(1 for r in risks if r["severity"] == "high"),
        "medium": sum(1 for r in risks if r["severity"] == "medium"),
        "low": sum(1 for r in risks if r["severity"] == "low"),
        "by_type": {
            "delay": sum(1 for r in risks if r["type"] == "delay"),
            "shortage": sum(1 for r in risks if r["type"] == "shortage"),
            "purchase": sum(1 for r in risks if r["type"] == "purchase"),
            "manpower": sum(1 for r in risks if r["type"] == "manpower"),
            "quality": sum(1 for r in risks if r["type"] == "quality"),
        }
    }

    return {"risks": risks, "summary": summary}


@router.get("/type/{risk_type}")
def get_risks_by_type(risk_type: str, db: Session = Depends(get_db)):
    all_risks = get_all_risks(db)
    filtered = [r for r in all_risks["risks"] if r["type"] == risk_type]
    return {"risks": filtered, "count": len(filtered)}
