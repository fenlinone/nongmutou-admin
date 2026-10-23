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
import PackagingSpecPage from './pages/PackagingSpecPage';
import LabelManagementPage from './pages/LabelManagementPage';
import FinishedGoodsPage from './pages/FinishedGoodsPage';
import ScatteredFruitPage from './pages/ScatteredFruitPage';
import { FinishedGoodsProvider } from './finishedGoods';
import { ScatteredFruitProvider } from './scatteredFruit';
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
  const packagingSpecs = hash.startsWith('#/packaging-specs');
  const labelManagement = hash.startsWith('#/label-management');
  const rawFruit = hash.startsWith('#/raw-fruit');
  const scatteredFruit = hash.startsWith('#/scattered-fruit');
  const weighing = hash.startsWith('#/weighing');
  const activePage = finishedGoods ? '成品管理' : workers ? '工人管理' : packagingSpecs ? '包装规格' : labelManagement ? '标签管理' : rawFruit ? '原果管理' : scatteredFruit ? '散果管理' : fruitCatalog ? '果品资料' : weighing ? '采摘称重' : '业务概览';
  useEffect(() => { document.title = `${activePage} - 农牧投蓝莓系统`; }, [activePage]);
  return <SideLayout activePage={activePage}>{finishedGoods ? <FinishedGoodsPage hash={hash} /> : workers ? <WorkerManagementPage /> : packagingSpecs ? <PackagingSpecPage /> : labelManagement ? <LabelManagementPage /> : rawFruit ? <RawFruitPage /> : scatteredFruit ? <ScatteredFruitPage hash={hash} /> : fruitCatalog ? <FruitCatalogPage /> : weighing ? <WeighingPage /> : <OverviewPage />}</SideLayout>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <ConfigProvider locale={zhCN} componentSize="middle" theme={{ token: {
    colorPrimary: '#0068ff', colorText: '#283b80', colorTextSecondary: '#59699d', colorBorder: '#dce4f4', colorBgLayout: '#f0f8fd', colorSuccess: '#00b83f', borderRadius: 6, borderRadiusLG: 8, fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif', controlHeight: 32, controlHeightSM: 24, controlHeightLG: 40,
  }, components: {
    // 统一业务表格与筛选文字，不随组件尺寸切换字号。
    Table: { headerBg: '#f3f8ff', borderColor: '#eaf0f8', cellPaddingBlockSM: 9, cellPaddingInlineSM: 8, cellFontSize: 14, cellFontSizeMD: 14, cellFontSizeSM: 14, fontWeightStrong: 600 },
    Form: { labelFontSize: 14 },
    Input: { inputFontSize: 14, inputFontSizeSM: 14, inputFontSizeLG: 14 },
    Select: { fontSize: 14, fontSizeSM: 14, fontSizeLG: 14, optionFontSize: 14 },
    DatePicker: { inputFontSize: 14, inputFontSizeSM: 14, inputFontSizeLG: 14 },
    Button: { contentFontSize: 14, contentFontSizeSM: 14, contentFontSizeLG: 14 },
    Tabs: { horizontalItemGutter: 40 }, Pagination: { itemActiveBg: '#0068ff', itemSize: 32, itemSizeSM: 24, itemSizeLG: 40 } } }}>
    <ProConfigProvider>
      <App><FinishedGoodsProvider><ScatteredFruitProvider><RoutedPages /></ScatteredFruitProvider></FinishedGoodsProvider></App>
    </ProConfigProvider>
  </ConfigProvider>
</React.StrictMode>);
