from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date, timedelta
from database import engine, get_db, Base
import models
import schemas

app = FastAPI(title="船舶坞修项目管理平台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def init_data():
    db = Session(bind=engine)
    try:
        if not db.query(models.User).first():
            users = [
                models.User(username="admin", name="系统管理员", role="manager", team=None),
                models.User(username="pm01", name="张经理", role="manager", team=None),
                models.User(username="team01", name="船体一班", role="team", team="船体车间"),
                models.User(username="team02", name="机电二班", role="team", team="机电车间"),
                models.User(username="team03", name="涂装三班", role="team", team="涂装车间"),
                models.User(username="purch01", name="李采购", role="procurement", team=None),
                models.User(username="qa01", name="王质检", role="qa", team=None),
            ]
            db.add_all(users)

        if not db.query(models.SparePart).first():
            parts = [
                models.SparePart(name="船体外板钢板", part_code="STL-001", specification="Q235 20mm", unit="张", stock_quantity=50, safety_stock=20, supplier="宝钢", unit_price=8500),
                models.SparePart(name="船用底漆", part_code="PNT-001", specification="环氧防锈漆", unit="桶", stock_quantity=30, safety_stock=15, supplier="海虹老人", unit_price=1200),
                models.SparePart(name="船用面漆", part_code="PNT-002", specification="聚氨酯面漆", unit="桶", stock_quantity=8, safety_stock=10, supplier="阿克苏诺贝尔", unit_price=2800),
                models.SparePart(name="主机活塞环", part_code="ENG-001", specification="MAN B&W", unit="组", stock_quantity=2, safety_stock=5, supplier="MAN", unit_price=15600),
                models.SparePart(name="螺旋桨密封件", part_code="PRP-001", specification="双唇密封", unit="套", stock_quantity=0, safety_stock=3, supplier="John Crane", unit_price=28000),
                models.SparePart(name="阀门垫片", part_code="VLV-001", specification="DN200 石墨", unit="片", stock_quantity=200, safety_stock=50, supplier="戈尔", unit_price=85),
                models.SparePart(name="电缆桥架", part_code="ELC-001", specification="300x100镀锌", unit="米", stock_quantity=120, safety_stock=80, supplier="大全", unit_price=65),
                models.SparePart(name="液压油管", part_code="HYD-001", specification="DN38 高压", unit="米", stock_quantity=15, safety_stock=30, supplier="派克", unit_price=320),
            ]
            db.add_all(parts)

        if not db.query(models.Project).first():
            today = date.today()
            p1 = models.Project(
                ship_name="远洋号", ship_type="散货船", dock_number="1#坞",
                dock_in_date=today - timedelta(days=2),
                planned_dock_out_date=today + timedelta(days=18),
                description="5年特检+常规坞修", status="active", manager_id=2
            )
            p2 = models.Project(
                ship_name="海风号", ship_type="集装箱船", dock_number="2#坞",
                dock_in_date=today - timedelta(days=5),
                planned_dock_out_date=today + timedelta(days=10),
                description="主机大修+船壳翻新", status="active", manager_id=2
            )
            db.add_all([p1, p2])
            db.flush()

            processes_p1 = [
                models.Process(project_id=1, parent_id=None, name="坞修准备", level=1, sort_order=1, status="completed",
                               owner_team="船体车间", planned_start_date=today - timedelta(days=2),
                               planned_end_date=today - timedelta(days=1), actual_start_date=today - timedelta(days=2),
                               actual_end_date=today - timedelta(days=1), progress=100, is_critical=False),
                models.Process(project_id=1, parent_id=1, name="船舶进坞定位", level=2, sort_order=1, status="completed",
                               owner_team="船体车间", progress=100),
                models.Process(project_id=1, parent_id=1, name="搭脚手架", level=2, sort_order=2, status="completed",
                               owner_team="船体车间", progress=100),
                models.Process(project_id=1, parent_id=None, name="船体工程", level=1, sort_order=2, status="in_progress",
                               owner_team="船体车间", planned_start_date=today,
                               planned_end_date=today + timedelta(days=8), actual_start_date=today,
                               progress=35, is_critical=True),
                models.Process(project_id=1, parent_id=4, name="船体外板除锈", level=2, sort_order=1, status="in_progress",
                               owner_team="船体车间", planned_start_date=today,
                               planned_end_date=today + timedelta(days=3), actual_start_date=today,
                               progress=60),
                models.Process(project_id=1, parent_id=4, name="外板缺陷修复", level=2, sort_order=2, status="blocked",
                               owner_team="船体车间", planned_start_date=today + timedelta(days=3),
                               planned_end_date=today + timedelta(days=6), progress=0, delay_reason="等待除锈完成"),
                models.Process(project_id=1, parent_id=4, name="压载舱检查维修", level=2, sort_order=3, status="pending",
                               owner_team="船体车间", planned_start_date=today + timedelta(days=4),
                               planned_end_date=today + timedelta(days=8), progress=0),
                models.Process(project_id=1, parent_id=None, name="涂装工程", level=1, sort_order=3, status="pending",
                               owner_team="涂装车间", planned_start_date=today + timedelta(days=6),
                               planned_end_date=today + timedelta(days=12), progress=0, is_critical=True),
                models.Process(project_id=1, parent_id=8, name="底漆喷涂", level=2, sort_order=1, status="pending",
                               owner_team="涂装车间", progress=0),
                models.Process(project_id=1, parent_id=8, name="面漆喷涂", level=2, sort_order=2, status="pending",
                               owner_team="涂装车间", progress=0, delay_reason="面漆库存不足"),
                models.Process(project_id=1, parent_id=None, name="机电工程", level=1, sort_order=4, status="pending",
                               owner_team="机电车间", planned_start_date=today + timedelta(days=5),
                               planned_end_date=today + timedelta(days=15), progress=0, is_critical=True),
                models.Process(project_id=1, parent_id=11, name="主机解体检修", level=2, sort_order=1, status="pending",
                               owner_team="机电车间", progress=0, delay_reason="活塞环备件不足"),
                models.Process(project_id=1, parent_id=11, name="尾轴密封更换", level=2, sort_order=2, status="pending",
                               owner_team="机电车间", progress=0, delay_reason="密封件未到货"),
                models.Process(project_id=1, parent_id=11, name="管系阀门检修", level=2, sort_order=3, status="pending",
                               owner_team="机电车间", progress=0),
                models.Process(project_id=1, parent_id=None, name="出坞验收", level=1, sort_order=5, status="pending",
                               owner_team="船体车间", planned_start_date=today + timedelta(days=17),
                               planned_end_date=today + timedelta(days=18), progress=0),
            ]
            processes_p2 = [
                models.Process(project_id=2, parent_id=None, name="坞修准备", level=1, sort_order=1, status="completed",
                               owner_team="船体车间", progress=100, is_critical=False),
                models.Process(project_id=2, parent_id=None, name="主机大修", level=1, sort_order=2, status="in_progress",
                               owner_team="机电车间", planned_start_date=today - timedelta(days=4),
                               planned_end_date=today + timedelta(days=3), actual_start_date=today - timedelta(days=4),
                               progress=55, is_critical=True, delay_reason="进度滞后2天"),
                models.Process(project_id=2, parent_id=None, name="船壳翻新", level=1, sort_order=3, status="in_progress",
                               owner_team="涂装车间", planned_start_date=today - timedelta(days=3),
                               planned_end_date=today + timedelta(days=5), actual_start_date=today - timedelta(days=3),
                               progress=40),
                models.Process(project_id=2, parent_id=None, name="验收交船", level=1, sort_order=4, status="pending",
                               owner_team="船体车间", planned_start_date=today + timedelta(days=8),
                               planned_end_date=today + timedelta(days=10), progress=0),
            ]
            db.add_all(processes_p1 + processes_p2)
            db.flush()

            deps = [
                models.ProcessDependency(process_id=6, dependency_id=5, dependency_type="finish_to_start"),
                models.ProcessDependency(process_id=9, dependency_id=5, dependency_type="finish_to_start"),
                models.ProcessDependency(process_id=10, dependency_id=9, dependency_type="finish_to_start"),
                models.ProcessDependency(process_id=15, dependency_id=4, dependency_type="finish_to_start"),
                models.ProcessDependency(process_id=15, dependency_id=8, dependency_type="finish_to_start"),
                models.ProcessDependency(process_id=15, dependency_id=11, dependency_type="finish_to_start"),
            ]
            db.add_all(deps)

            purchases = [
                models.PurchaseRequest(
                    project_id=1, process_id=12, request_no="PR-2026-001",
                    title="主机活塞环采购", requester_id=6, status="ordered", urgency="urgent",
                    expected_arrival_date=today + timedelta(days=2), remarks="主机大修急需"
                ),
                models.PurchaseRequest(
                    project_id=1, process_id=13, request_no="PR-2026-002",
                    title="螺旋桨密封件采购", requester_id=6, status="ordered", urgency="emergency",
                    expected_arrival_date=today + timedelta(days=1), remarks="尾轴密封更换急需"
                ),
                models.PurchaseRequest(
                    project_id=1, process_id=10, request_no="PR-2026-003",
                    title="船用面漆采购", requester_id=6, status="approved", urgency="normal",
                    expected_arrival_date=today + timedelta(days=5), remarks="涂装工程需要"
                ),
            ]
            db.add_all(purchases)
            db.flush()

            pr_items = [
                models.PurchaseItem(request_id=1, part_id=4, quantity=4, arrived_quantity=0, unit_price=15600),
                models.PurchaseItem(request_id=2, part_id=5, quantity=2, arrived_quantity=0, unit_price=28000),
                models.PurchaseItem(request_id=3, part_id=3, quantity=20, arrived_quantity=0, unit_price=2800),
            ]
            db.add_all(pr_items)

            inspections = [
                models.Inspection(process_id=2, inspector_id=7, inspection_date=today - timedelta(days=1),
                                  result="passed", defects=None, remarks="进坞定位准确"),
                models.Inspection(process_id=3, inspector_id=7, inspection_date=today - timedelta(days=1),
                                  result="passed", defects=None, remarks="脚手架搭设合格"),
                models.Inspection(process_id=5, inspector_id=7, inspection_date=today + timedelta(days=1),
                                  result="pending"),
            ]
            db.add_all(inspections)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Init data error: {e}")
    finally:
        db.close()


from routes import projects, processes, purchases, inspections, risks, stats, users

app.include_router(users.router, prefix="/api/users", tags=["用户管理"])
app.include_router(projects.router, prefix="/api/projects", tags=["项目管理"])
app.include_router(processes.router, prefix="/api/processes", tags=["工序管理"])
app.include_router(purchases.router, prefix="/api/purchases", tags=["请购管理"])
app.include_router(inspections.router, prefix="/api/inspections", tags=["验收管理"])
app.include_router(risks.router, prefix="/api/risks", tags=["风险管理"])
app.include_router(stats.router, prefix="/api/stats", tags=["统计分析"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "船舶坞修项目管理平台 API 运行正常"}
