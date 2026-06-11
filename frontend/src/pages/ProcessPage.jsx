import { useEffect, useState } from 'react'
import { Card, Row, Col, Tree, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, Progress, Divider, Alert, Slider, Drawer, App, Empty, Tooltip, Cascader } from 'antd'
import { PlusOutlined, EditOutlined, LinkOutlined, DisconnectOutlined, PlayCircleOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { projectApi, processApi, userApi } from '../api'
import { STATUS_MAP } from '../store'
import dayjs from 'dayjs'

export default function ProcessPage() {
  const { message, modal } = App.useApp()
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [treeData, setTreeData] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [expandedKeys, setExpandedKeys] = useState([])
  const [processDetail, setProcessDetail] = useState(null)
  const [users, setUsers] = useState([])
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProc, setEditingProc] = useState(null)
  const [depDrawerOpen, setDepDrawerOpen] = useState(false)
  const [targetProcessId, setTargetProcessId] = useState(null)

  useEffect(() => {
    loadProjects()
    loadUsers()
  }, [])

  useEffect(() => {
    const ppid = searchParams.get('project_id')
    const pcid = searchParams.get('process_id')
    if (pcid) setTargetProcessId(Number(pcid))
    if (ppid && projects.length > 0) {
      const proj = projects.find(p => p.id === Number(ppid))
      if (proj) selectProject(proj.id, Number(pcid))
    } else if (pcid && projects.length > 0) {
      locateProcessAcrossProjects(Number(pcid))
    }
  }, [searchParams, projects])

  const locateProcessAcrossProjects = async (procId) => {
    for (const proj of projects) {
      try {
        const tree = await processApi.tree(proj.id)
        const flat = []
        const flatten = (nodes) => nodes.forEach(n => {
          flat.push(n)
          if (n.children?.length) flatten(n.children)
        })
        flatten(tree)
        const found = flat.find(n => n.id === procId)
        if (found) {
          await selectProject(proj.id, procId)
          return
        }
      } catch (e) { }
    }
    message.warning('未找到关联工序，已打开第一个项目')
    if (projects.length > 0) selectProject(projects[0].id)
  }

  const loadProjects = async () => {
    try {
      const ps = await projectApi.list()
      setProjects(ps)
      const ppid = searchParams.get('project_id')
      const pcid = searchParams.get('process_id')
      if (ppid) {
        const proj = ps.find(p => p.id === Number(ppid))
        if (proj) selectProject(proj.id, Number(pcid))
        else if (pcid) locateProcessAcrossProjects(Number(pcid))
        else if (ps.length > 0 && !selectedProject) selectProject(ps[0].id)
      } else if (pcid) {
        setTargetProcessId(Number(pcid))
      } else if (ps.length > 0 && !selectedProject) {
        selectProject(ps[0].id)
      }
    } catch (e) { message.error(e.message) }
  }

  const loadUsers = async () => {
    try { setUsers(await userApi.list()) } catch (e) { }
  }

  const findAncestorIds = (nodes, targetId, path = []) => {
    for (const n of nodes) {
      if (n.key === targetId) return [...path, n.key]
      if (n.children?.length) {
        const found = findAncestorIds(n.children, targetId, [...path, n.key])
        if (found) return found
      }
    }
    return null
  }

  const selectProject = async (projectId, autoSelectProcId = null) => {
    setSelectedProject(projectId)
    try {
      const tree = await processApi.tree(projectId)
      const antTree = buildAntTree(tree)
      setTreeData(antTree)
      setProcessDetail(null)
      setSelectedNode(null)

      const pickId = autoSelectProcId || targetProcessId
      if (pickId) {
        const flat = []
        const flatten = (nodes) => nodes.forEach(n => {
          flat.push(n.raw)
          if (n.children?.length) flatten(n.children)
        })
        flatten(antTree)
        const target = flat.find(n => n.id === pickId)
        if (target) {
          const ancestors = findAncestorIds(antTree, pickId)
          if (ancestors && ancestors.length > 1) {
            setExpandedKeys(ancestors.slice(0, -1).map(String))
          }
          setTimeout(async () => {
            setSelectedNode([String(pickId)])
            try {
              setProcessDetail(await processApi.get(pickId))
              message.success(`已定位到工序：${target.name}`)
            } catch (e) { }
          }, 200)
          setTargetProcessId(null)
          return
        }
      }
      // 无定位目标，默认展开全部
      const allKeys = []
      const walk = (nodes) => nodes.forEach(n => {
        if (n.children?.length) {
          allKeys.push(String(n.key))
          walk(n.children)
        }
      })
      walk(antTree)
      setExpandedKeys(allKeys)
    } catch (e) { message.error(e.message) }
  }

  const buildAntTree = (nodes) => {
    return nodes.map(n => ({
      key: n.id,
      title: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {n.is_critical && <Tag color="red" style={{ fontSize: 10, padding: '0 4px' }}>关键</Tag>}
            {n.is_delayed && <Tag color="orange" style={{ fontSize: 10, padding: '0 4px' }}>延期</Tag>}
            {!n.can_start && n.status !== 'completed' && <Tag color="warning" style={{ fontSize: 10, padding: '0 4px' }}>阻塞</Tag>}
            <span style={{ fontWeight: n.level === 1 ? 600 : 400 }}>{n.name}</span>
            <Tag color={STATUS_MAP[n.status]?.color} style={{ fontSize: 10, marginLeft: 'auto' }}>
              {STATUS_MAP[n.status]?.text} {n.progress}%
            </Tag>
          </div>
        </div>
      ),
      icon: n.progress >= 100 ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
        n.status === 'blocked' ? <WarningOutlined style={{ color: '#faad14' }} /> :
        n.status === 'in_progress' ? <ClockCircleOutlined style={{ color: '#1677ff' }} /> : null,
      children: n.children?.length ? buildAntTree(n.children) : undefined,
      raw: n,
    }))
  }

  const flattenTree = (nodes, result = []) => {
    for (const n of nodes) {
      result.push(n.raw)
      if (n.children) flattenTree(n.children, result)
    }
    return result
  }

  const onSelectNode = async (keys) => {
    if (keys.length === 0) {
      setSelectedNode(null)
      setProcessDetail(null)
      return
    }
    const key = keys[0]
    setSelectedNode(key)
    try {
      setProcessDetail(await processApi.get(key))
    } catch (e) { message.error(e.message) }
  }

  const openCreate = (parent = null) => {
    setEditingProc(null)
    form.resetFields()
    form.setFieldsValue({
      project_id: selectedProject,
      parent_id: parent?.id || null,
      level: parent ? parent.level + 1 : 1,
      status: 'pending',
    })
    setModalOpen(true)
  }

  const openEdit = (proc) => {
    setEditingProc(proc)
    form.setFieldsValue({
      ...proc,
      planned_start_date: proc.planned_start_date ? dayjs(proc.planned_start_date) : null,
      planned_end_date: proc.planned_end_date ? dayjs(proc.planned_end_date) : null,
      actual_start_date: proc.actual_start_date ? dayjs(proc.actual_start_date) : null,
      actual_end_date: proc.actual_end_date ? dayjs(proc.actual_end_date) : null,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        planned_start_date: values.planned_start_date?.format('YYYY-MM-DD'),
        planned_end_date: values.planned_end_date?.format('YYYY-MM-DD'),
        actual_start_date: values.actual_start_date?.format('YYYY-MM-DD'),
        actual_end_date: values.actual_end_date?.format('YYYY-MM-DD'),
      }
      if (editingProc) {
        await processApi.update(editingProc.id, payload)
        message.success('工序更新成功')
      } else {
        await processApi.create(payload)
        message.success('工序创建成功')
      }
      setModalOpen(false)
      selectProject(selectedProject)
    } catch (e) { if (e.message) message.error(e.message) }
  }

  const startProc = async (proc) => {
    try {
      await processApi.update(proc.id, { status: 'in_progress' })
      message.success('已开工')
      setProcessDetail(await processApi.get(proc.id))
      selectProject(selectedProject)
    } catch (e) { message.error(e.message) }
  }

  const updateProgress = async (proc, value) => {
    try {
      await processApi.update(proc.id, { progress: value })
      message.success('进度已更新')
      setProcessDetail(await processApi.get(proc.id))
      selectProject(selectedProject)
    } catch (e) { message.error(e.message) }
  }

  const removeDependency = async (procId, depId) => {
    try {
      await processApi.removeDependency(procId, depId)
      message.success('已移除依赖')
      setProcessDetail(await processApi.get(procId))
    } catch (e) { message.error(e.message) }
  }

  const addDependency = async (depId) => {
    if (!processDetail) return
    try {
      await processApi.addDependency(processDetail.id, {
        process_id: processDetail.id, dependency_id: depId, dependency_type: 'finish_to_start'
      })
      message.success('依赖添加成功')
      setProcessDetail(await processApi.get(processDetail.id))
    } catch (e) { message.error(e.message) }
  }

  const allProcs = flattenTree(treeData)

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%' }} wrap>
          <span>选择项目：</span>
          <Select
            style={{ minWidth: 240 }}
            value={selectedProject}
            onChange={selectProject}
            options={projects.map(p => ({ label: `${p.ship_name} - ${p.dock_number}`, value: p.id }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()} disabled={!selectedProject}>
            添加工序(顶级)
          </Button>
          {processDetail && (
            <>
              <Button icon={<PlusOutlined />} onClick={() => openCreate(processDetail)}>
                添加子工序
              </Button>
              <Button icon={<EditOutlined />} onClick={() => openEdit(processDetail)}>
                编辑当前
              </Button>
              <Button icon={<LinkOutlined />} onClick={() => setDepDrawerOpen(true)}>
                管理依赖
              </Button>
            </>
          )}
        </Space>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card title="工序结构树" style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
            {treeData.length === 0 ? (
              <Empty description="暂无工序数据">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>添加首个工序</Button>
              </Empty>
            ) : (
              <Tree
                showLine
                showIcon
                blockNode
                selectedKeys={selectedNode ? [selectedNode] : []}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onSelect={onSelectNode}
                treeData={treeData}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="工序详情">
            {!processDetail ? (
              <Empty description="请在左侧选择一个工序查看详情" />
            ) : (
              <div>
                {processDetail.is_delayed && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="该工序存在延期风险"
                    description={processDetail.delay_reason || `计划完成日期已过，请加快进度`}
                  />
                )}
                {!processDetail.can_start && processDetail.status !== 'completed' && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="该工序无法开工"
                    description={processDetail.blocked_reason}
                  />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Space>
                    <h3 style={{ margin: 0 }}>{processDetail.name}</h3>
                    {processDetail.is_critical && <Tag color="red">关键路径</Tag>}
                    <Tag color={STATUS_MAP[processDetail.status]?.color}>
                      {STATUS_MAP[processDetail.status]?.text}
                    </Tag>
                  </Space>
                  <Space>
                    {processDetail.status === 'pending' && processDetail.can_start && (
                      <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => startProc(processDetail)}>
                        开工
                      </Button>
                    )}
                  </Space>
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={<><ClockCircleOutlined /> 计划工期</>}>
                      <div>计划开工：{processDetail.planned_start_date || '-'}</div>
                      <div>计划完工：{processDetail.planned_end_date || '-'}</div>
                      {processDetail.planned_start_date && processDetail.planned_end_date && (
                        <div>工期：{dayjs(processDetail.planned_end_date).diff(processDetail.planned_start_date, 'day') + 1}天</div>
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={<><CheckCircleOutlined /> 实际工期</>}>
                      <div>实际开工：{processDetail.actual_start_date || '-'}</div>
                      <div>实际完工：{processDetail.actual_end_date || '-'}</div>
                      {processDetail.actual_start_date && (
                        <div>已用：{(processDetail.actual_end_date
                          ? dayjs(processDetail.actual_end_date)
                          : dayjs()
                        ).diff(processDetail.actual_start_date, 'day') + 1}天</div>
                      )}
                    </Card>
                  </Col>
                </Row>

                <Divider />

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>当前进度</strong>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}>{processDetail.progress}%</span>
                  </div>
                  <Slider
                    min={0} max={100} value={processDetail.progress}
                    onChangeComplete={(v) => updateProgress(processDetail, v)}
                    marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }}
                  />
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={<><TeamOutlined /> 责任分配</>}>
                      <div>负责班组：<Tag color="blue">{processDetail.owner_team || '未分配'}</Tag></div>
                      <div>负责人：{users.find(u => u.id === processDetail.owner_id)?.name || '未分配'}</div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={<><LinkOutlined /> 前置依赖 ({processDetail.dependencies?.length || 0})</>}>
                      {processDetail.dependencies?.length === 0 ? (
                        <div style={{ color: '#999' }}>无前置依赖</div>
                      ) : (
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          {processDetail.dependencies.map(dep => {
                            const depProc = allProcs.find(p => p.id === dep.dependency_id)
                            return (
                              <div key={dep.id} style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: '4px 8px', background: '#f5f5f5', borderRadius: 4
                              }}>
                                <span>
                                  {depProc ? (
                                    <>
                                      {depProc.name}
                                      <Tag style={{ marginLeft: 8 }} color={STATUS_MAP[depProc.status]?.color}>
                                        {STATUS_MAP[depProc.status]?.text}
                                      </Tag>
                                    </>
                                  ) : `工序#${dep.dependency_id}`}
                                </span>
                                <Button
                                  size="small" type="text" danger
                                  icon={<DisconnectOutlined />}
                                  onClick={() => removeDependency(processDetail.id, dep.dependency_id)}
                                >移除</Button>
                              </div>
                            )
                          })}
                        </Space>
                      )}
                    </Card>
                  </Col>
                </Row>

                {processDetail.delay_reason && (
                  <Alert
                    type="warning" showIcon style={{ marginTop: 16 }}
                    message="延期原因" description={processDetail.delay_reason}
                  />
                )}

                {processDetail.description && (
                  <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>工序说明</strong>
                    <div style={{ color: '#555' }}>{processDetail.description}</div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingProc ? '编辑工序' : '添加工序'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={600}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }}>
            <Form.Item name="project_id" hidden><Input /></Form.Item>
            <Form.Item name="parent_id" hidden><Input /></Form.Item>
            <Form.Item name="name" label="工序名称" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Input placeholder="如：船体外板除锈" />
            </Form.Item>
            <Form.Item name="code" label="工序编码" style={{ width: 160 }}>
              <Input placeholder="可选" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="level" label="层级" style={{ width: 120 }}>
              <Select options={[1, 2, 3].map(v => ({ value: v, label: `第${v}级` }))} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 140 }}>
              <Select options={Object.entries(STATUS_MAP).map(([v, { text }]) => ({ value: v, label: text }))} />
            </Form.Item>
            <Form.Item name="is_critical" label="关键路径" valuePropName="checked" style={{ flex: 1 }}>
              <Select options={[{ value: true, label: '是' }, { value: false, label: '否' }]} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="owner_team" label="负责班组" style={{ flex: 1 }}>
              <Select options={[
                { value: '船体车间' }, { value: '机电车间' }, { value: '涂装车间' },
                { value: '管装车间' }, { value: '舾装车间' }, { value: '质检部' },
              ]} allowClear />
            </Form.Item>
            <Form.Item name="owner_id" label="负责人" style={{ flex: 1 }}>
              <Select options={users.map(u => ({ label: u.name, value: u.id }))} allowClear showSearch optionFilterProp="label" />
            </Form.Item>
          </Space>
          <div style={{ color: '#666', fontSize: 12, margin: '4px 0 8px' }}>计划工期</div>
          <Space style={{ width: '100%' }}>
            <Form.Item name="planned_start_date" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="计划开工" />
            </Form.Item>
            <Form.Item name="planned_end_date" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="计划完工" />
            </Form.Item>
          </Space>
          {editingProc && (
            <>
              <div style={{ color: '#666', fontSize: 12, margin: '4px 0 8px' }}>实际工期</div>
              <Space style={{ width: '100%' }}>
                <Form.Item name="actual_start_date" style={{ flex: 1 }}>
                  <DatePicker style={{ width: '100%' }} placeholder="实际开工" />
                </Form.Item>
                <Form.Item name="actual_end_date" style={{ flex: 1 }}>
                  <DatePicker style={{ width: '100%' }} placeholder="实际完工" />
                </Form.Item>
              </Space>
              <Form.Item name="delay_reason" label="延期/阻塞原因">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}
          <Form.Item name="description" label="工序说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`管理依赖: ${processDetail?.name || ''}`}
        open={depDrawerOpen}
        onClose={() => setDepDrawerOpen(false)}
        width={420}
      >
        {processDetail && (
          <div>
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="前置依赖说明"
              description="被选为依赖的工序必须完成后，当前工序才能开工。"
            />
            <h4 style={{ marginBottom: 12 }}>当前依赖</h4>
            {processDetail.dependencies?.length === 0 ? (
              <Empty description="暂无依赖" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 24 }}>
                {processDetail.dependencies.map(dep => {
                  const depProc = allProcs.find(p => p.id === dep.dependency_id)
                  return (
                    <div key={dep.id} style={{
                      padding: '8px 12px', border: '1px solid #e8e8e8',
                      borderRadius: 6, display: 'flex', justifyContent: 'space-between'
                    }}>
                      <span>
                        {depProc?.name || `#${dep.dependency_id}`}
                        <Tag style={{ marginLeft: 8 }} color={STATUS_MAP[depProc?.status]?.color}>
                          {STATUS_MAP[depProc?.status]?.text} {depProc?.progress}%
                        </Tag>
                      </span>
                      <Button size="small" danger icon={<DisconnectOutlined />}
                        onClick={() => removeDependency(processDetail.id, dep.dependency_id)}>
                        移除
                      </Button>
                    </div>
                  )
                })}
              </Space>
            )}

            <Divider />
            <h4 style={{ marginBottom: 12 }}>添加依赖</h4>
            <Select
              style={{ width: '100%' }}
              placeholder="选择要作为前置的工序"
              showSearch optionFilterProp="label"
              onChange={(v) => addDependency(v)}
              options={allProcs
                .filter(p => p.id !== processDetail.id &&
                  !processDetail.dependencies?.some(d => d.dependency_id === p.id))
                .map(p => ({
                  label: `${p.name} (${STATUS_MAP[p.status]?.text} ${p.progress}%)`,
                  value: p.id
                }))}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}
