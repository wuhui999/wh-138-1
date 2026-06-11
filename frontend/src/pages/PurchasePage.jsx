import { useEffect, useState } from 'react'
import {
  Card, Table, Tabs, Tag, Space, Button, Modal, Form, Input, Select,
  DatePicker, InputNumber, Drawer, App, Progress, Popconfirm, Badge, Alert, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, CheckCircleOutlined, WarningOutlined,
  InboxOutlined, FileDoneOutlined, ShoppingCartOutlined, EyeOutlined
} from '@ant-design/icons'
import { projectApi, processApi, partApi, purchaseApi, userApi } from '../api'
import { PURCHASE_STATUS_MAP, URGENCY_MAP, STATUS_MAP } from '../store'
import dayjs from 'dayjs'

const { TabPane } = Tabs

export default function PurchasePage() {
  const { message } = App.useApp()
  const [parts, setParts] = useState([])
  const [purchases, setPurchases] = useState([])
  const [projects, setProjects] = useState([])
  const [processes, setProcesses] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState({ parts: false, pr: false })
  const [modalOpen, setModalOpen] = useState(false)
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentPurchase, setCurrentPurchase] = useState(null)
  const [editingPart, setEditingPart] = useState(null)
  const [editingPR, setEditingPR] = useState(null)
  const [form] = Form.useForm()
  const [partForm] = Form.useForm()
  const [prForm] = Form.useForm()
  const [prItems, setPrItems] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [ps, prs, projs, us] = await Promise.all([
        partApi.list(), purchaseApi.list(), projectApi.list(), userApi.list(),
      ])
      setParts(ps)
      setPurchases(prs)
      setProjects(projs)
      setUsers(us.filter(u => u.role === 'procurement' || u.role === 'manager'))
    } catch (e) { message.error(e.message) }
  }

  const loadProcesses = async (projectId) => {
    setSelectedProject(projectId)
    if (projectId) {
      try {
        const procs = await processApi.list({ project_id: projectId })
        setProcesses(procs.filter(p => !p.parent_id || p.level === 2))
      } catch (e) { }
    } else {
      setProcesses([])
    }
  }

  const openCreatePart = () => {
    setEditingPart(null)
    partForm.resetFields()
    setPartModalOpen(true)
  }

  const openEditPart = (p) => {
    setEditingPart(p)
    partForm.setFieldsValue(p)
    setPartModalOpen(true)
  }

  const handlePartSubmit = async () => {
    try {
      const values = await partForm.validateFields()
      if (editingPart) {
        await partApi.update(editingPart.id, values)
        message.success('备件更新成功')
      } else {
        await partApi.create(values)
        message.success('备件创建成功')
      }
      setPartModalOpen(false)
      loadAll()
    } catch (e) { if (e.message) message.error(e.message) }
  }

  const openCreatePR = () => {
    setEditingPR(null)
    prForm.resetFields()
    setPrItems([])
    setSelectedProject(null)
    setProcesses([])
    prForm.setFieldsValue({
      status: 'draft',
      urgency: 'normal',
      request_no: `PR-${dayjs().format('YYYYMMDD-HHmm')}`,
    })
    setModalOpen(true)
  }

  const openEditPR = (pr) => {
    setEditingPR(pr)
    prForm.setFieldsValue({
      ...pr,
      expected_arrival_date: pr.expected_arrival_date ? dayjs(pr.expected_arrival_date) : null,
      actual_arrival_date: pr.actual_arrival_date ? dayjs(pr.actual_arrival_date) : null,
    })
    setPrItems(pr.items.map(i => ({
      part_id: i.part_id, part_name: i.part?.name,
      part_code: i.part?.part_code, quantity: i.quantity,
      unit: i.part?.unit, unit_price: i.unit_price,
      stock_quantity: i.part?.stock_quantity,
    })))
    loadProcesses(pr.project_id)
    setModalOpen(true)
  }

  const viewPurchase = async (pr) => {
    try {
      setCurrentPurchase(await purchaseApi.get(pr.id))
      setDetailOpen(true)
    } catch (e) { message.error(e.message) }
  }

  const handlePRSubmit = async () => {
    try {
      const values = await prForm.validateFields()
      if (prItems.length === 0) {
        message.warning('请至少添加一项备件')
        return
      }
      const payload = {
        ...values,
        expected_arrival_date: values.expected_arrival_date?.format('YYYY-MM-DD'),
        actual_arrival_date: values.actual_arrival_date?.format('YYYY-MM-DD'),
        items: prItems.map(i => ({
          part_id: i.part_id, quantity: i.quantity,
          unit_price: i.unit_price || 0, arrived_quantity: 0, status: 'pending',
        })),
      }
      if (editingPR) {
        await purchaseApi.update(editingPR.id, payload)
        message.success('请购单更新成功')
      } else {
        await purchaseApi.create(payload)
        message.success('请购单创建成功')
      }
      setModalOpen(false)
      loadAll()
    } catch (e) { if (e.message) message.error(e.message) }
  }

  const addPRItem = () => {
    setPrItems([...prItems, { part_id: null, quantity: 1, unit_price: 0 }])
  }

  const updatePRItem = (idx, field, value) => {
    const newItems = [...prItems]
    newItems[idx][field] = value
    if (field === 'part_id') {
      const part = parts.find(p => p.id === value)
      newItems[idx].part_name = part?.name
      newItems[idx].part_code = part?.part_code
      newItems[idx].unit = part?.unit
      newItems[idx].unit_price = part?.unit_price || 0
      newItems[idx].stock_quantity = part?.stock_quantity
    }
    setPrItems(newItems)
  }

  const removePRItem = (idx) => {
    setPrItems(prItems.filter((_, i) => i !== idx))
  }

  const markItemArrived = async (itemId, qty) => {
    try {
      await purchaseApi.markArrived(itemId, qty)
      message.success('入库成功')
      if (currentPurchase) {
        setCurrentPurchase(await purchaseApi.get(currentPurchase.id))
      }
      loadAll()
    } catch (e) { message.error(e.message) }
  }

  const deletePurchase = async (id) => {
    try {
      await purchaseApi.remove(id)
      message.success('已删除')
      loadAll()
    } catch (e) { message.error(e.message) }
  }

  const lowStockParts = parts.filter(p => p.is_low_stock)
  const overdueCount = purchases.filter(p =>
    p.status !== 'arrived' && p.status !== 'cancelled' &&
    p.expected_arrival_date && dayjs(p.expected_arrival_date) < dayjs()
  ).length

  const partColumns = [
    { title: '备件编码', dataIndex: 'part_code', width: 120, render: t => <code>{t}</code> },
    { title: '备件名称', dataIndex: 'name', width: 180 },
    { title: '规格型号', dataIndex: 'specification', width: 160 },
    { title: '单位', dataIndex: 'unit', width: 60 },
    {
      title: '库存', dataIndex: 'stock_quantity', width: 120,
      render: (t, r) => (
        <Space>
          <span style={{ color: r.is_low_stock ? '#ff4d4f' : '#333', fontWeight: r.is_low_stock ? 600 : 400 }}>
            {t}
          </span>
          {r.is_low_stock && <Badge count="库存不足" style={{ backgroundColor: '#ff4d4f' }} />}
        </Space>
      )
    },
    { title: '安全库存', dataIndex: 'safety_stock', width: 90 },
    {
      title: '库存健康度', width: 160,
      render: (_, r) => {
        const pct = r.safety_stock > 0 ? Math.min(100, Math.round(r.stock_quantity / r.safety_stock * 100)) : 0
        return <Progress percent={pct} size="small"
          strokeColor={pct >= 100 ? '#52c41a' : pct >= 50 ? '#faad14' : '#ff4d4f'} />
      }
    },
    { title: '供应商', dataIndex: 'supplier' },
    { title: '单价(¥)', dataIndex: 'unit_price', width: 100, render: t => t?.toLocaleString() },
    {
      title: '操作', width: 120, fixed: 'right',
      render: (_, r) => (
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditPart(r)}>编辑</Button>
      )
    },
  ]

  const prColumns = [
    { title: '请购单号', dataIndex: 'request_no', width: 160, render: (t, r) => <a onClick={() => viewPurchase(r)}><strong>{t}</strong></a> },
    { title: '请购标题', dataIndex: 'title', width: 200 },
    { title: '所属项目', width: 120, render: (_, r) => projects.find(p => p.id === r.project_id)?.ship_name || '-' },
    {
      title: '关联工序', width: 140,
      render: (_, r) => r.process ? (
        <Tooltip title={`工序状态: ${STATUS_MAP[r.process.status]?.text}`}>
          {r.process.name}
          {r.is_blocking && <Tag color="red" style={{ marginLeft: 4 }}>阻塞</Tag>}
        </Tooltip>
      ) : '-'
    },
    {
      title: '紧急度', dataIndex: 'urgency', width: 80,
      render: v => <Tag color={URGENCY_MAP[v]?.color}>{URGENCY_MAP[v]?.text}</Tag>
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v, r) => {
        const isOverdue = r.status !== 'arrived' && r.status !== 'cancelled' &&
          r.expected_arrival_date && dayjs(r.expected_arrival_date) < dayjs()
        return <Space>
          <Tag color={PURCHASE_STATUS_MAP[v]?.color}>{PURCHASE_STATUS_MAP[v]?.text}</Tag>
          {isOverdue && <Tag color="error">逾期</Tag>}
        </Space>
      }
    },
    { title: '采购项', width: 120, render: (_, r) => `${r.items.length}项 · ¥${r.items.reduce((s, i) => s + (i.quantity * (i.unit_price || 0)), 0).toLocaleString()}` },
    { title: '预计到货', dataIndex: 'expected_arrival_date', width: 110 },
    { title: '实际到货', dataIndex: 'actual_arrival_date', width: 110 },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => viewPurchase(r)}>查看</Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditPR(r)}>编辑</Button>
          <Popconfirm title="确认删除此请购单？" onConfirm={() => deletePurchase(r.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Tabs defaultActiveKey="parts">
        <TabPane tab={<span><InboxOutlined />备件库存
          {lowStockParts.length > 0 && <Badge count={lowStockParts.length} offset={[4, -2]} />}
        </span>} key="parts">
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePart}>新增备件</Button>
              <Tag color={lowStockParts.length > 0 ? 'error' : 'success'}>
                低库存备件: {lowStockParts.length} / {parts.length}
              </Tag>
            </Space>
          </Card>
          <Card>
            <Table
              rowKey="id"
              dataSource={parts}
              columns={partColumns}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 1200 }}
              rowClassName={(r) => r.is_low_stock ? 'table-row-warning' : ''}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><ShoppingCartOutlined />请购管理
          {overdueCount > 0 && <Badge count={overdueCount} offset={[4, -2]} />}
        </span>} key="purchase">
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePR}>新建请购单</Button>
              <Select
                style={{ width: 160 }}
                placeholder="按状态筛选"
                allowClear
                onChange={(v) => {
                  purchaseApi.list(v ? { status: v } : {}).then(setPurchases).catch(() => { })
                }}
                options={Object.entries(PURCHASE_STATUS_MAP).map(([v, { text }]) => ({ value: v, label: text }))}
              />
              <Select
                style={{ width: 140 }}
                placeholder="按紧急度"
                allowClear
                onChange={(v) => {
                  purchaseApi.list(v ? { urgency: v } : {}).then(setPurchases).catch(() => { })
                }}
                options={Object.entries(URGENCY_MAP).map(([v, { text }]) => ({ value: v, label: text }))}
              />
            </Space>
          </Card>
          <Card>
            <Table
              rowKey="id"
              dataSource={purchases}
              columns={prColumns}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 1300 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal title={editingPart ? '编辑备件' : '新增备件'} open={partModalOpen}
        onCancel={() => setPartModalOpen(false)} onOk={handlePartSubmit} width={560} okText="保存">
        <Form form={partForm} layout="vertical">
          <Space style={{ width: '100%' }}>
            <Form.Item name="part_code" label="备件编码" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Input placeholder="如：STL-001" disabled={!!editingPart} />
            </Form.Item>
            <Form.Item name="name" label="备件名称" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Input placeholder="如：船体外板钢板" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="specification" label="规格型号" style={{ flex: 1 }}>
              <Input placeholder="如：Q235 20mm" />
            </Form.Item>
            <Form.Item name="unit" label="单位" style={{ width: 120 }} rules={[{ required: true }]}>
              <Select options={['张', '桶', '组', '套', '片', '米', '个', '件'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="unit_price" label="单价(¥)" style={{ width: 160 }}>
              <InputNumber style={{ width: '100%' }} min={0} step={100} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="stock_quantity" label="当前库存" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} step={1} />
            </Form.Item>
            <Form.Item name="safety_stock" label="安全库存" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} step={1} />
            </Form.Item>
          </Space>
          <Form.Item name="supplier" label="供应商">
            <Input placeholder="如：宝钢" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingPR ? '编辑请购单' : '新建请购单'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handlePRSubmit} width={780} okText="保存" destroyOnClose>
        <Form form={prForm} layout="vertical">
          <Space style={{ width: '100%' }}>
            <Form.Item name="request_no" label="请购单号" style={{ width: 200 }} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="title" label="请购标题" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Input placeholder="如：主机活塞环采购" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="project_id" label="所属项目" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select
                placeholder="选择项目"
                options={projects.map(p => ({ label: `${p.ship_name} - ${p.dock_number}`, value: p.id }))}
                onChange={(v) => { prForm.setFieldValue('process_id', null); loadProcesses(v) }}
              />
            </Form.Item>
            <Form.Item name="process_id" label="关联工序（可阻塞）" style={{ flex: 1 }}>
              <Select
                placeholder="选择要关联的工序"
                disabled={!selectedProject}
                options={processes.map(p => ({
                  label: `${p.name}${p.is_critical ? '【关键】' : ''} (${STATUS_MAP[p.status]?.text})`,
                  value: p.id
                }))}
                allowClear showSearch optionFilterProp="label"
              />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="urgency" label="紧急度" style={{ width: 160 }} rules={[{ required: true }]}>
              <Select options={Object.entries(URGENCY_MAP).map(([v, { text }]) => ({ value: v, label: text }))} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 160 }} rules={[{ required: true }]}>
              <Select options={Object.entries(PURCHASE_STATUS_MAP).map(([v, { text }]) => ({ value: v, label: text }))} />
            </Form.Item>
            <Form.Item name="requester_id" label="申请人" style={{ flex: 1 }}>
              <Select options={users.map(u => ({ label: u.name, value: u.id }))} allowClear />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="expected_arrival_date" label="预计到货" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="actual_arrival_date" label="实际到货" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Divider style={{ margin: '8px 0 16px' }} orientation="left">采购明细</Divider>
          <div style={{ marginBottom: 12 }}>
            <Button size="small" icon={<PlusOutlined />} onClick={addPRItem}>添加采购项</Button>
          </div>

          {prItems.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', border: '1px dashed #d9d9d9', borderRadius: 8, color: '#999' }}>
              暂无采购项，请点击上方按钮添加
            </div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {prItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                  gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0'
                }}>
                  <Select
                    value={item.part_id}
                    placeholder="选择备件"
                    onChange={(v) => updatePRItem(idx, 'part_id', v)}
                    showSearch optionFilterProp="label"
                    options={parts.map(p => ({
                      label: `${p.part_code} | ${p.name} (库存:${p.stock_quantity}${p.unit})`,
                      value: p.id
                    }))}
                  />
                  <InputNumber min={0.1} step={1} value={item.quantity}
                    placeholder="数量"
                    onChange={(v) => updatePRItem(idx, 'quantity', v)} />
                  <Input value={item.unit} placeholder="单位" disabled />
                  <InputNumber min={0} step={100} value={item.unit_price}
                    placeholder="单价"
                    onChange={(v) => updatePRItem(idx, 'unit_price', v)} />
                  <Button danger size="small" onClick={() => removePRItem(idx)}>删除</Button>
                </div>
              ))}
            </div>
          )}

          <Form.Item name="remarks" label="备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={<Space>
          <FileDoneOutlined />
          请购单详情
          {currentPurchase && <Tag color={PURCHASE_STATUS_MAP[currentPurchase.status]?.color}>
            {PURCHASE_STATUS_MAP[currentPurchase.status]?.text}
          </Tag>}
        </Space>}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
      >
        {currentPurchase && (
          <div>
            <Card size="small" title="基本信息" style={{ marginBottom: 12 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div><strong>单号：</strong>{currentPurchase.request_no}</div>
                <div><strong>标题：</strong>{currentPurchase.title}</div>
                <div><strong>项目：</strong>{projects.find(p => p.id === currentPurchase.project_id)?.ship_name || '-'}</div>
                <div><strong>关联工序：</strong>{currentPurchase.process?.name || '-'}</div>
                <div><strong>紧急度：</strong>
                  <Tag color={URGENCY_MAP[currentPurchase.urgency]?.color}>
                    {URGENCY_MAP[currentPurchase.urgency]?.text}
                  </Tag>
                </div>
                <div><strong>预计到货：</strong>{currentPurchase.expected_arrival_date || '-'}</div>
                <div><strong>实际到货：</strong>{currentPurchase.actual_arrival_date || '-'}</div>
                {currentPurchase.remarks && <div><strong>备注：</strong>{currentPurchase.remarks}</div>}
              </Space>
            </Card>

            <Card size="small" title="采购明细">
              {currentPurchase.items?.map((item, idx) => (
                <div key={idx} style={{
                  padding: '10px 0', borderBottom: idx < currentPurchase.items.length - 1 ? '1px solid #f0f0f0' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Space>
                      <strong>{item.part?.name}</strong>
                      <code style={{ fontSize: 11 }}>{item.part?.part_code}</code>
                      <Tag color={item.status === 'arrived' ? 'success' : item.status === 'partial_arrived' ? 'warning' : 'default'}>
                        {item.status === 'arrived' ? '已到货' : item.status === 'partial_arrived' ? '部分到货' : '待到货'}
                      </Tag>
                    </Space>
                    <span>¥{(item.quantity * (item.unit_price || 0)).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                    {item.part?.specification} · 数量 {item.quantity}{item.part?.unit} · 已到 {item.arrived_quantity || 0}
                  </div>
                  {item.status !== 'arrived' && (
                    <Space>
                      <InputNumber
                        size="small"
                        min={0} max={item.quantity - (item.arrived_quantity || 0)}
                        step={1}
                        defaultValue={item.quantity - (item.arrived_quantity || 0)}
                        addonAfter={`${item.part?.unit}入库`}
                        style={{ width: 180 }}
                        id={`arrive-${item.id}`}
                      />
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                        onClick={() => {
                          const input = document.getElementById(`arrive-${item.id}`)
                          const qty = parseFloat(input?.querySelector('input')?.value) || (item.quantity - (item.arrived_quantity || 0))
                          markItemArrived(item.id, qty)
                        }}>
                        确认入库
                      </Button>
                    </Space>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  )
}
