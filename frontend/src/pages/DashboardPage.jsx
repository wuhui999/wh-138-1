import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Progress, List, Tag, Space, Badge, Tooltip } from 'antd'
import {
  ProjectOutlined, PartitionOutlined, ShoppingCartOutlined,
  AlertOutlined, CheckCircleOutlined, WarningOutlined,
  ClockCircleOutlined, RiseOutlined, FallOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { statsApi, processApi, purchaseApi, inspectionApi } from '../api'
import { STATUS_MAP, SEVERITY_MAP, PURCHASE_STATUS_MAP } from '../store'
import dayjs from 'dayjs'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [delayed, setDelayed] = useState([])
  const [overduePurchases, setOverduePurchases] = useState([])
  const [pendingInspections, setPendingInspections] = useState([])
  const [projectProgress, setProjectProgress] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [o, d, p, i, pp] = await Promise.all([
        statsApi.overview(),
        processApi.delayed(),
        purchaseApi.overdue(),
        inspectionApi.pending(),
        statsApi.projectProgress(),
      ])
      setOverview(o)
      setDelayed(d)
      setOverduePurchases(p)
      setPendingInspections(i)
      setProjectProgress(pp)
    } catch (e) { console.error(e) }
  }

  const statCards = overview ? [
    { title: '项目总数', value: overview.total_projects, suffix: '个', icon: <ProjectOutlined />, color: '#1677ff', onClick: () => navigate('/projects') },
    { title: '进行中项目', value: overview.active_projects, suffix: '个', icon: <ProjectOutlined />, color: '#52c41a', onClick: () => navigate('/projects') },
    { title: '延期风险工序', value: overview.delayed_processes, suffix: '项', icon: <AlertOutlined />, color: '#ff4d4f', onClick: () => navigate('/risks') },
    { title: '待验收项', value: overview.pending_inspections, suffix: '项', icon: <CheckCircleOutlined />, color: '#faad14', onClick: () => navigate('/inspections') },
    { title: '采购未到货', value: overview.pending_purchases, suffix: '单', icon: <ShoppingCartOutlined />, color: '#722ed1', onClick: () => navigate('/purchases') },
    { title: '逾期采购单', value: overview.overdue_purchases, suffix: '单', icon: <WarningOutlined />, color: '#eb2f96', onClick: () => navigate('/purchases') },
  ] : []

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((s, idx) => (
          <Col xs={24} sm={12} md={8} lg={4} key={idx}>
            <Card hoverable onClick={s.onClick} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Statistic title={s.title} value={s.value} suffix={s.suffix} />
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `${s.color}15`, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24
                }}>
                  {s.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<span><PartitionOutlined style={{ color: '#1677ff', marginRight: 8 }} />项目进度总览</span>}
            extra={<a onClick={() => navigate('/projects')}>查看全部</a>}>
            <List
              dataSource={projectProgress}
              renderItem={(p) => (
                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Space>
                        <strong>{p.ship_name}</strong>
                        <Tag color="blue">{p.dock_number}</Tag>
                        {p.delayed > 0 && <Badge count={p.delayed} style={{ backgroundColor: '#ff4d4f' }} />}
                      </Space>
                      <Space>
                        {p.deviation >= 0
                          ? <span style={{ color: '#52c41a' }}><RiseOutlined /> 提前{p.deviation}%</span>
                          : <span style={{ color: '#ff4d4f' }}><FallOutlined /> 滞后{Math.abs(p.deviation)}%</span>}
                      </Space>
                    </div>
                    <Progress
                      percent={p.progress}
                      strokeColor={p.progress >= 100 ? '#52c41a' : p.deviation >= 0 ? '#1677ff' : '#ff4d4f'}
                      format={(percent) => `${percent}% / 计划 ${p.schedule}%`}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: '#999' }}>
                      <span>进坞: {p.dock_in_date}</span>
                      <span>
                        {p.completed}完成 / {p.in_progress}进行 / {p.pending}待工
                      </span>
                      <span>计划出坞: {p.planned_dock_out_date}</span>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<span><ClockCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />延期工序预警</span>}
            extra={<a onClick={() => navigate('/risks')}>风险看板</a>}
          >
            {delayed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无延期工序 🎉</div>
            ) : (
              <List
                dataSource={delayed.slice(0, 6)}
                renderItem={(item) => {
                  const severity = item.delay_days > 7 ? 'critical' : item.delay_days > 3 ? 'high' : item.delay_days > 0 ? 'medium' : 'low'
                  const sev = SEVERITY_MAP[severity]
                  return (
                    <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{
                        width: '100%', padding: '8px 12px',
                        background: sev.bg, borderRadius: 6, borderLeft: `4px solid ${sev.dot}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Tooltip title={item.delay_reason}>
                            <strong style={{ color: '#333' }}>{item.name}</strong>
                          </Tooltip>
                          <Space>
                            <Tag color={STATUS_MAP[item.status]?.color}>{STATUS_MAP[item.status]?.text}</Tag>
                            <Tag color={sev.color}>{item.delay_days > 0 ? `延期${item.delay_days}天` : '阻塞'}</Tag>
                          </Space>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                          <span>负责班组: {item.owner_team || '未分配'}</span>
                          <span>进度: {item.progress}%</span>
                          <span>计划完成: {item.planned_end_date || '-'}</span>
                        </div>
                      </div>
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<span><ShoppingCartOutlined style={{ color: '#722ed1', marginRight: 8 }} />逾期采购提醒</span>}
            extra={<a onClick={() => navigate('/purchases')}>请购中心</a>}
          >
            {overduePurchases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无逾期采购 📦</div>
            ) : (
              <List
                dataSource={overduePurchases.slice(0, 6)}
                renderItem={(item) => (
                  <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Space>
                          <strong>{item.request_no}</strong>
                          <span style={{ color: '#666' }}>{item.title}</span>
                        </Space>
                        <Space>
                          <Tag color={PURCHASE_STATUS_MAP[item.status]?.color}>
                            {PURCHASE_STATUS_MAP[item.status]?.text}
                          </Tag>
                          <Tag color="error">逾期{item.overdue_days}天</Tag>
                        </Space>
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                        {item.items?.map((it, idx) => (
                          <span key={idx} style={{ marginRight: 12 }}>
                            {it.part}: {it.arrived}/{it.qty}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        预计到货: {item.expected_arrival_date}
                        {item.process_name && ` · 关联工序: ${item.process_name}`}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<span><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />待办验收</span>}
            extra={<a onClick={() => navigate('/inspections')}>验收中心</a>}
          >
            {pendingInspections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无待办验收 ✅</div>
            ) : (
              <List
                dataSource={pendingInspections.slice(0, 6)}
                renderItem={(item) => (
                  <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Space>
                          <Tag color="blue">{item.project_name}</Tag>
                          <strong>{item.process_name}</strong>
                        </Space>
                        <Space>
                          {item.rework_count > 0 && (
                            <Tag color="warning">返工{item.rework_count}次</Tag>
                          )}
                          {item.result === 'rework' ? (
                            <Tag color="warning">返工中</Tag>
                          ) : (
                            <Tag>待验收</Tag>
                          )}
                        </Space>
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        计划验收: {item.inspection_date || '未排期'}
                        {item.next_inspection_date && ` · 下次验收: ${item.next_inspection_date}`}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
