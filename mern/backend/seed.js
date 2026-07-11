const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user');
const Job = require('./models/job');
const Application = require('./models/application');
const Certificate = require('./models/certificate');
const OfferLetter = require('./models/offerLetter');
const Review = require('./models/review');
const Notification = require('./models/notification');
// const Recommendation = require('./models/recommendation');
const connectDB = require('./config/database');
require('dotenv').config();

// Sample data
const users = [
  {
    name: 'Admin User',
    email: 'contact@gmail.com',
    password: 'Prince1@',
    role: 'admin',
    status: 'active',
    role: "super-admin", 
    department: 'IT',
    position: 'IT Manager',
    employeeId: 'EMP001'
  },
  {
    name: 'Regular User',
    email: 'user@example.com',
    password: 'user123',
    role: 'user',
    status: 'active'
  },
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'john123',
    role: 'user',
    status: 'active',
    department: 'Development',
    position: 'Senior Developer',
    employeeId: 'EMP002'
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'jane123',
    role: 'user',
    status: 'active',
    department: 'Development',
    position: 'Backend Developer'
  },
  {
    name: 'Emily Davis',
    email: 'emily@example.com',
    password: 'emily123',
    role: 'user',
    status: 'former',
    department: 'Development',
    position: 'Frontend Developer Intern'
  }
];

const jobs = [
  {
    title: 'Frontend Developer',
    company: 'FMPG',
    description: 'We are looking for a skilled Frontend Developer to join our team. The ideal candidate should have experience with modern JavaScript frameworks and responsive design.',
    requirements: [
      'Proficient in HTML, CSS, and JavaScript',
      'Experience with React, Vue, or Angular',
      'Understanding of responsive design principles',
      'Knowledge of version control systems like Git'
    ],
    responsibilities: [
      'Develop user-facing features using modern frontend technologies',
      'Optimize applications for maximum speed and scalability',
      'Collaborate with backend developers and designers',
      'Ensure cross-browser compatibility and responsive design'
    ],
    location: 'Remote',
    type: 'Full-time',
    salary: '₹70,000 - ₹90,000',
    department: 'Development',
    position: 'Frontend Developer',
    questions: [
      {
        questionText: 'What is your experience with React?',
        questionType: 'text',
        required: true,
        order: 0
      },
      {
        questionText: 'Rate your CSS skills',
        questionType: 'rating',
        required: true,
        maxRating: 5,
        order: 1
      },
      {
        questionText: 'Which frontend frameworks have you worked with?',
        questionType: 'checkbox',
        required: false,
        options: ['React', 'Vue', 'Angular', 'Svelte'],
        order: 2
      }
    ],
    isActive: true,
    isPublished: true
  },
  {
    title: 'Backend Developer',
    company: 'FMPG',
    description: 'We are seeking a Backend Developer to design and implement server-side applications. The ideal candidate should have strong knowledge of backend technologies and databases.',
    requirements: [
      'Proficient in Node.js, Python, or Java',
      'Experience with database design and management',
      'Knowledge of RESTful API design',
      'Understanding of server security concerns'
    ],
    responsibilities: [
      'Design and implement server-side applications',
      'Develop and maintain databases',
      'Ensure high performance and responsiveness to requests',
      'Collaborate with backend developers'
    ],
    location: 'New Delhi, India',
    type: 'Full-time',
    salary: '₹80,000 - ₹100,000',
    department: 'Development',
    position: 'Backend Developer',
    questions: [
      {
        questionText: 'What backend frameworks have you worked with?',
        questionType: 'text',
        required: true,
        order: 0
      },
      {
        questionText: 'Rate your database skills',
        questionType: 'rating',
        required: true,
        maxRating: 5,
        order: 1
      }
    ],
    isActive: true,
    isPublished: true
  },
  {
    title: 'UI/UX Designer',
    company: 'FMPG',
    description: 'We are looking for a UI/UX Designer to create amazing user experiences. The ideal candidate should have a strong portfolio demonstrating their design skills.',
    requirements: [
      'Proficient in design tools like Figma, Sketch, or Adobe XD',
      'Understanding of user-centered design principles',
      'Experience with wireframing and prototyping',
      'Knowledge of accessibility standards'
    ],
    responsibilities: [
      'Create user-centered designs by understanding business requirements',
      'Develop wireframes, prototypes, and mockups',
      'Collaborate with developers to implement designs',
      'Conduct user research and testing'
    ],
    location: 'Bangalore, India',
    type: 'Full-time',
    salary: '₹65,000 - ₹85,000',
    department: 'Design',
    position: 'UI/UX Designer',
    questions: [
      {
        questionText: 'Please share a link to your portfolio',
        questionType: 'text',
        required: true,
        order: 0
      },
      {
        questionText: 'Which design tools do you use?',
        questionType: 'multipleChoice',
        required: true,
        options: ['Figma', 'Sketch', 'Adobe XD', 'Other'],
        order: 1
      }
    ],
    isActive: true,
    isPublished: true
  },
  {
    title: 'DevOps Engineer',
    company: 'FMPG',
    description: 'We are seeking a DevOps Engineer to help us automate and optimize our development and deployment processes.',
    requirements: [
      'Experience with CI/CD pipelines',
      'Knowledge of containerization (Docker, Kubernetes)',
      'Understanding of cloud platforms (AWS, Azure, GCP)',
      'Scripting skills (Bash, Python)'
    ],
    responsibilities: [
      'Implement and maintain CI/CD pipelines',
      'Manage cloud infrastructure',
      'Automate deployment processes',
      'Monitor system performance and troubleshoot issues'
    ],
    location: 'Remote',
    type: 'Contract',
    salary: '₹90,000 - ₹110,000',
    department: 'Operations',
    position: 'DevOps Engineer',
    isActive: true,
    isPublished: true
  },
  {
    title: 'Data Science Intern',
    company: 'FMPG',
    description: 'Join our data science team as an intern to gain hands-on experience with machine learning and data analysis.',
    requirements: [
      'Basic knowledge of Python and statistics',
      'Familiarity with data analysis libraries',
      'Understanding of machine learning concepts',
      'Strong analytical and problem-solving skills'
    ],
    responsibilities: [
      'Assist in data collection and preprocessing',
      'Support machine learning model development',
      'Create data visualizations and reports',
      'Learn from senior data scientists'
    ],
    location: 'Hybrid',
    type: 'Internship',
    salary: '₹1,500 - ₹2,000',
    department: 'Data Science',
    position: 'Data Science Intern',
    questions: [
      {
        questionText: 'What programming languages are you familiar with?',
        questionType: 'checkbox',
        required: true,
        options: ['Python', 'R', 'SQL', 'Java', 'JavaScript'],
        order: 0
      },
      {
        questionText: 'Rate your statistics knowledge',
        questionType: 'rating',
        required: true,
        maxRating: 5,
        order: 1
      }
    ],
    isActive: true,
    isPublished: true
  }
];

const applications = [
  {
    fullName: 'Michael Johnson',
    email: 'michael@example.com',
    phone: '123-456-7890',
    experience: 'Senior Frontend Developer at Tech Solutions (2018-2022)\nJunior Developer at WebCraft (2015-2018)',
    education: 'Bachelor of Science in Computer Science, University of Technology (2015)',
    skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Git'],
    coverLetter: 'I am excited to apply for the Frontend Developer position at FMPG. With my experience in React and responsive design, I believe I would be a great fit for your team.',
    isReferred: false,
    status: 'reviewing'
  },
  {
    fullName: 'Sarah Williams',
    email: 'sarah@example.com',
    phone: '987-654-3210',
    experience: 'Backend Developer at DataSystems (2019-2023)\nSoftware Engineer Intern at TechGiant (2018)',
    education: 'Master of Science in Software Engineering, Tech University (2019)\nBachelor of Engineering in Computer Science, State University (2017)',
    skills: ['Node.js', 'Express', 'MongoDB', 'SQL', 'Python'],
    coverLetter: 'I am applying for the Backend Developer position. My experience with Node.js and database management makes me confident that I can contribute effectively to your team.',
    isReferred: true,
    referrerEmployeeId: 'EMP002',
    referrerName: 'John Doe',
    referrerEmail: 'john@example.com',
    referralMessage: 'Sarah is an excellent backend developer who I worked with at my previous company. She has strong technical skills and would be a great addition to our team.',
    status: 'shortlisted'
  },
  {
    fullName: 'David Chen',
    email: 'david@example.com',
    phone: '555-123-4567',
    experience: 'UX Designer at Creative Agency (2020-2023)\nGraphic Designer at Design Studio (2017-2020)',
    education: 'Bachelor of Fine Arts in Graphic Design, Art Institute (2017)',
    skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping', 'User Research'],
    coverLetter: 'I am interested in the UI/UX Designer position. My portfolio demonstrates my ability to create intuitive and visually appealing user interfaces.',
    isReferred: false,
    status: 'pending'
  },
  {
    fullName: 'Alex Rodriguez',
    email: 'alex@example.com',
    phone: '444-555-6666',
    experience: 'Recent Computer Science graduate with internship experience at StartupTech (Summer 2023)',
    education: 'Bachelor of Science in Computer Science, State University (2023)',
    skills: ['Python', 'SQL', 'Pandas', 'Scikit-learn', 'Jupyter'],
    coverLetter: 'I am excited to apply for the Data Science Intern position. As a recent graduate with a strong foundation in statistics and Python, I am eager to gain hands-on experience in machine learning.',
    isReferred: false,
    status: 'offered'
  }
];

const certificates = [
  {
    name: 'Emily Davis',
    domain: 'Web Development',
    jobrole: 'Frontend Developer Intern',
    fromDate: new Date('2023-01-15'),
    toDate: new Date('2023-04-15'),
    issuedBy: 'FMPG'
  },
  {
    name: 'Ryan Wilson',
    domain: 'Mobile Development',
    jobrole: 'React Native Developer',
    fromDate: new Date('2023-02-01'),
    toDate: new Date('2023-05-01'),
    issuedBy: 'FMPG'
  },
  {
    name: 'Sophia Martinez',
    domain: 'UI/UX Design',
    jobrole: 'UI/UX Design Intern',
    fromDate: new Date('2023-03-10'),
    toDate: new Date('2023-06-10'),
    issuedBy: 'FMPG'
  }
];

const offerLetters = [
  {
    candidateName: 'Alex Rodriguez',
    email: 'alex@example.com',
    position: 'Data Science Intern',
    department: 'Data Science',
    salary: 24000, // Annual salary
    startDate: new Date('2024-07-01'),
    joiningLocation: 'Remote',
    workType: 'Remote',
    benefits: ['Health Insurance', 'Learning Allowance', 'Flexible Hours'],
    reportingManager: 'Dr. Sarah Johnson',
    companyName: 'FMPG',
    hrContactName: 'HR Team',
    hrContactEmail: 'fmpg974@gmail.com',
    hrContactPhone: '+91-9876543210',
    issuedBy: 'FMPG',
    status: 'Pending',
    validUntil: new Date('2024-06-15'),
    additionalNotes: 'This is a 6-month internship program with possibility of full-time conversion based on performance.'
  },
  {
    candidateName: 'Jane Smith',
    email: 'jane@example.com',
    position: 'Backend Developer',
    department: 'Development',
    salary: 85000,
    startDate: new Date('2024-06-15'),
    joiningLocation: 'New Delhi, India',
    workType: 'On-site',
    benefits: ['Health Insurance', 'PF', 'Paid Leave', 'Performance Bonus'],
    reportingManager: 'John Doe',
    companyName: 'FMPG',
    hrContactName: 'HR Team',
    hrContactEmail: 'fmpg974@gmail.com',
    hrContactPhone: '+91-9876543210',
    issuedBy: 'FMPG',
    status: 'Accepted',
    validUntil: new Date('2024-06-01'),
    additionalNotes: 'Welcome to our development team! We look forward to working with you.'
  }
];

const reviews = [
  {
    userEmail: 'john@example.com',
    userName: 'John Doe',
    rating: 5,
    title: 'Excellent work environment and growth opportunities',
    content: 'FMPG provides an excellent work environment with great learning opportunities. The team is supportive and management is understanding. The projects are challenging and help in skill development.',
    department: 'Development',
    position: 'Senior Developer',
    workType: 'On-site',
    employmentDuration: '2+ years',
    pros: 'Great work-life balance, supportive team, challenging projects, good compensation',
    cons: 'Sometimes project deadlines can be tight',
    advice: 'Be ready to learn new technologies and take on challenging projects',
    status: 'approved',
    reviewerType: 'employee',
    isAnonymous: false
  },
  {
    userEmail: 'emily@example.com',
    userName: 'Emily Davis',
    rating: 4,
    title: 'Great place for interns to learn and grow',
    content: 'My internship at FMPG was a wonderful experience. I learned a lot about frontend development and got hands-on experience with real projects. The mentorship program is excellent.',
    department: 'Development',
    position: 'Frontend Developer Intern',
    workType: 'Hybrid',
    employmentDuration: '3 months (Internship)',
    pros: 'Excellent mentorship, real project experience, friendly team',
    cons: 'Limited intern positions available',
    advice: 'Make the most of the mentorship program and ask questions',
    status: 'approved',
    reviewerType: 'employee',
    isAnonymous: false
  },
  {
    userEmail: 'jane@example.com',
    userName: 'Jane Smith',
    rating: 5,
    title: 'Excited to join the team!',
    content: 'I recently received an offer from FMPG and I am thrilled to join the backend development team. The interview process was smooth and professional. Looking forward to contributing to innovative projects.',
    department: 'Development',
    position: 'Backend Developer',
    workType: 'On-site',
    employmentDuration: 'Offer Recipient',
    pros: 'Professional interview process, competitive offer, exciting projects',
    cons: 'None so far',
    advice: 'Great company to work for, highly recommended',
    status: 'pending',
    reviewerType: 'offer_recipient',
    isAnonymous: false
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('🔌 Connected to database for seeding');

    // Clear existing data
    await User.deleteMany({});
    await Job.deleteMany({});
    await Application.deleteMany({});
    await Certificate.deleteMany({});
    await OfferLetter.deleteMany({});
    await Review.deleteMany({});
    await Notification.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Create users with hashed passwords
    const hashedUsers = await Promise.all(
      users.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        return { ...user, password: hashedPassword, isEmailVerified: true };
      })
    );
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`👤 Created ${createdUsers.length} users`);

    // Create jobs with admin user as poster
    const adminUser = createdUsers.find(user => user.role === 'admin' || user.role === 'super-admin');
    const jobsWithPostedBy = jobs.map(job => ({
      ...job,
      postedBy: adminUser._id
    }));
    const createdJobs = await Job.insertMany(jobsWithPostedBy);
    console.log(`💼 Created ${createdJobs.length} jobs`);

    // Create applications linked to jobs and users
    const regularUser = createdUsers.find(user => user.email === 'user@example.com');
    const applicationsWithIds = applications.map((application, index) => ({
      ...application,
      jobId: createdJobs[index % createdJobs.length]._id,
      userId: regularUser._id,
      // Add sample question answers based on the job's questions
      questionAnswers: createdJobs[index % createdJobs.length].questions?.map(question => ({
        questionId: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        answer: question.questionType === 'text' ? 'Sample answer to the question' :
               question.questionType === 'rating' ? 4 :
               question.questionType === 'multipleChoice' ? question.options[0] :
               question.questionType === 'checkbox' ? [question.options[0], question.options[1]] : ''
      })) || []
    }));
    const createdApplications = await Application.insertMany(applicationsWithIds);
    console.log(`📝 Created ${createdApplications.length} applications`);

    // Create certificates linked to users
    const certificatesWithUserId = certificates.map(certificate => ({
      ...certificate,
      userId: adminUser._id
    }));
    const createdCertificates = await Certificate.insertMany(certificatesWithUserId);
    console.log(`🏆 Created ${createdCertificates.length} certificates`);

    // Create offer letters linked to users
    const janeUser = createdUsers.find(user => user.email === 'jane@example.com');
    const alexApplication = createdApplications.find(app => app.email === 'alex@example.com');
    const offerLettersWithUserId = offerLetters.map(offer => {
      let userId = null;
      if (offer.email === 'jane@example.com') {
        userId = janeUser._id;
      } else if (offer.email === 'alex@example.com' && alexApplication) {
        userId = alexApplication.userId;
      }
      return {
        ...offer,
        userId
      };
    });
    const createdOfferLetters = await OfferLetter.insertMany(offerLettersWithUserId);
    console.log(`📋 Created ${createdOfferLetters.length} offer letters`);

    // Create reviews linked to users
    const johnUser = createdUsers.find(user => user.email === 'john@example.com');
    const emilyUser = createdUsers.find(user => user.email === 'emily@example.com');
    const reviewsWithUserId = reviews.map(review => {
      let userId = null;
      let approvedBy = null;
      let approvedAt = null;

      if (review.userEmail === 'john@example.com') {
        userId = johnUser._id;
      } else if (review.userEmail === 'emily@example.com') {
        userId = emilyUser._id;
      } else if (review.userEmail === 'jane@example.com') {
        userId = janeUser._id;
      }

      // Set approval details for approved reviews
      if (review.status === 'approved') {
        approvedBy = adminUser._id;
        approvedAt = new Date();
      }

      return {
        ...review,
        userId,
        approvedBy,
        approvedAt
      };
    });
    const createdReviews = await Review.insertMany(reviewsWithUserId);
    console.log(`⭐ Created ${createdReviews.length} reviews`);

    
    // const createdRecommendations = await Recommendation.insertMany(recommendationsWithUserId);
    // console.log(`🤝 Created ${createdRecommendations.length} recommendations`);

    console.log('✅ Database seeded successfully');
    console.log('\n📊 Summary:');
    // console.log(`   Users: ${createdUsers.length + createdAdditionalUsers.length}`);
    console.log(`   Jobs: ${createdJobs.length}`);
    console.log(`   Applications: ${createdApplications.length}`);
    console.log(`   Certificates: ${createdCertificates.length}`);
    console.log(`   Offer Letters: ${createdOfferLetters.length}`);
    console.log(`   Reviews: ${createdReviews.length}`);
    // console.log(`   Recommendations: ${createdRecommendations.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();