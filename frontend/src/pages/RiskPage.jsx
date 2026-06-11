import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Statistic, Tag, Space, Tabs, List, Empty, Badge, App, Select, Input, Progress
} from 'antd'
import {
  ClockCircleOutlined, WarningOutlined, ShoppingCartOutlined,
  TeamOutlined, ExclamationCircleOutlined, SearchOutlined,
  AlertOutlined, FireOutlined, RiseOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { riskApi } from '../api'
import { RISK_TYPE_MAP, SEVERITY_MAP, STATUS_MAP } from '../store'
import dayjs from 'dayjs'

const { TabPane } = Tabs

const RiskIcon = ({ type }) => {
  const map = RISK_TYPE_MAP[type]
  const Icon = {
    delay: ClockCircleOutlined,
    shortage: WarningOutlined,
    purchase: ShoppingCartOutlined,
    manpower: TeamOutlined,
    quality: ExclamationCircleOutlined,
  }[type] || AlertOutlined
  return <Icon style={{ color: map?.color || '#999', fontSize: 22 }} />
}

export default function RiskPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState({ risks: [], summary: {} })
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try { setData(await riskApi.all()) }
    catch (e) { message.error(e.message) }
    setLoading(false)
  }

  const filteredRisks = data.risks.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false
    if (keyword && !r.title.includes(keyword) && !r.description.includes(keyword)) return false
    return true
  })

  const s = data.summary || {}

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <Card style={{ background: 'linear-gradient(135deg,#fff1f0,#fff)' }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>风险总数</span>}
              value={s.total || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card style={{ background: 'linear-gradient(135deg,#fff2e8,#fff)' }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>严重风险</span>}
              value={s.critical || 0}
              valueStyle={{ color: '#d4380d' }}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card style={{ background: 'linear-gradient(135deg,#fff7e6,#fff)' }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>高风险</span>}
              value={s.high || 0}
              valueStyle={{ color: '#d46b08' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card style={{ background: 'linear-gradient(135deg,#e6f7ff,#fff)' }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>中风险</span>}
              value={s.medium || 0}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card style={{ background: 'linear-gradient(135deg,#f6ffed,#fff)' }}>
            <Statistic
              title={<span style={{ color: '#8c8c8c' }}>低风险</span>}
              value={s.low || 0}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Row gutter={8}>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>延期</div>
                <Tag color="orange">{s.by_type?.delay || 0}</Tag>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>缺件</div>
                <Tag color="red">{s.by_type?.shortage || 0}</Tag>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>采购逾期</div>
                <Tag color="magenta">{s.by_type?.purchase || 0}</Tag>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>质量/人力</div>
                <Space>
                  <Tag color="volcano">{s.by_type?.quality || 0}</Tag>
                  <Tag color="purple">{s.by_type?.manpower || 0}</Tag>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索风险标题/描述"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            style={{ width: 160 }}
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'delay', label: '延期风险' },
              { value: 'shortage', label: '缺件风险' },
              { value: 'purchase', label: '采购逾期' },
              { value: 'manpower', label: '人力冲突' },
              { value: 'quality', label: '质量风险' },
            ]}
          />
          <Select
            style={{ width: 140 }}
            value={filterSeverity}
            onChange={setFilterSeverity}
            options={[
              { value: 'all', label: '全部级别' },
              { value: 'critical', label: '严重' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
        </Space>
      </Card>

      <Card title={`风险详情 (${filteredRisks.length}项)`}>
        {filteredRisks.length === 0 ? (
          <Empty description="暂无风险数据 🎉" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={filteredRisks}
            renderItem={(r) => {
              const sev = SEVERITY_MAP[r.severity]
              const typeMap = RISK_TYPE_MAP[r.type]
              return (
                <List.Item>
                  <div
                    className="risk-card"
                    style={{
                      border: '1px solid #f0f0f0', borderRadius: 12,
                      background: sev.bg, padding: 16,
                      borderTop: `4px solid ${sev.dot}`,
                      height: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Space>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: 'white', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}>
                          <RiskIcon type={r.type} />
                        </div>
                        <Space direction="vertical" size={0}>
                          <Tag color={typeMap?.color} style={{ margin: 0 }}>
                            {typeMap?.text}
                          </Tag>
                          <Tag color={sev.color} style={{ margin: 0 }}>
                            {r.severity === 'critical' ? <FireOutlined /> : <WarningOutlined />}
                            {' '}{sev.text}
                          </Tag>
                        </Space>
                      </Space>
                      <Badge
                        status={r.severity === 'critical' ? 'error' :
                          r.severity === 'high' ? 'warning' :
                            r.severity === 'medium' ? 'processing' : 'default'}
                      />
                    </div>

                    <h4 style={{ margin: '0 0 8px', color: '#262626' }}>{r.title}</h4>
                    <p style={{ margin: 0, color: '#595959', fontSize: 13, lineHeight: 1.5, minHeight: 40 }}>
                      {r.description}
                    </p>

                    {r.ship_name && (
                      <div style={{ marginTop: 12 }}>
                        <Tag color="blue">{r.ship_name}</Tag>
                      </div>
                    )}

                    {r.extra && (
                      <div style={{
                        marginTop: 12, paddingTop: 12,
                        borderTop: '1px dashed rgba(0,0,0,0.1)',
                        fontSize: 12, color: '#666'
                      }}>
                        {r.extra.delay_days !== undefined && r.extra.delay_days > 0 && (
                          <div>延期天数: <strong style={{ color: '#ff4d4f' }}>{r.extra.delay_days}天</strong> · 进度 {r.extra.progress}%</div>
                        )}
                        {r.extra.overdue_days !== undefined && (
                          <div>逾期天数: <strong style={{ color: '#ff4d4f' }}>{r.extra.overdue_days}天</strong>
                            {r.extra.urgency && ` · ${r.extra.urgency === 'emergency' ? '特急' : r.extra.urgency === 'urgent' ? '紧急' : '普通'}`}
                          </div>
                        )}
                        {r.extra.shortage !== undefined && (
                          <div>缺货数量: <strong>{r.extra.shortage}{r.extra.unit || ''}</strong>
                            (库存{r.extra.stock}/安全{r.extra.safety_stock})
                          </div>
                        )}
                        {r.extra.rework_count !== undefined && (
                          <div>返工次数: <strong style={{ color: '#ff4d4f' }}>{r.extra.rework_count}次</strong></div>
                        )}
                        {r.extra.process_count !== undefined && (
                          <div>并行工序: <strong>{r.extra.process_count}个</strong></div>
                        )}
                        {r.extra.owner_team && (
                          <div>负责班组: {r.extra.owner_team}</div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {r.related_type === 'process' && (
                        <a onClick={() => navigate('/processes')}>前往工序 →</a>
                      )}
                      {r.related_type === 'purchase' && (
                        <a onClick={() => navigate('/purchases')}>前往采购 →</a>
                      )}
                      {r.related_type === 'part' && (
                        <a onClick={() => navigate('/purchases')}>处理缺件 →</a>
                      )}
                      {r.related_type === 'inspection' && (
                        <a onClick={() => navigate('/inspections')}>处理质量 →</a>
                      )}
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        )}
      </Card>
    </div>
  )
}
