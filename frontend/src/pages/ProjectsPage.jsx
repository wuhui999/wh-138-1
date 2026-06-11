import { useEffect, useState } from 'react'
import { Table, Card, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, Progress, Popconfirm, App } from 'antd'
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, RocketOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { projectApi, userApi } from '../api'
import dayjs from 'dayjs'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [managers, setManagers] = useState([])

  useEffect(() => {
    loadData()
    loadManagers()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try { setData(await projectApi.list()) }
    catch (e) { message.error(e.message) }
    setLoading(false)
  }

  const loadManagers = async () => {
    try { setManagers(await userApi.list('manager')) }
    catch (e) { console.error(e) }
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      dock_in_date: record.dock_in_date ? dayjs(record.dock_in_date) : null,
      planned_dock_out_date: record.planned_dock_out_date ? dayjs(record.planned_dock_out_date) : null,
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        dock_in_date: values.dock_in_date?.format('YYYY-MM-DD'),
        planned_dock_out_date: values.planned_dock_out_date?.format('YYYY-MM-DD'),
      }
      if (editing) {
        await projectApi.update(editing.id, payload)
        message.success('更新成功')
      } else {
        await projectApi.create(payload)
        message.success('创建成功')
      }
      setOpen(false)
      loadData()
    } catch (e) {
      if (e.message) message.error(e.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await projectApi.remove(id)
      message.success('删除成功')
      loadData()
    } catch (e) { message.error(e.message) }
  }

  const getStatusColor = (record) => {
    if (record.delayed_processes > 0) return 'error'
    if (record.progress >= 100) return 'success'
    if (record.progress > 0) return 'processing'
    return 'default'
  }

  const getStatusText = (record) => {
    if (record.delayed_processes > 0) return '有延期'
    if (record.progress >= 100) return '已完成'
    if (record.progress > 0) return '进行中'
    return '待开工'
  }

  const columns = [
    { title: '船名', dataIndex: 'ship_name', width: 140, render: (t, r) => <a onClick={() => navigate(`/projects/${r.id}`)}><strong>{t}</strong></a> },
    { title: '船型', dataIndex: 'ship_type', width: 100 },
    { title: '坞位', dataIndex: 'dock_number', width: 80, render: (t) => <Tag color="blue">{t}</Tag> },
    { title: '进坞日期', dataIndex: 'dock_in_date', width: 120 },
    { title: '计划出坞', dataIndex: 'planned_dock_out_date', width: 120 },
    {
      title: '总进度', dataIndex: 'progress', width: 200,
      render: (t, r) => <Progress
        percent={t}
        strokeColor={t >= 100 ? '#52c41a' : r.delayed_processes > 0 ? '#ff4d4f' : '#1677ff'}
        format={(p) => `${p}%`}
      />
    },
    {
      title: '工序统计', width: 150,
      render: (t, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontSize: 12 }}>
            <span style={{ color: '#52c41a' }}>●</span> 完成 {r.completed_processes}
            <span style={{ color: '#1677ff', marginLeft: 8 }}>●</span> 进行中 {r.total_processes - r.completed_processes - (r.delayed_processes || 0)}
          </span>
          <span style={{ fontSize: 12 }}>
            <span style={{ color: '#ff4d4f' }}>●</span> 延期 {r.delayed_processes || 0}
            <span style={{ marginLeft: 8 }}>共 {r.total_processes} 项</span>
          </span>
        </Space>
      )
    },
    { title: '项目经理', width: 110, render: (_, r) => managers.find(m => m.id === r.manager_id)?.name || '-' },
    { title: '状态', width: 90, render: (_, r) => <Tag color={getStatusColor(r)}>{getStatusText(r)}</Tag> },
    {
      title: '操作', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => navigate(`/projects/${r.id}`)}>详情</Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该项目？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建坞修项目</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑坞修项目' : '新建坞修项目'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="ship_name" label="船名" rules={[{ required: true, message: '请输入船名' }]}>
            <Input placeholder="请输入船名，如：远洋号" />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="ship_type" label="船型" style={{ flex: 1 }}>
              <Select placeholder="选择船型" options={[
                { value: '散货船' }, { value: '集装箱船' }, { value: '油轮' },
                { value: '客船' }, { value: '工程船' }, { value: '其他' },
              ]} allowClear />
            </Form.Item>
            <Form.Item name="dock_number" label="坞位编号" style={{ flex: 1 }} rules={[{ required: true, message: '请输入坞位' }]}>
              <Input placeholder="如：1#坞" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="dock_in_date" label="进坞日期" style={{ flex: 1 }} rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
            </Form.Item>
            <Form.Item name="planned_dock_out_date" label="计划出坞日期" style={{ flex: 1 }} rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
            </Form.Item>
          </Space>
          <Form.Item name="manager_id" label="项目经理">
            <Select placeholder="选择项目经理" options={managers.map(m => ({ label: m.name, value: m.id }))} allowClear />
          </Form.Item>
          <Form.Item name="status" label="项目状态" initialValue="active">
            <Select options={[
              { label: '进行中', value: 'active' },
              { label: '已完成', value: 'completed' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="坞修内容描述">
            <Input.TextArea rows={3} placeholder="描述本次坞修的主要内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
