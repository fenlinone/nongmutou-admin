import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Pagination, Select, Space, Switch, Table } from 'antd';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { FLOATING_LAYER_MAX_WIDTH, FLOATING_LAYER_WIDTHS, getModalStyles } from '../components/floatingLayer';
import TableSelectionToolbar from '../components/TableSelectionToolbar';
import ColumnSettingsPopover from '../components/ColumnSettingsPopover';
import type { ColumnOption } from '../components/ColumnSettingsPopover';

type Fruit = { key: string; code: string; name: string; size: string; grade: string; enabled: boolean; order: number; updated: string };
const seed: Array<[string,string,string,string,boolean,number]> = [
  ['BM001','蓝莓1号','L','特级',true,1],['BM002','蓝莓1号','M','一级',true,2],['BM003','蓝莓1号','S','二级',false,3],['BM004','奥尼尔','L','一级',true,4],['BM005','奥尼尔','M','一级',false,5],['BM006','绿宝石','L','一级',true,6],['BM007','绿宝石','M','一级',false,7],['BM008','珠宝','S','二级',false,8],['BM009','莱格西','XL','特级',true,9],['BM999','废果','/','/',true,99],
];
const initial: Fruit[] = seed.map(([code,name,size,grade,enabled,order]) => ({ key:code,code,name,size,grade,enabled,order,updated:'2026-10-16 10:20' }));
const fieldOptions = (values: string[]) => values.map(value => ({ value, label: value }));
const defaultColumnKeys = ['code','name','size','grade','enabled','order','updated'];

export default function FruitCatalogPage() {
  const { message } = App.useApp();
  const [rows,setRows] = useState<Fruit[]>(initial);
  const [selected,setSelected] = useState<string[]>([]);
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(10);
  const [filters,setFilters] = useState({ code:'', name:'', size:'', grade:'', status:'全部' });
  const [form] = Form.useForm<Fruit>();
  const [editing,setEditing] = useState<Fruit>();
  const [modalOpen,setModalOpen] = useState(false);
  const [hiddenColumns,setHiddenColumns] = useState<string[]>([]);
  const [columnOrder,setColumnOrder] = useState(defaultColumnKeys);
  const filtered = useMemo(() => rows.filter(row => (!filters.code || row.code.toLowerCase().includes(filters.code.toLowerCase())) && (!filters.name || row.name.includes(filters.name)) && (!filters.size || row.size===filters.size) && (!filters.grade || row.grade===filters.grade) && (filters.status==='全部' || (filters.status==='启用' ? row.enabled : !row.enabled))),[rows,filters]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const openForm = (row?: Fruit) => { setEditing(row); form.setFieldsValue(row ?? { code:'',name:'',size:undefined,grade:undefined,enabled:true,order:rows.length+1 }); setModalOpen(true); };
  const save = async () => { const value = await form.validateFields(); if (editing) setRows(current=>current.map(row=>row.key===editing.key?{...row,...value,updated:'2026-10-20 09:30'}:row)); else setRows(current=>[{...value,key:value.code,updated:'2026-10-20 09:30'},...current]); setModalOpen(false); message.success(editing?'果品资料已更新':'果品资料已新增'); };
  const remove = (row: Fruit) => Modal.confirm({ title:'删除果品资料', content:`确定删除「${row.code} ${row.name} ${row.size}」吗？`, centered:true, width:FLOATING_LAYER_WIDTHS.confirmModal, style:{maxWidth:FLOATING_LAYER_MAX_WIDTH}, styles:getModalStyles(), okText:'删除', okButtonProps:{danger:true}, cancelText:'取消', onOk:()=>{setRows(current=>current.filter(item=>item.key!==row.key));setSelected(current=>current.filter(key=>key!==row.key));message.success('果品资料已删除');} });
  const removeSelected = () => {
    if (!selectedRows.length) return;
    Modal.confirm({
      title:'批量删除果品资料',
      content:`确定删除已勾选的 ${selectedRows.length} 条果品资料吗？删除后无法恢复。`,
      centered:true,
      width:FLOATING_LAYER_WIDTHS.confirmModal,
      style:{maxWidth:FLOATING_LAYER_MAX_WIDTH},
      styles:getModalStyles(),
      okText:'批量删除',
      okButtonProps:{danger:true},
      cancelText:'取消',
      onOk:()=>{
        const targetKeys = new Set(selectedRows.map(row=>row.key));
        setRows(current=>current.filter(row=>!targetKeys.has(row.key)));
        setSelected(current=>current.filter(key=>!targetKeys.has(key)));
        message.success(`已删除 ${targetKeys.size} 条果品资料`);
      },
    });
  };
  const allColumns: ColumnsType<Fruit> = [
    { title:'果品编码',dataIndex:'code',width:105 }, { title:'果品名称',dataIndex:'name',width:112 }, { title:'果径',dataIndex:'size',width:80 }, { title:'等级',dataIndex:'grade',width:92 },
    { title:'状态',dataIndex:'enabled',width:100,align:'center',render:(enabled:boolean,row)=><Switch checked={enabled} checkedChildren="启用" unCheckedChildren="停用" onChange={checked=>setRows(current=>current.map(item=>item.key===row.key?{...item,enabled:checked,updated:'2026-10-20 09:30'}:item))}/> },
    { title:'排序',dataIndex:'order',width:80,align:'center' }, { title:'更新时间',dataIndex:'updated',width:156 },
    { title:'操作',key:'action',width:104,align:'center',render:(_,row)=><Space size={12}><Button type="link" className="fruit-link" onClick={()=>openForm(row)}>编辑</Button><Button type="link" danger className="fruit-link" onClick={()=>remove(row)}>删除</Button></Space> },
  ];
  const columnKey = (column: ColumnsType<Fruit>[number]) => String(column.key??('dataIndex' in column ? column.dataIndex : ''));
  const dataColumns = allColumns.filter(column=>columnKey(column)!=='action');
  const orderedDataColumns = [...dataColumns].sort((left,right)=>columnOrder.indexOf(columnKey(left))-columnOrder.indexOf(columnKey(right)));
  const columns = [...orderedDataColumns.filter(column=>!hiddenColumns.includes(columnKey(column))), allColumns[allColumns.length-1]];
  const columnOptions: ColumnOption[] = dataColumns.map(column=>({key:columnKey(column),label:String(column.title)}));
  const selectedRows = filtered.filter(row=>selected.includes(row.key));
  const exportRows = (exporting?: Fruit[]) => { const targetRows=exporting??(selectedRows.length?selectedRows:filtered); const csv=['果品编码,果品名称,果径,等级,启用,排序,更新时间',...targetRows.map(r=>[r.code,r.name,r.size,r.grade,r.enabled?'是':'否',r.order,r.updated].join(','))].join('\n'); const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})); const link=document.createElement('a'); link.href=url; link.download='果品资料.csv'; link.click(); URL.revokeObjectURL(url); message.success(`已导出 ${targetRows.length} 条果品资料`); };
  const updateSelectedStatus = (enabled: boolean) => { if (!selectedRows.length) return; const keys = new Set(selectedRows.map(row=>row.key)); setRows(current=>current.map(row=>keys.has(row.key)?{...row,enabled,updated:'2026-10-20 09:30'}:row)); message.success(`已${enabled?'启用':'停用'} ${selectedRows.length} 条果品资料`); };
  const reset = () => setFilters({code:'',name:'',size:'',grade:'',status:'全部'});
  return <div className="fruit-page">
    <Card className="fruit-filter" bordered={false}>
      <div className="fruit-filters">
        <label>果品编码<Input value={filters.code} placeholder="请输入果品编码" suffix={<SearchOutlined/>} onChange={e=>setFilters({...filters,code:e.target.value})}/></label>
        <label>果品名称<Input value={filters.name} placeholder="请输入果品名称" suffix={<SearchOutlined/>} onChange={e=>setFilters({...filters,name:e.target.value})}/></label>
        <label>果径<Input allowClear value={filters.size} placeholder="请输入果径" onChange={e=>setFilters({...filters,size:e.target.value})}/></label>
        <label>等级<Input allowClear value={filters.grade} placeholder="请输入等级" onChange={e=>setFilters({...filters,grade:e.target.value})}/></label>
        <label>状态<Select value={filters.status} options={fieldOptions(['全部','启用','停用'])} onChange={status=>setFilters({...filters,status})}/></label>
        <div className="fruit-filter-actions"><Button type="link" onClick={reset}>重置</Button><Button type="primary" onClick={()=>setFilters({...filters})}>查询</Button></div>
      </div>
    </Card>
    <Card className="fruit-table-card" bordered={false}>
      <TableSelectionToolbar title="果品资料" selectedCount={selectedRows.length} selectedLabel="条资料" onClear={()=>setSelected([])} className="fruit-toolbar"
        batchActions={<Space size={8}>
          {selectedRows.length > 0 && <><Button type="primary" onClick={()=>updateSelectedStatus(true)} disabled={selectedRows.every(row=>row.enabled)}>批量启用</Button><Button onClick={()=>updateSelectedStatus(false)} disabled={selectedRows.every(row=>!row.enabled)}>批量停用</Button><Button danger icon={<DeleteOutlined/>} onClick={removeSelected}>批量删除</Button><Button onClick={()=>exportRows(selectedRows)}>批量导出</Button></>}
        </Space>}
        fixedActions={<Space size={8}>
          <Button type="primary" onClick={()=>openForm()}>新建果品</Button><Button onClick={()=>exportRows()} disabled={!filtered.length}>导出</Button>
          <ColumnSettingsPopover columns={columnOptions} hiddenKeys={hiddenColumns} onHiddenKeysChange={setHiddenColumns} order={columnOrder} onOrderChange={setColumnOrder}/>
        </Space>} />
      <Table<Fruit> rowKey="key" size="small" columns={columns} dataSource={filtered.slice((currentPage-1)*pageSize,currentPage*pageSize)} pagination={false} rowSelection={{selectedRowKeys:selected,onChange:keys=>setSelected(keys.map(String)),preserveSelectedRowKeys:true,columnWidth:40}} scroll={{x:columns.reduce((sum,column)=>sum+Number(column.width??100),40)}} locale={{emptyText:'暂无果品资料'}} />
      <div className="fruit-pagination"><strong>共 {filtered.length} 项数据</strong><Pagination current={currentPage} pageSize={pageSize} showSizeChanger showQuickJumper pageSizeOptions={[10,20,50,100]} total={filtered.length} onChange={(nextPage,nextSize)=>{setPage(nextSize!==pageSize?1:nextPage);setPageSize(nextSize);}}/></div>
    </Card>
    <Modal className="business-modal fruit-edit-modal" centered width={FLOATING_LAYER_WIDTHS.formModal} style={{maxWidth:FLOATING_LAYER_MAX_WIDTH}} styles={getModalStyles()} open={modalOpen} title={editing?'编辑果品资料':'新建果品资料'} onCancel={()=>setModalOpen(false)} onOk={save} okText="保存" cancelText="取消">
      <Form form={form} layout="vertical" initialValues={{enabled:true}}><div className="fruit-form-grid"><Form.Item name="code" label="果品编码" rules={[{required:true,message:'请输入果品编码'}]}><Input disabled={!!editing} placeholder="请输入果品编码" maxLength={20}/></Form.Item><Form.Item name="name" label="果品名称" rules={[{required:true,message:'请输入果品名称'}]}><Input placeholder="请输入果品名称" maxLength={30}/></Form.Item><Form.Item name="size" label="果径" rules={[{required:true,message:'请输入果径'}]}><Input placeholder="请输入果径" maxLength={20}/></Form.Item><Form.Item name="grade" label="等级" rules={[{required:true,message:'请输入等级'}]}><Input placeholder="请输入等级" maxLength={20}/></Form.Item><Form.Item name="order" label="排序" rules={[{required:true,message:'请输入排序值'}]}><Input type="number" min={1}/></Form.Item><Form.Item name="enabled" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item></div></Form>
    </Modal>
  </div>;
}
