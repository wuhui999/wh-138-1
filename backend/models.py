from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    name = Column(String(100))
    role = Column(String(20))  # manager, team, procurement, qa
    team = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    ship_name = Column(String(100), index=True)
    ship_type = Column(String(50), nullable=True)
    dock_number = Column(String(20))
    dock_in_date = Column(Date)
    planned_dock_out_date = Column(Date)
    actual_dock_out_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # active, completed, delayed
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    processes = relationship("Process", back_populates="project", cascade="all, delete-orphan")
    purchases = relationship("PurchaseRequest", back_populates="project", cascade="all, delete-orphan")


class Process(Base):
    __tablename__ = "processes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    parent_id = Column(Integer, ForeignKey("processes.id"), nullable=True)
    name = Column(String(200))
    code = Column(String(50), nullable=True)
    level = Column(Integer, default=1)
    sort_order = Column(Integer, default=0)
    status = Column(String(20), default="pending")  # pending, in_progress, blocked, completed
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner_team = Column(String(50), nullable=True)
    planned_start_date = Column(Date, nullable=True)
    planned_end_date = Column(Date, nullable=True)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    progress = Column(Float, default=0.0)
    is_critical = Column(Boolean, default=False)
    delay_reason = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="processes")
    parent = relationship("Process", remote_side=[id], backref="children")
    dependencies = relationship("ProcessDependency", foreign_keys="ProcessDependency.process_id",
                                 back_populates="process", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="process", cascade="all, delete-orphan")


class ProcessDependency(Base):
    __tablename__ = "process_dependencies"
    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("processes.id"))
    dependency_id = Column(Integer, ForeignKey("processes.id"))
    dependency_type = Column(String(20), default="finish_to_start")

    process = relationship("Process", foreign_keys=[process_id], back_populates="dependencies")
    dependency = relationship("Process", foreign_keys=[dependency_id])


class SparePart(Base):
    __tablename__ = "spare_parts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    part_code = Column(String(50), unique=True, index=True)
    specification = Column(String(200), nullable=True)
    unit = Column(String(20))
    stock_quantity = Column(Float, default=0.0)
    safety_stock = Column(Float, default=0.0)
    supplier = Column(String(100), nullable=True)
    unit_price = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    purchase_items = relationship("PurchaseItem", back_populates="part")


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    process_id = Column(Integer, ForeignKey("processes.id"), nullable=True)
    request_no = Column(String(50), unique=True, index=True)
    title = Column(String(200))
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="draft")  # draft, approved, ordered, partial_arrived, arrived, cancelled
    urgency = Column(String(20), default="normal")  # normal, urgent, emergency
    expected_arrival_date = Column(Date, nullable=True)
    actual_arrival_date = Column(Date, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="purchases")
    process = relationship("Process")
    items = relationship("PurchaseItem", back_populates="request", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("purchase_requests.id"))
    part_id = Column(Integer, ForeignKey("spare_parts.id"))
    quantity = Column(Float)
    arrived_quantity = Column(Float, default=0.0)
    unit_price = Column(Float, nullable=True)
    status = Column(String(20), default="pending")  # pending, partial_arrived, arrived

    request = relationship("PurchaseRequest", back_populates="items")
    part = relationship("SparePart", back_populates="purchase_items")


class Inspection(Base):
    __tablename__ = "inspections"
    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("processes.id"))
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    inspection_date = Column(Date, nullable=True)
    result = Column(String(20), default="pending")  # pending, passed, failed, rework
    defects = Column(Text, nullable=True)
    rework_description = Column(Text, nullable=True)
    rework_count = Column(Integer, default=0)
    next_inspection_date = Column(Date, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    process = relationship("Process", back_populates="inspections")
