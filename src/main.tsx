import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, ConfigProvider } from 'antd';
import { ProConfigProvider } from '@ant-design/pro-components';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import SideLayout from './components/SideLayout';
import OverviewPage from './pages/OverviewPage';
import WeighingPage from './pages/WeighingPage';
import FruitCatalogPage from './pages/FruitCatalogPage';
import RawFruitPage from './pages/RawFruitPage';
import WorkerManagementPage from './pages/WorkerManagementPage';
import FinishedGoodsPage from './pages/FinishedGoodsPage';
import { FinishedGoodsProvider } from './finishedGoods';
import './styles/global-style.css';
import './styles/app.css';

dayjs.locale('zh-cn');
function RoutedPages() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    if (!location.hash) history.replaceState(null, '', '#/overview');
    const change = () => setHash(location.hash);
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const finishedGoods = hash.startsWith('#/finished-goods');
  const fruitCatalog = hash.startsWith('#/fruit-catalog');
  const workers = hash.startsWith('#/workers');
  const rawFruit = hash.startsWith('#/raw-fruit');
  const weighing = hash.startsWith('#/weighing');
  const activePage = finishedGoods ? '成品管理' : workers ? '工人管理' : rawFruit ? '原果管理' : fruitCatalog ? '果品资料' : weighing ? '采摘称重' : '业务概览';
  return <SideLayout activePage={activePage}>{finishedGoods ? <FinishedGoodsPage hash={hash} /> : workers ? <WorkerManagementPage /> : rawFruit ? <RawFruitPage /> : fruitCatalog ? <FruitCatalogPage /> : weighing ? <WeighingPage /> : <OverviewPage />}</SideLayout>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: '#0068ff', colorText: '#283b80', colorTextSecondary: '#59699d', colorBorder: '#dce4f4', colorBgLayout: '#f0f8fd', colorSuccess: '#00b83f', borderRadius: 6, borderRadiusLG: 8, fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif', controlHeight: 40,
  }, components: { Table: { headerBg: '#f3f8ff', borderColor: '#eaf0f8', cellPaddingBlockSM: 9, cellPaddingInlineSM: 8 }, Tabs: { horizontalItemGutter: 40 }, Pagination: { itemActiveBg: '#0068ff' } } }}>
    <ProConfigProvider>
      <App><FinishedGoodsProvider><RoutedPages /></FinishedGoodsProvider></App>
    </ProConfigProvider>
  </ConfigProvider>
</React.StrictMode>);
