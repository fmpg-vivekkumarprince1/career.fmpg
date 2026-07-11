import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { applicationService, jobService, certificateService } from '../services/api';
import DashboardStat from '../components/dashboard/DashboardStat';
import StatusDistribution from '../components/dashboard/StatusDistribution';
import TopJobs from '../components/dashboard/TopJobs';
import RecentApplicationsTable from '../components/dashboard/RecentApplicationsTable';

import Loader from '../components/common/Loader';

const ApplicationsDashboard = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({
    totalApplications: 0,
    recentApplications: 0,
    statusCounts: {},
    jobCounts: {},
    conversionRate: 0,
    timeToHire: 0,
    certificatesIssued: 0,
    offersGenerated: 0
  });
  const [dateRange, setDateRange] = useState('all');
  
  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        applicationService.getDashboardStats(dateRange),
        jobService.getAllJobs()
      ]);
      
      const statsData = statsRes.data;
      setJobs(jobsRes.data);
      setApplications(statsData.recentApplicationsList || []);
      
      setStats({
        totalApplications: statsData.totalApplications || 0,
        recentApplications: statsData.recentApplications || 0,
        statusCounts: statsData.statusCounts || {},
        jobCounts: statsData.jobCounts || {},
        conversionRate: statsData.conversionRate || 0,
        timeToHire: statsData.timeToHire || 0,
        activeJobs: statsData.activeJobs || 0,
        certificatesIssued: statsData.certificatesIssued || 0,
        offersGenerated: statsData.offersGenerated || 0
      });

    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Error loading dashboard data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      reviewing: 'Reviewing',
      shortlisted: 'Shortlisted',
      rejected: 'Rejected',
      offered: 'Offered',
      hired: 'Hired'
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getJobById = (jobId) => {
    if (jobId && typeof jobId === 'object' && jobId.title) {
      return jobId;
    }

    const job = jobs.find(job => job._id === jobId);
    
    return job || { title: 'Unknown Job', company: 'Unknown Company' };
  };

  const scrollToRecentApplications = () => {
    const element = document.getElementById('recent-applications-section');
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  if (loading) {
    return <Loader fullPage={true} />;
  }

  const icons = {
    applications: (
      <svg className="h-8 w-8 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    conversion: (
      <svg className="h-8 w-8 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    timeToHire: (
      <svg className="h-8 w-8 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activeJobs: (
      <svg className="h-8 w-8 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    certificate: (
      <svg className="h-8 w-8 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    offerLetter: (
      <svg className="h-8 w-8 mr-3 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    )
  };

  return (
    <div className="ui-page">
      <div className="ui-content">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-8">
          <div>
            <span className="fmpg-kicker">Recruitment overview</span>
            <h1 className="ui-page-title mt-3">Dashboard</h1>
            <p className="ui-page-subtitle">Monitor applications, active roles, offers, and certificates.</p>
          </div>
        </div>
        
        {error && (
          <div className="border-l-4 border-red-500 text-red-400 p-4 mb-6 rounded-md shadow-sm bg-gray-900">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <DashboardStat
            title="Total Applications"
            value={stats.totalApplications}
            subtitle={`${stats.recentApplications} new in last 24h`}
            icon={icons.applications}
            gradientFrom="blue-800"
            gradientTo="blue-900"
            borderColor="blue-700"
            onScroll={scrollToRecentApplications}
          />
          
          <DashboardStat
            title="Issued Certificates"
            value={stats.certificatesIssued}
            subtitle="Total certificates issued"
            icon={icons.certificate}
            gradientFrom="purple-800"
            gradientTo="purple-900"
            borderColor="purple-700"
            redirectTo="/certificates"
          />
          
          <DashboardStat
            title="Offer Letters"
            value={stats.offersGenerated}
            subtitle="Total offer letters generated"
            icon={icons.offerLetter}
            gradientFrom="pink-800"
            gradientTo="pink-900"
            borderColor="pink-700"
            redirectTo="/certificates?tab=alloffers"
          />
          
          <DashboardStat
            title="Active Jobs"
            value={jobs.filter(job => job.isActive).length}
            subtitle={`Of ${jobs.length} total jobs`}
            icon={icons.activeJobs}
            gradientFrom="amber-700"
            gradientTo="amber-900"
            borderColor="amber-600"
            redirectTo="/jobs"
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <StatusDistribution
            statusCounts={stats.statusCounts}
            getStatusLabel={getStatusLabel}
          />
          
          <TopJobs
            jobCounts={stats.jobCounts}
            getJobById={getJobById}
          />
        </div>
        
        <div id="recent-applications-section">
          <RecentApplicationsTable
            applications={applications}
            getJobById={getJobById}
            getStatusLabel={getStatusLabel}
            initialShowAll={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ApplicationsDashboard;