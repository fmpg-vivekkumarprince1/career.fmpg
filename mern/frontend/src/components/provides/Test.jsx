import React from 'react';
import { Link } from 'react-router';
 const test = () => {
   return (
    <>
    {/* <Breadcrumb name="Careers"/> */}
    

    <section className="career pt-115 pb-130">
            <div className="container pos-rel">
                <div className="section-title section-title--border pos-rel mb-40">
                    <h3 className="title"><span>CAREERS & <br/>
                        <span>VACANCIES</span></span></h3>
                    <span className="career-sec-subtitle">current openings</span>
                </div>
                <div className="career-img mb-40">
                    <img src="assets/img/career/img_01.png" alt=""/>
                </div>
                <div className="xb-career-inner">
                    <div className="xb-career ul_li_between">
                        <h3 className="xb-item--title"><a href="/test/job">Data Engineer - Machine Learning and Data Analytics</a></h3>
                        <div className="xb-item--content ul_li">
                            <span className="xb-item--price">₹40/ <span>hour</span></span>
                            <div className="xb-item--holder">
                                <h4 className="xb-item--location">LOCATION</h4>
                                <p>Remote and customer location when required</p>
                            </div>
                        </div>
                    </div>
                    <div className="xb-career ul_li_between">
                        <h3 className="xb-item--title"><a href="/test/job">ReеLead Product Designer</a></h3>
                        <div className="xb-item--content ul_li">
                            <span className="xb-item--price">₹40/ <span>hour</span></span>
                            <div className="xb-item--holder">
                                <h4 className="xb-item--location">LOCATION</h4>
                                <p>Remote and customer location when required</p>
                            </div>
                        </div>
                    </div>
                    <div className="xb-career ul_li_between">
                        <h3 className="xb-item--title"><a href="/test/job">UI/UX Designer</a></h3>
                        <div className="xb-item--content ul_li">
                            <span className="xb-item--price">₹40/ <span>hour</span></span>
                            <div className="xb-item--holder">
                                <h4 className="xb-item--location">LOCATION</h4>
                                <p>Remote and customer location when required</p>
                            </div>
                        </div>
                    </div>
                    <div className="xb-career ul_li_between">
                        <h3 className="xb-item--title"><a href="/test/job">Platform Engineer - Operations</a></h3>
                        <div className="xb-item--content ul_li">
                            <span className="xb-item--price">₹40/ <span>hour</span></span>
                            <div className="xb-item--holder">
                                <h4 className="xb-item--location">LOCATION</h4>
                                <p>Remote and customer location when required</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="career-cta ul_li_between mt-130">
                    <div className="xb-item--holder mt-30">
                        <h3 className="xb-item--title">Find Your Next Job!</h3>
                        <p className="xb-item--content">We're growing, and we're looking for passionate individuals to grow with us. If you're excited about building cutting-edge customer platforms and want to be part of a company that truly values your unique contributions, let's connect — we’d love to hear from you.</p>
                    </div>
                    <div className="xb-item--btn mt-30">
                        {/* <Link to="/contact" className="btn-link ul_li_right">Let’s Talk <span><img src={img} alt=""/></span></Link> */}
                    </div>
                </div>
                <div className="career-blur xb-blur"></div>
            </div>
        </section>



    
    </>
   )
 }
 
 export default test