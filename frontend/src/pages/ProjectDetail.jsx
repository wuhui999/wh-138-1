import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Progress, Button, Space, Divider, Statistic, Row, Col, Empty, Tooltip, App, Modal, Form, Input, DatePicker, Select, Slider } from 'antd'
import { ArrowLeftOutlined, CalendarOutlined, TeamOutlined, AlertOutlined, CheckCircleOutlined, EditOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { projectApi, processApi, userApi } from '../api'
import { STATUS_MAP } from '../store'
import dayjs from 'dayjs'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [project, setProject] = useState(null)
  const [ganttTasks, setGanttTasks] = useState([])
  const [processes, setProcesses] = useState([])
  const [users, setUsers] = useState([])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentProc, setCurrentProc] = useState(null)
  const [form] = Form.useForm()
  const scrollRef = useRef(null)

  useEffect(() => {
    loadData()
    loadUsers()
  }, [id])

  const loadData = async () => {
    try {
      const [p, g, tree] = await Promise.all([
        projectApi.get(id),
        projectApi.gantt(id),
        processApi.tree(id),
      ])
      setProject(p)
      setGanttTasks(g.tasks)
      setProcesses(flattenTree(tree))
    } catch (e) { message.error(e.message) }
  }

  const loadUsers = async () => {
    try { setUsers(await userApi.list()) } catch (e) { }
  }

  const flattenTree = (tree, result = []) => {
    for (const node of tree) {
      result.push(node)
      if (node.children) flattenTree(node.children, result)
    }
    return result
  }

  const ganttConfig = useMemo(() => {
    if (!project) return null
    const start = dayjs(project.dock_in_date)
    const end = dayjs(project.planned_dock_out_date)
    const days = end.diff(start, 'day') + 1
    const today = dayjs()
    const todayOffset = Math.max(0, Math.min(days, today.diff(start, 'day')))
    return { start, end, days, todayOffset, today }
  }, [project])

  const getBarStyle = (task) => {
    const { start } = ganttConfig
    const plannedStart = dayjs(task.planned_start)
    const plannedEnd = dayjs(task.planned_end)
    const left = Math.max(0, plannedStart.diff(start, 'day'))
    const width = Math.max(1, plannedEnd.diff(plannedStart, 'day') + 1)

    let actualLeft = 0, actualWidth = 0
    if (task.actual_start) {
      actualLeft = Math.max(0, dayjs(task.actual_start).diff(start, 'day'))
      const aEnd = task.actual_end ? dayjs(task.actual_end) : ganttConfig.today
      actualWidth = Math.max(1, aEnd.diff(dayjs(task.actual_start), 'day') + 1)
    }

    const colors = {
      completed: { planned: '#52c41a', actual: '#73d13d' },
      in_progress: { planned: '#1677ff', actual: '#4096ff' },
      blocked: { planned: '#faad14', actual: '#ffc53d' },
      pending: { planned: '#bfbfbf', actual: '#d9d9d9' },
    }
    const c = colors[task.status] || colors.pending

    return { left, width, actualLeft, actualWidth, colors: c }
  }

  const openEditProgress = (proc) => {
    setCurrentProc(proc)
    form.setFieldsValue({
      progress: proc.progress,
      status: proc.status,
      actual_start_date: proc.actual_start_date ? dayjs(proc.actual_start_date) : null,
      actual_end_date: proc.actual_end_date ? dayjs(proc.actual_end_date) : null,
      delay_reason: proc.delay_reason,
      owner_id: proc.owner_id,
      owner_team: proc.owner_team,
    })
    setEditModalOpen(true)
  }

  const handleUpdateProc = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        actual_start_date: values.actual_start_date?.format('YYYY-MM-DD'),
        actual_end_date: values.actual_end_date?.format('YYYY-MM-DD'),
      }
      await processApi.update(currentProc.id, payload)
      message.success('更新成功')
      setEditModalOpen(false)
      loadData()
    } catch (e) { if (e.message) message.error(e.message) }
  }

  const startProcess = async (proc) => {
    try {
      await processApi.update(proc.id, { status: 'in_progress' })
      message.success('已开工')
      loadData()
    } catch (e) { message.error(e.message) }
  }

  if (!project || !ganttConfig) return <Empty description="加载中..." />

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>返回</Button>
          <h2 style={{ margin: 0 }}>{project.ship_name} · 坞修项目详情</h2>
        </Space>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => { }}>编辑项目</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="船名">{project.ship_name}</Descriptions.Item>
              <Descriptions.Item label="船型">{project.ship_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="坞位"><Tag color="blue">{project.dock_number}</Tag></Descriptions.Item>
              <Descriptions.Item label="项目经理">{users.find(u => u.id === project.manager_id)?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="进坞日期"><Space><CalendarOutlined />{project.dock_in_date}</Space></Descriptions.Item>
              <Descriptions.Item label="计划出坞"><Space><CalendarOutlined />{project.planned_dock_out_date}</Space></Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '16px 0' }} />
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>总体进度</strong>
                <span style={{ color: project.delayed_processes > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                  {project.progress}% {project.delayed_processes > 0 && `(延期${project.delayed_processes}项)`}
                </span>
              </div>
              <Progress percent={project.progress}
                strokeColor={project.delayed_processes > 0 ? '#ff4d4f' : '#1677ff'}
                status={project.progress >= 100 ? 'success' : project.delayed_processes > 0 ? 'exception' : 'active'}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Card size="small"><Statistic title="工序总数" value={project.total_processes} suffix="项" /></Card>
            </Col>
            <Col span={12}>
              <Card size="small"><Statistic title="已完成" value={project.completed_processes} suffix="项" valueStyle={{ color: '#52c41a' }} /></Card>
            </Col>
            <Col span={12}>
              <Card size="small"><Statistic title="延期项" value={project.delayed_processes || 0} suffix="项" valueStyle={{ color: '#ff4d4f' }} prefix={<AlertOutlined />} /></Card>
            </Col>
            <Col span={12}>
              <Card size="small"><Statistic title="剩余天数" value={Math.max(0, dayjs(project.planned_dock_out_date).diff(dayjs(), 'day'))} suffix="天" prefix={<CalendarOutlined />} /></Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Card title={<span><CheckCircleOutlined style={{ color: '#1677ff', marginRight: 8 }} />坞修工序甘特图</span>} style={{ marginBottom: 16 }}>
        <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
          <div style={{ minWidth: Math.max(900, ganttConfig.days * 32 + 320) }}>
            <div style={{ display: 'flex', borderBottom: '2px solid #e8e8e8', background: '#fafafa', position: 'sticky', top: 0, zIndex: 10 }}>
              <div style={{ width: 320, padding: '8px 12px', fontWeight: 600, borderRight: '1px solid #e8e8e8', position: 'sticky', left: 0, background: '#fafafa', zIndex: 11 }}>
                工序名称
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                {Array.from({ length: ganttConfig.days }).map((_, i) => {
                  const d = ganttConfig.start.add(i, 'day')
                  const isToday = d.isSame(ganttConfig.today, 'day')
                  const isWeekend = d.day() === 0 || d.day() === 6
                  return (
                    <div key={i} style={{
                      flex: 1, minWidth: 32, textAlign: 'center', fontSize: 11,
                      padding: '4px 0', borderRight: '1px solid #f0f0f0',
                      background: isToday ? '#e6f4ff' : isWeekend ? '#fffbe6' : 'transparent',
                      color: isToday ? '#1677ff' : isWeekend ? '#faad14' : '#666',
                      fontWeight: isToday ? 600 : 400
                    }}>
                      {d.format('DD')}
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{d.format('MM/DD').split('/')[0]}月</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {ganttTasks.filter(t => t.level === 1).length === 0 ? (
              <Empty description="暂无工序" style={{ padding: 40 }} />
            ) : (
              ganttTasks.map((task) => {
                const style = getBarStyle(task)
                const level = task.level || 1
                return (
                  <div key={task.id}
                    onClick={() => openEditProgress(processes.find(p => p.id === task.id) || task)}
                    className="process-tree-node"
                    style={{
                      display: 'flex', cursor: 'pointer',
                      borderBottom: '1px solid #f5f5f5',
                      background: task.is_delayed ? '#fff1f0' : 'transparent'
                    }}>
                    <div style={{
                      width: 320, padding: '8px 12px',
                      borderRight: '1px solid #f0f0f0',
                      paddingLeft: 12 + (level - 1) * 20,
                      position: 'sticky', left: 0,
                      background: task.is_delayed ? '#fff1f0' : 'white',
                      zIndex: 5
                    }}>
                      <div style={{ fontSize: level === 1 ? 14 : 13, fontWeight: level === 1 ? 600 : 400 }}>
                        {task.is_critical && <Tag color="red" style={{ fontSize: 10, padding: '0 4px' }}>关键</Tag>}
                        {task.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {task.owner || '-'} · 进度 {task.progress}%
                        {task.is_delayed && <Tag color="warning" style={{ marginLeft: 4, fontSize: 10 }}>延期</Tag>}
                      </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative', padding: '10px 0', minHeight: 44 }}>
                      {Array.from({ length: ganttConfig.days }).map((_, i) => {
                        const d = ganttConfig.start.add(i, 'day')
                        const isToday = d.isSame(ganttConfig.today, 'day')
                        return (
                          <div key={i} style={{
                            position: 'absolute',
                            left: `${(i / ganttConfig.days) * 100}%`,
                            top: 0, bottom: 0, width: 1,
                            background: isToday ? '#1677ff' : 'transparent',
                            zIndex: 2
                          }} />
                        )
                      })}
                      <div
                        className="gantt-bar"
                        style={{
                          position: 'absolute',
                          left: `${(style.left / ganttConfig.days) * 100}%`,
                          width: `${(style.width / ganttConfig.days) * 100}%`,
                          top: 10, height: 10,
                          background: style.colors.planned,
                          borderRadius: 5, opacity: 0.25,
                          border: `1px dashed ${style.colors.planned}`
                        }}
                        title={`计划: ${task.planned_start} ~ ${task.planned_end}`}
                      />
                      {style.actualWidth > 0 && (
                        <Tooltip title={`实际进度: ${task.progress}%`}>
                          <div
                            className="gantt-bar"
                            style={{
                              position: 'absolute',
                              left: `${(style.actualLeft / ganttConfig.days) * 100}%`,
                              width: `${(Math.min(style.actualWidth, style.width) / ganttConfig.days) * 100}%`,
                              top: 10, height: 10,
                              background: style.colors.actual,
                              borderRadius: 5,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                          >
                            <div style={{
                              height: '100%',
                              width: `${task.progress}%`,
                              background: 'rgba(255,255,255,0.4)',
                              borderRadius: 5
                            }} />
                          </div>
                        </Tooltip>
                      )}
                      <div style={{
                        position: 'absolute',
                        left: `${(style.left / ganttConfig.days) * 100}%`,
                        width: `${(style.width / ganttConfig.days) * 100}%`,
                        top: 24, textAlign: 'center', fontSize: 10,
                        color: '#666', whiteSpace: 'nowrap', overflow: 'hidden'
                      }}>
                        {task.progress}%
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Card>

      <Modal
        title={`更新工序: ${currentProc?.name || ''}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleUpdateProc}
        width={560}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="进度" required>
            <Form.Item name="progress" noStyle rules={[{ required: true }]}>
              <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
            </Form.Item>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={Object.entries(STATUS_MAP).map(([v, { text }]) => ({ value: v, label: text }))} />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="actual_start_date" label="实际开工" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="actual_end_date" label="实际完工" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="owner_id" label="负责人" style={{ flex: 1 }}>
              <Select options={users.map(u => ({ label: u.name, value: u.id }))} allowClear showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="owner_team" label="负责班组" style={{ flex: 1 }}>
              <Select options={[
                { value: '船体车间' }, { value: '机电车间' }, { value: '涂装车间' },
                { value: '管装车间' }, { value: '舾装车间' },
              ]} allowClear />
            </Form.Item>
          </Space>
          <Form.Item name="delay_reason" label="延期/阻塞原因">
            <Input.TextArea rows={2} placeholder="如有延期或阻塞，请描述原因" />
          </Form.Item>
          {currentProc && !currentProc.can_start && (
            <div style={{ padding: 12, background: '#fff7e6', borderRadius: 6, color: '#ad6800', fontSize: 13 }}>
              <strong>⚠ 开工受限：</strong>{currentProc.blocked_reason}
            </div>
          )}
        </Form>
        {currentProc && currentProc.can_start && currentProc.status === 'pending' && (
          <Button type="primary" block icon={<PlayCircleOutlined />} style={{ marginTop: 8 }}
            onClick={() => startProcess(currentProc)}>
            立即开工
          </Button>
        )}
      </Modal>
    </div>
  )
}
