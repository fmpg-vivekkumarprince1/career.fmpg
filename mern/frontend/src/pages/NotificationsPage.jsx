import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/common/Loader';
import JobUpdateNotificationCard from '../components/notifications/JobUpdateNotificationCard';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    unreadCount: 0
  });
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [filter, pagination.page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      
      if (filter === 'unread') {
        params.unreadOnly = 'true';
      }

      const response = await notificationService.getUserNotifications(params);
      setNotifications(response.data.notifications);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages,
        unreadCount: response.data.pagination.unreadCount
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      const msg = 'Failed to load notifications';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await notificationService.markAsRead(notification._id);
        setNotifications(prev => 
          prev.map(n => 
            n._id === notification._id 
              ? { ...n, isRead: true }
              : n
          )
        );
        setPagination(prev => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
      }

      // Navigate to related content
      if (notification.relatedJobId) {
        const relatedJob = notification.relatedJobId;
        const jobIdentifier = relatedJob?.slug || relatedJob?._id || relatedJob;
        navigate(`/apply/${jobIdentifier}`);
      } else if (notification.relatedApplicationId) {
        const relatedApplication = notification.relatedApplicationId;
        const applicationIdentifier = relatedApplication?.slug || relatedApplication?._id || relatedApplication;
        navigate(`/applications/${applicationIdentifier}`);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true }))
      );
      setPagination(prev => ({
        ...prev,
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this notification?')) {
      try {
        await notificationService.deleteNotification(notificationId);
        setNotifications(prev => 
          prev.filter(n => n._id !== notificationId)
        );
        toast.success('Notification deleted');
      } catch (error) {
        console.error('Error deleting notification:', error);
        toast.error('Failed to delete notification');
      }
    }
  };

  const getNotificationIcon = (type, priority = 'medium') => {
    const baseClasses = "w-10 h-10 rounded-full flex items-center justify-center";
    
    switch (type) {
      case 'job_update':
        const bgColor = priority === 'high' ? 'bg-orange-100' : 'bg-blue-100';
        const iconColor = priority === 'high' ? 'text-orange-600' : 'text-blue-600';
        return (
          <div className={`${baseClasses} ${bgColor}`}>
            <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8zM12 14l9-5-9-5-9 5 9 5z" />
            </svg>
          </div>
        );
      case 'application_status':
        return (
          <div className={`${baseClasses} bg-green-100`}>
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${baseClasses} bg-gray-100`}>
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">High Priority</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Medium</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Low</span>;
      default:
        return null;
    }
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Please log in to view your notifications.</p>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="ui-page-header flex items-start justify-between gap-4">
        <div>
          <span className="fmpg-kicker">Activity centre</span>
          <h1 className="ui-page-title mt-3">Notifications</h1>
          <p className="ui-page-subtitle">Stay updated with changes to your applications and account.</p>
        </div>
        {pagination.unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="fmpg-secondary-button px-4 py-2 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({pagination.total})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-md transition-colors ${
            filter === 'unread'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Unread ({pagination.unreadCount})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 rounded-md transition-colors ${
            filter === 'read'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Read
        </button>
      </div>

      {/* Notifications List */}
      {loading ? <Loader text="Loading notifications…" /> : error ? (
        <div className="bg-red-900/30 border border-red-500 text-red-400 px-6 py-4 rounded-md">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="ui-card ui-empty">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-5 5v-5zM10.07 2.82a3 3 0 014.24 0l1.41 1.41a3 3 0 010 4.24l-7.07 7.07a3 3 0 01-4.24 0L2.82 14.13a3 3 0 010-4.24l7.25-7.07z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No notifications found</h3>
          <p className="text-gray-400">
            {filter === 'unread' 
              ? "You're all caught up! No unread notifications."
              : "You'll see updates about your job applications here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification._id}>
              {notification.type === 'job_update' ? (
                <JobUpdateNotificationCard
                  notification={notification}
                  onMarkAsRead={async (notificationId) => {
                    try {
                      await notificationService.markAsRead(notificationId);
                      setNotifications(prev => 
                        prev.map(n => 
                          n._id === notificationId 
                            ? { ...n, isRead: true }
                            : n
                        )
                      );
                      setPagination(prev => ({
                        ...prev,
                        unreadCount: Math.max(0, prev.unreadCount - 1)
                      }));
                    } catch (error) {
                      console.error('Error marking notification as read:', error);
                    }
                  }}
                  onDismiss={(notificationId) => handleDeleteNotification(notificationId, { stopPropagation: () => {} })}
                />
              ) : (
                // Default notification card for other types
                <div
                  onClick={() => handleNotificationClick(notification)}
                  className={`ui-card p-6 cursor-pointer transition-colors border-l-4 ${
                    !notification.isRead 
                      ? notification.priority === 'high'
                        ? 'border-l-orange-500'
                        : 'border-l-emerald-500'
                      : 'border-l-slate-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {getNotificationIcon(notification.type, notification.priority)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-semibold ${
                          !notification.isRead ? 'text-white' : 'text-gray-300'
                        }`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center space-x-3">
                          {getPriorityBadge(notification.priority)}
                          {!notification.isRead && (
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-400 mb-3 leading-relaxed">
                        {notification.message}
                      </p>
                      
                      {notification.relatedJobId && (
                        <div className="mb-3">
                          <span className="inline-flex items-center px-3 py-1 text-sm bg-blue-900/50 text-blue-300 rounded-full">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8zM12 14l9-5-9-5-9 5 9 5z" />
                            </svg>
                            {notification.relatedJobId.title || 'View Job'}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                        <button
                          onClick={(e) => handleDeleteNotification(notification._id, e)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                          title="Delete notification"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center mt-8 space-x-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-3 py-2 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-300">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-2 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
    </div>
  );
};

export default NotificationsPage;
