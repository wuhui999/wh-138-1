import { useEffect, useState } from 'react'
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Select,
  DatePicker, InputNumber, Drawer, App, Tabs, Progress, Alert, Badge, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, FileTextOutlined, AlertOutlined, WarningOutlined
} from '@ant-design/icons'
import { inspectionApi, processApi, userApi, projectApi } from '../api'
import { INSPECTION_RESULT_MAP, STATUS_MAP } from '../store'
import dayjs from 'dayjs'

const { TabPane } = Tabs

export default function InspectionPage() {
  const { message } = App.useApp()
  const [allInspections, setAllInspections] = useState([])
  const [pendingList, setPendingList] = useState([])
  const [failedList, setFailedList] = useState([])
  const [processes, setProcesses] = useState([])
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentIns, setCurrentIns] = useState(null)
  const [editingIns, setEditingIns] = useState(null)
  const [form] = Form.useForm()
  const [selectedProject, setSelectedProject] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [all, pending, failed, us, projs] = await Promise.all([
        inspectionApi.list(),
        inspectionApi.pending(),
        inspectionApi.failed(),
        userApi.list(),
        projectApi.list(),
      ])
      setAllInspections(all)
      setPendingList(pending)
      setFailedList(failed)
      setUsers(us.filter(u => u.role === 'qa' || u.role === 'manager'))
      setProjects(projs)
    } catch (e) { message.error(e.message) }
  }

  const loadProcesses = async (projectId) => {
    setSelectedProject(projectId)
    if (projectId) {
      try { setProcesses(await processApi.list({ project_id: projectId })) }
      catch (e) { }
    } else setProcesses([])
  }

  const openCreate = () => {
    setEditingIns(null)
    form.resetFields()
    setSelectedProject(null)
    setProcesses([])
    form.setFieldsValue({ result: 'pending', rework_count: 0 })
    setModalOpen(true)
  }

  const openEdit = (ins) => {
    setEditingIns(ins)
    form.setFieldsValue({
      ...ins,
      inspection_date: ins.inspection_date ? dayjs(ins.inspection_date) : null,
      next_inspection_date: ins.next_inspection_date ? dayjs(ins.next_inspection_date) : null,
    })
    const project = projects.find(p => pendingList.find(pl => pl.id === ins.id)?.project_id === p.id
      || failedList.find(fl => fl.id === ins.id)?.project_id === p.id)
    if (project) loadProcesses(project.id)
    setModalOpen(true)
  }

  const viewInspection = async (ins) => {
    try {
      setCurrentIns(await inspectionApi.get(ins.id))
      setDetailOpen(true)
    } catch (e) { message.error(e.message) }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        inspection_date: values.inspection_date?.format('YYYY-MM-DD'),
        next_inspection_date: values.next_inspection_date?.format('YYYY-MM-DD'),
      }
      if (editingIns) {
        await inspectionApi.update(editingIns.id, payload)
        message.success('验收记录更新成功')
      } else {
        await inspectionApi.create(payload)
        message.success('验收记录创建成功')
      }
      setModalOpen(false)
      loadAll()
    } catch (e) { if (e.message) message.error(e.message) }
  }

  const quickAction = async (ins, result) => {
    try {
      await inspectionApi.update(ins.id, {
        result,
        inspection_date: dayjs().format('YYYY-MM-DD'),
        rework_count: result === 'failed' || result === 'rework' ? (ins.rework_count || 0) + 1 : ins.rework_count,
      })
      message.success(result === 'passed' ? '已通过验收' : result === 'failed' ? '已标记不通过' : '已安排返工')
      loadAll()
    } catch (e) { message.error(e.message) }
  }

  const commonColumns = (withActions = true) => [
    { title: '所属项目', dataIndex: 'project_name', width: 120, render: t => <Tag color="blue">{t}</Tag> },
    { title: '工序名称', dataIndex: 'process_name', width: 200 },
    { title: '验收日期', dataIndex: 'inspection_date', width: 120 },
    {
      title: '验收结果', dataIndex: 'result', width: 110,
      render: v => <Tag color={INSPECTION_RESULT_MAP[v]?.color}>
        {INSPECTION_RESULT_MAP[v]?.text}
      </Tag>
    },
    {
      title: '返工次数', dataIndex: 'rework_count', width: 90,
      render: v => v > 0 ? <Badge count={v} style={{ backgroundColor: '#ff4d4f' }} offset={[4, 0]} /> : <span style={{ color: '#999' }}>0</span>
    },
    { title: '质检员', width: 100, render: (_, r) => users.find(u => u.id === r.inspector_id)?.name || '-' },
    { title: '下次验收', dataIndex: 'next_inspection_date', width: 120 },
    withActions && {
      title: '操作', width: 260, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" icon={<FileTextOutlined />} onClick={() => viewInspection(r)}>查看</Button>
          {r.result !== 'passed' && (
            <>
              <Button size="small" type="link" icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => quickAction(r, 'passed')}>通过</Button>
              <Button size="small" type="link" icon={<SyncOutlined />}
                style={{ color: '#faad14' }}
                onClick={() => quickAction(r, 'rework')}>返工</Button>
              <Button size="small" type="link" danger icon={<CloseCircleOutlined />}
                onClick={() => quickAction(r, 'failed')}>不通过</Button>
            </>
          )}
        </Space>
      )
    },
  ].filter(Boolean)

  const pendingStats = {
    total: pendingList.length,
    rework: pendingList.filter(p => p.result === 'rework').length,
    normal: pendingList.filter(p => p.result === 'pending').length,
    highRework: pendingList.filter(p => p.rework_count >= 2).length,
  }

  const allColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '工序', dataIndex: 'process_id', width: 200,
      render: (pid, r) => processes.find(p => p.id === pid)?.name || projects.find(p => {
        const pr = pendingList.find(pl => pl.id === r.id) || failedList.find(fl => fl.id === r.id)
        return pr?.project_id === p.id
      })?.ship_name || `#${pid}`
    },
    {
      title: '结果', dataIndex: 'result', width: 100,
      render: v => <Tag color={INSPECTION_RESULT_MAP[v]?.color}>{INSPECTION_RESULT_MAP[v]?.text}</Tag>
    },
    { title: '返工', dataIndex: 'rework_count', width: 60 },
    { title: '日期', dataIndex: 'inspection_date', width: 110 },
    { title: '质检', width: 100, render: (_, r) => users.find(u => u.id === r.inspector_id)?.name || '-' },
    { title: '缺陷', dataIndex: 'defects', ellipsis: true },
    {
      title: '操作', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Tabs defaultActiveKey="pending">
        <TabPane tab={<span>
          <CheckCircleOutlined />待验收
          {pendingList.length > 0 && <Badge count={pendingList.length} offset={[4, -2]} />}
        </span>} key="pending">
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建验收</Button>
              <Tag color="default">待验收总数: {pendingStats.total}</Tag>
              <Tag color="processing">首次验收: {pendingStats.normal}</Tag>
              <Tag color="warning">返工中: {pendingStats.rework}</Tag>
              {pendingStats.highRework > 0 && <Tag color="error">多次返工: {pendingStats.highRework}</Tag>}
            </Space>
          </Card>

          {pendingList.some(p => p.rework_count >= 2) && (
            <Alert
              type="error"
              showIcon style={{ marginBottom: 16 }}
              message="存在多次返工的工序，请重点关注"
              description={`共 ${pendingStats.highRework} 项工序返工超过2次，建议组织专项评审。`}
            />
          )}

          <Card>
            <Table
              rowKey="id"
              dataSource={pendingList}
              columns={commonColumns(true)}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 1100 }}
              rowClassName={(r) => r.rework_count >= 2 ? 'table-row-warning' : ''}
              expandable={{
                expandedRowRender: (r) => (
                  <div style={{ padding: '0 24px' }}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {r.defects && <div><strong>缺陷记录：</strong><span style={{ color: '#ff4d4f' }}>{r.defects}</span></div>}
                      {r.remarks && <div><strong>备注：</strong>{r.remarks}</div>}
                    </Space>
                  </div>
                )
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span>
          <AlertOutlined />质量问题
          {failedList.length > 0 && <Badge count={failedList.length} offset={[4, -2]} />}
        </span>} key="failed">
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Alert
                type="warning" showIcon
                message={`共 ${failedList.length} 项存在质量问题`}
                description="包括验收不通过和需要返工的工序，需要及时跟进处理"
              />
            </Space>
          </Card>
          <Card>
            <Table
              rowKey="id"
              dataSource={failedList}
              columns={commonColumns(true)}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 1100 }}
              rowClassName={(r) => r.rework_count >= 3 ? 'table-row-danger' : ''}
              expandable={{
                expandedRowRender: (r) => (
                  <div style={{ padding: '0 24px' }}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {r.defects && (
                        <div style={{ padding: 12, background: '#fff1f0', borderRadius: 6 }}>
                          <strong style={{ color: '#ff4d4f' }}>发现缺陷：</strong>{r.defects}
                        </div>
                      )}
                      {r.rework_description && (
                        <div style={{ padding: 12, background: '#fff7e6', borderRadius: 6 }}>
                          <strong style={{ color: '#d46b08' }}>返工方案：</strong>{r.rework_description}
                        </div>
                      )}
                      {r.next_inspection_date && (
                        <div><strong>计划复检日期：</strong>{r.next_inspection_date}</div>
                      )}
                    </Space>
                  </div>
                )
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><FileTextOutlined />全部记录</span>} key="all">
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建验收</Button>
            </Space>
          </Card>
          <Card>
            <Table
              rowKey="id"
              dataSource={allInspections}
              columns={allColumns}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingIns ? '编辑验收记录' : '新建验收'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={600}
        okText="保存"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }}>
            <Form.Item label="所属项目" style={{ flex: 1 }}>
              <Select
                placeholder="先选择项目"
                value={selectedProject}
                onChange={(v) => { form.setFieldValue('process_id', null); loadProcesses(v) }}
                options={projects.map(p => ({ label: `${p.ship_name} - ${p.dock_number}`, value: p.id }))}
                allowClear
              />
            </Form.Item>
            <Form.Item name="process_id" label="验收工序" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select
                placeholder="选择工序"
                disabled={!selectedProject}
                options={processes.map(p => ({
                  label: `${p.name} (${STATUS_MAP[p.status]?.text} ${p.progress}%)`,
                  value: p.id
                }))}
                showSearch optionFilterProp="label"
              />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="inspection_date" label="验收日期" style={{ flex: 1 }} rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="inspector_id" label="质检员" style={{ flex: 1 }}>
              <Select options={users.map(u => ({ label: u.name, value: u.id }))} allowClear />
            </Form.Item>
          </Space>
          <Form.Item name="result" label="验收结果" rules={[{ required: true }]}>
            <Select options={Object.entries(INSPECTION_RESULT_MAP).map(([v, { text }]) => ({ value: v, label: text }))} />
          </Form.Item>
          <Form.Item name="defects" label="缺陷记录">
            <Input.TextArea rows={3} placeholder="描述发现的缺陷，如：焊缝有气孔、外板锈蚀超标等" />
          </Form.Item>
          <Form.Item name="rework_description" label="返工方案/要求">
            <Input.TextArea rows={2} placeholder="如需返工，描述具体要求" />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="rework_count" label="返工次数" style={{ width: 160 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="next_inspection_date" label="下次验收日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="验收详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
      >
        {currentIns && (
          <div>
            <Card size="small" title="基本信息" style={{ marginBottom: 12 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div><strong>工序：</strong>{currentIns.process?.name || '-'}</div>
                <div><strong>项目：</strong>{projects.find(p => pendingList.find(pl => pl.id === currentIns.id)?.project_id === p.id)?.ship_name || '-'}</div>
                <div><strong>结果：</strong>
                  <Tag color={INSPECTION_RESULT_MAP[currentIns.result]?.color}>
                    {INSPECTION_RESULT_MAP[currentIns.result]?.text}
                  </Tag>
                </div>
                <div><strong>验收日期：</strong>{currentIns.inspection_date || '-'}</div>
                <div><strong>质检员：</strong>{users.find(u => u.id === currentIns.inspector_id)?.name || '-'}</div>
                {currentIns.rework_count > 0 && (
                  <div><strong>返工次数：</strong>
                    <Badge count={currentIns.rework_count} style={{ backgroundColor: '#ff4d4f' }} />
                  </div>
                )}
              </Space>
            </Card>
            {currentIns.defects && (
              <Card size="small" title={<span style={{ color: '#ff4d4f' }}><WarningOutlined /> 缺陷记录</span>} style={{ marginBottom: 12 }}>
                {currentIns.defects}
              </Card>
            )}
            {currentIns.rework_description && (
              <Card size="small" title={<span style={{ color: '#faad14' }}><SyncOutlined /> 返工方案</span>} style={{ marginBottom: 12 }}>
                {currentIns.rework_description}
              </Card>
            )}
            {currentIns.next_inspection_date && (
              <Card size="small" title="复检安排">
                下次验收日期：{currentIns.next_inspection_date}
              </Card>
            )}
            {currentIns.remarks && (
              <Card size="small" title="备注" style={{ marginTop: 12 }}>
                {currentIns.remarks}
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
