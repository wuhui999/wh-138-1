from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class UserBase(BaseModel):
    username: str
    name: str
    role: str
    team: Optional[str] = None


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    ship_name: str
    ship_type: Optional[str] = None
    dock_number: str
    dock_in_date: date
    planned_dock_out_date: date
    actual_dock_out_date: Optional[date] = None
    description: Optional[str] = None
    status: str = "active"
    manager_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    ship_name: Optional[str] = None
    ship_type: Optional[str] = None
    dock_number: Optional[str] = None
    dock_in_date: Optional[date] = None
    planned_dock_out_date: Optional[date] = None
    actual_dock_out_date: Optional[date] = None
    description: Optional[str] = None
    status: Optional[str] = None
    manager_id: Optional[int] = None


class Project(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    progress: Optional[float] = 0.0
    total_processes: Optional[int] = 0
    completed_processes: Optional[int] = 0
    delayed_processes: Optional[int] = 0

    class Config:
        from_attributes = True


class ProcessDependencyBase(BaseModel):
    process_id: int
    dependency_id: int
    dependency_type: str = "finish_to_start"


class ProcessDependencyCreate(ProcessDependencyBase):
    pass


class ProcessDependency(ProcessDependencyBase):
    id: int

    class Config:
        from_attributes = True


class ProcessBase(BaseModel):
    project_id: int
    parent_id: Optional[int] = None
    name: str
    code: Optional[str] = None
    level: int = 1
    sort_order: int = 0
    status: str = "pending"
    owner_id: Optional[int] = None
    owner_team: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    progress: float = 0.0
    is_critical: bool = False
    delay_reason: Optional[str] = None
    description: Optional[str] = None


class ProcessCreate(ProcessBase):
    dependency_ids: Optional[List[int]] = None


class ProcessUpdate(BaseModel):
    parent_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None
    level: Optional[int] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    owner_id: Optional[int] = None
    owner_team: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    progress: Optional[float] = None
    is_critical: Optional[bool] = None
    delay_reason: Optional[str] = None
    description: Optional[str] = None


class Process(ProcessBase):
    id: int
    created_at: datetime
    updated_at: datetime
    dependencies: List[ProcessDependency] = []
    is_delayed: Optional[bool] = False
    can_start: Optional[bool] = True
    blocked_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ProcessTree(Process):
    children: List["ProcessTree"] = []


ProcessTree.model_rebuild()


class SparePartBase(BaseModel):
    name: str
    part_code: str
    specification: Optional[str] = None
    unit: str
    stock_quantity: float = 0.0
    safety_stock: float = 0.0
    supplier: Optional[str] = None
    unit_price: Optional[float] = None


class SparePartCreate(SparePartBase):
    pass


class SparePartUpdate(BaseModel):
    name: Optional[str] = None
    specification: Optional[str] = None
    unit: Optional[str] = None
    stock_quantity: Optional[float] = None
    safety_stock: Optional[float] = None
    supplier: Optional[str] = None
    unit_price: Optional[float] = None


class SparePart(SparePartBase):
    id: int
    created_at: datetime
    is_low_stock: Optional[bool] = False

    class Config:
        from_attributes = True


class PurchaseItemBase(BaseModel):
    part_id: int
    quantity: float
    arrived_quantity: float = 0.0
    unit_price: Optional[float] = None
    status: str = "pending"


class PurchaseItemCreate(PurchaseItemBase):
    pass


class PurchaseItemUpdate(BaseModel):
    arrived_quantity: Optional[float] = None
    status: Optional[str] = None


class PurchaseItem(PurchaseItemBase):
    id: int
    part: Optional[SparePart] = None

    class Config:
        from_attributes = True


class PurchaseRequestBase(BaseModel):
    project_id: int
    process_id: Optional[int] = None
    request_no: str
    title: str
    requester_id: Optional[int] = None
    status: str = "draft"
    urgency: str = "normal"
    expected_arrival_date: Optional[date] = None
    actual_arrival_date: Optional[date] = None
    remarks: Optional[str] = None


class PurchaseRequestCreate(PurchaseRequestBase):
    items: List[PurchaseItemCreate]


class PurchaseRequestUpdate(BaseModel):
    process_id: Optional[int] = None
    title: Optional[str] = None
    status: Optional[str] = None
    urgency: Optional[str] = None
    expected_arrival_date: Optional[date] = None
    actual_arrival_date: Optional[date] = None
    remarks: Optional[str] = None
    items: Optional[List[PurchaseItemCreate]] = None


class PurchaseRequest(PurchaseRequestBase):
    id: int
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseItem] = []
    process: Optional[Process] = None
    is_blocking: Optional[bool] = False

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    process_id: int
    inspector_id: Optional[int] = None
    inspection_date: Optional[date] = None
    result: str = "pending"
    defects: Optional[str] = None
    rework_description: Optional[str] = None
    rework_count: int = 0
    next_inspection_date: Optional[date] = None
    remarks: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionUpdate(BaseModel):
    inspector_id: Optional[int] = None
    inspection_date: Optional[date] = None
    result: Optional[str] = None
    defects: Optional[str] = None
    rework_description: Optional[str] = None
    rework_count: Optional[int] = None
    next_inspection_date: Optional[date] = None
    remarks: Optional[str] = None


class Inspection(InspectionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    process: Optional[Process] = None

    class Config:
        from_attributes = True


class RiskItem(BaseModel):
    type: str  # delay, shortage, manpower
    severity: str  # low, medium, high, critical
    title: str
    description: str
    related_id: Optional[int] = None
    related_type: Optional[str] = None
    created_at: Optional[datetime] = None


class StatsOverview(BaseModel):
    total_projects: int
    active_projects: int
    delayed_projects: int
    completed_projects: int
    total_processes: int
    completed_processes: int
    in_progress_processes: int
    delayed_processes: int
    pending_purchases: int
    overdue_purchases: int
    pending_inspections: int
    failed_inspections: int


class DelayReasonItem(BaseModel):
    reason: str
    count: int
    percentage: float
