import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Checkbox, Form, Input, InputNumber, Modal, Pagination, QRCode, Select, Space, Switch, Table, Tag } from 'antd';
import { DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../components/floatingLayer';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';
import { exportCsv } from '../data';

type Worker = { key: string; code: string; name: string; gender: '男' | '女'; team: string; phone: string; enabled: boolean; createdAt: string };
const workerSeed: Array<[string, string, Worker['gender'], string, string, boolean, string]> = [
  ['G001','张三','男','第一班组','13800138000',true,'2026-03-01'], ['G002','李四','女','第一班组','13800138001',true,'2026-03-01'],
  ['G003','王五','男','第二班组','13800138002',true,'2026-03-02'], ['G004','赵六','女','第二班组','13800138003',true,'2026-03-02'],
  ['G005','孙七','男','第三班组','13800138004',true,'2026-03-05'], ['G006','周八','女','第三班组','13800138005',true,'2026-03-05'],
  ['G007','吴九','男','第一班组','13800138006',true,'2026-03-08'], ['G008','郑十','女','第二班组','13800138007',true,'2026-03-10'],
  ['G009','刘一','男','第三班组','13800138008',false,'2026-03-10'], ['G010','陈二','女','第一班组','13800138009',true,'2026-03-12'],
];
const initialWorkers: Worker[] = workerSeed.map(([code,name,gender,team,phone,enabled,createdAt]) => ({ key:code,code,name,gender,team,phone,enabled,createdAt }));

export default function WorkerManagementPage() {
  const { message } = App.useApp();
  const [rows,setRows] = useState<Worker[]>(initialWorkers);
  const teamOptions = useMemo(() => [...new Set(rows.map(row=>row.team))].map(value=>({value,label:value})),[rows]);
  const [filters,setFilters] = useState({code:'',name:'',team:'',status:'全部'});
  const [applied,setApplied] = useState(filters);
  const [selected,setSelected] = useState<React.Key[]>([]);
  const [hiddenColumns,setHiddenColumns] = useState<string[]>([]);
  const [columnOrder,setColumnOrder] = useState(['code','name','gender','team','phone','enabled','createdAt']);
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(10);
  const [form] = Form.useForm<Worker>();
  const [editing,setEditing] = useState<Worker>();
  const [formOpen,setFormOpen] = useState(false);
  const [qrWorkers,setQrWorkers] = useState<Worker[]>([]);
  const [printCopies,setPrintCopies] = useState(1);
  const [printReady,setPrintReady] = useState(false);
  const filtered = useMemo(() => rows.filter(row => (!applied.code || row.code.toLowerCase().includes(applied.code.toLowerCase())) && (!applied.name || row.name.includes(applied.name)) && (!applied.team || row.team===applied.team) && (applied.status==='全部' || (applied.status==='启用' ? row.enabled : !row.enabled))),[rows,applied]);
  const selectedRows = rows.filter(row => selected.includes(row.key));
  const pageRows = filtered.slice((page-1)*pageSize,page*pageSize);
  const openQr = (workers: Worker[]) => { setPrintCopies(1); setQrWorkers(workers); };
  useEffect(() => {
    if (!printReady) return;
    const finishPrint = () => setPrintReady(false);
    window.addEventListener('afterprint',finishPrint,{once:true});
    window.print();
    return () => window.removeEventListener('afterprint',finishPrint);
  },[printReady]);
  const openForm = (row?: Worker) => { setEditing(row); form.resetFields(); form.setFieldsValue(row ?? {code:'',name:'',gender:undefined,team:undefined,phone:'',enabled:true}); setFormOpen(true); };
  const save = async () => {
    const value = await form.validateFields();
    const worker = {...value,team:value.team.trim()};
    if (editing) setRows(current=>current.map(row=>row.key===editing.key?{...row,...worker}:row));
    else setRows(current=>[{...worker,key:worker.code,createdAt:'2026-10-20'},...current]);
    setFormOpen(false); message.success(editing?'工人信息已更新':'工人已新增');
  };
  const remove = (row: Worker) => Modal.confirm({title:'删除工人信息',content:`确定删除「${row.code} ${row.name}」吗？`,centered:true,width:FLOATING_LAYER_WIDTHS.confirmModal,style:{maxWidth:FLOATING_LAYER_MAX_WIDTH},styles:getModalStyles(),okText:'删除',okButtonProps:{danger:true},cancelText:'取消',onOk:()=>{setRows(current=>current.filter(item=>item.key!==row.key));setSelected(current=>current.filter(key=>key!==row.key));message.success('工人信息已删除');}});
  const removeSelected = () => {
    const targets = rows.filter(row => selected.includes(row.key));
    if (!targets.length) return;
    Modal.confirm({
      title:'批量删除工人',
      content:`确定删除已勾选的 ${targets.length} 名工人吗？删除后无法恢复。`,
      okText:'批量删除',
      centered:true,
      width:FLOATING_LAYER_WIDTHS.confirmModal,
      style:{maxWidth:FLOATING_LAYER_MAX_WIDTH},
      styles:getModalStyles(),
      okButtonProps:{danger:true},
      cancelText:'取消',
      onOk:()=>{
        const targetKeys = new Set(targets.map(row=>row.key));
        setRows(current=>current.filter(row=>!targetKeys.has(row.key)));
        setSelected(current=>current.filter(key=>!targetKeys.has(String(key))));
        message.success(`已删除 ${targets.length} 名工人`);
      },
    });
  };
  const exportRows = (exporting = selectedRows.length ? selectedRows : filtered, filename = '工人信息.csv') => {
    exportCsv(['工号','姓名','性别','所属班组','联系电话','状态','创建时间'], exporting.map(row => [row.code,row.name,row.gender,row.team,row.phone,row.enabled?'启用':'停用',row.createdAt]), filename);
    message.success(`已导出 ${exporting.length} 条工人信息`);
  };
  const columns: ColumnsType<Worker> = [
    {title:'工号',dataIndex:'code',width:100}, {title:'姓名',dataIndex:'name',width:100}, {title:'性别',dataIndex:'gender',width:80}, {title:'所属班组',dataIndex:'team',width:130}, {title:'联系电话',dataIndex:'phone',width:150},
    {title:'状态',dataIndex:'enabled',width:100,render:(enabled:boolean,row)=><Switch checked={enabled} checkedChildren="启用" unCheckedChildren="停用" onChange={checked=>{setRows(current=>current.map(item=>item.key===row.key?{...item,enabled:checked}:item));message.success(`${row.name}已${checked?'启用':'停用'}`);}}/>},
    {title:'创建时间',dataIndex:'createdAt',width:130}, {title:'操作',key:'action',width:180,align:'center',render:(_,row)=><Space size={8} align="center" style={{whiteSpace:'nowrap'}}><Button type="link" className="fruit-link" onClick={()=>openForm(row)}>编辑</Button><Button type="link" className="fruit-link" onClick={()=>openQr([row])}>查看二维码</Button><Button type="link" className="fruit-link" onClick={()=>remove(row)}>删除</Button></Space>},
  ];
  const columnKey = (column: ColumnsType<Worker>[number]) => String(column.key??('dataIndex' in column ? column.dataIndex : ''));
  const dataColumns = columns.filter(column=>columnKey(column)!=='action');
  const orderedDataColumns = [...dataColumns].sort((left,right)=>columnOrder.indexOf(columnKey(left))-columnOrder.indexOf(columnKey(right)));
  const visibleColumns = [...orderedDataColumns.filter(column=>!hiddenColumns.includes(columnKey(column))),columns[columns.length-1]];
  const columnOptions: ColumnOption[] = dataColumns.map(column=>({key:columnKey(column),label:String(column.title)}));
  const reset = () => { const clean={code:'',name:'',team:'',status:'全部'}; setFilters(clean); setApplied(clean); setPage(1); };
  return <div className="worker-page">
    <Card className="worker-filter" bordered={false}><div className="worker-filters">
      <label>工号<Input value={filters.code} placeholder="请输入工号" onChange={e=>setFilters({...filters,code:e.target.value})}/></label>
      <label>姓名<Input value={filters.name} placeholder="请输入姓名" onChange={e=>setFilters({...filters,name:e.target.value})}/></label>
      <label>所属班组<Select allowClear value={filters.team||undefined} placeholder="请选择班组" options={teamOptions} onChange={team=>setFilters({...filters,team:team??''})}/></label>
      <label>状态<Select value={filters.status} options={['全部','启用','停用'].map(value=>({value,label:value}))} onChange={status=>setFilters({...filters,status})}/></label>
      <div className="worker-filter-actions"><Button onClick={()=>{reset();setSelected([]);}}>重置</Button><Button type="primary" onClick={()=>{setApplied({...filters});setPage(1);setSelected([]);}}>查询</Button></div>
    </div></Card>
    <Card className="worker-table-card" bordered={false}><TableSelectionToolbar title="工人列表" selectedCount={selected.length} selectedLabel="名工人" onClear={()=>setSelected([])} className="worker-toolbar"
      batchActions={<Space size={8}><Button danger icon={<DeleteOutlined/>} onClick={removeSelected}>批量删除</Button><Button icon={<PrinterOutlined/>} onClick={()=>openQr(selectedRows)}>批量打印二维码</Button><Button onClick={()=>exportRows(selectedRows,'工人信息-所选记录.csv')}>批量导出</Button></Space>}
      fixedActions={<Space size={8}><Button type="primary" onClick={()=>openForm()}>新增工人</Button><Button onClick={()=>exportRows()} disabled={!filtered.length}>导出</Button><ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenColumns} onHiddenKeysChange={setHiddenColumns} order={columnOrder} onOrderChange={setColumnOrder}/></Space>} />
      <Table<Worker> rowKey="key" size="small" columns={visibleColumns} dataSource={pageRows} pagination={false} rowSelection={{selectedRowKeys:selected,onChange:keys=>setSelected(keys),preserveSelectedRowKeys:true}} scroll={{x:visibleColumns.reduce((sum,column)=>sum+Number(column.width??100),40)}} locale={{emptyText:'暂无符合条件的工人'}} />
      <div className="worker-pagination"><span>共 {filtered.length} 项数据</span><Pagination current={page} pageSize={pageSize} pageSizeOptions={[10,20,50,100]} total={filtered.length} showSizeChanger showQuickJumper onChange={(nextPage,nextSize)=>{setPage(nextSize!==pageSize?1:nextPage);setPageSize(nextSize);}} /></div>
    </Card>
    <Modal className="business-modal worker-edit-modal" centered width={FLOATING_LAYER_WIDTHS.complexModal} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles()} open={formOpen} title={editing?'编辑工人':'新增工人'} onCancel={()=>setFormOpen(false)} onOk={save} okText="保存" cancelText="取消"><Form form={form} layout="vertical"><div className="worker-form-grid"><Form.Item name="code" label="工号" rules={[{required:true,message:'请输入工号'},{validator:(_,value)=>!value||editing||!rows.some(row=>row.code===value)?Promise.resolve():Promise.reject(new Error('工号已存在'))}]}><Input disabled={!!editing} maxLength={20} placeholder="请输入工号"/></Form.Item><Form.Item name="name" label="姓名" rules={[{required:true,message:'请输入姓名'}]}><Input maxLength={30} placeholder="请输入姓名"/></Form.Item><Form.Item name="gender" label="性别" rules={[{required:true,message:'请选择性别'}]}><Select placeholder="请选择性别" options={['男','女'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="team" label="所属班组" rules={[{required:true,whitespace:true,message:'请输入所属班组'}]}><Input maxLength={30} placeholder="请输入所属班组"/></Form.Item><Form.Item name="phone" label="联系电话" rules={[{required:true,message:'请输入联系电话'},{pattern:/^1\d{10}$/,message:'请输入有效的 11 位手机号'}]}><Input maxLength={11} placeholder="请输入联系电话"/></Form.Item><Form.Item name="enabled" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item></div></Form></Modal>
    <Modal className="business-modal worker-qr-modal" centered width={qrWorkers.length===1?FLOATING_LAYER_WIDTHS.confirmModal:FLOATING_LAYER_WIDTHS.complexModal} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles()} open={qrWorkers.length>0} title={qrWorkers.length===1?'工人二维码':`工人二维码（${qrWorkers.length}）`} onCancel={()=>setQrWorkers([])} footer={<div className="worker-qr-footer"><label htmlFor="worker-qr-copies">每人份数</label><InputNumber id="worker-qr-copies" min={1} max={20} precision={0} value={printCopies} onChange={value=>setPrintCopies(value??1)}/><span>共 {qrWorkers.length*printCopies} 张</span><Button type="primary" icon={<PrinterOutlined/>} onClick={()=>setPrintReady(true)}>打印二维码</Button></div>}>
      <div className={`worker-qr-list worker-qr-preview${qrWorkers.length===1?' is-single':''}`}>
        {qrWorkers.map(worker=><div className="worker-qr-content" key={worker.key}>
          <QRCode type="svg" value={`worker:${worker.code}`} size={192} color="#000000" bgColor="#ffffff" bordered={false} aria-label={`工人 ${worker.code} 的二维码`}/>
          <strong>{worker.name}</strong>
          <span>{worker.code} · {worker.team}</span>
        </div>)}
      </div>
      {printReady&&<div className="worker-qr-list worker-qr-print-list">{qrWorkers.flatMap(worker=>Array.from({length:printCopies},(_,index)=><div className="worker-qr-content" key={`${worker.key}-${index}`}><QRCode type="svg" value={`worker:${worker.code}`} size={192} color="#000000" bgColor="#ffffff" bordered={false}/><strong>{worker.name}</strong><span>{worker.code} · {worker.team}</span></div>))}</div>}
      {!printReady&&<p className="worker-qr-note">扫码可读取工人工号，用于演示身份识别。</p>}
    </Modal>
  </div>;
}
