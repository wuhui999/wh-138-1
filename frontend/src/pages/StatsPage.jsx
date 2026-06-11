import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Progress, Table, Tag, Space, App, Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import {
  ProjectOutlined, PartitionOutlined, AlertOutlined,
  CheckCircleOutlined, ShoppingCartOutlined, TeamOutlined,
  RiseOutlined, FallOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import { statsApi } from '../api'

export default function StatsPage() {
  const { message } = App.useApp()
  const [overview, setOverview] = useState(null)
  const [delayReasons, setDelayReasons] = useState([])
  const [shortage, setShortage] = useState(null)
  const [projectProgress, setProjectProgress] = useState([])
  const [teamWorkload, setTeamWorkload] = useState([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [o, dr, sh, pp, tw] = await Promise.all([
        statsApi.overview(),
        statsApi.delayReasons(),
        statsApi.shortageRate(),
        statsApi.projectProgress(),
        statsApi.teamWorkload(),
      ])
      setOverview(o)
      setDelayReasons(dr)
      setShortage(sh)
      setProjectProgress(pp)
      setTeamWorkload(tw)
    } catch (e) { message.error(e.message) }
  }

  const delayPieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}次 ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: { show: true, formatter: '{b}\n{d}%' },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      data: delayReasons.map((d, i) => ({
        value: d.count, name: d.reason,
        itemStyle: { color: ['#1677ff', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#52c41a', '#eb2f96'][i % 7] }
      }))
    }]
  }

  const progressBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['实际进度', '计划进度'], top: 0 },
    grid: { left: 60, right: 20, top: 40, bottom: 60 },
    xAxis: {
      type: 'category',
      data: projectProgress.map(p => p.ship_name),
      axisLabel: { rotate: 20, interval: 0 }
    },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: '实际进度', type: 'bar', data: projectProgress.map(p => p.progress),
        itemStyle: {
          color: (p) => projectProgress[p.dataIndex].deviation >= 0 ? '#52c41a' : '#ff4d4f',
          borderRadius: [4, 4, 0, 0]
        },
        label: { show: true, position: 'top', formatter: '{c}%' }
      },
      {
        name: '计划进度', type: 'bar', data: projectProgress.map(p => p.schedule),
        itemStyle: { color: '#e6f4ff', borderRadius: [4, 4, 0, 0], borderColor: '#1677ff', borderWidth: 1 },
      }
    ]
  }

  const shortageBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['实际库存', '安全库存', '缺货量'], top: 0 },
    grid: { left: 120, right: 20, top: 40, bottom: 20 },
    yAxis: {
      type: 'category',
      data: shortage?.parts?.slice(0, 15).map(p => p.name).reverse() || [],
    },
    xAxis: { type: 'value' },
    series: [
      {
        name: '实际库存', type: 'bar', stack: 'stock',
        data: shortage?.parts?.slice(0, 15).map(p => Math.min(p.stock, p.safety_stock)).reverse() || [],
        itemStyle: { color: (p) => shortage.parts.slice(0, 15).reverse()[p.dataIndex].is_out ? '#ff4d4f' : '#52c41a' }
      },
      {
        name: '缺货量', type: 'bar', stack: 'stock',
        data: shortage?.parts?.slice(0, 15).map(p => Math.max(0, p.safety_stock - p.stock)).reverse() || [],
        itemStyle: { color: '#ff7a45' }
      },
      {
        name: '安全库存', type: 'line',
        data: shortage?.parts?.slice(0, 15).map(p => p.safety_stock).reverse() || [],
        lineStyle: { color: '#1677ff', type: 'dashed' },
        symbol: 'none'
      }
    ]
  }

  const workloadRadarOption = {
    tooltip: {},
    legend: { data: ['利用率', '平均进度'], top: 0 },
    radar: {
      indicator: teamWorkload.map(t => ({ name: t.team, max: 100 })),
      shape: 'polygon',
      splitArea: { areaStyle: { color: ['#fafbff', '#f5f7ff'] } }
    },
    series: [{
      type: 'radar',
      data: [
        { value: teamWorkload.map(t => t.utilization), name: '利用率',
          itemStyle: { color: '#1677ff' }, areaStyle: { opacity: 0.2 } },
        { value: teamWorkload.map(t => t.avg_progress), name: '平均进度',
          itemStyle: { color: '#52c41a' }, areaStyle: { opacity: 0.2 } },
      ]
    }]
  }

  const teamColumns = [
    { title: '班组', dataIndex: 'team', width: 140, render: t => <Tag color="blue">{t}</Tag> },
    { title: '总工序', dataIndex: 'total', width: 80 },
    { title: '已完成', dataIndex: 'completed', width: 80, render: v => <span style={{ color: '#52c41a' }}>{v}</span> },
    { title: '进行中', dataIndex: 'in_progress', width: 80, render: v => <span style={{ color: '#1677ff' }}>{v}</span> },
    { title: '延期', dataIndex: 'delayed', width: 80, render: v => v > 0 ? <span style={{ color: '#ff4d4f' }}>{v}</span> : v },
    {
      title: '平均进度', dataIndex: 'avg_progress', width: 160,
      render: v => <Progress percent={v} size="small" />
    },
    {
      title: '资源利用率', dataIndex: 'utilization', width: 160,
      render: v => <Progress percent={v} size="small"
        strokeColor={v > 80 ? '#ff4d4f' : v > 60 ? '#faad14' : '#52c41a'} />
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title={<span><ProjectOutlined /> 项目总数</span>}
              value={overview?.total_projects || 0}
              valueStyle={{ color: '#1677ff' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title={<span><PartitionOutlined /> 工序完成</span>}
              value={overview?.completed_processes || 0}
              suffix={`/${overview?.total_processes || 0}`}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress
              percent={overview?.total_processes ? Math.round(overview.completed_processes / overview.total_processes * 100) : 0}
              size="small" showInfo={false} style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title={<span><AlertOutlined /> 延期工序</span>}
              value={overview?.delayed_processes || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title={<span><CheckCircleOutlined /> 待验收</span>}
              value={overview?.pending_inspections || 0}
              valueStyle={{ color: '#faad14' }}
              suffix={`(不通过${overview?.failed_inspections || 0})`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title={<span><ShoppingCartOutlined /> 采购未到货</span>}
              value={overview?.pending_purchases || 0}
              valueStyle={{ color: '#722ed1' }}
              suffix={`(逾期${overview?.overdue_purchases || 0})`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title={<span><TeamOutlined /> 仓库健康度</span>}
              value={shortage ? 100 - shortage.low_stock_rate : 0}
              suffix="%"
              valueStyle={{ color: shortage && shortage.low_stock_rate < 20 ? '#52c41a' : '#faad14' }}
            />
            <Progress
              percent={shortage ? 100 - shortage.low_stock_rate : 0}
              size="small" showInfo={false} style={{ marginTop: 8 }}
              strokeColor={shortage && shortage.low_stock_rate < 20 ? '#52c41a' : '#faad14'}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<span><RiseOutlined /> 项目进度对比（实际 vs 计划）</span>}>
            <ReactECharts option={progressBarOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span><ClockCircleOutlined /> 延期原因分布</span>}>
            {delayReasons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无延期数据 🎉</div>
            ) : (
              <ReactECharts option={delayPieOption} style={{ height: 320 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <span><ShoppingCartOutlined /> 库存健康度分析</span>
                <Tag color="default">总备件: {shortage?.total_parts || 0}</Tag>
                <Tag color="warning">低库存: {shortage?.low_stock_count || 0} ({shortage?.low_stock_rate}%)</Tag>
                <Tag color="error">缺货: {shortage?.out_of_stock_count || 0} ({shortage?.out_of_stock_rate}%)</Tag>
              </Space>
            }
          >
            <ReactECharts option={shortageBarOption} style={{ height: 400 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span><TeamOutlined /> 班组负载雷达</span>}>
            {teamWorkload.length === 0 ? (
              <Empty />
            ) : teamWorkload.length < 3 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                班组数量不足3个，雷达图不显示
                <div style={{ marginTop: 16, fontSize: 14 }}>
                  {teamWorkload.map(t => (
                    <div key={t.team} style={{ margin: '8px 0' }}>
                      <Tag color="blue">{t.team}</Tag>
                      进度 {t.avg_progress}% · 负载 {t.utilization}%
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ReactECharts option={workloadRadarOption} style={{ height: 400 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card title={<span><TeamOutlined /> 班组工作明细</span>}>
        <Table
          rowKey="team"
          dataSource={teamWorkload}
          columns={teamColumns}
          pagination={false}
        />
      </Card>
    </div>
  )
}
