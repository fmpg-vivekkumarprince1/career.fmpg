import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Table, 
  Code2, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  RefreshCw, 
  Filter, 
  Check, 
  Copy, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Terminal, 
  FileJson, 
  Layers, 
  X,
  Play,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-toastify';
import { databaseService } from '../../services/api';
import Loader from '../../components/common/Loader';

const DatabaseManager = () => {
  // Navigation & Collection state
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [dbStats, setDbStats] = useState({ databaseName: '', totalCollections: 0, totalDocuments: 0 });
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer' | 'console'

  // Loading states
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Document explorer state
  const [documents, setDocuments] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [jsonFilter, setJsonFilter] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [sortField, setSortField] = useState('_id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'

  // Modals state
  const [viewModalDoc, setViewModalDoc] = useState(null);
  const [editModalDoc, setEditModalDoc] = useState(null);
  const [editJsonText, setEditJsonText] = useState('');
  const [editJsonError, setEditJsonError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createJsonText, setCreateJsonText] = useState('');
  const [createJsonError, setCreateJsonError] = useState('');
  const [deleteModalDoc, setDeleteModalDoc] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Query Console state
  const [consoleCollection, setConsoleCollection] = useState('');
  const [consoleOperation, setConsoleOperation] = useState('find');
  const [consoleQueryText, setConsoleQueryText] = useState('{}');
  const [consoleLimit, setConsoleLimit] = useState(50);
  const [consoleResult, setConsoleResult] = useState(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleError, setConsoleError] = useState('');

  // 1. Fetch Collections on mount
  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoadingCollections(true);
      const res = await databaseService.getCollections();
      const data = res.data;
      setCollections(data.collections || []);
      setDbStats({
        databaseName: data.databaseName || 'MongoDB',
        totalCollections: data.totalCollections || 0,
        totalDocuments: data.totalDocuments || 0
      });

      // Select first collection by default if not already selected
      if (!selectedCollection && data.collections?.length > 0) {
        setSelectedCollection(data.collections[0].name);
        setConsoleCollection(data.collections[0].name);
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch MongoDB collections');
    } finally {
      setLoadingCollections(false);
    }
  };

  // 2. Fetch Documents whenever collection, page, limit, search, or sort changes
  useEffect(() => {
    if (selectedCollection && activeTab === 'explorer') {
      fetchDocuments();
    }
  }, [selectedCollection, page, limit, sortField, sortOrder]);

  const fetchDocuments = async (overrideFilter = null) => {
    try {
      setLoadingDocs(true);
      const params = {
        page,
        limit,
        sortField,
        sortOrder
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const activeFilter = overrideFilter !== null ? overrideFilter : jsonFilter;
      if (activeFilter.trim()) {
        try {
          // Validate JSON syntax locally before sending
          JSON.parse(activeFilter);
          params.filter = activeFilter.trim();
        } catch (e) {
          toast.error('Invalid JSON filter format');
          setLoadingDocs(false);
          return;
        }
      }

      const res = await databaseService.getDocuments(selectedCollection, params);
      setDocuments(res.data.documents || []);
      setTotalDocs(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load documents:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch documents');
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  // Apply JSON Filter
  const handleApplyFilter = () => {
    setPage(1);
    fetchDocuments();
  };

  const handleClearFilter = () => {
    setJsonFilter('');
    setSearchTerm('');
    setPage(1);
    fetchDocuments('');
  };

  // Copy helper
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered collections in sidebar
  const filteredCollections = useMemo(() => {
    if (!collectionSearch.trim()) return collections;
    return collections.filter(c => c.name.toLowerCase().includes(collectionSearch.toLowerCase()));
  }, [collections, collectionSearch]);

  // Extract table columns dynamically from documents
  const dynamicColumns = useMemo(() => {
    if (!documents || documents.length === 0) return ['_id'];
    const keysSet = new Set();
    keysSet.add('_id');

    // Sample first 5 documents
    documents.slice(0, 5).forEach(doc => {
      Object.keys(doc).forEach(k => {
        if (k !== '__v') {
          keysSet.add(k);
        }
      });
    });

    // Put standard fields in logical order
    const priority = ['_id', 'name', 'email', 'title', 'role', 'status', 'department', 'createdAt'];
    const sorted = Array.from(keysSet).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sorted.slice(0, 6); // Max 6 columns in table view for readability
  }, [documents]);

  // Open Edit Modal
  const handleOpenEdit = (doc) => {
    setEditModalDoc(doc);
    setEditJsonText(JSON.stringify(doc, null, 2));
    setEditJsonError('');
  };

  // Save Edit
  const handleSaveEdit = async () => {
    try {
      const parsed = JSON.parse(editJsonText);
      setActionLoading(true);
      await databaseService.updateDocument(selectedCollection, editModalDoc._id, parsed);
      toast.success('Document updated successfully');
      setEditModalDoc(null);
      fetchDocuments();
      fetchCollections(); // Refresh counts
    } catch (err) {
      if (err instanceof SyntaxError) {
        setEditJsonError(`JSON Syntax Error: ${err.message}`);
      } else {
        toast.error(err.response?.data?.message || 'Failed to update document');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    // Generate intelligent starter template based on collection documents
    let template = { createdAt: new Date().toISOString() };
    if (documents.length > 0) {
      const sample = documents[0];
      const skeleton = {};
      Object.keys(sample).forEach(key => {
        if (key === '_id' || key === '__v') return;
        const val = sample[key];
        if (typeof val === 'string') skeleton[key] = '';
        else if (typeof val === 'number') skeleton[key] = 0;
        else if (typeof val === 'boolean') skeleton[key] = false;
        else if (Array.isArray(val)) skeleton[key] = [];
        else if (typeof val === 'object' && val !== null) skeleton[key] = {};
        else skeleton[key] = null;
      });
      template = skeleton;
    }
    setCreateJsonText(JSON.stringify(template, null, 2));
    setCreateJsonError('');
    setCreateModalOpen(true);
  };

  // Submit Create
  const handleSaveCreate = async () => {
    try {
      const parsed = JSON.parse(createJsonText);
      setActionLoading(true);
      await databaseService.createDocument(selectedCollection, parsed);
      toast.success('Document inserted successfully');
      setCreateModalOpen(false);
      fetchDocuments();
      fetchCollections(); // Update counts
    } catch (err) {
      if (err instanceof SyntaxError) {
        setCreateJsonError(`JSON Syntax Error: ${err.message}`);
      } else {
        toast.error(err.response?.data?.message || 'Failed to insert document');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteModalDoc) return;
    try {
      setActionLoading(true);
      await databaseService.deleteDocument(selectedCollection, deleteModalDoc._id);
      toast.success('Document deleted successfully');
      setDeleteModalDoc(null);
      fetchDocuments();
      fetchCollections(); // Update counts
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    } finally {
      setActionLoading(false);
    }
  };

  // Query Console: Run custom query
  const handleExecuteConsole = async () => {
    setConsoleError('');
    setConsoleResult(null);

    let parsedQuery = {};
    if (consoleOperation === 'aggregate') {
      try {
        parsedQuery = JSON.parse(consoleQueryText);
        if (!Array.isArray(parsedQuery)) {
          setConsoleError('Aggregate pipeline must be a valid JSON array, e.g. [{"$match": {...}}]');
          return;
        }
      } catch (e) {
        setConsoleError(`Invalid JSON in Pipeline: ${e.message}`);
        return;
      }
    } else {
      try {
        parsedQuery = JSON.parse(consoleQueryText);
      } catch (e) {
        setConsoleError(`Invalid JSON in Query: ${e.message}`);
        return;
      }
    }

    try {
      setConsoleLoading(true);
      const res = await databaseService.executeQuery({
        collectionName: consoleCollection,
        operation: consoleOperation,
        query: parsedQuery,
        options: {
          limit: parseInt(consoleLimit) || 50
        }
      });
      setConsoleResult(res.data);
    } catch (err) {
      console.error('Console query error:', err);
      setConsoleError(err.response?.data?.message || err.message || 'Execution error');
    } finally {
      setConsoleLoading(false);
    }
  };

  // Render cell helper
  const renderCellContent = (val) => {
    if (val === null || val === undefined) return <span className="text-gray-400 italic">null</span>;
    if (typeof val === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {val ? 'true' : 'false'}
        </span>
      );
    }
    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return <span className="text-purple-600 font-mono text-xs">Array({val.length})</span>;
      }
      return <span className="text-blue-600 font-mono text-xs">&#123;...&#125;</span>;
    }
    if (typeof val === 'string' && val.length > 40) {
      return <span title={val}>{val.substring(0, 37)}...</span>;
    }
    return String(val);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">Database Studio</h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    Live DB: {dbStats.databaseName}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Full read and write control over all MongoDB collections directly from Super Admin.
                </p>
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Collections</span>
                  <span className="font-bold text-gray-800">{dbStats.totalCollections}</span>
                </div>
                <div className="w-px h-8 bg-gray-200"></div>
                <div>
                  <span className="text-gray-500 block text-xs">Total Records</span>
                  <span className="font-bold text-gray-800">{dbStats.totalDocuments.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  fetchCollections();
                  if (activeTab === 'explorer') fetchDocuments();
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm"
                title="Refresh Database"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingCollections || loadingDocs ? 'animate-spin text-indigo-600' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mt-6 -mb-6">
            <button
              onClick={() => setActiveTab('explorer')}
              className={`flex items-center py-3 px-4 font-medium text-sm border-b-2 transition ${
                activeTab === 'explorer'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Table className="w-4 h-4 mr-2" />
              Document Explorer
            </button>
            <button
              onClick={() => {
                setActiveTab('console');
                setConsoleCollection(selectedCollection);
              }}
              className={`flex items-center py-3 px-4 font-medium text-sm border-b-2 transition ${
                activeTab === 'console'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Terminal className="w-4 h-4 mr-2" />
              Mongo Query Console
            </button>
          </div>
        </div>

        {/* Tab 1: Document Explorer */}
        {activeTab === 'explorer' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Left Sidebar: Collections */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-indigo-600" />
                  Collections ({filteredCollections.length})
                </span>
              </div>

              {/* Collection search filter */}
              <div className="mt-3 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter collections..."
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Collections list */}
              <div className="mt-3 space-y-1 max-h-[600px] overflow-y-auto pr-1">
                {loadingCollections ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    <Loader size="small" />
                    <p className="mt-2">Loading collections...</p>
                  </div>
                ) : filteredCollections.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    No matching collections found.
                  </div>
                ) : (
                  filteredCollections.map((col) => {
                    const isSelected = selectedCollection === col.name;
                    return (
                      <button
                        key={col.name}
                        onClick={() => {
                          setSelectedCollection(col.name);
                          setPage(1);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 shadow-sm'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate pr-2 font-mono text-xs">{col.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isSelected ? 'bg-indigo-200 text-indigo-900' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {col.count.toLocaleString()}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Main Panel: Documents Data & Operations */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Toolbar */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Current Collection Info */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center font-mono">
                      <span>{selectedCollection || 'Select a Collection'}</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Showing {documents.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, totalDocs)} of {totalDocs.toLocaleString()} documents
                    </p>
                  </div>

                  {/* Actions & View Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    
                    {/* View mode toggle */}
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                          viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="Table View"
                      >
                        <Table className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('json')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                          viewMode === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="JSON View"
                      >
                        <FileJson className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Filter Toggle */}
                    <button
                      onClick={() => setShowFilterBar(!showFilterBar)}
                      className={`inline-flex items-center px-3 py-1.5 border rounded-lg text-xs font-medium transition ${
                        showFilterBar || jsonFilter
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5 mr-1.5" />
                      Filter {jsonFilter ? '(Active)' : ''}
                    </button>

                    {/* Add Document Button */}
                    <button
                      onClick={handleOpenCreate}
                      disabled={!selectedCollection}
                      className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Insert Document
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="mt-3 flex gap-2">
                  <div className="relative flex-grow">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search in ${selectedCollection} (ID, email, name, title...)`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition"
                  >
                    Search
                  </button>
                  {(searchTerm || jsonFilter) && (
                    <button
                      type="button"
                      onClick={handleClearFilter}
                      className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition"
                    >
                      Reset
                    </button>
                  )}
                </form>

                {/* Expandable JSON Filter Panel */}
                {showFilterBar && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 flex items-center">
                        <Code2 className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Mongo JSON Filter Query:
                      </span>
                      <span className="text-[11px] text-gray-400">e.g. &#123; "status": "active" &#125;</span>
                    </div>
                    <textarea
                      rows={2}
                      value={jsonFilter}
                      onChange={(e) => setJsonFilter(e.target.value)}
                      placeholder='{ "role": "admin", "status": "active" }'
                      className="w-full p-2 text-xs font-mono bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear Filter
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyFilter}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Documents Data Area */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loadingDocs ? (
                  <div className="py-16 text-center text-sm text-gray-500">
                    <Loader size="medium" />
                    <p className="mt-3">Loading documents from {selectedCollection}...</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 space-y-2">
                    <Database className="w-10 h-10 mx-auto text-gray-300" />
                    <p className="text-sm font-medium text-gray-700">No documents found in this collection</p>
                    <p className="text-xs text-gray-400">
                      Try clearing filters or click "+ Insert Document" to add the first record.
                    </p>
                  </div>
                ) : viewMode === 'table' ? (
                  /* Table View */
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider">
                        <tr>
                          {dynamicColumns.map((col) => (
                            <th
                              key={col}
                              className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition"
                              onClick={() => {
                                if (sortField === col) {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortField(col);
                                  setSortOrder('desc');
                                }
                              }}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{col}</span>
                                {sortField === col && (
                                  <ArrowUpDown className="w-3 h-3 text-indigo-600" />
                                )}
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {documents.map((doc, idx) => (
                          <tr key={doc._id || idx} className="hover:bg-indigo-50/30 transition">
                            {dynamicColumns.map((col) => (
                              <td key={col} className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                                {col === '_id' ? (
                                  <span className="font-mono text-indigo-700 font-medium">
                                    {String(doc._id)}
                                  </span>
                                ) : (
                                  renderCellContent(doc[col])
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-medium space-x-1">
                              {/* View */}
                              <button
                                onClick={() => setViewModalDoc(doc)}
                                className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-gray-100 transition"
                                title="View Document"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEdit(doc)}
                                className="p-1 text-gray-500 hover:text-amber-600 rounded hover:bg-gray-100 transition"
                                title="Edit Document"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => setDeleteModalDoc(doc)}
                                className="p-1 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100 transition"
                                title="Delete Document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* JSON Card View */
                  <div className="p-4 space-y-3">
                    {documents.map((doc) => (
                      <div key={doc._id} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 hover:border-indigo-300 transition">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
                          <span className="font-mono text-xs font-bold text-indigo-600">
                            _id: {String(doc._id)}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleCopy(doc, doc._id)}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-600 hover:bg-gray-200"
                              title="Copy JSON"
                            >
                              {copiedId === doc._id ? <Check className="w-3.5 h-3.5 text-green-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                              Copy
                            </button>
                            <button
                              onClick={() => handleOpenEdit(doc)}
                              className="px-2 py-0.5 rounded text-xs text-amber-700 bg-amber-50 hover:bg-amber-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteModalDoc(doc)}
                              className="px-2 py-0.5 rounded text-xs text-red-700 bg-red-50 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <pre className="text-xs font-mono text-gray-800 overflow-x-auto max-h-48 p-2 bg-white rounded border border-gray-100">
                          {JSON.stringify(doc, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Bar */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700">
                  <div className="flex items-center space-x-2">
                    <span>Rows per page:</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(parseInt(e.target.value));
                        setPage(1);
                      }}
                      className="border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <div className="inline-flex rounded-md shadow-sm">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-2.5 py-1 border border-gray-300 rounded-l-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-2.5 py-1 border border-gray-300 border-l-0 rounded-r-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Mongo Query Console */}
        {activeTab === 'console' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Terminal className="w-5 h-5 mr-2 text-indigo-600" />
                  MongoDB Query Console
                </h2>
                <p className="text-xs text-gray-500">
                  Execute safe ad-hoc queries, aggregation pipelines, or counts directly on the database.
                </p>
              </div>

              {/* Preset templates */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Templates:</span>
                <button
                  type="button"
                  onClick={() => {
                    setConsoleOperation('find');
                    setConsoleQueryText('{\n  "status": "active"\n}');
                  }}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                >
                  Find Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsoleOperation('aggregate');
                    setConsoleQueryText('[\n  {\n    "$group": {\n      "_id": "$role",\n      "count": { "$sum": 1 }\n    }\n  }\n]');
                  }}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                >
                  Group Count
                </button>
              </div>
            </div>

            {/* Query Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Collection</label>
                <select
                  value={consoleCollection}
                  onChange={(e) => setConsoleCollection(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 font-mono"
                >
                  {collections.map((c) => (
                    <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Operation</label>
                <select
                  value={consoleOperation}
                  onChange={(e) => setConsoleOperation(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2"
                >
                  <option value="find">find()</option>
                  <option value="count">countDocuments()</option>
                  <option value="aggregate">aggregate() [Pipeline Array]</option>
                  <option value="distinct">distinct()</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Limit</label>
                <input
                  type="number"
                  value={consoleLimit}
                  onChange={(e) => setConsoleLimit(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2"
                  min="1"
                  max="100"
                />
              </div>
            </div>

            {/* Query JSON Editor */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {consoleOperation === 'aggregate' ? 'Aggregation Pipeline (JSON Array):' : 'Filter Query (JSON Object):'}
              </label>
              <textarea
                rows={6}
                value={consoleQueryText}
                onChange={(e) => setConsoleQueryText(e.target.value)}
                className="w-full font-mono text-xs p-3 bg-gray-900 text-green-400 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Run Button */}
            <div className="flex items-center justify-between">
              {consoleError && (
                <div className="text-xs text-red-600 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-red-500 flex-shrink-0" />
                  <span>{consoleError}</span>
                </div>
              )}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={handleExecuteConsole}
                  disabled={consoleLoading}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {consoleLoading ? (
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-1.5" />
                  )}
                  Execute Query
                </button>
              </div>
            </div>

            {/* Results Console Output */}
            {consoleResult && (
              <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-gray-900">
                <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
                  <div className="flex items-center space-x-3 text-xs text-gray-300">
                    <span className="font-semibold text-white">Execution Result</span>
                    <span>Time: <span className="text-amber-400 font-mono">{consoleResult.executionTimeMs}ms</span></span>
                    <span>Count: <span className="text-emerald-400 font-mono">{consoleResult.resultCount}</span></span>
                  </div>
                  <button
                    onClick={() => handleCopy(consoleResult.result, 'console-res')}
                    className="text-xs text-gray-400 hover:text-white flex items-center"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy Result
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-green-300 max-h-96 overflow-y-auto">
                  {JSON.stringify(consoleResult.result, null, 2)}
                </pre>
              </div>
            )}

          </div>
        )}

      </div>

      {/* MODAL 1: View Document Full Modal */}
      {viewModalDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Document Inspector</h3>
                <p className="text-xs font-mono text-gray-500">_id: {String(viewModalDoc._id)}</p>
              </div>
              <button
                onClick={() => setViewModalDoc(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 font-mono text-xs p-4 rounded-lg overflow-x-auto max-h-[480px]">
                {JSON.stringify(viewModalDoc, null, 2)}
              </pre>
              <button
                onClick={() => handleCopy(viewModalDoc, 'modal-view')}
                className="absolute top-3 right-3 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs flex items-center"
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  const doc = viewModalDoc;
                  setViewModalDoc(null);
                  handleOpenEdit(doc);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
              >
                Edit Document
              </button>
              <button
                type="button"
                onClick={() => setViewModalDoc(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Document Modal */}
      {editModalDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Document</h3>
                <p className="text-xs font-mono text-gray-500">
                  Collection: <span className="font-semibold">{selectedCollection}</span> | ID: {String(editModalDoc._id)}
                </p>
              </div>
              <button
                onClick={() => setEditModalDoc(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner if JSON invalid */}
            {editJsonError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                {editJsonError}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-700">Document JSON Payload:</span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const formatted = JSON.stringify(JSON.parse(editJsonText), null, 2);
                      setEditJsonText(formatted);
                      setEditJsonError('');
                    } catch (e) {
                      setEditJsonError(e.message);
                    }
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Beautify / Format JSON
                </button>
              </div>
              <textarea
                rows={14}
                value={editJsonText}
                onChange={(e) => {
                  setEditJsonText(e.target.value);
                  setEditJsonError('');
                }}
                className="w-full font-mono text-xs p-3 bg-gray-900 text-amber-300 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 italic">
                Note: Updating will preserve `_id` and record this change in the Audit Log.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalDoc(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Insert Document Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Insert Document</h3>
                <p className="text-xs font-mono text-gray-500">
                  Target Collection: <span className="font-semibold text-indigo-600">{selectedCollection}</span>
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {createJsonError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                {createJsonError}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-700">New Document JSON:</span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const formatted = JSON.stringify(JSON.parse(createJsonText), null, 2);
                      setCreateJsonText(formatted);
                      setCreateJsonError('');
                    } catch (e) {
                      setCreateJsonError(e.message);
                    }
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Beautify / Format JSON
                </button>
              </div>
              <textarea
                rows={14}
                value={createJsonText}
                onChange={(e) => {
                  setCreateJsonText(e.target.value);
                  setCreateJsonError('');
                }}
                className="w-full font-mono text-xs p-3 bg-gray-900 text-emerald-300 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 italic">
                A MongoDB ObjectId will be assigned automatically if `_id` is omitted.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCreate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {actionLoading ? 'Inserting...' : 'Insert to Database'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation Modal */}
      {deleteModalDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Confirm Document Deletion</h3>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete this document from collection{' '}
              <span className="font-semibold font-mono text-gray-900">{selectedCollection}</span>?
            </p>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs font-mono text-gray-700">_id: {String(deleteModalDoc._id)}</p>
            </div>

            <p className="text-xs text-red-600 font-semibold">
              Warning: This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteModalDoc(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DatabaseManager;
