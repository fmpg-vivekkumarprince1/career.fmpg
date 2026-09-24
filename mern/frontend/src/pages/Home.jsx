import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { reviewService } from '../services/api';
import { getCache, setCache } from '../utils/cache';
import HeroSection from '../components/hero/HeroSection';
import { toast } from 'react-toastify';

// Animation imports
import { motion } from 'framer-motion';

const Home = () => {
  const location = useLocation();
  const [reviews, setReviews] = useState(() => getCache('home:approved_reviews') || []);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [loading, setLoading] = useState(() => !getCache('home:approved_reviews'));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (location.state?.successMessage) {
      toast.success(location.state.successMessage);
      // Clear the state to prevent showing message on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchData = async () => {
      const cachedReviews = getCache('home:approved_reviews');
      if (cachedReviews && Array.isArray(cachedReviews) && cachedReviews.length > 0) {
        setReviews(cachedReviews);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch approved reviews
        const reviewsResponse = await reviewService.getApprovedReviews({ limit: 10 });
        const list = reviewsResponse.data.reviews || [];
        setReviews(list);
        setCache('home:approved_reviews', list, 300000); // 5 min client cache
      } catch (err) {
        console.error('Error fetching data:', err);
        const msg = 'Failed to load data';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


  // Auto-slide reviews every 6 seconds (slightly longer for better UX)
  useEffect(() => {
    if (reviews.length > 3) {
      const interval = setInterval(() => {
        setCurrentReviewIndex((prevIndex) => 
          prevIndex + 3 >= reviews.length ? 0 : prevIndex + 3
        );
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [reviews.length]);

  // Memoized handlers to prevent unnecessary re-renders
  const nextReviews = useCallback(() => {
    setCurrentReviewIndex((prevIndex) => 
      prevIndex + 3 >= reviews.length ? 0 : prevIndex + 3
    );
  }, [reviews.length]);

  const prevReviews = useCallback(() => {
    setCurrentReviewIndex((prevIndex) => {
      if (prevIndex === 0) {
        // Go to the last complete set of 3 reviews
        const lastPageStartIndex = Math.floor((reviews.length - 1) / 3) * 3;
        return lastPageStartIndex;
      }
      return prevIndex - 3;
    });
  }, [reviews.length]);

  // Memoized computed values to avoid recalculation on every render
  const displayedReviews = useMemo(() => {
    // Always ensure we show exactly 3 reviews if available
    const endIndex = Math.min(currentReviewIndex + 3, reviews.length);
    const displayedReviewsArray = reviews.slice(currentReviewIndex, endIndex);
    
    // If we have less than 3 reviews on the current page and there are more reviews available
    if (displayedReviewsArray.length < 3 && reviews.length >= 3) {
      const remaining = 3 - displayedReviewsArray.length;
      const additionalReviews = reviews.slice(0, remaining);
      return [...displayedReviewsArray, ...additionalReviews];
    }
    
    return displayedReviewsArray;
  }, [reviews, currentReviewIndex]);

  const totalPages = useMemo(() => {
    return Math.ceil(reviews.length / 3);
  }, [reviews.length]);

  const currentPage = useMemo(() => {
    return Math.floor(currentReviewIndex / 3);
  }, [currentReviewIndex]);

  return (
    <div className="overflow-hidden bg-white text-slate-900">
      <Helmet>
        <title>Careers at FMPG | Join Our Team & Grow Your Career</title>
        <meta name="description" content="Join FMPG! Discover exciting career opportunities, property management roles, and professional growth with comprehensive perks and benefits." />
        <link rel="canonical" href="https://fmpg.vercel.app/index" />
      </Helmet>

      {/* Hero Section */}
      <HeroSection />

      {/* Welcome Section - Inspired by Moris Media */}
      <section id="life-at-fmpg" className="fmpg-section relative py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute top-20 -right-20 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Content */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-6">
                <span className="fmpg-kicker">Create, build & grow</span>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight">
                Welcome to <span className="fmpg-accent-text">FMPG</span>
              </h2>
              <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
                <p>
                  FMPG is your premier choice for hassle-free and comfortable living! We pride 
                  ourselves on creating a home away from home, offering a perfect blend of 
                  convenience, security, and community.
                </p>
                <p>
                  We help students, working professionals, and travelers find the perfect 
                  living space that matches their needs. We believe in creating environments 
                  where comfort meets convenience and every stay feels like home.
                </p>
                <p>
                  We cherish creativity, innovation, communication, uniqueness, openness, 
                  hard work, and passion amongst our team members to deliver exceptional living experiences.
                </p>
              </div>
            </motion.div>

            {/* Enhanced Image */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative fmpg-image-frame p-3">
                <div className="absolute -bottom-5 -left-5 right-10 top-10 bg-emerald-100 rounded-3xl transform rotate-2"></div>
                <img
                  src="/images/s_image_text.svg"
                  alt="Career professional"
                  className="relative z-10 w-full rounded-[1.4rem]"
                />
                <div className="absolute -top-6 -right-6 w-16 h-16 bg-lime-500/30 rounded-full blur-xl"></div>
                <div className="absolute bottom-10 -left-8 w-20 h-20 bg-green-500/20 rounded-full blur-xl"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Work From Home Section */}
      <section className="fmpg-section-muted relative py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute bottom-40 -left-20 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            {/* Content */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                Work from home <span className="fmpg-accent-text">confidently</span>. 
                <br />Let your talent shine from <span className="fmpg-accent-text">anywhere</span>.
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Start your journey with FMPG. We believe that professional excellence can be 
                achieved through dedication and a supportive work environment. Whether you're 
                managing properties or improving our services, we provide the tools you 
                need to shine.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  "Flexible working hours",
                  "Remote-first culture",
                  "Digital collaboration tools",
                  "Work-life balance"
                ].map((item, index) => (
                  <motion.div 
                    key={index} 
                    className="flex items-center"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + (index * 0.1) }}
                    viewport={{ once: true }}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 mr-3 flex-shrink-0 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-slate-700 font-semibold">{item}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Image Placeholder */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <div className="fmpg-image-frame p-3">
                  <div className="flex items-center justify-center h-full">
                  <img src='/images/welcome.jpg' alt="Work from home" className="h-full rounded-[1.4rem] z-0" />
                    {/* <div className="text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-lime-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21l4-4 4 4" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">Remote Work</h3>
                      <p className="text-gray-400">Work from anywhere in the world</p>
                    </div> */}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      
      {/* How It Works Section */}
      <section className="fmpg-section py-20 lg:py-28 relative overflow-hidden">
        {/* Enhanced background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute -top-40 right-0 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl"
            animate={{ 
              y: [0, -10, 0], 
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 7,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
          <motion.div 
            className="absolute -bottom-20 left-20 w-80 h-80 bg-emerald-50 rounded-full blur-3xl"
            animate={{ 
              y: [0, 15, 0], 
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              How it <span className="fmpg-accent-text">works</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our streamlined process makes job hunting and application tracking simple and efficient
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {[
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
                title: "Find Jobs",
                description: "Browse through thousands of job listings filtered to match your skills and preferences."
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                title: "Easy Apply",
                description: "Submit your application with just a few clicks using our streamlined application process."
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
                title: "Track Progress",
                description: "Monitor all your job applications in one place with real-time status updates."
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                className="fmpg-card group relative overflow-hidden p-8"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                {/* Enhanced visual elements */}
                <div className="absolute -right-8 -top-8 w-28 h-28 bg-emerald-100/70 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-emerald-50 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                
                {/* Enhanced icon */}
                <div className="relative w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 mb-7 transition-all duration-300 transform group-hover:scale-105">
                  <div className="flex items-center justify-center">
                    <div className="text-emerald-700">
                      {step.icon}
                    </div>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-emerald-700 transition-colors">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
                
                <div className="mt-6 pt-4">
                  {/* <div className="w-8 h-8 rounded-full bg-gray-800 group-hover:bg-lime-500/20 flex items-center justify-center transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-lime-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div> */}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Company Policies Section */}
      <section className="fmpg-section-muted relative py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute top-20 -left-20 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Content */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-6">
                <span className="fmpg-kicker">Principles that guide us</span>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight">
                Company <span className="fmpg-accent-text">policies</span>
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                We have a direct and well-encompassing company policy that establishes the right 
                expectations for our workforce and provides guidance on handling workplace 
                situations.
              </p>
              <Link 
                to="https://fmpg.vercel.app/" 
                className="fmpg-primary-button inline-flex items-center px-7 py-3.5 transition-all"
              >
                VISIT FMPG
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </motion.div>

            {/* Image */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <div className="">
                  <div className="flex items-center justify-center">
                  <div className="fmpg-image-frame p-3"><img src='/images/policies.jpg' alt="Company Policies" className="h-full rounded-[1.4rem] z-0" /></div>
                    {/* <div className="text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-lime-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">Company Policies</h3>
                      <p className="text-gray-400">Clear guidelines for workplace excellence</p>
                    </div> */}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      
      {/* Perks and Benefits Section */}
      <section className="fmpg-section relative py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute -top-20 right-20 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl"
            animate={{ 
              y: [0, -20, 0], 
              scale: [1, 1.05, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6">
              <span className="fmpg-kicker">Why people choose us</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Perks and <span className="fmpg-accent-text">benefits</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              We believe happy employees create a healthy company, which means that certain 
              'perks' are just part of our cultural model.
            </p>
            
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
                title: "Casual and Virtual Office Space",
                description: "Work from our flexible office spaces throughout the globe"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                ),
                title: "Family-Oriented Culture",
                description: "Nurturing creativity and versatility in a supportive environment"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a1.5 1.5 0 011.5 1.5M9 10a.75.75 0 000 1.5H10M9 10v6a2 2 0 002 2h2a2 2 0 002-2v-6" />
                  </svg>
                ),
                title: "Happy Hours & Team Events",
                description: "Team volunteering opportunities and local community events"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: "Comprehensive Growth Benefits",
                description: "Get hardware, software, and guidance you need to excel in your role"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: "Collaborative Environment",
                description: "Join our profitable and growing company with a flat organizational structure"
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                ),
                title: "Learn, Grow and Excel",
                description: "Partner with us to learn, grow, and excel in your career journey"
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                className="fmpg-card group relative overflow-hidden p-5 sm:p-7 lg:p-8"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="relative text-center">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 mb-5 mx-auto transition-all duration-300 transform group-hover:scale-105">
                    <div className="text-emerald-700">
                      {benefit.icon}
                    </div>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 md:mb-3 group-hover:text-emerald-700 transition-colors leading-tight">{benefit.title}</h3>
                  <p className="text-sm md:text-base text-slate-600 leading-relaxed">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Have We Got You Excited Section */}
      <section className="fmpg-section-muted relative py-20 lg:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute bottom-40 -left-20 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ 
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          ></motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Content */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight">
                Ready to build something <span className="fmpg-accent-text">meaningful?</span>
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                The right person for our company is more than just an asset. Connect with us if 
                you believe that you have the skills we are looking for.
              </p>
              <Link 
                to="/jobs" 
                className="fmpg-primary-button inline-flex items-center px-7 py-3.5 transition-all"
              >
                APPLY NOW
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </motion.div>

            {/* Image */}
            <motion.div 
              className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <div className="fmpg-image-frame p-3">
                  <div className="flex items-center justify-center">
                  <img src='/images/excieted.jpg' alt="Excited to join FMPG" className="h-full rounded-[1.4rem] z-0" />
                    {/* <div className="text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-lime-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">Grow Together</h3>
                      <p className="text-gray-400">Join our growing team of professionals</p>
                    </div> */}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      
      {/* Reviews/Testimonials Section */}
      <section className="fmpg-section py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              Employee <span className="fmpg-accent-text">reviews</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Hear from our employees and team members about their experience working with us
            </p>
          </motion.div>

          {reviews.length > 0 ? (
            <div className="relative max-w-6xl mx-auto">
              {/* Navigation Arrows */}
              {reviews.length > 3 && (
                <>
                  <button
                    onClick={prevReviews}
                    aria-label="Previous reviews"
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 bg-lime-500 hover:bg-lime-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 group hover:scale-110 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextReviews}
                    aria-label="Next reviews"
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 bg-lime-500 hover:bg-lime-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 group hover:scale-110 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Reviews Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {displayedReviews.map((review, index) => (
                  <motion.div
                    key={`${review._id}-${currentReviewIndex}`}
                    className="fmpg-card p-6 md:p-8 h-full flex flex-col"
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.95 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    {/* Quote symbol */}
                    <div className="text-emerald-600 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16" className="md:w-9 md:h-9">
                        <path d="M12 12a1 1 0 0 0 1-1V8.558a1 1 0 0 0-1-1h-1.388c0-.351.021-.703.062-1.054.062-.372.166-.703.31-.992.145-.29.331-.517.559-.683.227-.186.516-.279.868-.279V3c-.579 0-1.085.124-1.52.372a3.322 3.322 0 0 0-1.085.992 4.92 4.92 0 0 0-.62 1.458A7.712 7.712 0 0 0 9 7.558V11a1 1 0 0 0 1 1h2Zm-6 0a1 1 0 0 0 1-1V8.558a1 1 0 0 0-1-1H4.612c0-.351.021-.703.062-1.054.062-.372.166-.703.31-.992.145-.29.331-.517.559-.683.227-.186.516-.279.868-.279V3c-.579 0-1.085.124-1.52.372a3.322 3.322 0 0 0-1.085.992 4.92 4.92 0 0 0-.62 1.458A7.712 7.712 0 0 0 3 7.558V11a1 1 0 0 0 1 1h2Z" />
                      </svg>
                    </div>

                    <div className="flex-grow">
                      {/* Star rating */}
                      <div className="flex mb-4" role="img" aria-label={`${review.rating} out of 5 stars`}>
                        {[...Array(5)].map((_, i) => (
                          <svg 
                            key={i} 
                            className={`w-5 h-5 ${i < review.rating ? 'text-amber-500' : 'text-slate-300'}`} 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
                          </svg>
                        ))}
                        <span className="ml-2 text-sm text-gray-400">({review.rating}/5)</span>
                      </div>

                      {/* Review Title */}
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 line-clamp-2">{review.title}</h3>

                      {/* Review Content */}
                      <p className="text-slate-600 mb-4 italic line-clamp-4">“{review.content}”</p>
                      
                      {/* Pros if available */}
                      {review.pros && (
                        <div className="mb-4">
                          <p className="text-sm text-emerald-700 font-semibold mb-1">Pros</p>
                          <p className="text-sm text-gray-400 line-clamp-2">{review.pros}</p>
                        </div>
                      )}

                      {/* Cons if available */}
                      {review.cons && (
                        <div className="mb-4">
                          <p className="text-sm text-rose-700 font-semibold mb-1">Considerations</p>
                          <p className="text-sm text-gray-400 line-clamp-2">{review.cons}</p>
                        </div>
                      )}
                    </div>

                    {/* Author Info */}
                    <div className="flex items-center border-t border-slate-200 pt-4 mt-auto">
                      <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mr-4 text-xl font-bold text-white flex-shrink-0">
                        {review.isAnonymous ? 'A' : review.userName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 truncate">
                          {review.isAnonymous ? 'Anonymous Employee' : review.userName}
                        </h4>
                        <p className="text-sm text-gray-400 truncate">
                          {review.position && review.department 
                            ? `${review.position}, ${review.department}`
                            : review.position || review.department || 'Employee'
                          }
                        </p>
                        {review.workType && (
                          <p className="text-xs text-gray-500">{review.workType}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Review Counter */}
              {reviews.length > 3 && (
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-400">
                    Showing {Math.min(3, reviews.length)} of {reviews.length} reviews
                  </p>
                </div>
              )}

              {/* Pagination Dots */}
              {reviews.length > 3 && (
                <div className="flex justify-center mt-8 space-x-2">
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentReviewIndex(index * 3)}
                      aria-label={`Go to page ${index + 1}`}
                      className={`w-3 h-3 rounded-full transition-all duration-300 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-lime-400 ${
                        currentPage === index
                          ? 'bg-lime-500 scale-125'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Fallback content when no reviews are available
            <div className="text-center py-12">
              <div className="fmpg-card p-12 max-w-2xl mx-auto">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10 0v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8m10 0H7m5 5v3m0 0h-3m3 0h3" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No reviews yet</h3>
                <p className="text-gray-400">
                  Be the first to share your experience working with us!
                </p>
                <Link 
                  to="/reviews/submit" 
                  className="fmpg-primary-button inline-flex items-center mt-5 px-6 py-3 transition-colors duration-300"
                >
                  Submit Review
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;