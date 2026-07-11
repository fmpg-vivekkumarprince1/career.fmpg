import React, { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, Clock, User, FileText, ChevronRight, Activity } from 'lucide-react';
import api from '../../services/api';
import Loader from '../../components/common/Loader';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  // Filters
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async (pageNum = 1) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', '50');
      if (entityFilter) params.append('entity', entityFilter);
      if (actionFilter) params.append('action', actionFilter);

      const { data } = await api.get(`/api/audit/logs?${params.toString()}`);
      if (data && data.logs) {
        setLogs(pageNum === 1 ? data.logs : [...logs, ...data.logs]);
        setTotalPages(data.totalPages);
        setPage(data.page);
      } else if (Array.isArray(data)) {
        setLogs(data); // Fallback for plain array
      }
    } catch (err) {
      setError('Failed to load audit logs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [entityFilter, actionFilter]);

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-900/40 text-green-400 border-green-700/50';
      case 'UPDATE': return 'bg-blue-900/40 text-blue-400 border-blue-700/50';
      case 'DELETE': return 'bg-red-900/40 text-red-400 border-red-700/50';
      case 'ISSUE': return 'bg-purple-900/40 text-purple-400 border-purple-700/50';
      case 'EMAIL': return 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50';
      case 'STATUS_CHANGE': return 'bg-orange-900/40 text-orange-400 border-orange-700/50';
      default: return 'bg-gray-800 text-gray-300 border-gray-600';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return { date: 'N/A', time: 'N/A' };
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div className="ui-page">
      <div className="ui-content text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <span className="fmpg-kicker">Governance</span>
            <h1 className="ui-page-title mt-3 flex items-center">
              <ShieldCheck className="mr-3 text-emerald-600" size={32} />
              System audit logs
            </h1>
            <p className="ui-page-subtitle">
              Track and monitor all administrative actions across the system.
            </p>
          </div>
          
          {/* Filters */}
          <div className="ui-card flex flex-wrap gap-3 p-3 self-start md:self-auto">
            <select 
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="ui-select text-sm py-2 px-3"
            >
              <option value="">All Entities</option>
              <option value="Certificate">Certificate</option>
              <option value="OfferLetter">Offer Letter</option>
              <option value="Role">Role Change</option>
              <option value="Job">Job</option>
              <option value="Application">Application</option>
              <option value="User">User</option>
            </select>
            
            <select 
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="ui-select text-sm py-2 px-3"
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ISSUE">ISSUE</option>
              <option value="EMAIL">EMAIL</option>
              <option value="ACCEPT">ACCEPT</option>
              <option value="STATUS_CHANGE">STATUS_CHANGE</option>
              <option value="LOGIN">LOGIN</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 text-red-400 p-4 rounded-lg mb-6 shadow-sm border border-red-700/50">
            {error}
          </div>
        )}

        {loading && logs.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <Loader />
          </div>
        ) : (
          <div className="ui-card overflow-hidden">
            <div className="ui-table-shell border-0 rounded-none">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th scope="col">Date & time</th>
                    <th scope="col">User</th>
                    <th scope="col">Action</th>
                    <th scope="col">Module</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {logs.length > 0 ? (
                    logs.map((log, index) => {
                      try {
                        const { date, time } = formatDate(log?.createdAt);
                        return (
                          <tr key={log?._id || index} className="transition-colors">
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex flex-col text-sm">
                                <span className="font-medium text-slate-900 flex items-center">
                                  <Calendar size={14} className="mr-1 text-gray-400" /> {date}
                                </span>
                                <span className="text-gray-400 flex items-center mt-1">
                                  <Clock size={14} className="mr-1 text-gray-400" /> {time}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 font-bold mr-3">
                                  {typeof log?.actor?.name === 'string' ? log.actor.name.charAt(0) : <User size={16} />}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-900">
                                    {String(log?.actor?.name || log?.actor || 'Unknown User')}
                                  </span>
                                  <span className="text-xs text-gray-400 capitalize flex items-center">
                                    {String(log?.actorRole || 'System')}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(log?.action)}`}>
                                {String(log?.action || 'UNKNOWN')}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center text-sm text-gray-300 font-medium">
                                <Activity size={16} className="mr-2 text-gray-400" />
                                {String(log?.resourceEntity || 'Unknown Entity')}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {log?.resourceId && typeof log.resourceId === 'object' && (log.resourceId.name || log.resourceId.title || log.resourceId.email) ? (
                                  <span className="font-semibold text-gray-300">
                                    {String(log.resourceId.name || log.resourceId.title || log.resourceId.email)}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={log?.resourceId?._id || (typeof log?.resourceId === 'string' ? log.resourceId : '')}>
                                ID: {String(log?.resourceId?._id || (typeof log?.resourceId === 'string' ? log.resourceId : 'Unknown'))}
                              </div>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="flex items-center text-sm font-medium text-lime-brand hover:text-lime-brand-light hover:bg-gray-800 px-3 py-1.5 rounded-md transition-colors"
                              >
                                <FileText size={16} className="mr-1" />
                                View
                                <ChevronRight size={16} className="ml-1" />
                              </button>
                            </td>
                          </tr>
                        );
                      } catch (err) {
                        return <tr key={index}><td colSpan="5" className="text-red-500">Error rendering row: {err.message}</td></tr>;
                      }
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-400">
                        No audit logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {page < totalPages && (
              <div className="p-4 border-t border-gray-700 flex justify-center bg-gray-800/30">
                <button
                  onClick={() => fetchLogs(page + 1)}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg shadow-sm hover:bg-gray-700 font-medium text-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More Results'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-xl shadow-2xl w-full border border-gray-700 max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
              <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center">
                    Changes for {String(selectedLog?.resourceEntity || 'Unknown')}
                    <span className={`ml-3 px-2.5 py-0.5 rounded-full text-xs border ${getActionColor(selectedLog?.action)}`}>
                      {String(selectedLog?.action || 'UNKNOWN')}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    <strong>Target:</strong> {String(selectedLog?.resourceId?.name || selectedLog?.resourceId?.title || selectedLog?.resourceId?.email || 'Unknown')} <span className="font-mono text-gray-400 ml-2">({String(selectedLog?.resourceId?._id || (typeof selectedLog?.resourceId === 'string' ? selectedLog.resourceId : 'Unknown'))})</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-lg transition-colors"
                >
                ✕
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 bg-gray-900">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                  <h4 className="text-xs font-bold uppercase text-red-500 mb-3 border-b border-gray-700 pb-2 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                    Previous Data
                  </h4>
                  <pre className="text-[11px] md:text-xs overflow-x-auto p-4 bg-black text-gray-300 rounded-lg font-mono leading-relaxed custom-scrollbar">
                    {selectedLog?.changes?.oldData || selectedLog?.changes?.from
                      ? JSON.stringify(selectedLog.changes.oldData || selectedLog.changes.from, null, 2)
                      : '// No previous data'}
                  </pre>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                  <h4 className="text-xs font-bold uppercase text-green-500 mb-3 border-b border-gray-700 pb-2 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    New Data
                  </h4>
                  <pre className="text-[11px] md:text-xs overflow-x-auto p-4 bg-black text-gray-300 rounded-lg font-mono leading-relaxed custom-scrollbar">
                    {selectedLog?.changes?.newData || selectedLog?.changes?.to || selectedLog?.changes?.new
                      ? JSON.stringify(selectedLog.changes.newData || selectedLog.changes.to || selectedLog.changes.new, null, 2)
                      : '// No new data'}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center text-sm text-gray-400">
              <div className="flex space-x-4">
                <span>By: <strong>{String(selectedLog?.actor?.name || selectedLog?.actor || 'Unknown')}</strong></span>
                <span>IP: <strong>{String(selectedLog?.ipAddress || 'N/A')}</strong></span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default AuditLogs;
