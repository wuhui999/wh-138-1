import { create } from 'zustand'

export const useUserStore = create((set) => ({
  currentUser: {
    id: 1, username: 'admin', name: '系统管理员', role: 'manager', team: null
  },
  users: [],
  setCurrentUser: (user) => set({ currentUser: user }),
  setUsers: (users) => set({ users }),
}))

export const STATUS_MAP = {
  pending: { text: '待开工', color: 'default' },
  in_progress: { text: '进行中', color: 'processing' },
  blocked: { text: '已阻塞', color: 'warning' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
}

export const PURCHASE_STATUS_MAP = {
  draft: { text: '草稿', color: 'default' },
  approved: { text: '已审批', color: 'processing' },
  ordered: { text: '已下单', color: 'processing' },
  partial_arrived: { text: '部分到货', color: 'warning' },
  arrived: { text: '已到货', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
}

export const INSPECTION_RESULT_MAP = {
  pending: { text: '待验收', color: 'default' },
  passed: { text: '通过', color: 'success' },
  failed: { text: '不通过', color: 'error' },
  rework: { text: '返工中', color: 'warning' },
}

export const URGENCY_MAP = {
  normal: { text: '普通', color: 'default' },
  urgent: { text: '紧急', color: 'warning' },
  emergency: { text: '特急', color: 'error' },
}

export const SEVERITY_MAP = {
  low: { text: '低', color: 'default', bg: '#f0f0f0', dot: '#8c8c8c' },
  medium: { text: '中', color: 'warning', bg: '#fff7e6', dot: '#faad14' },
  high: { text: '高', color: 'error', bg: '#fff1f0', dot: '#ff7a45' },
  critical: { text: '严重', color: 'error', bg: '#fff1f0', dot: '#ff4d4f' },
}

export const RISK_TYPE_MAP = {
  delay: { text: '延期风险', icon: 'ClockCircleOutlined', color: '#faad14' },
  shortage: { text: '缺件风险', icon: 'WarningOutlined', color: '#ff7a45' },
  purchase: { text: '采购逾期', icon: 'ShoppingCartOutlined', color: '#eb2f96' },
  manpower: { text: '人力冲突', icon: 'TeamOutlined', color: '#722ed1' },
  quality: { text: '质量风险', icon: 'ExclamationCircleOutlined', color: '#ff4d4f' },
}

export const ROLE_MAP = {
  manager: { text: '项目经理', color: 'primary' },
  team: { text: '班组', color: 'success' },
  procurement: { text: '采购', color: 'processing' },
  qa: { text: '质检', color: 'warning' },
}
