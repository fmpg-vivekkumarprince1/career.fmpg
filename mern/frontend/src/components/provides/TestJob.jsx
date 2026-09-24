import React from 'react'

const TestJob = () => {
  return (
    <>
    {/* <Breadcrumb name="JobTitle"/> */}
    
    <section className="career-single pt-110 pb-180">
            <div className="container">
                <div className="section-title text-center mb-40">
                    <h3 className="title">Associate Creative Director</h3>
                </div>
                <div className="career-neta ul_li_between mb-15">
                    <span className="time mt-15">Full-time</span>
                    <div className="xb-item--holder mt-15">
                        <h4 className="xb-item--location">LOCATION</h4>
                        <p>Remote and customer location when required</p>
                    </div>
                </div>
                <div className="career-content">
                    <h2>Overview:</h2>
                    <p>We're looking for a hands-on, inspiring leader who's passionate about building, prototyping, and continually evolving digital products and experiences. You understand how to build relationships with clients and internal teams and can sense when to zoom into and out of the work to maintain quality and momentum. You're not precious about any one solution, because you know that exploration and iteration gets you to the right answer. You love to solve complex problems through design, but you're equally passionate about cultivating, guiding and inspiring your team to create a collaborative environment of experimentation and innovation.</p>
                    <h2>What You'll Do</h2>
                    <ul>
                        <li>Collaborate with other disciplines and clients to understand what a project needs at any given moment in an effort to move the work forward</li>
                        <li>Help establish the bar for design thinking and execution on your team, shipping work, creating design guidelines, and codifying best practices and processes</li>
                        <li>Fearlessly concept, iterate, prototype, and test in an effort to deliver strategic, elegant and simple design solutions</li>
                        <li>Make sense of complex systems and develop inventive solutions through distillation and experimentation</li>
                        <li>Ground the work in a deep understanding of the client and push on strategic insights to stretch creative opportunities</li>
                    </ul>
                    <h2>What You'll Bring</h2>
                    <ul>
                        <li>Demonstrated experience leading teams in shipping high impact, successful digital products, experiences & content</li>
                        <li>Proven experience managing, training and mentoring design teams, and steering work with clarity and actionable directionProven experience managing, training and mentoring design teams, and steering work with clarity and actionable direction</li>
                        <li>Experience collaborating with cross disciplinary partners and leaders</li>
                        <li>Capacity for unsticking intractable roadblocks and pushing the team toward inventive solutions</li>
                        <li>Strong verbal and visual presentation skills that get across the process, approach, and impact of your design</li>
                    </ul>
                </div>
                <div className="contact-form-inner">
                    <div className="job-apply__holder pt-50">
                        <h2>Apply for This Job</h2>
                        <p>Ovix doesn't accept unsolicited resumes from recruiters or employment agencies.</p>
                    </div>
                    <form className="contact-form pos-rel" action="#">
                        <div className="row">
                            <div className="col-lg-6">
                                <div className="xb-item--field">
                                    <label htmlFor="name">Your Name</label>
                                    <input id="name" type="text" placeholder="Gomez Golatria"/>
                                </div>
                            </div>
                            <div className="col-lg-6">
                                <div className="xb-item--field">
                                    <label htmlFor="mail">Email</label>
                                    <input id="mail" type="text" placeholder="gomez@example.com"/>
                                </div>
                            </div>
                            <div className="col-lg-6">
                                <div className="xb-item--field">
                                    <label htmlFor="number">Skype/Phone</label>
                                    <input id="number" type="text" placeholder="+91 8123 456 789"/>
                                </div>
                            </div>
                            <div className="col-lg-6">
                                <div className="xb-item--field">
                                    <label htmlFor="service">Address</label>
                                    <input id="service" type="text" placeholder="Hoshiarpur"/>
                                </div>
                            </div>
                            <div className="col-lg-12">
                                <div className="xb-item--field">
                                    <label htmlFor="salary">What is your expected salary?</label>
                                    <input id="salary" type="text" placeholder="1000"/>
                                </div>
                            </div>
                            <div className="col-lg-12">
                                <div className="xb-item--field">
                                    <label htmlFor="file">Resume/CV</label>
                                    <div className="clearfix"></div>
                                    <input id="file" type="file"/>
                                </div>
                            </div>
                            <div className="col-12">
                                <div className="xb-item--field xb-item--textarea">
                                    <label htmlFor="message">Cover Letter</label>
                                    <textarea name="message" id="message" cols="30" rows="10" placeholder="Write about work experience..."></textarea>
                                </div>
                                <button type="submit" className="circle-btn port-btn">
                                    <span className="button__bg"></span>Send
                                </button>    
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </section>

    
    </>
  )
}

export default TestJob