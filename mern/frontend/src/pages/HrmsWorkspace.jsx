import { useEffect, useMemo, useState } from 'react';
import { hrmsService } from '../services/api';
import Loader from '../components/common/Loader';
import { toast } from 'react-toastify';

const configuration = {
  attendance: { title: 'Attendance', load: () => hrmsService.myAttendance(), action: 'Check in', onAction: () => hrmsService.checkIn(), columns: ['date', 'status', 'checkIn', 'checkOut'] },
  'admin-attendance': { title: 'Attendance', load: () => hrmsService.attendance(), columns: ['date', 'status', 'checkIn', 'checkOut'] },
  leaves: { title: 'Leave requests', load: () => hrmsService.myLeaveRequests(), action: 'Apply for leave', columns: ['fromDate', 'toDate', 'days', 'status'] },
  'admin-leaves': { title: 'Leave requests', load: () => hrmsService.leaveRequests(), columns: ['fromDate', 'toDate', 'days', 'status'] },
  payroll: { title: 'Payroll runs', load: () => hrmsService.payrollRuns(), action: 'New payroll run', columns: ['month', 'year', 'status', 'createdAt'] },
  payslips: { title: 'Payslips', load: () => hrmsService.payslips(), columns: ['payrollRunId', 'paymentStatus', 'payableDays', 'createdAt'] },
  documents: { title: 'Documents', load: () => hrmsService.myDocuments(), columns: ['documentNumber', 'documentType', 'status', 'issuedAt'] },
  'admin-documents': { title: 'Documents', load: () => hrmsService.documents(), columns: ['documentNumber', 'documentType', 'status', 'issuedAt'] },
  resignations: { title: 'Resignations', load: () => hrmsService.resignations(), columns: ['employeeId', 'status', 'lastWorkingDay', 'createdAt'] },
  'my-resignation': { title: 'My resignation', load: () => hrmsService.myResignation(), action: 'Submit resignation', columns: ['status', 'lastWorkingDay', 'createdAt'] },
  terminations: { title: 'Terminations', load: () => hrmsService.terminations(), columns: ['employeeId', 'status', 'effectiveDate', 'createdAt'] },
  exits: { title: 'Exit checklists', load: () => hrmsService.exits(), columns: ['employeeId', 'status', 'createdAt'] },
  assets: { title: 'Asset inventory', load: () => hrmsService.assets(), columns: ['assetTag', 'name', 'category', 'status'] },
};
const format = value => value == null ? '—' : typeof value === 'object' ? (value.name || value.employeeCode || value._id || '—') : String(value).includes('T') ? new Date(value).toLocaleDateString() : String(value).replaceAll('_', ' ');
export default function HrmsWorkspace({ kind }) {
  const config = configuration[kind]; const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const response=await config.load();setItems(response.data.items || response.data || []);}catch(e){setError(e.response?.data?.message || 'Unable to load this workspace.');}finally{setLoading(false)}};
  useEffect(()=>{load()},[kind]);
  const handleAction=async()=>{try{if(kind==='leaves'){const leaveType=prompt('Leave type ID'); if(!leaveType)return; await hrmsService.applyLeave({leaveTypeId:leaveType,fromDate:prompt('Start date (YYYY-MM-DD)'),toDate:prompt('End date (YYYY-MM-DD)'),days:Number(prompt('Days')),reason:prompt('Reason')});} else if(kind==='my-resignation'){const reason=prompt('Reason for resignation');if(!reason)return;await hrmsService.resign({reason,requestedLastWorkingDay:prompt('Requested last working day (YYYY-MM-DD)')});} else if(kind==='payroll'){await hrmsService.createPayrollRun({month:new Date().getMonth()+1,year:new Date().getFullYear()});} else await config.onAction?.(); toast.success('Action completed');load()}catch(e){toast.error(e.response?.data?.message||'Action could not be completed')}};
  if(loading)return <Loader fullPage />;
  return <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6"><header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">HR operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h1></div><div className="flex gap-2"><button onClick={load} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:ring-2">Refresh</button>{config.action&&<button onClick={handleAction} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:ring-2">{config.action}</button>}</div></header>{error?<div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Couldn’t load {config.title.toLowerCase()}.</strong><p>{error}</p></div>:items.length===0?<div className="border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600"><strong className="block text-slate-900">No records yet</strong><span>Create or refresh records to see them here.</span></div>:<div className="overflow-x-auto border border-slate-200"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{config.columns.map(c=><th key={c} className="px-4 py-3 font-medium">{c.replace(/([A-Z])/g,' $1')}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map(item=><tr key={item._id} className="hover:bg-slate-50">{config.columns.map(c=><td key={c} className="px-4 py-3 capitalize text-slate-700">{format(item[c])}</td>)}</tr>)}</tbody></table></div>}</section>;
}
