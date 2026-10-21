// 基于 ant-design-skill SideLayout 模板，按 Figma 调整品牌、导航与顶部栏。
import { useState, type ReactNode } from 'react';
import { Avatar, Badge, Button, Dropdown, Modal, Popover, Select } from 'antd';
import { AppstoreOutlined, BarChartOutlined, BellOutlined, BlockOutlined, CloudOutlined, ClusterOutlined, ContainerOutlined, DesktopOutlined, DownOutlined, HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PictureOutlined, SettingOutlined, UpOutlined, UserOutlined } from '@ant-design/icons';
import brandSource from '../assets/figma-source.png';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from './floatingLayer';

export default function SideLayout({ children, activePage }: { children: ReactNode; activePage: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState(new Set(['blueberry', 'settings']));
  const [scope, setScope] = useState<string>();
  const toggleMenu = (id: string) => setOpenMenus(previous => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const standalone = [
    { id: 'screen', label: '智慧大棚大屏', icon: <AppstoreOutlined />, children: false },
    { id: 'system', label: '系统管理', icon: <DesktopOutlined />, children: true },
    { id: 'org', label: '组织管理', icon: <SettingOutlined />, children: true },
    { id: 'farm', label: '我的农场', icon: <HomeOutlined />, children: true },
    { id: 'tasks', label: '农事管理', icon: <CloudOutlined />, children: true },
    { id: 'stock', label: '物流库存（轻）', icon: <BlockOutlined />, children: true },
  ];
  const business = [
    { label: '业务概览', icon: <PictureOutlined /> },
    { label: '采摘称重', icon: <ContainerOutlined /> },
    { label: '原果管理', icon: <PictureOutlined /> },
    { label: '成品管理', icon: <BlockOutlined /> },
    { label: '散果管理', icon: <BarChartOutlined /> },
  ];
  return <div className={`side-layout blueberry-app ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand" aria-label="新疆农牧投 XAHG"><div className="brand-image"><img src={brandSource} alt="新疆农牧投" /></div></div>
      <nav className="side-menu" aria-label="主导航">
        {standalone.map(item => <button key={item.id} className="side-link" onClick={() => setScope(item.label)} title={collapsed ? item.label : undefined}>
          <span className="side-icon">{item.icon}</span><span className="menu-label">{item.label}</span>{item.children && <DownOutlined className="menu-chevron" />}
        </button>)}
        <div className={`side-item ${openMenus.has('blueberry') ? 'is-open' : ''}`}>
          <button className="side-link has-active-child" onClick={() => toggleMenu('blueberry')} title="蓝莓业务管理"><span className="side-icon"><ClusterOutlined /></span><span className="menu-label">蓝莓业务管理</span>{openMenus.has('blueberry') ? <UpOutlined className="menu-chevron" /> : <DownOutlined className="menu-chevron" />}</button>
          {(openMenus.has('blueberry') || collapsed) && <>{business.map(item => <button key={item.label} className={`side-link child-link ${item.label === activePage ? 'is-active' : ''}`} onClick={() => item.label === '采摘称重' ? window.location.hash = '/weighing/detail' : item.label === '业务概览' ? window.location.hash = '/overview' : item.label === '原果管理' ? window.location.hash = '/raw-fruit' : item.label === '成品管理' ? window.location.hash = '/finished-goods/inventory' : setScope(item.label)} title={item.label}>
            <span className="side-icon">{item.icon}</span><span className="menu-label">{item.label}</span>
          </button>)}
        <div className={`side-item ${openMenus.has('settings') ? 'is-open' : ''}`}>
          <button className="side-link child-link" onClick={() => toggleMenu('settings')} title="蓝莓业务设置"><span className="side-icon"><SettingOutlined /></span><span className="menu-label">蓝莓业务设置</span>{openMenus.has('settings') ? <UpOutlined className="menu-chevron" /> : <DownOutlined className="menu-chevron" />}</button>
          {openMenus.has('settings') && !collapsed && <div className="side-submenu">{['工人管理', '果品资料', '包装规格', '标签管理', '作业设备'].map(label => <button className={label === activePage ? 'is-active' : ''} key={label} onClick={() => label === '果品资料' ? window.location.hash = '/fruit-catalog' : label === '工人管理' ? window.location.hash = '/workers' : setScope(label)}>{label}</button>)}</div>}
        </div>
          </>}
        </div>
      </nav>
    </aside>
    <header className="topbar">
      <div className="topbar-left"><Button type="text" className="collapse-trigger" aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} /><div className="breadcrumb"><span>蓝莓业务管理</span><span>/</span><strong>{activePage}</strong></div></div>
      <div className="topbar-right">
        <Select className="base-select" aria-label="当前基地" value="新疆·阿克苏基地" options={[{ value: '新疆·阿克苏基地', label: '新疆·阿克苏基地' }]} />
        <Popover title="消息通知" content={<div className="notification"><strong>采摘称重记录已更新</strong><p>当前可查看 2026 年 10 月的采摘记录。</p></div>} trigger="click"><Button type="text" aria-label="消息通知" icon={<Badge dot><BellOutlined /></Badge>} /></Popover>
        <Dropdown menu={{ items: [{ key: 'profile', label: '个人资料' }, { key: 'help', label: '演示说明' }], onClick: ({ key }) => setScope(key === 'profile' ? '个人资料' : '演示说明') }} trigger={['click']}><button className="user-actions"><Avatar icon={<UserOutlined />} /><span>管理员</span><DownOutlined /></button></Dropdown>
      </div>
    </header>
    <main className="content">{children}</main>
    <Modal open={!!scope} onCancel={() => setScope(undefined)} footer={null} centered title={scope} width={FLOATING_LAYER_WIDTHS.confirmModal} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles()} className="business-modal">
      {scope === '个人资料' ? <p>当前用户：管理员<br />所属基地：新疆·阿克苏基地</p> : <p>当前可演示业务概览、采摘称重、原果管理、成品管理、工人管理与果品资料。成品管理支持组托入库、整托或整箱出库、出库单预览及原批次整批恢复。数据刷新后恢复初始状态；标签、语音和外部服务未连接。</p>}
    </Modal>
  </div>;
}
