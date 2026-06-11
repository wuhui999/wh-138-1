import { Layout, Menu, theme } from 'antd'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ProjectOutlined,
  PartitionOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProcessPage from './pages/ProcessPage.jsx'
import PurchasePage from './pages/PurchasePage.jsx'
import InspectionPage from './pages/InspectionPage.jsx'
import RiskPage from './pages/RiskPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/processes', icon: <PartitionOutlined />, label: '工序管理' },
  { key: '/purchases', icon: <ShoppingCartOutlined />, label: '请购管理' },
  { key: '/inspections', icon: <CheckCircleOutlined />, label: '验收管理' },
  { key: '/risks', icon: <AlertOutlined />, label: '风险看板' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计分析' },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const selectedKey = location.pathname.startsWith('/projects/')
    ? '/projects'
    : location.pathname

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{ background: '#001529' }}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <ShipIcon style={{ marginRight: 8 }} />
          船舶坞修管理平台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px', background: colorBgContainer,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)', zIndex: 10
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#001529' }}>
            {menuItems.find(m => m.key === selectedKey)?.label || '工作台'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#666' }}>系统管理员</span>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#1677ff', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              管
            </div>
          </div>
        </Header>
        <Content style={{
          margin: 16, padding: 24,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          minHeight: 280, overflow: 'auto'
        }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/processes" element={<ProcessPage />} />
            <Route path="/purchases" element={<PurchasePage />} />
            <Route path="/inspections" element={<InspectionPage />} />
            <Route path="/risks" element={<RiskPage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

function ShipIcon({ style }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M20 21c-1.5 0-3-.5-4-1.5-1 1-2.5 1.5-4 1.5s-3-.5-4-1.5C7 20.5 5.5 21 4 21v-2h16v2z" fill="white"/>
      <path d="M4 15l8-10 8 10v2H4v-2z" fill="white" opacity="0.7"/>
      <path d="M12 5v10" stroke="white" strokeWidth="1"/>
    </svg>
  )
}
